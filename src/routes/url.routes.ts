import { RequestHandler, Router } from 'express';

import { controller } from '../bootstrap/url.bootstrap';
import { validate } from '../middleware/validate.middleware';
import { getUrlSchema, listUrlsQuerySchema, urlSchema } from '../validators/url.validator';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post(
  '/',
  requireAuth,
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
  }) as unknown as RequestHandler,
  controller.list.bind(controller) as unknown as RequestHandler
);

router.get(
  '/:shortCode',
  validate({
    params: getUrlSchema,
  }),
  controller.redirect.bind(controller)
);

router.delete('/:id', requireAuth, controller.delete.bind(controller));

export default router;
