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

export type SnapshotRecord = {
  id: number;
  vehicleId: string;
  snapshotTimestamp: string;
  batteryPercentage: number;
  speedKmph: number;
  engineOn: boolean;
  charging: boolean;
  ambientTemperature: number | null;
  odometerKm: number | null;
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

const mapSnapshotRow = (row: Record<string, unknown>): SnapshotRecord => ({
  id: Number(row.id),
  vehicleId: String(row.vehicle_id),
  snapshotTimestamp: String(row.snapshot_timestamp),
  batteryPercentage: Number(row.battery_percentage),
  speedKmph: Number(row.speed_kmph),
  engineOn: Number(row.engine_on) === 1,
  charging: Number(row.charging) === 1,
  ambientTemperature:
    typeof row.ambient_temperature === 'number' ? row.ambient_temperature : null,
  odometerKm: typeof row.odometer_km === 'number' ? row.odometer_km : null,
});

export const getLatestSnapshot = async (
  vehicleId: string,
): Promise<SnapshotRecord | null> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id,
              vehicle_id,
              snapshot_timestamp,
              battery_percentage,
              speed_kmph,
              engine_on,
              charging,
              ambient_temperature,
              odometer_km
       FROM telemetry_snapshots
       WHERE vehicle_id = ?
       ORDER BY snapshot_timestamp DESC
       LIMIT 1;`,
      [vehicleId],
      (error, row) => {
        if (error) {
          reject(error);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve(mapSnapshotRow(row as Record<string, unknown>));
      },
    );
  });
};

export const getRecentSnapshots = async (
  vehicleId: string,
  limit: number,
): Promise<SnapshotRecord[]> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id,
              vehicle_id,
              snapshot_timestamp,
              battery_percentage,
              speed_kmph,
              engine_on,
              charging,
              ambient_temperature,
              odometer_km
       FROM telemetry_snapshots
       WHERE vehicle_id = ?
       ORDER BY snapshot_timestamp DESC
       LIMIT ?;`,
      [vehicleId, limit],
      (error, rows) => {
        if (error) {
          reject(error);
          return;
        }

        const snapshots = (rows ?? []).map((row) =>
          mapSnapshotRow(row as Record<string, unknown>),
        );
        resolve(snapshots);
      },
    );
  });
};
