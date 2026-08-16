import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Server } from 'node:http';
import pool from '../../../src/config/database';
import { redis } from '../../../src/config/redis';
import { gracefulShutdown, resetShutdownStateForTesting } from '../../../src/server';

describe('gracefulShutdown', () => {
  let mockServer: Server;

  beforeEach(() => {
    resetShutdownStateForTesting();
    mockServer = {
      close: vi.fn((cb?: (err?: Error) => void) => {
        if (cb) cb();
        return mockServer;
      }),
      closeAllConnections: vi.fn(),
    } as unknown as Server;

    vi.spyOn(pool, 'end').mockResolvedValue(undefined as never);
    vi.spyOn(redis, 'quit').mockResolvedValue('OK' as never);
  });

  it('should close server, pool, and redis cleanly on signal', async () => {
    await gracefulShutdown(mockServer, 'SIGTERM', 5000);

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('should ignore duplicate shutdown calls when shutdown is already in progress', async () => {
    const shutdownPromise1 = gracefulShutdown(mockServer, 'SIGTERM', 5000);
    const shutdownPromise2 = gracefulShutdown(mockServer, 'SIGINT', 5000);

    await Promise.all([shutdownPromise1, shutdownPromise2]);

    expect(mockServer.close).toHaveBeenCalledTimes(1);
  });
});
