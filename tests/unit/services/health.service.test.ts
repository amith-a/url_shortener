import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import { HealthService } from '../../../src/services/health.service.js';

describe('HealthService', () => {
  let mockPool: Pool;
  let mockRedis: Redis;
  let service: HealthService;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    } as unknown as Pool;

    mockRedis = {
      ping: vi.fn(),
    } as unknown as Redis;

    service = new HealthService(mockPool, mockRedis);
  });

  it('should return healthy: true when PostgreSQL query and Redis ping succeed', async () => {
    vi.mocked(mockPool.query).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);
    vi.mocked(mockRedis.ping).mockResolvedValueOnce('PONG');

    const result = await service.checkReadiness();

    expect(result).toEqual({
      healthy: true,
      db: true,
      redis: true,
    });
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    expect(mockRedis.ping).toHaveBeenCalledTimes(1);
  });

  it('should return healthy: false when PostgreSQL fails', async () => {
    vi.mocked(mockPool.query).mockRejectedValueOnce(new Error('DB connection failed'));
    vi.mocked(mockRedis.ping).mockResolvedValueOnce('PONG');

    const result = await service.checkReadiness();

    expect(result).toEqual({
      healthy: false,
      db: false,
      redis: true,
    });
  });

  it('should return healthy: false when Redis fails', async () => {
    vi.mocked(mockPool.query).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);
    vi.mocked(mockRedis.ping).mockRejectedValueOnce(new Error('Redis timeout'));

    const result = await service.checkReadiness();

    expect(result).toEqual({
      healthy: false,
      db: true,
      redis: false,
    });
  });

  it('should return healthy: false when Redis returns unexpected ping response', async () => {
    vi.mocked(mockPool.query).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);
    vi.mocked(mockRedis.ping).mockResolvedValueOnce('UNEXPECTED');

    const result = await service.checkReadiness();

    expect(result).toEqual({
      healthy: false,
      db: true,
      redis: false,
    });
  });
});
