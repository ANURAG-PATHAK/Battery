import dotenvFlow from 'dotenv-flow';

import { runMigrations, closeDatabase } from '../src/db/sqlite';
import { mapSmartcarTelemetryToNormalized } from '../src/integrations/smartcar/telemetryMapper';
import { SmartcarService } from '../src/services/smartcar.service';
import { recordTelemetry } from '../src/services/telemetryRecorder.service';
import { logger } from '../src/utils/logger';

dotenvFlow.config();

const parseArgs = () => {
  const args = process.argv.slice(2);
  return args.reduce<{ vehicleId?: string; dryRun?: boolean; userId?: string }>(
    (accumulator, arg) => {
      if (arg.startsWith('--vehicleId=')) {
        return { ...accumulator, vehicleId: arg.split('=')[1] };
      }

      if (arg === '--dry-run') {
        return { ...accumulator, dryRun: true };
      }

      if (arg.startsWith('--userId=')) {
        return { ...accumulator, userId: arg.split('=')[1] };
      }

      return accumulator;
    },
    {},
  );
};

const run = async () => {
  const args = parseArgs();
  const smartcarService = new SmartcarService();

  const vehicles = args.vehicleId
    ? [{ id: args.vehicleId }]
    : await smartcarService.listVehicles(args.userId);

  const vehicleIds = vehicles.map((vehicle) =>
    typeof vehicle === 'string' ? vehicle : vehicle.id,
  );

  if (vehicleIds.length === 0) {
    throw new Error('No vehicles available for the configured Smartcar account.');
  }

  await runMigrations();

  const ingestionSummaries = await Promise.all(
    vehicleIds.map(async (vehicleId) => {
      const snapshot = await smartcarService.getVehicleTelemetry(vehicleId, args.userId);
      const telemetry = mapSmartcarTelemetryToNormalized(snapshot);

      if (telemetry.batteryPercentage === 0 && snapshot.batteryPercentage === null) {
        logger.warn(
          { vehicleId },
          'battery percentage unavailable from Smartcar payload',
        );
      }

      if (args.dryRun) {
        const dryRunSummary = {
          vehicleId,
          persisted: false as const,
          batteryPercentage: telemetry.batteryPercentage,
        };
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ vehicleId, telemetry }, null, 2));
        return dryRunSummary;
      }

      const result = await recordTelemetry(telemetry);
      return {
        vehicleId,
        persisted: true as const,
        score: result.score,
        status: result.status,
        batteryPercentage: telemetry.batteryPercentage,
      };
    }),
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ vehicles: ingestionSummaries }, null, 2));
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
