import { betterAuth } from 'better-auth';
import pool from './database.js';
import { env } from './env.js';

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || `http://localhost:${env.PORT}`,
});
