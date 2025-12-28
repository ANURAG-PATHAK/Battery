import dotenvFlow from 'dotenv-flow';
import type { Server } from 'http';

import { createApp } from './app';
import { closeDatabase, runMigrations } from './db/sqlite';
import { logger } from './utils/logger';

dotenvFlow.config();

const port = Number(process.env.PORT || 3000);
const app = createApp();
let server: Server | undefined;

const start = async (): Promise<void> => {
  await runMigrations();
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

  await closeDatabase().catch((error) => {
    logger.error({ error }, 'failed to close sqlite connection');
  });

  logger.info('shutdown complete');
  process.exit(0);
};

start().catch(async (error) => {
  logger.error({ error }, 'failed to start server');
  await closeDatabase().catch((closeError) => {
    logger.error({ error: closeError }, 'error closing sqlite during startup failure');
  });
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
