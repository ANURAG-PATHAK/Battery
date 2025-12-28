import type { HealthStatus } from '../rules/rules.config';
import { buildAlertsFromImpacts, type Alert } from './alert.service';
import {
  evaluateBatteryHealth,
  type BatteryEvaluationContext,
  type BatteryHealthEvaluation,
  type RapidSnapshot,
} from './batteryHealth.service';
import { buildDriverTipsFromImpacts, type DriverTip } from './driverTips.service';
import {
  getRecentSnapshots,
  insertSnapshot,
} from '../db/repositories/telemetrySnapshot.repository';
import { upsertVehicle } from '../db/repositories/vehicle.repository';
import { insertInsightLog } from '../db/repositories/insights.repository';
import type { NormalizedTelemetry } from '../models/telemetry';

export type TelemetryRecordResult = {
  vehicleId: string;
  score: number;
  status: HealthStatus;
  evaluation: BatteryHealthEvaluation;
  alerts: Alert[];
  tips: DriverTip[];
};

const HISTORY_SNAPSHOT_LIMIT = 20;

export type SnapshotHistoryEntry = {
  snapshotTimestamp: string;
  batteryPercentage: number;
  speedKmph: number;
  engineOn: boolean;
  charging: boolean;
};

type ContinuousAccumulator = {
  active: boolean;
  lastTimestamp: number;
  durationMinutes: number;
  startBattery: number;
};

const toChronologicalSnapshots = (
  snapshots: SnapshotHistoryEntry[],
  currentTimestamp: number,
): SnapshotHistoryEntry[] =>
  snapshots
    .filter(
      (snapshot) => new Date(snapshot.snapshotTimestamp).getTime() < currentTimestamp,
    )
    .sort(
      (a, b) =>
        new Date(a.snapshotTimestamp).getTime() - new Date(b.snapshotTimestamp).getTime(),
    );

const computeIdleDuration = (
  telemetry: NormalizedTelemetry,
  chronologicalSnapshots: SnapshotHistoryEntry[],
  currentTimestamp: number,
): number => {
  if (!telemetry.engineOn || telemetry.speedKmph > 0) {
    return 0;
  }

  const reversed = [...chronologicalSnapshots].reverse();
  const idleAccumulator = reversed.reduce(
    (state, snapshot) => {
      if (!state.active) {
        return state;
      }

      if (snapshot.engineOn && snapshot.speedKmph === 0) {
        const snapshotTime = new Date(snapshot.snapshotTimestamp).getTime();
        const minutes = (state.lastTimestamp - snapshotTime) / 60000;
        return {
          active: true,
          lastTimestamp: snapshotTime,
          durationMinutes: state.durationMinutes + minutes,
        };
      }

      return {
        active: false,
        lastTimestamp: state.lastTimestamp,
        durationMinutes: state.durationMinutes,
      };
    },
    {
      active: true,
      lastTimestamp: currentTimestamp,
      durationMinutes: 0,
    },
  );

  return Math.max(idleAccumulator.durationMinutes, 0);
};

const computeChargingStats = (
  telemetry: NormalizedTelemetry,
  chronologicalSnapshots: SnapshotHistoryEntry[],
  currentTimestamp: number,
): { durationMinutes: number; deltaPercentage: number } => {
  if (!telemetry.charging) {
    return { durationMinutes: 0, deltaPercentage: 0 };
  }

  const reversed = [...chronologicalSnapshots].reverse();
  const chargingAccumulator = reversed.reduce<ContinuousAccumulator>(
    (state, snapshot) => {
      if (!state.active) {
        return state;
      }

      if (snapshot.charging) {
        const snapshotTime = new Date(snapshot.snapshotTimestamp).getTime();
        const minutes = (state.lastTimestamp - snapshotTime) / 60000;
        return {
          active: true,
          lastTimestamp: snapshotTime,
          durationMinutes: state.durationMinutes + minutes,
          startBattery: snapshot.batteryPercentage,
        };
      }

      return {
        active: false,
        lastTimestamp: state.lastTimestamp,
        durationMinutes: state.durationMinutes,
        startBattery: state.startBattery,
      };
    },
    {
      active: true,
      lastTimestamp: currentTimestamp,
      durationMinutes: 0,
      startBattery: telemetry.batteryPercentage,
    },
  );

  const delta = telemetry.batteryPercentage - chargingAccumulator.startBattery;

  return {
    durationMinutes: Math.max(chargingAccumulator.durationMinutes, 0),
    deltaPercentage: Math.max(delta, 0),
  };
};

const toRapidSnapshots = (snapshots: SnapshotHistoryEntry[]): RapidSnapshot[] =>
  snapshots.map((snapshot) => ({
    snapshotTimestamp: snapshot.snapshotTimestamp,
    batteryPercentage: snapshot.batteryPercentage,
  }));

export const buildEvaluationContext = async (
  telemetry: NormalizedTelemetry,
  historyEntries?: SnapshotHistoryEntry[],
): Promise<BatteryEvaluationContext> => {
  const currentTimestamp = new Date(telemetry.snapshotTimestamp).getTime();
  const historySnapshots =
    historyEntries ??
    (await getRecentSnapshots(telemetry.vehicleId, HISTORY_SNAPSHOT_LIMIT)).map(
      (snapshot) => ({
        snapshotTimestamp: snapshot.snapshotTimestamp,
        batteryPercentage: snapshot.batteryPercentage,
        speedKmph: snapshot.speedKmph,
        engineOn: snapshot.engineOn,
        charging: snapshot.charging,
      }),
    );

  const chronologicalSnapshots = toChronologicalSnapshots(
    historySnapshots,
    currentTimestamp,
  );

  const idleDurationMinutes = computeIdleDuration(
    telemetry,
    chronologicalSnapshots,
    currentTimestamp,
  );

  const { durationMinutes: chargingDurationMinutes, deltaPercentage } =
    computeChargingStats(telemetry, chronologicalSnapshots, currentTimestamp);

  const rapidSnapshots = toRapidSnapshots(chronologicalSnapshots.slice(-5));

  return {
    telemetry,
    idleDurationMinutes,
    chargingDurationMinutes,
    chargeDeltaDuringCharge: deltaPercentage,
    recentSnapshots: rapidSnapshots,
  };
};

export const recordTelemetry = async (
  telemetry: NormalizedTelemetry,
): Promise<TelemetryRecordResult> => {
  const context = await buildEvaluationContext(telemetry);
  const evaluation = evaluateBatteryHealth(context);
  const alerts = buildAlertsFromImpacts(evaluation.ruleImpacts);
  const tips = buildDriverTipsFromImpacts(evaluation.ruleImpacts);

  await insertSnapshot({
    vehicleId: telemetry.vehicleId,
    snapshotTimestamp: telemetry.snapshotTimestamp,
    batteryPercentage: telemetry.batteryPercentage,
    speedKmph: telemetry.speedKmph,
    engineOn: telemetry.engineOn,
    charging: telemetry.charging,
    ambientTemperature: telemetry.ambientTemperature,
    odometerKm: telemetry.odometerKm,
  });

  await upsertVehicle({
    vehicleId: telemetry.vehicleId,
    lastSeenAt: telemetry.snapshotTimestamp,
    lastHealthScore: evaluation.score,
    metadata: null,
  });

  await insertInsightLog({
    vehicleId: telemetry.vehicleId,
    healthScore: evaluation.score,
    status: evaluation.status,
    alerts,
    tips,
  });

  return {
    vehicleId: telemetry.vehicleId,
    score: evaluation.score,
    status: evaluation.status,
    evaluation,
    alerts,
    tips,
  };
};
