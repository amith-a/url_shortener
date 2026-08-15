import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import pool from '../../src/config/database';

async function safeCleanupAuthTables() {
  const { rows } = await pool.query('SELECT current_database()');
  const activeDb = rows[0]?.current_database;

  if (activeDb !== 'url_shortener_test') {
    throw new Error(
      `SAFETY FAILURE: Refusing cleanup because active database is '${activeDb}', expected 'url_shortener_test'`
    );
  }

  await pool.query(
    'TRUNCATE TABLE "session", "account", "user", "verification" RESTART IDENTITY CASCADE'
  );
}

describe('Better Auth Integration Tests (Real PostgreSQL Test DB)', () => {
  beforeEach(async () => {
    await safeCleanupAuthTables();
  });

  describe('POST /api/auth/sign-up/email', () => {
    it('should register a new user and create an active session', async () => {
      const response = await request(app)
        .post('/api/auth/sign-up/email')
        .send({
          email: 'newuser@example.com',
          password: 'securePassword123!',
          name: 'New Test User',
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'newuser@example.com');
      expect(response.body.user).toHaveProperty('name', 'New Test User');
    });

    it('should reject duplicate signup when user email already exists', async () => {
      // First signup
      await request(app).post('/api/auth/sign-up/email').send({
        email: 'duplicate@example.com',
        password: 'securePassword123!',
        name: 'First User',
      });

      // Second duplicate signup
      const response = await request(app)
        .post('/api/auth/sign-up/email')
        .send({
          email: 'duplicate@example.com',
          password: 'securePassword123!',
          name: 'Duplicate User',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/sign-in/email', () => {
    it('should authenticate user with valid credentials and set session cookie', async () => {
      // First register user
      await request(app).post('/api/auth/sign-up/email').send({
        email: 'signin@example.com',
        password: 'correctPassword123!',
        name: 'Sign In User',
      });

      // Attempt login
      const response = await request(app)
        .post('/api/auth/sign-in/email')
        .send({
          email: 'signin@example.com',
          password: 'correctPassword123!',
        });

      expect([200, 201]).toContain(response.status);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      await request(app).post('/api/auth/sign-up/email').send({
        email: 'wrongpass@example.com',
        password: 'correctPassword123!',
        name: 'Wrong Pass User',
      });

      const response = await request(app)
        .post('/api/auth/sign-in/email')
        .send({
          email: 'wrongpass@example.com',
          password: 'wrongPassword999!',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject login with non-existent user email', async () => {
      const response = await request(app)
        .post('/api/auth/sign-in/email')
        .send({
          email: 'nonexistent@example.com',
          password: 'somePassword123!',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/auth/get-session', () => {
    it('should return null or 401 when no session cookie is provided', async () => {
      const response = await request(app).get('/api/auth/get-session');

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toBeNull();
      }
    });

    it('should return active user session when valid session cookie is sent', async () => {
      // Signup user and capture cookies
      const signupRes = await request(app)
        .post('/api/auth/sign-up/email')
        .send({
          email: 'sessionuser@example.com',
          password: 'securePassword123!',
          name: 'Session User',
        });

      const cookies = signupRes.get('Set-Cookie');
      expect(cookies).toBeDefined();

      const sessionRes = await request(app)
        .get('/api/auth/get-session')
        .set('Cookie', cookies!);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body).not.toBeNull();
      expect(sessionRes.body).toHaveProperty('user');
      expect(sessionRes.body.user).toHaveProperty('email', 'sessionuser@example.com');
    });
  });

  describe('POST /api/auth/sign-out & Complete Authentication Lifecycle', () => {
    it('should authenticate user, retrieve session, sign out, and invalidate session', async () => {
      const origin = 'http://localhost:3001';

      // 1. Signup user
      const signupRes = await request(app)
        .post('/api/auth/sign-up/email')
        .set('Origin', origin)
        .send({
          email: 'lifecycle@example.com',
          password: 'lifecyclePassword123!',
          name: 'Lifecycle User',
        });

      expect([200, 201]).toContain(signupRes.status);
      const cookies = signupRes.get('Set-Cookie');
      expect(cookies).toBeDefined();

      // 2. Retrieve session (authenticated)
      const sessionRes1 = await request(app)
        .get('/api/auth/get-session')
        .set('Cookie', cookies!);

      expect(sessionRes1.status).toBe(200);
      expect(sessionRes1.body).not.toBeNull();
      expect(sessionRes1.body.user.email).toBe('lifecycle@example.com');

      // 3. Sign out
      const signOutRes = await request(app)
        .post('/api/auth/sign-out')
        .set('Origin', origin)
        .set('Cookie', cookies!);

      expect([200, 204]).toContain(signOutRes.status);

      // 4. Retrieve session after sign out (should be invalidated/null)
      const sessionRes2 = await request(app)
        .get('/api/auth/get-session')
        .set('Cookie', cookies!);

      expect([200, 401]).toContain(sessionRes2.status);
      if (sessionRes2.status === 200) {
        expect(sessionRes2.body).toBeNull();
      }
    });
  });
});
