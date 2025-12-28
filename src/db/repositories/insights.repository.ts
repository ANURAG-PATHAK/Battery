import { getDatabase } from '../sqlite';

export type InsightLogInput = {
  vehicleId: string;
  healthScore: number;
  status: string;
  alerts: unknown;
  tips: unknown;
};

export const insertInsightLog = async ({
  vehicleId,
  healthScore,
  status,
  alerts,
  tips,
}: InsightLogInput): Promise<void> => {
  const db = await getDatabase();

  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO insights_log (
        vehicle_id,
        health_score,
        status,
        alerts_json,
        tips_json
      ) VALUES (?, ?, ?, ?, ?);`,
      [vehicleId, healthScore, status, JSON.stringify(alerts), JSON.stringify(tips)],
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
