import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';

export function createTimeoutMiddleware(
  timeoutMs: number = env.REQUEST_TIMEOUT_MS
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent && !res.writableEnded) {
        logger.warn(
          { reqId: req.id, path: req.path, method: req.method, timeoutMs },
          'Request timed out'
        );
        res.status(503).json({ error: 'Request timeout' });
      }
    }, timeoutMs);

    const clear = () => {
      clearTimeout(timer);
    };

    res.on('finish', clear);
    res.on('close', clear);

    next();
  };
}
