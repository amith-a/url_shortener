import type { Server } from 'node:http';
import app from './app.js';
import pool from './config/database.js';
import { connectWithRetry } from './config/database-connection.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { redis } from './config/redis.js';

let isShuttingDown = false;

export function resetShutdownStateForTesting(): void {
  isShuttingDown = false;
}

export async function gracefulShutdown(
  server: Server,
  signal: string,
  shutdownTimeoutMs: number = env.SHUTDOWN_TIMEOUT_MS
): Promise<void> {
  if (isShuttingDown) {
    logger.warn(
      { signal },
      'Shutdown already in progress, ignoring duplicate signal'
    );
    return;
  }
  isShuttingDown = true;

  logger.info(
    { signal },
    `${signal} signal received: starting graceful shutdown`
  );

  const forceShutdownTimer = setTimeout(() => {
    logger.warn(
      { shutdownTimeoutMs },
      'Shutdown timeout reached, destroying remaining open HTTP connections'
    );
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
  }, shutdownTimeoutMs);

  await new Promise<void>((resolve) => {
    server.close((err) => {
      clearTimeout(forceShutdownTimer);
      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
      } else {
        logger.info('HTTP server closed cleanly');
      }
      resolve();
    });
  });

  try {
    await pool.end();
    logger.info('PostgreSQL pool drained cleanly');
  } catch (err) {
    logger.error({ err }, 'Error draining PostgreSQL pool');
  }

  try {
    await redis.quit();
    logger.info('Redis connection closed cleanly');
  } catch (err) {
    logger.error({ err }, 'Error closing Redis connection');
  }

  logger.info('Graceful shutdown completed');
  if (env.NODE_ENV !== 'test') {
    process.exit(0);
  }
}

async function bootstrap() {
  await connectWithRetry();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });

  process.on('SIGTERM', () => void gracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown(server, 'SIGINT'));
}

if (env.NODE_ENV !== 'test') {
  bootstrap();
}
