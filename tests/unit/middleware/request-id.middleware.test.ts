import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../../../src/middleware/request-id.middleware.js';

describe('requestIdMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      setHeader: vi.fn(),
    };
    nextFn = vi.fn();
  });

  it('should preserve valid incoming X-Request-ID (alphanumeric, max 64 chars)', () => {
    mockReq.headers!['x-request-id'] = 'custom-request-id-123_ABC';

    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(mockReq.id).toBe('custom-request-id-123_ABC');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      'custom-request-id-123_ABC'
    );
    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  it('should generate UUID when X-Request-ID header is missing', () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    const generatedId = mockReq.id as string;
    expect(generatedId).toBeDefined();
    expect(typeof generatedId).toBe('string');
    expect(generatedId.length).toBe(36); // UUID format length
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', generatedId);
    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  it('should generate UUID when incoming X-Request-ID is longer than 64 characters', () => {
    mockReq.headers!['x-request-id'] = 'a'.repeat(65);

    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    const generatedId = mockReq.id as string;
    expect(generatedId).not.toBe('a'.repeat(65));
    expect(generatedId.length).toBe(36);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', generatedId);
    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  it('should generate UUID when incoming X-Request-ID contains invalid characters', () => {
    mockReq.headers!['x-request-id'] = 'invalid id with spaces & symbols <script>';

    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    const generatedId = mockReq.id as string;
    expect(generatedId).not.toContain('<script>');
    expect(generatedId.length).toBe(36);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', generatedId);
    expect(nextFn).toHaveBeenCalledTimes(1);
  });
});
