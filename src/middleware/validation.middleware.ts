import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ZodError } from 'zod';

import { badRequestError } from '../utils/errors';

export type ValidatedRequest<T> = Request & {
  validatedBody: T;
};

export const validateBody = <T>(schema: ZodTypeAny): RequestHandler => {
  const handler: RequestHandler = (req, _res, next) => {
    try {
      const parsed = schema.parse(req.body) as T;
      (req as ValidatedRequest<T>).validatedBody = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(badRequestError('Request validation failed', error.flatten()));
        return;
      }

      next(error);
    }
  };

  return handler;
};
