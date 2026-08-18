import { Router } from 'express';
import { healthController } from '../bootstrap/health.bootstrap.js';

const router = Router();

router.get('/health', healthController.getHealth);
router.get('/ready', healthController.getReadiness);

export default router;
