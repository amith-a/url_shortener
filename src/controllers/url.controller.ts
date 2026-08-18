import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';

import { CreateShortUrlRequestDto } from '../dto/create-short-url-request.dto.js';
import type { UrlService } from '../services/url.service.js';
import { GetUrlRequestDto } from '../dto/get-url-request.dto.js';
import { ListUrlsQueryDto } from '../dto/list-urls-query.dto.js';

export class UrlController {
  constructor(private readonly service: UrlService) {}

  async create(
    req: Request<ParamsDictionary, unknown, CreateShortUrlRequestDto>,
    res: Response
  ): Promise<void> {
    const userId = req.user!.id;
    const url = await this.service.create(req.body, userId);

    res.status(201).json(url);
  }

  async list(
    req: Request<ParamsDictionary, unknown, unknown, ListUrlsQueryDto>,
    res: Response
  ): Promise<void> {
    const userId = req.user!.id;

    const result = await this.service.list(
      userId,
      req.query.page,
      req.query.limit
    );

    res.status(200).json(result);
  }

  async delete(req: Request<{ id: string }>, res: Response): Promise<void> {
    const userId = req.user!.id;
    await this.service.deleteUrl(req.params.id, userId);

    res.status(204).send();
  }

  async redirect(req: Request<GetUrlRequestDto>, res: Response): Promise<void> {
    const url = await this.service.resolveShortCode(req.params.shortCode);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.redirect(302, url);
  }
}
