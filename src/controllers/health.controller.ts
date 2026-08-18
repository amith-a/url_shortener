import type { Request, Response } from 'express';
import type { HealthService } from '../services/health.service.js';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  getHealth = (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok' });
  };

  getReadiness = async (_req: Request, res: Response): Promise<void> => {
    const readiness = await this.healthService.checkReadiness();

    if (readiness.healthy) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not_ready' });
    }
  };
}
