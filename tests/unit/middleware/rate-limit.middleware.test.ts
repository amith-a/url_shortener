import '../../../src/types/express.d.ts';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '../../../src/middleware/rate-limit.middleware';
import type { RateLimitService } from '../../../src/services/rate-limit.service';

describe('rateLimitMiddleware', () => {
  let mockService: {
    buildKey: ReturnType<typeof vi.fn>;
    check: ReturnType<typeof vi.fn>;
  };
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let headers: Record<string, string>;

  beforeEach(() => {
    headers = {};
    mockService = {
      buildKey: vi
        .fn()
        .mockImplementation(
          (scope, identity) => `ratelimit:${scope}:${identity}`
        ),
      check: vi.fn(),
    };
    mockReq = {
      ip: '192.168.1.100',
    };
    mockRes = {
      setHeader: vi
        .fn()
        .mockImplementation((key: string, value: string | number) => {
          headers[key] = value.toString();
          return mockRes as Response;
        }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    nextFn = vi.fn();
  });

  it('should call next() and set headers when request is allowed', async () => {
    mockService.check.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetSeconds: 60,
    });

    const middleware = createRateLimiter(
      mockService as unknown as RateLimitService,
      { scope: 'test-scope', limit: 100, windowSeconds: 60 }
    );

    await middleware(mockReq as Request, mockRes as Response, nextFn);

    expect(mockService.buildKey).toHaveBeenCalledWith(
      'test-scope',
      '192.168.1.100'
    );
    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(headers['X-RateLimit-Remaining']).toBe('99');
    expect(headers['X-RateLimit-Reset']).toBe('60');
    expect(headers['Retry-After']).toBeUndefined();
    expect(nextFn).toHaveBeenCalled();
  });

  it('should use req.user.id for authenticated requests', async () => {
    mockReq.user = { id: 'user-777' } as any;
    mockService.check.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetSeconds: 60,
    });

    const middleware = createRateLimiter(
      mockService as unknown as RateLimitService,
      { scope: 'auth-scope' }
    );

    await middleware(mockReq as Request, mockRes as Response, nextFn);

    expect(mockService.buildKey).toHaveBeenCalledWith(
      'auth-scope',
      'user-777'
    );
    expect(nextFn).toHaveBeenCalled();
  });

  it('should return 429 and Retry-After header when rate limit is exceeded', async () => {
    mockService.check.mockResolvedValue({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetSeconds: 30,
    });

    const middleware = createRateLimiter(
      mockService as unknown as RateLimitService,
      { scope: 'limited-scope', limit: 10, windowSeconds: 30 }
    );

    await middleware(mockReq as Request, mockRes as Response, nextFn);

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(headers['X-RateLimit-Reset']).toBe('30');
    expect(headers['Retry-After']).toBe('30');
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Too many requests, please try again later',
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should call next() under fail-open service response on error', async () => {
    mockService.check.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 100,
      resetSeconds: 60,
    });

    const middleware = createRateLimiter(
      mockService as unknown as RateLimitService,
      { scope: 'fail-open-scope' }
    );

    await middleware(mockReq as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalled();
  });

  it('should call next() without rate limiting if identity is unavailable', async () => {
    delete mockReq.ip;
    delete mockReq.user;

    const middleware = createRateLimiter(
      mockService as unknown as RateLimitService,
      { scope: 'no-id-scope' }
    );

    await middleware(mockReq as Request, mockRes as Response, nextFn);

    expect(mockService.check).not.toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
  });
});
