import { getDatabase } from '../sqlite';

type UpsertVehicleInput = {
  vehicleId: string;
  lastSeenAt: string;
  lastHealthScore: number | null;
  metadata?: Record<string, unknown> | null;
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
