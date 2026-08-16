import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const headerValue = req.headers['x-request-id'];
  let requestId: string;

  if (typeof headerValue === 'string' && REQUEST_ID_REGEX.test(headerValue)) {
    requestId = headerValue;
  } else {
    requestId = randomUUID();
  }

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}
