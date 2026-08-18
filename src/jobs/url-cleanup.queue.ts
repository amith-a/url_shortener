import { Queue } from 'bullmq';
import { bullRedisConnection } from '../config/redis.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const URL_CLEANUP_QUEUE_NAME = 'url-cleanup';
export const URL_CLEANUP_SCHEDULER_ID = 'periodic-expired-url-cleanup';

export function createUrlCleanupQueue(): Queue {
  return new Queue(URL_CLEANUP_QUEUE_NAME, {
    connection: bullRedisConnection,
  });
}

export async function setupUrlCleanupSchedule(
  queue: Queue,
  intervalSeconds: number = env.URL_CLEANUP_INTERVAL_SECONDS
): Promise<void> {
  const intervalMs = intervalSeconds * 1000;

  try {
    // In BullMQ 5+, upsertJobScheduler creates or updates a repeatable job schedule
    // using a deterministic scheduler ID, preventing duplicate jobs on restart.
    await queue.upsertJobScheduler(
      URL_CLEANUP_SCHEDULER_ID,
      {
        every: intervalMs,
      },
      {
        name: 'cleanup-expired-urls',
        data: {},
      }
    );

    logger.info(
      { intervalSeconds, schedulerId: URL_CLEANUP_SCHEDULER_ID },
      `Registered expired URL cleanup background job schedule (every ${intervalSeconds}s)`
    );
  } catch (err) {
    logger.error(
      { err, intervalSeconds },
      'Failed to register expired URL cleanup schedule'
    );
    throw err;
  }
}
