import type { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../config/auth';
import { UnauthorizedError } from '../errors/unauthorized.error';

export async function requireAuth<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
>(
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData || !sessionData.user) {
      throw new UnauthorizedError('Authentication required');
    }

    req.user = sessionData.user;
    next();
  } catch (error) {
    next(error);
  }
}
