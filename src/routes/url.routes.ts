import { Router } from 'express';

import {
  analyticsController,
  controller,
  rateLimitService,
} from '../bootstrap/url.bootstrap.js';
import { validate } from '../middleware/validate.middleware.js';
import { createRateLimiter } from '../middleware/rate-limit.middleware.js';
import {
  getUrlSchema,
  listUrlsQuerySchema,
  urlIdParamSchema,
  urlSchema,
} from '../validators/url.validator.js';
import { requireAuth } from '../middleware/auth.middleware.js';

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
  validate({
    params: urlIdParamSchema,
  }),
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

router.delete(
  '/:id',
  requireAuth,
  validate({
    params: urlIdParamSchema,
  }),
  controller.delete.bind(controller)
);

export default router;
