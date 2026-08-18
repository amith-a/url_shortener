import { randomUUID } from 'crypto';
import { pinoHttp } from 'pino-http';

import { logger } from '../config/logger.js';

const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export const httpLogger = pinoHttp({
  logger,
  redact: ['req.headers.authorization', 'req.headers.cookie'],

  genReqId(req, res) {
    const existingId = (req as unknown as { id?: string }).id;
    if (existingId && REQUEST_ID_REGEX.test(existingId)) {
      res.setHeader('X-Request-ID', existingId);
      return existingId;
    }

    const headerValue = req.headers['x-request-id'];
    const requestId =
      typeof headerValue === 'string' && REQUEST_ID_REGEX.test(headerValue)
        ? headerValue
        : randomUUID();

    res.setHeader('X-Request-ID', requestId);
    return requestId;
  },
});
