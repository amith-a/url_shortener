import { z } from 'zod';
import { listUrlsQuerySchema } from '../validators/url.validator';

export type ListUrlsQueryDto = z.infer<typeof listUrlsQuerySchema>;
