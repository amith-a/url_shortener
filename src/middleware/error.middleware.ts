import { ErrorRequestHandler } from 'express';
import z, { ZodError } from 'zod';

import { env } from '../config/env';
import { logger } from '../config/logger';
import AppError from '../errors/app-error';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  logger.error(
    {
      err: error,
      requestId: req.id ?? req.headers['x-request-id'],
      method: req.method,
      url: req.originalUrl,
    },
    'Handled error in HTTP pipeline'
  );

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof ZodError) {
     const { fieldErrors } = z.flattenError(error);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: fieldErrors,
    });
  }

  return res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
};
