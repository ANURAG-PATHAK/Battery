import { closeDatabase, runMigrations } from './sqlite';
import { logger } from '../utils/logger';

const run = async (): Promise<void> => {
  try {
    await runMigrations();
    logger.info('migrations applied successfully');
  } catch (error) {
    logger.error({ error }, 'migration run failed');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
};

run().catch((error) => {
  logger.error({ error }, 'unexpected migration failure');
  process.exit(1);
});
