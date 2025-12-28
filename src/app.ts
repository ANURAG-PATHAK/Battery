import express, { Application } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

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

  return app;
};
