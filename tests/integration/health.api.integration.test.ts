import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import app from '../../src/app';
import pool from '../../src/config/database';
import { redis } from '../../src/config/redis';
import { createTimeoutMiddleware } from '../../src/middleware/timeout.middleware';

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

    it('should return 503 Service Unavailable with status not_ready when Redis ping fails', async () => {
      const pingSpy = vi.spyOn(redis, 'ping').mockImplementationOnce(() => {
        throw new Error('Simulated Redis failure');
      });

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'not_ready' });

      pingSpy.mockRestore();
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

    it('should fallback to generated UUID when incoming X-Request-ID has invalid characters', async () => {
      const invalidHeader = 'invalid@header!value';
      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', invalidHeader);

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).not.toBe(invalidHeader);
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should fallback to generated UUID when incoming X-Request-ID is oversized (> 64 chars)', async () => {
      const oversizedHeader = 'a'.repeat(65);
      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', oversizedHeader);

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).not.toBe(oversizedHeader);
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('Request Timeout Middleware Integration', () => {
    it('should return 503 Service Unavailable when request execution exceeds timeout', async () => {
      const testApp = express();
      testApp.use(createTimeoutMiddleware(50));
      testApp.get('/test-timeout', (_req, res) => {
        setTimeout(() => {
          if (!res.headersSent) {
            res.json({ status: 'completed' });
          }
        }, 100);
      });

      const response = await request(testApp).get('/test-timeout');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Request timeout' });
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
