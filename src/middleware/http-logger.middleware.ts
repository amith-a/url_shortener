import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';

import { logger } from '../config/logger';

export const httpLogger = pinoHttp({
  logger,
  redact: ['req.headers.authorization', 'req.headers.cookie'],

  genReqId(req, res) {
    const requestId = req.headers['x-request-id']?.toString() ?? randomUUID();

    res.setHeader('X-Request-Id', requestId);

    return requestId;
  },
});
