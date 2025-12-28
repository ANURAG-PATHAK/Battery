import dotenvFlow from 'dotenv-flow';
import type { Server } from 'http';

import { createApp } from './app';
import { logger } from './utils/logger';

dotenvFlow.config();

const port = Number(process.env.PORT || 3000);
const app = createApp();
let server: Server | undefined;

const start = async (): Promise<void> => {
  server = app.listen(port, () => {
    logger.info({ port }, 'server listening');
  });
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info({ signal }, 'shutdown signal received');

  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  logger.info('shutdown complete');
  process.exit(0);
};

start().catch((error) => {
  logger.error({ error }, 'failed to start server');
  process.exit(1);
});

(['SIGINT', 'SIGTERM', 'SIGQUIT'] as NodeJS.Signals[]).forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal).catch((error) => {
      logger.error({ error }, 'error during shutdown');
      process.exit(1);
    });
  });
});
