import { buildAlertsFromImpacts } from './alert.service';
import { buildDriverTipsFromImpacts } from './driverTips.service';
import {
  evaluateBatteryHealth,
  type BatteryHealthEvaluation,
} from './batteryHealth.service';
import { buildEvaluationContext } from './telemetryRecorder.service';
import { getVehicleById } from '../db/repositories/vehicle.repository';
import { getLatestSnapshot } from '../db/repositories/telemetrySnapshot.repository';
import { getRecentInsights } from '../db/repositories/insights.repository';
import { notFoundError } from '../utils/errors';
import type { NormalizedTelemetry } from '../models/telemetry';
import type { Alert } from './alert.service';
import type { DriverTip } from './driverTips.service';

export type VehicleInsightHistoryEntry = {
  id: number;
  createdAt: string;
  healthScore: number;
  status: string;
  alerts: unknown;
  tips: unknown;
};

export type VehicleInsights = {
  vehicleId: string;
  score: number;
  status: BatteryHealthEvaluation['status'];
  telemetry: NormalizedTelemetry;
  evaluation: BatteryHealthEvaluation;
  alerts: Alert[];
  tips: DriverTip[];
  history: VehicleInsightHistoryEntry[];
  lastSeenAt: string;
};

const HISTORY_LIMIT = 10;

const mapSnapshotToTelemetry = (snapshot: {
  vehicleId: string;
  snapshotTimestamp: string;
  batteryPercentage: number;
  speedKmph: number;
  engineOn: boolean;
  charging: boolean;
  ambientTemperature: number | null;
  odometerKm: number | null;
}): NormalizedTelemetry => ({
  vehicleId: snapshot.vehicleId,
  snapshotTimestamp: snapshot.snapshotTimestamp,
  rawTimestamp: snapshot.snapshotTimestamp,
  batteryPercentage: snapshot.batteryPercentage,
  speedKmph: snapshot.speedKmph,
  engineOn: snapshot.engineOn,
  charging: snapshot.charging,
  ambientTemperature: snapshot.ambientTemperature,
  odometerKm: snapshot.odometerKm,
});

export const getVehicleInsights = async (vehicleId: string): Promise<VehicleInsights> => {
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) {
    throw notFoundError(`Vehicle ${vehicleId} has not been registered yet.`);
  }

  const latestSnapshot = await getLatestSnapshot(vehicleId);
  if (!latestSnapshot) {
    throw notFoundError(`No telemetry available yet for vehicle ${vehicleId}.`);
  }

  const telemetry = mapSnapshotToTelemetry(latestSnapshot);
  const context = await buildEvaluationContext(telemetry);
  const evaluation = evaluateBatteryHealth(context);
  const alerts = buildAlertsFromImpacts(evaluation.ruleImpacts);
  const tips = buildDriverTipsFromImpacts(evaluation.ruleImpacts);
  const historyRecords = await getRecentInsights(vehicleId, HISTORY_LIMIT);

  const history = historyRecords.map((record) => ({
    id: record.id,
    createdAt: record.createdAt,
    healthScore: record.healthScore,
    status: record.status,
    alerts: record.alerts,
    tips: record.tips,
  }));

  return {
    vehicleId,
    score: evaluation.score,
    status: evaluation.status,
    telemetry,
    evaluation,
    alerts,
    tips,
    history,
    lastSeenAt: vehicle.lastSeenAt ?? telemetry.snapshotTimestamp,
  };
};
