const request = require('supertest');
const mockUsers = [];
const mockAuditLog = jest.fn().mockResolvedValue(undefined);
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  debug: jest.fn()
};

jest.mock('../config/env', () => ({
  NODE_ENV: 'test',
  TRUST_PROXY: 0,
  ALLOWED_ORIGIN: 'http://localhost',
  SESSION_SECRET: 'test-session-secret-with-more-than-thirty-two-characters',
  MAX_NOTE_SIZE_BYTES: 10240,
  ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  ENCRYPTION_KEY_VERSION: 'test'
}));

jest.mock('../config/db', () => (table) => ({
  where(criteria) {
    this.criteria = criteria;
    return this;
  },
  first() {
    return Promise.resolve(mockUsers.find((user) => Object.entries(this.criteria || {}).every(
      ([key, value]) => user[key] === value
    )));
  },
  insert(values) {
    if (mockUsers.some((user) => user.email === values.email)) {
      const error = new Error('duplicate user');
      error.code = '23505';
      throw error;
    }
    mockUsers.push({
      id: `test-user-${mockUsers.length + 1}`,
      failed_attempts: 0,
      locked_until: null,
      ...values
    });
    return Promise.resolve();
  },
  update(values) {
    const matches = mockUsers.filter((user) => Object.entries(this.criteria || {}).every(
      ([key, value]) => user[key] === value
    ));
    matches.forEach((user) => Object.assign(user, values));
    return Promise.resolve(matches.length);
  }
}));

jest.mock('../crypto/password', () => ({
  hashPassword: jest.fn(async (password) => `test-hash:${password}`),
  verifyPassword: jest.fn(async (password, hash) => hash === `test-hash:${password}`)
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(false)
}));

jest.mock('../services/auditService', () => ({
  logEvent: mockAuditLog
}));

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

async function createAgentWithCsrf() {
  const agent = request.agent(app);
  const response = await agent.get('/api/auth/csrf');
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken };
}

beforeEach(() => {
  mockUsers.splice(0, mockUsers.length);
  mockAuditLog.mockClear();
});

describe('authentication security', () => {
  test('rejects passwords shorter than 12 characters', async () => {
    const { agent, csrfToken } = await createAgentWithCsrf();

    const response = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'weak@example.com', name: 'Weak User', password: 'short-pass' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(mockUsers).toHaveLength(0);
  });

  test('rejects passwords that exceed the bcrypt UTF-8 byte limit', async () => {
    const { agent, csrfToken } = await createAgentWithCsrf();

    const response = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'unicode@example.com',
        name: 'Unicode User',
        password: 'é'.repeat(37)
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(mockUsers).toHaveLength(0);
  });

  test('rejects a role injection and creates valid registrations as user', async () => {
    const { agent, csrfToken } = await createAgentWithCsrf();

    const injectedRole = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'admin-injection@example.com',
        name: 'Injected User',
        password: 'Strong-Test-Passphrase-1',
        role: 'admin'
      });

    expect(injectedRole.status).toBe(400);
    expect(mockUsers).toHaveLength(0);

    const registration = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'ordinary@example.com',
        name: 'Ordinary User',
        password: 'Strong-Test-Passphrase-2'
      });

    expect(registration.status).toBe(201);
    expect(mockUsers).toHaveLength(1);
    expect(mockUsers[0].role).toBe('user');
  });

  test('returns the same generic 401 message for an unknown user and a wrong password', async () => {
    mockUsers.push({
      id: '10000000-0000-4000-8000-000000000001',
      email: 'known@example.com',
      name: 'Known User',
      password_hash: 'test-hash:Correct-Passphrase-1',
      role: 'user',
      failed_attempts: 0,
      locked_until: null
    });

    const { agent, csrfToken } = await createAgentWithCsrf();
    const unknownUser = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'missing@example.com', password: 'Wrong-Passphrase-1' });
    const wrongPassword = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'known@example.com', password: 'Wrong-Passphrase-1' });

    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.body.message).toBe(wrongPassword.body.message);
  });

  test('blocks login with 429 on the fifth consecutive failed password attempt', async () => {
    mockUsers.push({
      id: '10000000-0000-4000-8000-000000000002',
      email: 'locked@example.com',
      name: 'Locked User',
      password_hash: 'test-hash:Correct-Passphrase-2',
      role: 'user',
      failed_attempts: 0,
      locked_until: null
    });

    const { agent, csrfToken } = await createAgentWithCsrf();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await agent
        .post('/api/auth/login')
        .set('x-csrf-token', csrfToken)
        .send({ email: 'locked@example.com', password: 'Wrong-Passphrase-2' });
      expect(response.status).toBe(401);
    }

    const fifthAttempt = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'locked@example.com', password: 'Wrong-Passphrase-2' });

    expect(fifthAttempt.status).toBe(429);
    expect(fifthAttempt.body.code).toBe('TOO_MANY_REQUESTS');
  });
});
