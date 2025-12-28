import { randomUUID } from 'crypto';
import express, { Application, Router } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { apiKeyMiddleware } from './middleware/apiKey.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { telemetryRouter } from './controllers/telemetry.controller';
import { insightsRouter } from './controllers/insights.controller';
import { simulationRouter } from './controllers/simulation.controller';
import { smartcarPublicRouter, smartcarRouter } from './controllers/smartcar.controller';
import { getAppConfig } from './config/appConfig';
import { logger } from './utils/logger';
import { getMigrationStatus, getDatabaseHealth } from './db/sqlite';

type RequestWithId = { id?: string };

const extractRequestId = (req: unknown): string | undefined =>
  (req as RequestWithId | undefined)?.id;

export const createApp = (): Application => {
  const appConfig = getAppConfig();
  const app = express();

  const redactPaths = appConfig.logging.redactHeaders.map((header) => {
    const sanitized = header.toLowerCase();
    return /^[a-z0-9_]+$/.test(sanitized)
      ? `req.headers.${sanitized}`
      : `req.headers["${sanitized}"]`;
  });

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incomingHeader = req.headers[appConfig.requestIdHeader];
        const candidate = Array.isArray(incomingHeader)
          ? incomingHeader[0]
          : incomingHeader;
        const requestId = candidate && candidate.length > 0 ? candidate : randomUUID();
        res.setHeader(appConfig.requestIdHeader, requestId);
        return requestId;
      },
      redact: {
        paths: redactPaths,
        remove: true,
      },
      serializers: {
        req(req) {
          const { id, method, url } = req;
          return { id, method, url };
        },
        res(res) {
          const { statusCode } = res;
          return { statusCode };
        },
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: appConfig.helmet.contentSecurityPolicy,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json());
  app.use(
    rateLimit({
      windowMs: appConfig.rateLimit.windowMs,
      limit: appConfig.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        const retryAfterSeconds = Math.ceil(appConfig.rateLimit.windowMs / 1000);
        res.setHeader('Retry-After', retryAfterSeconds.toString());
        const requestId = extractRequestId(req);
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Slow down before retrying.',
            details: {
              windowMs: appConfig.rateLimit.windowMs,
              maxRequests: appConfig.rateLimit.max,
              retryAfterSeconds,
              requestId,
            },
            requestId,
          },
        });
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', async (req, res, next) => {
    try {
      const requestId = extractRequestId(req);
      const health = await getDatabaseHealth();
      const { pending, applied } = await getMigrationStatus();

      if (!health.connected || pending.length > 0) {
        res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service is not ready to accept traffic.',
            details: {
              database: health,
              pendingMigrations: pending,
            },
            requestId,
          },
        });
        return;
      }

      res.json({
        status: 'ready',
        details: {
          database: health,
          appliedMigrations: applied,
        },
        requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/smartcar', smartcarPublicRouter);

  const apiRouter = Router();
  apiRouter.use(apiKeyMiddleware);
  apiRouter.use('/telemetry', telemetryRouter);
  apiRouter.use('/vehicles', insightsRouter);
  apiRouter.use('/simulate', simulationRouter);
  apiRouter.use('/smartcar', smartcarRouter);

  app.use('/api/v1', apiRouter);

  app.use((req, res) => {
    const requestId = extractRequestId(req);
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        requestId,
      },
    });
  });

  app.use(errorHandler);

  return app;
};
