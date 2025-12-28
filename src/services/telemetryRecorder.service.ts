import type { HealthStatus } from '../rules/rules.config';
import { buildAlertsFromImpacts, type Alert } from './alert.service';
import {
  evaluateBatteryHealth,
  type BatteryEvaluationContext,
  type BatteryHealthEvaluation,
} from './batteryHealth.service';
import { buildDriverTipsFromImpacts, type DriverTip } from './driverTips.service';
import { insertSnapshot } from '../db/repositories/telemetrySnapshot.repository';
import { upsertVehicle } from '../db/repositories/vehicle.repository';
import { insertInsightLog } from '../db/repositories/insights.repository';

export type TelemetryRecordResult = {
  vehicleId: string;
  score: number;
  status: HealthStatus;
  evaluation: BatteryHealthEvaluation;
  alerts: Alert[];
  tips: DriverTip[];
};

export const recordTelemetry = async (
  context: BatteryEvaluationContext,
): Promise<TelemetryRecordResult> => {
  const evaluation = evaluateBatteryHealth(context);
  const alerts = buildAlertsFromImpacts(evaluation.ruleImpacts);
  const tips = buildDriverTipsFromImpacts(evaluation.ruleImpacts);

  const { telemetry } = context;

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
