import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './config/auth.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';
import { httpLogger } from './middleware/http-logger.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { createTimeoutMiddleware } from './middleware/timeout.middleware.js';
import healthRoutes from './routes/health.routes.js';
import urlRoutes from './routes/url.routes.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (env.CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(requestIdMiddleware);
app.use(createTimeoutMiddleware());
app.use(httpLogger);

app.use('/', healthRoutes);

app.all('/api/auth/{*path}', toNodeHandler(auth));

app.use(express.json({ limit: '10kb' }));

app.use('/api/v1/urls', urlRoutes);

app.use(errorHandler);

export default app;
