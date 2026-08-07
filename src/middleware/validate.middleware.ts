import { RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { z } from 'zod';

interface ValidationSchema<
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
  TBody = unknown,
> {
  params?: z.ZodSchema<TParams>;
  query?: z.ZodSchema<TQuery>;
  body?: z.ZodSchema<TBody>;
}

export function validate<
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
  TBody = unknown,
>(
  schema: ValidationSchema<TParams, TQuery, TBody>
): RequestHandler<TParams, unknown, TBody, TQuery> {
  const handler: RequestHandler<TParams, unknown, TBody, TQuery> = async (
    req,
    _res,
    next
  ) => {
    try {
      const { body, params, query } = schema;
      let parsedParams: TParams | undefined;
      let parsedQuery: TQuery | undefined;
      let parsedBody: TBody | undefined;

      if (params) {
        const result = await params.safeParseAsync(req.params);
        if (!result.success) {
          return next(result.error);
        }
        parsedParams = result.data;
      }

      if (query) {
        const result = await query.safeParseAsync(req.query);
        if (!result.success) {
          return next(result.error);
        }
        parsedQuery = result.data;
      }

      if (body) {
        const result = await body.safeParseAsync(req.body);
        if (!result.success) {
          return next(result.error);
        }
        parsedBody = result.data;
      }

      if (parsedParams) req.params = parsedParams;
      if (parsedQuery) req.query = parsedQuery;
      if (parsedBody) req.body = parsedBody;

      next();
    } catch (err) {
      next(err);
    }
  };

  return handler;
}
