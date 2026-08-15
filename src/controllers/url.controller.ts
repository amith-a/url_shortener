import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';

import { CreateShortUrlRequestDto } from '../dto/create-short-url-request.dto';
import type { UrlService } from '../services/url.service';
import { GetUrlRequestDto } from '../dto/get-url-request.dto';

export class UrlController {
  constructor(private readonly service: UrlService) {}

  async create(
    req: Request<ParamsDictionary, unknown, CreateShortUrlRequestDto>,
    res: Response
  ): Promise<void> {
    const url = await this.service.create(req.body);

    res.status(201).json(url);
  }

  async redirect(req: Request<GetUrlRequestDto>, res: Response): Promise<void> {
    const url = await this.service.resolveShortCode(req.params.shortCode);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.redirect(302, url);
  }
}
