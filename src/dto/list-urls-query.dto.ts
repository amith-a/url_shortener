import { z } from 'zod';
import { listUrlsQuerySchema } from '../validators/url.validator.js';

export type ListUrlsQueryDto = z.infer<typeof listUrlsQuerySchema>;
