import { getDatabase } from '../sqlite';

type UpsertVehicleInput = {
  vehicleId: string;
  lastSeenAt: string;
  lastHealthScore: number | null;
  metadata?: Record<string, unknown> | null;
};

export type VehicleRecord = {
  vehicleId: string;
  lastSeenAt: string | null;
  lastHealthScore: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type VehicleRow = {
  vehicleId: string;
  lastSeenAt: string | null;
  lastHealthScore: number | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapVehicleRow = (row: VehicleRow): VehicleRecord => {
  let metadata: Record<string, unknown> | null = null;
  if (typeof row.metadata === 'string') {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch (parseError) {
      metadata = null;
    }
  }

  return {
    vehicleId: row.vehicleId,
    lastSeenAt: row.lastSeenAt,
    lastHealthScore: row.lastHealthScore,
    metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const upsertVehicle = async ({
  vehicleId,
  lastSeenAt,
  lastHealthScore,
  metadata,
}: UpsertVehicleInput): Promise<void> => {
  const db = await getDatabase();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO vehicles (vehicle_id, last_seen_at, last_health_score, metadata, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(vehicle_id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         last_health_score = excluded.last_health_score,
         metadata = excluded.metadata,
         updated_at = CURRENT_TIMESTAMP;`,
      [vehicleId, lastSeenAt, lastHealthScore, metadataJson],
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

export const getVehicleById = async (
  vehicleId: string,
): Promise<VehicleRecord | null> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    db.get<VehicleRow>(
      `SELECT vehicle_id AS vehicleId,
              last_seen_at AS lastSeenAt,
              last_health_score AS lastHealthScore,
              metadata,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM vehicles
       WHERE vehicle_id = ?;`,
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

        resolve(mapVehicleRow(row));
      },
    );
  });
};
