import { Router } from 'express';

import { controller } from '../bootstrap/url.bootstrap';
import { validate } from '../middleware/validate.middleware';
import { getUrlSchema, urlSchema } from '../validators/url.validator';

const router = Router();


router.post(
  '/',
  validate({
    body: urlSchema,
  }),
  controller.create.bind(controller),
);

router.get(
  '/:shortCode',
  validate({
    params: getUrlSchema,
  }),
  controller.redirect.bind(controller),
);

export default router;