const express = require('express');
const request = require('supertest');
const mockRaw = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('../config/db', () => ({
  raw: (...args) => mockRaw(...args)
}));

jest.mock('../utils/logger', () => ({
  error: (...args) => mockLoggerError(...args)
}));

const healthRoutes = require('../routes/healthRoutes');
const app = express();
app.use('/api/health', healthRoutes);

beforeEach(() => {
  mockRaw.mockReset();
  mockLoggerError.mockReset();
});

describe('database health check', () => {
  test('reports the database as connected after a successful query', async () => {
    mockRaw.mockResolvedValue([{ connected: 1 }]);

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
    expect(mockRaw).toHaveBeenCalledWith('select 1');
  });

  test('reports unavailable and logs the error when the query fails', async () => {
    mockRaw.mockRejectedValue(new Error('connection failed'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', database: 'unavailable' });
    expect(mockLoggerError).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: 'connection failed' }) },
      'Database health check failed'
    );
  });
});
