import { cleanupService } from './bootstrap/url.bootstrap';
import {
  createUrlCleanupQueue,
  setupUrlCleanupSchedule,
} from './jobs/url-cleanup.queue';
import { createUrlCleanupWorker } from './jobs/url-cleanup.worker';
import { connectWithRetry } from './config/database-connection';
import { logger } from './config/logger';

export async function startWorker() {
  logger.info('Initializing background worker service...');

  const queue = createUrlCleanupQueue();
  await setupUrlCleanupSchedule(queue);

  const worker = createUrlCleanupWorker(cleanupService);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Closing background worker and queue...');
    try {
      await worker.close();
      await queue.close();
      logger.info('Background worker and queue closed successfully');
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
    }
  };

  return { queue, worker, shutdown };
}

if (process.env.NODE_ENV !== 'test' && process.argv[1]?.endsWith('worker.ts')) {
  (async () => {
    await connectWithRetry();
    const { shutdown } = await startWorker();

    process.on('SIGTERM', () =>
      shutdown('SIGTERM').then(() => process.exit(0))
    );
    process.on('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)));
  })();
}
