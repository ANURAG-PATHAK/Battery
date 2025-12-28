import { z } from 'zod';

const isoDateString = z
  .string()
  .min(1, 'timestamp is required')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'timestamp must be ISO-8601');

const telemetryBaseSchema = z.object({
  vehicleId: z.string().min(1, 'vehicleId is required'),
  timestamp: isoDateString,
  batteryPercentage: z.number().min(0).max(100),
  speedKmph: z.number().min(0),
  engineOn: z.boolean(),
  charging: z.boolean(),
  ambientTemperature: z.number().finite().optional(),
  odometerKm: z.number().min(0).optional(),
});

export type TelemetryPayload = z.infer<typeof telemetryBaseSchema>;

export type NormalizedTelemetry = {
  vehicleId: string;
  snapshotTimestamp: string;
  batteryPercentage: number;
  speedKmph: number;
  engineOn: boolean;
  charging: boolean;
  ambientTemperature: number | null;
  odometerKm: number | null;
  rawTimestamp: string;
};

export const telemetryPayloadSchema = telemetryBaseSchema.transform<NormalizedTelemetry>(
  (payload) => ({
    vehicleId: payload.vehicleId.trim(),
    snapshotTimestamp: new Date(payload.timestamp).toISOString(),
    batteryPercentage: payload.batteryPercentage,
    speedKmph: payload.speedKmph,
    engineOn: payload.engineOn,
    charging: payload.charging,
    ambientTemperature:
      typeof payload.ambientTemperature === 'number' ? payload.ambientTemperature : null,
    odometerKm: typeof payload.odometerKm === 'number' ? payload.odometerKm : null,
    rawTimestamp: payload.timestamp,
  }),
);

export const parseTelemetryPayload = (payload: unknown): NormalizedTelemetry =>
  telemetryPayloadSchema.parse(payload);
