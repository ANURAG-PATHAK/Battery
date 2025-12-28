import type { RequestHandler } from 'express';

import { unauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

export const apiKeyMiddleware: RequestHandler = (req, res, next) => {
  const configuredKey = process.env.API_KEY;
  if (!configuredKey) {
    logger.error('API_KEY environment variable is not configured');
    next(unauthorizedError());
    return;
  }

  const providedKey = req.header('x-api-key');
  if (!providedKey || providedKey !== configuredKey) {
    next(unauthorizedError('Invalid API key'));
    return;
  }

  next();
};
