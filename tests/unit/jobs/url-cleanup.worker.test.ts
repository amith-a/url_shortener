import { describe, it, expect, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { UrlCleanupService } from '../../../src/services/url-cleanup.service';

const mockWorkerInstances: Array<{
  name: string;
  processor: (job: Job) => Promise<{ deletedCount: number }>;
  opts: unknown;
}> = [];

vi.mock('bullmq', () => {
  class MockWorker {
    name: string;
    processor: (job: Job) => Promise<{ deletedCount: number }>;
    opts: unknown;

    constructor(
      name: string,
      processor: (job: Job) => Promise<{ deletedCount: number }>,
      opts: unknown
    ) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
      mockWorkerInstances.push(this);
    }

    on = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);
  }

  return { Worker: MockWorker };
});

import { createUrlCleanupWorker } from '../../../src/jobs/url-cleanup.worker';

describe('createUrlCleanupWorker', () => {
  it('should instantiate BullMQ worker and invoke cleanupService.cleanupExpiredUrls in processor', async () => {
    const mockCleanupService = {
      cleanupExpiredUrls: vi.fn().mockResolvedValue(3),
    } as unknown as UrlCleanupService;

    const worker = createUrlCleanupWorker(mockCleanupService);

    expect(worker).toBeDefined();
    expect(mockWorkerInstances.length).toBeGreaterThan(0);

    const instance = mockWorkerInstances.at(-1)!;
    expect(instance.name).toBe('url-cleanup');
    expect(instance.opts).toEqual(
      expect.objectContaining({
        concurrency: 1,
      })
    );

    const mockJob = { id: 'job-1', name: 'cleanup' } as Job;
    const result = await instance.processor(mockJob);

    expect(mockCleanupService.cleanupExpiredUrls).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ deletedCount: 3 });
  });
});
