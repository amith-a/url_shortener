import app from './app';
import pool from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

const MAX_ATTEMPTS = 5;
const INITIAL_DELAY_MS = 1000;

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectWithRetry(
  dbPool = pool,
  maxAttempts = MAX_ATTEMPTS,
  initialDelayMs = INITIAL_DELAY_MS,
  delayFn: (ms: number) => Promise<void> = sleep
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await dbPool.query('SELECT NOW()');
      logger.info('Database connected');
      return;
    } catch (err) {
      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        logger.warn(
          { attempt, delay: delayMs / 1000 },
          `Database connection attempt ${attempt} failed. Retrying in ${delayMs / 1000}s`
        );
        await delayFn(delayMs);
      } else {
        logger.error('Database Connection Failed');
        logger.error(err);
        process.exit(1);
      }
    }
  }
}

async function bootstrap() {
  await connectWithRetry();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} signal received: closing HTTP server`);
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await pool.end();
        logger.info('Database pool drained');
        process.exit(0);
      } catch (err) {
        logger.error(err, 'Error during database pool shutdown');
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
