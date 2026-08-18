import { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { RateLimitService } from '../services/rate-limit.service.js';

export interface RateLimitOptions {
  scope: string;
  limit?: number;
  windowSeconds?: number;
}

export function createRateLimiter(
  service: RateLimitService,
  options: RateLimitOptions
): RequestHandler {
  const limit = options.limit ?? env.RATE_LIMIT_MAX;
  const windowSeconds = options.windowSeconds ?? env.RATE_LIMIT_WINDOW_SECONDS;

  return async (req, res, next): Promise<void> => {
    const identity = req.user?.id ?? req.ip;

    if (!identity) {
      next();
      return;
    }

    const key = service.buildKey(options.scope, identity);

    const result = await service.check(key, limit, windowSeconds);

    res.setHeader('X-RateLimit-Limit', result.limit.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', result.resetSeconds.toString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.resetSeconds.toString());
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
      });
      return;
    }

    next();
  };
}
