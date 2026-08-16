import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { HealthController } from '../../../src/controllers/health.controller';
import type { HealthService } from '../../../src/services/health.service';

describe('HealthController', () => {
  let mockHealthService: HealthService;
  let controller: HealthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockHealthService = {
      checkReadiness: vi.fn(),
    } as unknown as HealthService;

    controller = new HealthController(mockHealthService);

    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('getHealth', () => {
    it('should return 200 OK with status ok without calling HealthService', () => {
      controller.getHealth(mockReq as Request, mockRes as Response);

      expect(mockHealthService.checkReadiness).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok' });
    });
  });

  describe('getReadiness', () => {
    it('should return 200 OK when HealthService returns healthy: true', async () => {
      vi.mocked(mockHealthService.checkReadiness).mockResolvedValueOnce({
        healthy: true,
        db: true,
        redis: true,
      });

      await controller.getReadiness(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ready' });
    });

    it('should return 503 Service Unavailable when HealthService returns healthy: false', async () => {
      vi.mocked(mockHealthService.checkReadiness).mockResolvedValueOnce({
        healthy: false,
        db: true,
        redis: false,
      });

      await controller.getReadiness(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'not_ready' });
    });
  });
});
