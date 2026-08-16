import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import pool from '../../src/config/database';

describe('Health & Hardening API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return 200 OK with status ok (liveness)', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /ready', () => {
    it('should return 200 OK with status ready when dependencies are healthy', async () => {
      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ready' });
    });

    it('should return 503 Service Unavailable with status not_ready when PostgreSQL query fails', async () => {
      const querySpy = vi.spyOn(pool, 'query').mockImplementationOnce(() => {
        throw new Error('Simulated DB failure');
      });

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'not_ready' });

      querySpy.mockRestore();
    });
  });

  describe('Security Headers & Request ID', () => {
    it('should set Helmet security headers and X-Request-ID on HTTP response', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should preserve valid custom X-Request-ID provided in request header', async () => {
      const customId = 'integration-test-req-id-12345';
      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', customId);

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBe(customId);
    });
  });

  describe('CORS Behavior', () => {
    it('should allow configured origin and set access-control-allow-credentials', async () => {
      const allowedOrigin = 'http://localhost:3000';
      const response = await request(app)
        .get('/health')
        .set('Origin', allowedOrigin);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should not set access-control-allow-origin for disallowed origin', async () => {
      const disallowedOrigin = 'http://malicious-site.com';
      const response = await request(app)
        .get('/health')
        .set('Origin', disallowedOrigin);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
