import type { NormalizedTelemetry } from '../../models/telemetry';
import type { SmartcarVehicleTelemetry } from '../../services/smartcar.service';

export const mapSmartcarTelemetryToNormalized = (
  snapshot: SmartcarVehicleTelemetry,
): NormalizedTelemetry => {
  const timestamp = snapshot.fetchedAt;

  return {
    vehicleId: snapshot.vehicleId,
    snapshotTimestamp: timestamp,
    rawTimestamp: timestamp,
    batteryPercentage:
      typeof snapshot.batteryPercentage === 'number' ? snapshot.batteryPercentage : 0,
    speedKmph: 0,
    engineOn: snapshot.engineOn,
    charging: snapshot.isCharging,
    ambientTemperature: null,
    odometerKm: snapshot.odometerKm,
  } satisfies NormalizedTelemetry;
};
