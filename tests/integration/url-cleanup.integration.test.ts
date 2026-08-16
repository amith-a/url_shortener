import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../../src/app';
import pool from '../../src/config/database';
import {
  cacheService,
  cleanupService,
  repository,
} from '../../src/bootstrap/url.bootstrap';

async function safeCleanupUrlTables() {
  const { rows } = await pool.query('SELECT current_database()');
  const activeDb = rows[0]?.current_database;

  if (activeDb !== 'url_shortener_test') {
    throw new Error(
      `SAFETY FAILURE: Refusing cleanup because active database is '${activeDb}', expected 'url_shortener_test'`
    );
  }

  await pool.query(
    'TRUNCATE TABLE url_click_events, urls, "session", "account", "user", "verification" RESTART IDENTITY CASCADE'
  );

  await cacheService.flushTestKeys();
}

async function registerAndLogin(email: string, name: string) {
  const response = await request(app).post('/api/auth/sign-up/email').send({
    email,
    password: 'Password123!',
    name,
  });

  const cookies = response.get('Set-Cookie');
  return {
    user: response.body.user as { id: string; email: string },
    cookies: cookies!,
  };
}

describe('Expired URL Cleanup Integration (Real PostgreSQL & Redis Test DB)', () => {
  beforeEach(async () => {
    await safeCleanupUrlTables();
  });

  it('should delete expired URLs, remove Redis cache keys, cascade click events, and leave active/non-expiring URLs intact', async () => {
    const user = await registerAndLogin(
      'cleanup_user@example.com',
      'Cleanup User'
    );
    const userId = user.user.id;

    // 1. Create active, expired, and non-expiring URLs directly via repository
    const activeUrl = await repository.create({
      id: randomUUID(),
      shortCode: 'active01',
      originalUrl: 'https://example.com/active-url',
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour in future
      userId,
    });

    const expiredUrl = await repository.create({
      id: randomUUID(),
      shortCode: 'expired1',
      originalUrl: 'https://example.com/expired-url',
      expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour in past
      userId,
    });

    const nonExpiringUrl = await repository.create({
      id: randomUUID(),
      shortCode: 'noexp100',
      originalUrl: 'https://example.com/non-expiring-url',
      expiresAt: null,
      userId,
    });

    // 2. Populate Redis cache and click events for the expired URL
    await cacheService.set(
      expiredUrl.shortCode,
      { urlId: expiredUrl.id, originalUrl: expiredUrl.originalUrl },
      3600
    );
    await cacheService.set(
      activeUrl.shortCode,
      { urlId: activeUrl.id, originalUrl: activeUrl.originalUrl },
      3600
    );

    await pool.query(
      'INSERT INTO url_click_events (url_id, clicked_at) VALUES ($1, NOW())',
      [expiredUrl.id]
    );

    // Verify click event exists before cleanup
    const preCleanupClicks = await pool.query(
      'SELECT COUNT(*)::int AS count FROM url_click_events WHERE url_id = $1',
      [expiredUrl.id]
    );
    expect(preCleanupClicks.rows[0]?.count).toBe(1);

    // 3. Run background cleanup
    const deletedCount = await cleanupService.cleanupExpiredUrls();

    expect(deletedCount).toBe(1);

    // 4. Verify expired URL is deleted from PostgreSQL
    const expiredCheck = await repository.findByShortCode(
      expiredUrl.shortCode
    );
    expect(expiredCheck).toBeNull();

    // 5. Verify active and non-expiring URLs remain intact in PostgreSQL
    const activeCheck = await repository.findByShortCode(activeUrl.shortCode);
    expect(activeCheck).not.toBeNull();

    const nonExpiringCheck = await repository.findByShortCode(
      nonExpiringUrl.shortCode
    );
    expect(nonExpiringCheck).not.toBeNull();

    // 6. Verify expired URL Redis key is deleted
    const expiredCache = await cacheService.get(expiredUrl.shortCode);
    expect(expiredCache).toBeNull();

    const activeCache = await cacheService.get(activeUrl.shortCode);
    expect(activeCache).toEqual({
      urlId: activeUrl.id,
      originalUrl: activeUrl.originalUrl,
    });

    // 7. Verify ON DELETE CASCADE deleted click events for the expired URL
    const postCleanupClicks = await pool.query(
      'SELECT COUNT(*)::int AS count FROM url_click_events WHERE url_id = $1',
      [expiredUrl.id]
    );
    expect(postCleanupClicks.rows[0]?.count).toBe(0);
  });
});
