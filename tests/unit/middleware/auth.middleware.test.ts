import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../../src/middleware/auth.middleware';
import { auth } from '../../../src/config/auth';
import { UnauthorizedError } from '../../../src/errors/unauthorized.error';

describe('requireAuth Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.restoreAllMocks();
    req = {
      headers: {},
    };
    res = {};
    next = vi.fn();
  });

  it('should attach session.user to req.user and call next() when a valid session exists', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'auth@example.com',
      name: 'Authenticated User',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      user: mockUser,
      session: {
        id: 'sess-123',
        userId: 'user-123',
        token: 'token-123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await requireAuth(req as Request, res as Response, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should throw UnauthorizedError when no active session is returned', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(null);

    await requireAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const passedError = (next as any).mock.calls[0][0];
    expect(passedError).toBeInstanceOf(UnauthorizedError);
    expect(passedError.statusCode).toBe(401);
  });

  it('should pass error to Express error handling when session lookup fails', async () => {
    const dbError = new Error('Database connection failed');
    vi.spyOn(auth.api, 'getSession').mockRejectedValue(dbError);

    await requireAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(dbError);
  });
});
