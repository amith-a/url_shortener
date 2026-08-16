import { Worker, Job } from 'bullmq';
import { bullRedisConnection } from '../config/redis';
import { URL_CLEANUP_QUEUE_NAME } from './url-cleanup.queue';
import type { UrlCleanupService } from '../services/url-cleanup.service';
import { logger } from '../config/logger';

export function createUrlCleanupWorker(
  cleanupService: UrlCleanupService
): Worker {
  const worker = new Worker(
    URL_CLEANUP_QUEUE_NAME,
    async (job: Job) => {
      logger.info(
        { jobId: job.id, jobName: job.name },
        'Starting expired URL cleanup background job'
      );
      const deletedCount = await cleanupService.cleanupExpiredUrls();
      return { deletedCount };
    },
    {
      connection: bullRedisConnection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job: Job, returnvalue: { deletedCount: number }) => {
    logger.info(
      { jobId: job.id, deletedCount: returnvalue.deletedCount },
      'Expired URL cleanup job completed successfully'
    );
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error(
      { jobId: job?.id, err },
      'Expired URL cleanup job failed in BullMQ worker'
    );
  });

  worker.on('error', (err: Error) => {
    logger.error({ err }, 'BullMQ worker connection error');
  });

  return worker;
}
