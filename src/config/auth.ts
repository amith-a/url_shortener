import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import pool from './database.js';
import { getMongoDb } from './mongo.js';
import { env } from './env.js';

const database =
  env.DB_PROVIDER === 'mongodb' ? mongodbAdapter(getMongoDb()) : pool;

export const auth = betterAuth({
  database,
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || `http://localhost:${env.PORT}`,
});
