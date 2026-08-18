import { cleanupService } from './bootstrap/url.bootstrap.js';
import {
  createUrlCleanupQueue,
  setupUrlCleanupSchedule,
} from './jobs/url-cleanup.queue.js';
import { createUrlCleanupWorker } from './jobs/url-cleanup.worker.js';
import pool from './config/database.js';
import { connectWithRetry } from './config/database-connection.js';
import { logger } from './config/logger.js';
import { env } from './config/env.js';

export async function startWorker() {
  logger.info('Initializing background worker service...');

  const queue = createUrlCleanupQueue();
  await setupUrlCleanupSchedule(queue);

  const worker = createUrlCleanupWorker(cleanupService);

  const shutdown = async (signal: string) => {
    logger.info(
      { signal },
      'Closing background worker, queue, and database pool...'
    );
    try {
      await worker.close();
      await queue.close();
      logger.info('Background worker and queue closed successfully');
      await pool.end();
      logger.info('Database pool drained successfully');
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
    }
  };

  return { queue, worker, shutdown };
}

if (env.NODE_ENV !== 'test' && process.argv[1]?.includes('worker')) {
  (async () => {
    await connectWithRetry();
    const { shutdown } = await startWorker();

    process.on('SIGTERM', () =>
      shutdown('SIGTERM').then(() => process.exit(0))
    );
    process.on('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)));
  })();
}
