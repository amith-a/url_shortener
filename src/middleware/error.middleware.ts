import { ErrorRequestHandler } from 'express';
import z, { ZodError } from 'zod';

import { env } from '../config/env';
import { logger } from '../config/logger';
import AppError from '../errors/app-error';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const context = {
    requestId: req.id ?? req.headers['x-request-id'],
    method: req.method,
    url: req.originalUrl,
  };

  if (error instanceof AppError) {
    if (error.statusCode < 500) {
      logger.warn({ ...context, statusCode: error.statusCode, message: error.message }, 'Operational error handled');
    } else {
      logger.error({ ...context, err: error }, 'Internal application error');
    }

    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof ZodError) {
    const { fieldErrors } = z.flattenError(error);
    logger.warn({ ...context, errors: fieldErrors }, 'Request validation failed');

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: fieldErrors,
    });
  }

  logger.error({ ...context, err: error }, 'Unhandled server error in HTTP pipeline');

  return res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
};
