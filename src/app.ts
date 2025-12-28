import express, { Application, Router } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { apiKeyMiddleware } from './middleware/apiKey.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { telemetryRouter } from './controllers/telemetry.controller';

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(express.json());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  app.use(
    pinoHttp({
      transport:
        process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
          };
        },
      },
    }),
  );

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  const apiRouter = Router();
  apiRouter.use(apiKeyMiddleware);
  apiRouter.use('/telemetry', telemetryRouter);

  app.use('/api/v1', apiRouter);

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  });

  app.use(errorHandler);

  return app;
};
