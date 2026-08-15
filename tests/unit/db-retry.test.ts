import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { connectWithRetry } from '../../src/server';
import { logger } from '../../src/config/logger';

describe('connectWithRetry', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockDelayFn: Mock<(ms: number) => Promise<void>>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = {
      query: vi.fn(),
    };
    mockDelayFn = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger);
  });

  it('should resolve on first attempt if database query succeeds', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await connectWithRetry(mockPool as any, 5, 1000, mockDelayFn);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    expect(mockDelayFn).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith('Database connected');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should retry with exponential backoff on failure and succeed', async () => {
    const error = new Error('Connection failed');
    mockPool.query
      .mockRejectedValueOnce(error) // Attempt 1 fails
      .mockRejectedValueOnce(error) // Attempt 2 fails
      .mockResolvedValueOnce({ rows: [] }); // Attempt 3 succeeds

    await connectWithRetry(mockPool as any, 5, 1000, mockDelayFn);

    expect(mockPool.query).toHaveBeenCalledTimes(3);
    expect(mockDelayFn).toHaveBeenCalledTimes(2);
    expect(mockDelayFn).toHaveBeenNthCalledWith(1, 1000); // 1s delay
    expect(mockDelayFn).toHaveBeenNthCalledWith(2, 2000); // 2s delay
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenNthCalledWith(
      1,
      { attempt: 1, delay: 1 },
      'Database connection attempt 1 failed. Retrying in 1s'
    );
    expect(warnSpy).toHaveBeenNthCalledWith(
      2,
      { attempt: 2, delay: 2 },
      'Database connection attempt 2 failed. Retrying in 2s'
    );
    expect(infoSpy).toHaveBeenCalledWith('Database connected');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should exhaust 5 attempts, log warnings, and call process.exit(1) on final failure', async () => {
    const error = new Error('Connection failed');
    mockPool.query.mockRejectedValue(error);

    await connectWithRetry(mockPool as any, 5, 1000, mockDelayFn);

    expect(mockPool.query).toHaveBeenCalledTimes(5);
    expect(mockDelayFn).toHaveBeenCalledTimes(4);
    expect(mockDelayFn).toHaveBeenNthCalledWith(1, 1000);
    expect(mockDelayFn).toHaveBeenNthCalledWith(2, 2000);
    expect(mockDelayFn).toHaveBeenNthCalledWith(3, 4000);
    expect(mockDelayFn).toHaveBeenNthCalledWith(4, 8000);
    expect(warnSpy).toHaveBeenCalledTimes(4);
    expect(errorSpy).toHaveBeenCalledWith('Database Connection Failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
