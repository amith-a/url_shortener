import { describe, it, expect, vi } from 'vitest';
import type { Queue } from 'bullmq';

const mockQueueInstances: Array<{ name: string; opts: unknown }> = [];

vi.mock('bullmq', () => {
  class MockQueue {
    name: string;
    opts: unknown;

    constructor(name: string, opts: unknown) {
      this.name = name;
      this.opts = opts;
      mockQueueInstances.push(this);
    }

    upsertJobScheduler = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
  }

  return { Queue: MockQueue };
});

import {
  createUrlCleanupQueue,
  setupUrlCleanupSchedule,
  URL_CLEANUP_QUEUE_NAME,
  URL_CLEANUP_SCHEDULER_ID,
} from '../../../src/jobs/url-cleanup.queue';

describe('url-cleanup queue & schedule', () => {
  it('should create Queue with url-cleanup name', () => {
    const queue = createUrlCleanupQueue();
    expect(queue.name).toBe(URL_CLEANUP_QUEUE_NAME);
    expect(mockQueueInstances.length).toBeGreaterThan(0);
  });

  it('should register repeatable schedule via upsertJobScheduler', async () => {
    const mockQueue = {
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
    } as unknown as Queue;

    await setupUrlCleanupSchedule(mockQueue, 120);

    expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
      URL_CLEANUP_SCHEDULER_ID,
      { every: 120000 },
      { name: 'cleanup-expired-urls', data: {} }
    );
  });
});
