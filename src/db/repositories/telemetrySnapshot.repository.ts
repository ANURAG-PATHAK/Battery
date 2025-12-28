import { getDatabase } from '../sqlite';

type InsertSnapshotInput = {
  vehicleId: string;
  snapshotTimestamp: string;
  batteryPercentage: number;
  speedKmph: number;
  engineOn: boolean;
  charging: boolean;
  ambientTemperature?: number | null;
  odometerKm?: number | null;
};

export const insertSnapshot = async ({
  vehicleId,
  snapshotTimestamp,
  batteryPercentage,
  speedKmph,
  engineOn,
  charging,
  ambientTemperature = null,
  odometerKm = null,
}: InsertSnapshotInput): Promise<void> => {
  const db = await getDatabase();

  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO telemetry_snapshots (
        vehicle_id,
        snapshot_timestamp,
        battery_percentage,
        speed_kmph,
        engine_on,
        charging,
        ambient_temperature,
        odometer_km
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        vehicleId,
        snapshotTimestamp,
        batteryPercentage,
        speedKmph,
        engineOn ? 1 : 0,
        charging ? 1 : 0,
        ambientTemperature,
        odometerKm,
      ],
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
};
