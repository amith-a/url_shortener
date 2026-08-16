import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .default('info'),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: z.coerce.number().default(5432),
    POSTGRES_DB: z.string().min(1),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string(),
    DATABASE_URL: z.string().min(8),

    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters long'),
    BETTER_AUTH_URL: z.string().url().optional(),

    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    REDIS_URL_TTL: z.coerce.number().int().positive().default(3600),

    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

    URL_CLEANUP_INTERVAL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(3600),

    CORS_ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:3000,http://localhost:5173')
      .transform((val) =>
        val
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      )
      .refine((origins) => origins.length > 0, {
        message: 'CORS_ALLOWED_ORIGINS must contain at least one origin',
      })
      .refine(
        (origins) =>
          origins.every(
            (origin) => origin === '*' || /^https?:\/\//i.test(origin)
          ),
        {
          message: 'All CORS origins must be valid HTTP/HTTPS URLs or "*"',
        }
      ),

    REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  })
  .refine(
    (data) => {
      if (
        data.NODE_ENV === 'production' &&
        data.CORS_ALLOWED_ORIGINS.includes('*')
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Wildcard CORS origin (*) is not allowed in production',
      path: ['CORS_ALLOWED_ORIGINS'],
    }
  );

export const env = envSchema.parse(process.env);
