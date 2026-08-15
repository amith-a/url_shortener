import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

import { CreateShortUrlRequestDto } from '../dto/create-short-url-request.dto';
import type { UrlService } from '../services/url.service';
import { GetUrlRequestDto } from '../dto/get-url-request.dto';
import { ListUrlsQueryDto } from '../dto/list-urls-query.dto';

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
    req: Request<ParamsDictionary, unknown, unknown, ParsedQs>,
    res: Response
  ): Promise<void> {
    const query = req.query as unknown as ListUrlsQueryDto;
    const userId = req.user!.id;
    const result = await this.service.list(
      userId,
      query.page,
      query.limit
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
