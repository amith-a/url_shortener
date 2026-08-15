import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error.middleware';
import urlRoutes from './routes/url.routes';
import { httpLogger } from './middleware/http-logger.middleware';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(helmet());
app.disable('x-powered-by');
app.use(httpLogger);

app.use('/api/v1/urls', urlRoutes);

app.use(errorHandler);

export default app;
