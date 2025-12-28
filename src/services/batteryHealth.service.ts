import {
  rulesConfig,
  RuleIds,
  type HealthStatus,
  type RuleId,
} from '../rules/rules.config';
import type { NormalizedTelemetry } from '../models/telemetry';

export type RapidSnapshot = {
  snapshotTimestamp: string;
  batteryPercentage: number;
};

export type BatteryEvaluationContext = {
  telemetry: NormalizedTelemetry;
  idleDurationMinutes?: number;
  chargingDurationMinutes?: number;
  chargeDeltaDuringCharge?: number;
  recentSnapshots?: RapidSnapshot[];
};

export type RuleImpact = {
  id: RuleId;
  deduction: number;
  metadata?: Record<string, unknown>;
};

export type BatteryHealthEvaluation = {
  baseScore: number;
  score: number;
  status: HealthStatus;
  ruleImpacts: RuleImpact[];
};

const determineStatus = (score: number): HealthStatus => {
  const { statusBands } = rulesConfig;
  const matchingBand = statusBands.find((band) => score >= band.threshold);
  if (matchingBand) {
    return matchingBand.status;
  }

  return statusBands[statusBands.length - 1]?.status ?? 'POOR';
};

const evaluateDeepDischarge = (
  telemetry: NormalizedTelemetry,
  impacts: RuleImpact[],
): number => {
  const { deepDischarge } = rulesConfig;
  const { batteryPercentage } = telemetry;

  if (batteryPercentage < deepDischarge.criticalThreshold) {
    impacts.push({
      id: RuleIds.deepDischargeCritical,
      deduction: deepDischarge.critical.deduction,
      metadata: { batteryPercentage },
    });
    return deepDischarge.critical.deduction;
  }

  if (batteryPercentage < deepDischarge.warningThreshold) {
    impacts.push({
      id: RuleIds.deepDischargeWarning,
      deduction: deepDischarge.warning.deduction,
      metadata: { batteryPercentage },
    });
    return deepDischarge.warning.deduction;
  }

  return 0;
};

const evaluateIdleDrain = (
  telemetry: NormalizedTelemetry,
  context: BatteryEvaluationContext,
  impacts: RuleImpact[],
): number => {
  const { idleDrain } = rulesConfig;
  const duration = context.idleDurationMinutes ?? 0;

  if (!telemetry.engineOn || telemetry.speedKmph > 0) {
    return 0;
  }

  const intervals = Math.floor(duration / idleDrain.durationMinutes);
  if (intervals <= 0) {
    return 0;
  }

  const deduction = intervals * idleDrain.deductionPerInterval;
  impacts.push({
    id: RuleIds.idleDrain,
    deduction,
    metadata: { idleDurationMinutes: duration, intervals },
  });

  return deduction;
};

const evaluateRapidDrop = (
  telemetry: NormalizedTelemetry,
  context: BatteryEvaluationContext,
  impacts: RuleImpact[],
): number => {
  const { rapidDrop } = rulesConfig;
  const { recentSnapshots = [] } = context;
  if (recentSnapshots.length === 0) {
    return 0;
  }

  const windowMillis = rapidDrop.windowMinutes * 60 * 1000;
  const currentTimestamp = new Date(telemetry.snapshotTimestamp).getTime();

  const relevant = recentSnapshots.filter((snapshot) => {
    const snapshotTime = new Date(snapshot.snapshotTimestamp).getTime();
    return currentTimestamp - snapshotTime <= windowMillis;
  });

  if (relevant.length === 0) {
    return 0;
  }

  const maxPercentage = Math.max(
    telemetry.batteryPercentage,
    ...relevant.map((snapshot) => snapshot.batteryPercentage),
  );
  const drop = maxPercentage - telemetry.batteryPercentage;

  if (drop < rapidDrop.percentageDrop) {
    return 0;
  }

  impacts.push({
    id: RuleIds.rapidDrop,
    deduction: rapidDrop.deduction,
    metadata: { drop, windowMinutes: rapidDrop.windowMinutes },
  });

  return rapidDrop.deduction;
};

const evaluateTemperature = (
  telemetry: NormalizedTelemetry,
  impacts: RuleImpact[],
): number => {
  const { temperature } = rulesConfig;
  const { ambientTemperature } = telemetry;

  if (ambientTemperature === null) {
    return 0;
  }

  if (ambientTemperature > temperature.highCelsius) {
    impacts.push({
      id: RuleIds.temperatureHigh,
      deduction: temperature.highDeduction,
      metadata: { ambientTemperature },
    });
    return temperature.highDeduction;
  }

  if (ambientTemperature < temperature.lowCelsius) {
    impacts.push({
      id: RuleIds.temperatureLow,
      deduction: temperature.lowDeduction,
      metadata: { ambientTemperature },
    });
    return temperature.lowDeduction;
  }

  return 0;
};

const evaluateSlowCharge = (
  telemetry: NormalizedTelemetry,
  context: BatteryEvaluationContext,
  impacts: RuleImpact[],
): number => {
  const { slowCharge } = rulesConfig;
  if (!telemetry.charging) {
    return 0;
  }

  const duration = context.chargingDurationMinutes ?? 0;
  const delta = context.chargeDeltaDuringCharge ?? 0;

  if (duration < slowCharge.durationMinutes) {
    return 0;
  }

  if (delta >= slowCharge.minRatePercentage) {
    return 0;
  }

  impacts.push({
    id: RuleIds.slowCharge,
    deduction: 0,
    metadata: { durationMinutes: duration, progressDelta: delta },
  });
  return 0;
};

export const evaluateBatteryHealth = (
  context: BatteryEvaluationContext,
): BatteryHealthEvaluation => {
  const impacts: RuleImpact[] = [];
  const { telemetry } = context;

  let totalDeduction = 0;
  totalDeduction += evaluateDeepDischarge(telemetry, impacts);
  totalDeduction += evaluateIdleDrain(telemetry, context, impacts);
  totalDeduction += evaluateRapidDrop(telemetry, context, impacts);
  totalDeduction += evaluateTemperature(telemetry, impacts);
  totalDeduction += evaluateSlowCharge(telemetry, context, impacts);

  const score = Math.max(0, rulesConfig.baseScore - totalDeduction);
  const status = determineStatus(score);

  return {
    baseScore: rulesConfig.baseScore,
    score,
    status,
    ruleImpacts: impacts,
  };
};
