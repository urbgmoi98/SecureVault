const request = require('supertest');
const mockNotes = [];
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  debug: jest.fn()
};
const mockAccounts = {
  'user-a@example.com': {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'User A',
    role: 'user'
  },
  'user-b@example.com': {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'User B',
    role: 'user'
  }
};
const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(async (email) => {
    const account = mockAccounts[email.toLowerCase()];
    if (!account) throw new Error('INVALID_CREDENTIALS');
    return account;
  }),
  getCurrentUser: jest.fn()
};

jest.mock('../config/env', () => ({
  NODE_ENV: 'test',
  TRUST_PROXY: 0,
  ALLOWED_ORIGIN: 'http://localhost',
  SESSION_SECRET: 'test-session-secret-with-more-than-thirty-two-characters',
  MAX_NOTE_SIZE_BYTES: 10240,
  ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
  ENCRYPTION_KEY_VERSION: 'test'
}));

jest.mock('../config/db', () => {
  const matches = (row, criteria) => Object.entries(criteria || {}).every(
    ([key, value]) => row[key] === value
  );

  const knex = (table) => {
    const query = {
      table,
      criteria: {},
      where(criteria) {
        Object.assign(this.criteria, criteria);
        return this;
      },
      select() {
        return this;
      },
      orderBy() {
        return this;
      },
      first() {
        return Promise.resolve(mockNotes.find((row) => matches(row, this.criteria)));
      },
      insert(values) {
        this.insertValues = values;
        return this;
      },
      update(values) {
        this.updateValues = values;
        return this;
      },
      returning() {
        if (this.insertValues) {
          const row = {
            ...this.insertValues,
            created_at: new Date(),
            updated_at: new Date()
          };
          mockNotes.push(row);
          return Promise.resolve([row]);
        }

        const rows = mockNotes.filter((row) => matches(row, this.criteria));
        if (this.updateValues) rows.forEach((row) => Object.assign(row, this.updateValues));
        return Promise.resolve(rows);
      },
      delete() {
        const matchingRows = mockNotes.filter((row) => matches(row, this.criteria));
        for (const row of matchingRows) mockNotes.splice(mockNotes.indexOf(row), 1);
        return Promise.resolve(matchingRows.length);
      },
      then(resolve, reject) {
        return Promise.resolve(mockNotes.filter((row) => matches(row, this.criteria))).then(resolve, reject);
      }
    };

    return query;
  };

  knex.fn = { now: () => new Date() };
  return knex;
});

jest.mock('../services/authService', () => mockAuthService);
jest.mock('../services/auditService', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/logger', () => mockLogger);

jest.mock('../middlewares/sessions', () => {
  const session = require('express-session');
  return session({
    name: 'SecureVault',
    secret: 'test-session-secret-with-more-than-thirty-two-characters',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: 'lax', path: '/' }
  });
});

jest.mock('pino-http', () => () => (req, res, next) => {
  req.id = 'test-request-id';
  next();
});

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../crypto/token', () => ({
  generateToken: () => 'test-csrf-token',
  hashToken: (token) => `hash:${token}`,
  safeCompare: (left, right) => left === right
}));

const app = require('../app');

async function loginAs(email) {
  const agent = request.agent(app);
  const csrfResponse = await agent.get('/api/auth/csrf');
  const loginResponse = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrfResponse.body.csrfToken)
    .send({ email, password: 'Test-Passphrase-123' });

  expect(loginResponse.status).toBe(200);
  return { agent, csrfToken: loginResponse.body.csrfToken };
}

beforeEach(() => {
  mockNotes.splice(0, mockNotes.length);
});

describe('notes authorization and IDOR protection', () => {
  test('requires an authenticated session to access notes', async () => {
    const response = await request(app).get('/api/notes');
    expect(response.status).toBe(401);
  });

  test('prevents another user from reading, editing, or deleting a note', async () => {
    const userA = await loginAs('user-a@example.com');
    const userB = await loginAs('user-b@example.com');
    const created = await userA.agent
      .post('/api/notes')
      .set('x-csrf-token', userA.csrfToken)
      .send({ title: 'Private note', body: 'Only user A may read this.' });

    expect(created.status).toBe(201);
    const noteId = created.body.id;

    const readAttempt = await userB.agent.get(`/api/notes/${noteId}`);
    const editAttempt = await userB.agent
      .put(`/api/notes/${noteId}`)
      .set('x-csrf-token', userB.csrfToken)
      .send({ title: 'Changed', body: 'Unauthorized modification' });
    const deleteAttempt = await userB.agent
      .delete(`/api/notes/${noteId}`)
      .set('x-csrf-token', userB.csrfToken);

    expect(readAttempt.status).toBe(404);
    expect(editAttempt.status).toBe(404);
    expect(deleteAttempt.status).toBe(404);
    expect(readAttempt.body.message).toBe('Nota no encontrada');

    const ownerRead = await userA.agent.get(`/api/notes/${noteId}`);
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body.body).toBe('Only user A may read this.');
  });
});
