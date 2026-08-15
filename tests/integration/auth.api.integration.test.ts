import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { QueryResult } from 'pg';
import app from '../../src/app';
import pool from '../../src/config/database';

describe('Better Auth Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    const mockQuery = async (queryInput: unknown, values?: unknown[]) => {
      const queryStr = typeof queryInput === 'string' ? queryInput : (queryInput as { text?: string })?.text || '';
      const params = values || (queryInput as { values?: unknown[] })?.values || [];

      if (queryStr.includes('INSERT INTO "user"') || queryStr.includes('insert into "user"')) {
        const email = params[1] || 'test@example.com';
        const name = params[2] || 'Test User';
        return {
          rows: [
            {
              id: 'user-id-1',
              email,
              name,
              emailVerified: false,
              image: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          rowCount: 1,
        } as unknown as QueryResult;
      }

      if (queryStr.includes('INSERT INTO "account"') || queryStr.includes('insert into "account"')) {
        return {
          rows: [
            {
              id: 'account-id-1',
              accountId: 'user-id-1',
              providerId: 'credential',
              userId: 'user-id-1',
              password: 'hashed-password',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          rowCount: 1,
        } as unknown as QueryResult;
      }

      if (queryStr.includes('INSERT INTO "session"') || queryStr.includes('insert into "session"')) {
        return {
          rows: [
            {
              id: 'session-id-1',
              token: 'session-token-123',
              userId: 'user-id-1',
              expiresAt: new Date(Date.now() + 86400000),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          rowCount: 1,
        } as unknown as QueryResult;
      }

      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    };

    vi.spyOn(pool, 'query').mockImplementation(mockQuery as any);
    vi.spyOn(pool, 'connect').mockResolvedValue({
      query: mockQuery,
      release: vi.fn(),
    } as any);
  });

  describe('POST /api/auth/sign-up/email', () => {
    it('should register a new user and create a session', async () => {

      const response = await request(app)
        .post('/api/auth/sign-up/email')
        .send({
          email: 'test@example.com',
          password: 'securePassword123!',
          name: 'Test User',
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
    });

    it('should reject duplicate signup when user already exists', async () => {
      const mockQuery = async (queryInput: unknown) => {
        const queryStr = typeof queryInput === 'string' ? queryInput : (queryInput as { text?: string })?.text || '';
        if (queryStr.includes('SELECT') || queryStr.includes('select')) {
          return {
            rows: [
              {
                id: 'existing-user-id',
                email: 'duplicate@example.com',
                name: 'Existing User',
                emailVerified: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
            rowCount: 1,
          } as unknown as QueryResult;
        }
        return { rows: [], rowCount: 0 } as unknown as QueryResult;
      };

      vi.spyOn(pool, 'query').mockImplementation(mockQuery as any);
      vi.spyOn(pool, 'connect').mockResolvedValue({
        query: mockQuery,
        release: vi.fn(),
      } as any);

      const response = await request(app)
        .post('/api/auth/sign-up/email')
        .send({
          email: 'duplicate@example.com',
          password: 'securePassword123!',
          name: 'Existing User',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/sign-in/email', () => {
    it('should reject login with non-existent user email', async () => {
      vi.spyOn(pool, 'query').mockImplementation(async () => {
        return { rows: [] } as unknown as QueryResult;
      });

      const response = await request(app)
        .post('/api/auth/sign-in/email')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongPassword123',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/auth/get-session', () => {
    it('should return null or unauthenticated response when no session cookie is provided', async () => {
      vi.spyOn(pool, 'query').mockImplementation(async () => {
        return { rows: [] } as unknown as QueryResult;
      });

      const response = await request(app).get('/api/auth/get-session');

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toBeNull();
      }
    });
  });

  describe('POST /api/auth/sign-out', () => {
    it('should succeed sign-out call', async () => {
      vi.spyOn(pool, 'query').mockImplementation(async () => {
        return { rows: [] } as unknown as QueryResult;
      });

      const response = await request(app).post('/api/auth/sign-out');

      expect([200, 204, 401]).toContain(response.status);
    });
  });
});
