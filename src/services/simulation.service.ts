import type { NormalizedTelemetry } from '../models/telemetry';
import {
  buildEvaluationContext,
  type SnapshotHistoryEntry,
} from './telemetryRecorder.service';
import { evaluateBatteryHealth } from './batteryHealth.service';
import { buildAlertsFromImpacts, type Alert } from './alert.service';
import { buildDriverTipsFromImpacts, type DriverTip } from './driverTips.service';
import { recordTelemetry } from './telemetryRecorder.service';
import {
  getScenario,
  listScenarios,
  type SimulationScenarioName,
  type SimulationScenario,
} from '../simulation/smartcar.mock';

export type SimulationRequest = {
  scenario: SimulationScenarioName;
  vehicleId?: string;
  persist?: boolean;
  baseTimestamp?: string;
};

export type SimulationResult = {
  vehicleId: string;
  scenario: SimulationScenario;
  persisted: boolean;
  samples: NormalizedTelemetry[];
  before: { batteryPercentage: number; snapshotTimestamp: string };
  after: {
    batteryPercentage: number;
    snapshotTimestamp: string;
    score: number;
    status: string;
  };
  alerts: Alert[];
  tips: DriverTip[];
};

const DEFAULT_SIMULATION_TIMESTAMP = '2024-01-01T08:00:00.000Z';

const getDefaultVehicleId = (): string =>
  process.env.SIMULATION_DEFAULT_VEHICLE_ID || 'simulated-vehicle';

const buildTelemetrySequence = (
  scenario: SimulationScenario,
  vehicleId: string,
  baseTimestamp: string,
): NormalizedTelemetry[] => {
  const parsedBase = new Date(baseTimestamp).getTime();
  const baseTime = Number.isNaN(parsedBase)
    ? new Date(DEFAULT_SIMULATION_TIMESTAMP).getTime()
    : parsedBase;

  return scenario.samples.map((sample) => {
    const timestamp = new Date(baseTime + sample.minuteOffset * 60000).toISOString();

    return {
      vehicleId,
      snapshotTimestamp: timestamp,
      rawTimestamp: timestamp,
      batteryPercentage: sample.batteryPercentage,
      speedKmph: sample.speedKmph,
      engineOn: sample.engineOn,
      charging: sample.charging,
      ambientTemperature: sample.ambientTemperature,
      odometerKm: sample.odometerKm,
    } satisfies NormalizedTelemetry;
  });
};

const toHistoryEntries = (telemetries: NormalizedTelemetry[]): SnapshotHistoryEntry[] =>
  telemetries.map((telemetry) => ({
    snapshotTimestamp: telemetry.snapshotTimestamp,
    batteryPercentage: telemetry.batteryPercentage,
    speedKmph: telemetry.speedKmph,
    engineOn: telemetry.engineOn,
    charging: telemetry.charging,
  }));

export const getAvailableScenarios = (): SimulationScenario[] => listScenarios();

export const simulateDrive = async ({
  scenario: scenarioName,
  vehicleId: requestedVehicleId,
  persist = false,
  baseTimestamp = DEFAULT_SIMULATION_TIMESTAMP,
}: SimulationRequest): Promise<SimulationResult> => {
  const scenario = getScenario(scenarioName);
  const vehicleId = requestedVehicleId || getDefaultVehicleId();
  const samples = buildTelemetrySequence(scenario, vehicleId, baseTimestamp);
  if (samples.length === 0) {
    throw new Error(`Scenario ${scenario.name} does not contain any samples.`);
  }
  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];

  let alerts: Alert[] = [];
  let tips: DriverTip[] = [];
  let score = 0;
  let status = 'GOOD';

  if (persist) {
    type TelemetryRecord = Awaited<ReturnType<typeof recordTelemetry>>;

    const finalResult = await samples.reduce<Promise<TelemetryRecord | null>>(
      async (previousPromise, telemetry) => {
        await previousPromise;
        const result = await recordTelemetry(telemetry);
        return result;
      },
      Promise.resolve<TelemetryRecord | null>(null),
    );

    if (!finalResult) {
      throw new Error('Simulation failed to persist telemetry.');
    }

    alerts = finalResult.alerts;
    tips = finalResult.tips;
    score = finalResult.score;
    status = finalResult.status;
  } else {
    const historyEntries = toHistoryEntries(samples.slice(0, -1));
    const context = await buildEvaluationContext(lastSample, historyEntries);
    const evaluation = evaluateBatteryHealth(context);
    alerts = buildAlertsFromImpacts(evaluation.ruleImpacts);
    tips = buildDriverTipsFromImpacts(evaluation.ruleImpacts);
    score = evaluation.score;
    status = evaluation.status;
  }

  return {
    vehicleId,
    scenario,
    persisted: persist,
    samples,
    before: {
      batteryPercentage: firstSample.batteryPercentage,
      snapshotTimestamp: firstSample.snapshotTimestamp,
    },
    after: {
      batteryPercentage: lastSample.batteryPercentage,
      snapshotTimestamp: lastSample.snapshotTimestamp,
      score,
      status,
    },
    alerts,
    tips,
  };
};
