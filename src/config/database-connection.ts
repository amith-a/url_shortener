import pool from './database.js';
import { logger } from './logger.js';

const MAX_ATTEMPTS = 5;
const INITIAL_DELAY_MS = 1000;

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
