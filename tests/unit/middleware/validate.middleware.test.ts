import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate } from '../../../src/middleware/validate.middleware';
import { Request, RequestHandler, Response } from 'express';

describe('validate.middleware', () => {
  it('should call next() and assign parsed data when validation succeeds', async () => {
    const schema = {
      body: z.object({
        originalUrl: z.string().url(),
      }),
      params: z.object({
        id: z.string().min(1),
      }),
    };

    const req = {
      body: { originalUrl: 'https://example.com' },
      params: { id: '123' },
    } as unknown as Request;

    const res = {} as Response;
    const next = vi.fn();

    const middleware = validate(schema);
    await (middleware as RequestHandler)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ originalUrl: 'https://example.com' });
    expect(req.params).toEqual({ id: '123' });
  });

  it('should call next(error) when validation fails', async () => {
    const schema = {
      body: z.object({
        originalUrl: z.string().url(),
      }),
    };

    const req = {
      body: { originalUrl: 'not-a-valid-url' },
    } as unknown as Request;

    const res = {} as Response;
    const next = vi.fn();

    const middleware = validate(schema);
    await (middleware as RequestHandler)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(z.ZodError);
  });
});
