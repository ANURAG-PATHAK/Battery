import dotenvFlow from 'dotenv-flow';

import { runMigrations, closeDatabase } from '../src/db/sqlite';
import { getAvailableScenarios, simulateDrive } from '../src/services/simulation.service';
import type { SimulationScenarioName } from '../src/simulation/smartcar.mock';

dotenvFlow.config();

const parseArgs = () => {
  const args = process.argv.slice(2);
  return args.reduce<{
    scenario?: string;
    persist?: boolean;
    vehicleId?: string;
    baseTimestamp?: string;
  }>((accumulator, arg) => {
    if (arg.startsWith('--scenario=')) {
      return { ...accumulator, scenario: arg.split('=')[1] };
    }

    if (arg === '--persist') {
      return { ...accumulator, persist: true };
    }

    if (arg.startsWith('--vehicleId=')) {
      return { ...accumulator, vehicleId: arg.split('=')[1] };
    }

    if (arg.startsWith('--baseTimestamp=')) {
      return { ...accumulator, baseTimestamp: arg.split('=')[1] };
    }

    return accumulator;
  }, {});
};

const run = async () => {
  const { scenario = 'urban', persist = false, vehicleId, baseTimestamp } = parseArgs();
  const scenarioNames = getAvailableScenarios().map((item) => item.name);
  if (!scenarioNames.includes(scenario as SimulationScenarioName)) {
    throw new Error(
      `Unknown scenario "${scenario}". Available: ${scenarioNames.join(', ')}`,
    );
  }

  await runMigrations();

  const result = await simulateDrive({
    scenario: scenario as SimulationScenarioName,
    vehicleId,
    persist,
    baseTimestamp,
  });

  const summary = {
    vehicleId: result.vehicleId,
    scenario: result.scenario.name,
    persisted: result.persisted,
    samples: result.samples.length,
    startingBattery: result.before.batteryPercentage,
    endingBattery: result.after.batteryPercentage,
    score: result.after.score,
    status: result.after.status,
    alerts: result.alerts.map((alert) => ({ id: alert.id, severity: alert.severity })),
    tips: result.tips.map((tip) => tip.message),
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
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
