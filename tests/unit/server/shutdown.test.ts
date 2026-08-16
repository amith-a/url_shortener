import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Server } from 'node:http';
import pool from '../../../src/config/database';
import { redis } from '../../../src/config/redis';
import { gracefulShutdown, resetShutdownStateForTesting } from '../../../src/server';

describe('gracefulShutdown', () => {
  let mockServer: Server;

  beforeEach(() => {
    resetShutdownStateForTesting();
    vi.clearAllMocks();
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

  it('should trigger closeAllConnections and close pool/redis when server.close hangs past shutdown timeout', async () => {
    vi.useFakeTimers();

    let serverCloseCallback: ((err?: Error) => void) | undefined;
    const hangingServer = {
      close: vi.fn((cb?: (err?: Error) => void) => {
        serverCloseCallback = cb;
        return hangingServer;
      }),
      closeAllConnections: vi.fn(),
    } as unknown as Server;

    const shutdownPromise = gracefulShutdown(hangingServer, 'SIGTERM', 3000);

    expect(hangingServer.close).toHaveBeenCalledTimes(1);
    expect(hangingServer.closeAllConnections).not.toHaveBeenCalled();

    // Advance fake timers past shutdownTimeoutMs
    vi.advanceTimersByTime(3500);

    expect(hangingServer.closeAllConnections).toHaveBeenCalledTimes(1);

    // Simulate server finish closing after force destruction
    if (serverCloseCallback) {
      serverCloseCallback();
    }

    await shutdownPromise;

    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(redis.quit).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
