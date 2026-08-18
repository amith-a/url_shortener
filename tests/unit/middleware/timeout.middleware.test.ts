import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createTimeoutMiddleware } from '../../../src/middleware/timeout.middleware.js';

describe('createTimeoutMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let eventListeners: Record<string, () => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    eventListeners = {};

    mockReq = {
      id: 'test-req-id',
      path: '/test',
      method: 'GET',
    };

    mockRes = {
      headersSent: false,
      writableEnded: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      on: vi.fn((event: string, cb: () => void) => {
        eventListeners[event] = cb;
        return mockRes as Response;
      }),
    };

    nextFn = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call next() and clear timer when request finishes before timeout', () => {
    const middleware = createTimeoutMiddleware(5000);
    middleware(mockReq as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(mockRes.on).toHaveBeenCalledWith('close', expect.any(Function));

    // Simulate response finish
    eventListeners['finish']?.();

    // Advance time past timeout
    vi.advanceTimersByTime(6000);

    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should return 503 Service Unavailable if request times out before response is sent', () => {
    const middleware = createTimeoutMiddleware(5000);
    middleware(mockReq as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);

    // Advance time past timeout
    vi.advanceTimersByTime(5500);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Request timeout' });
  });

  it('should not send duplicate 503 response if headers were already sent when timeout fires', () => {
    const middleware = createTimeoutMiddleware(5000);
    middleware(mockReq as Request, mockRes as Response, nextFn);

    // Simulate headers sent
    mockRes.headersSent = true;

    vi.advanceTimersByTime(6000);

    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should clean up timer when response closes before timeout', () => {
    const middleware = createTimeoutMiddleware(5000);
    middleware(mockReq as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);

    // Simulate response close event
    eventListeners['close']?.();

    // Advance time past timeout
    vi.advanceTimersByTime(6000);

    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});
