import { getDatabase } from '../sqlite';

export type InsightLogInput = {
  vehicleId: string;
  healthScore: number;
  status: string;
  alerts: unknown;
  tips: unknown;
};

export type InsightRecord = {
  id: number;
  vehicleId: string;
  healthScore: number;
  status: string;
  alerts: unknown;
  tips: unknown;
  createdAt: string;
};

type InsightRow = {
  id: number;
  vehicleId: string;
  healthScore: number;
  status: string;
  alertsJson: string | null;
  tipsJson: string | null;
  createdAt: string;
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

const safeParseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    return null;
  }
};

export const getRecentInsights = async (
  vehicleId: string,
  limit: number,
): Promise<InsightRecord[]> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    db.all<InsightRow>(
      `SELECT id,
              vehicle_id AS vehicleId,
              health_score AS healthScore,
              status,
              alerts_json AS alertsJson,
              tips_json AS tipsJson,
              created_at AS createdAt
       FROM insights_log
       WHERE vehicle_id = ?
       ORDER BY created_at DESC
       LIMIT ?;`,
      [vehicleId, limit],
      (error, rows) => {
        if (error) {
          reject(error);
          return;
        }

        const insightRows = rows ?? [];
        const insights = insightRows.map((row) => ({
          id: Number(row.id),
          vehicleId: row.vehicleId,
          healthScore: row.healthScore,
          status: row.status,
          alerts: safeParseJson(row.alertsJson),
          tips: safeParseJson(row.tipsJson),
          createdAt: row.createdAt,
        }));
        resolve(insights);
      },
    );
  });
};
