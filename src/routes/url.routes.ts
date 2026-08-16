import { Router } from 'express';

import {
  analyticsController,
  controller,
  rateLimitService,
} from '../bootstrap/url.bootstrap';
import { validate } from '../middleware/validate.middleware';
import { createRateLimiter } from '../middleware/rate-limit.middleware';
import {
  getUrlSchema,
  listUrlsQuerySchema,
  urlSchema,
} from '../validators/url.validator';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post(
  '/',
  requireAuth,
  createRateLimiter(rateLimitService, { scope: 'create-url' }),
  validate({
    body: urlSchema,
  }),
  controller.create.bind(controller)
);

router.get(
  '/',
  requireAuth,
  validate({
    query: listUrlsQuerySchema,
  }),
  controller.list.bind(controller)
);

router.get(
  '/:id/analytics',
  requireAuth,
  analyticsController.getAnalytics.bind(analyticsController)
);

router.get(
  '/:shortCode',
  createRateLimiter(rateLimitService, { scope: 'resolve-url' }),
  validate({
    params: getUrlSchema,
  }),
  controller.redirect.bind(controller)
);

router.delete('/:id', requireAuth, controller.delete.bind(controller));

export default router;
