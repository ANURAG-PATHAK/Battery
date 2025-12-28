import { getDatabase } from '../sqlite';

export type SmartcarTokenRecord = {
  id: number;
  userId: string;
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresAt: string;
  refreshExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SmartcarTokenRow = {
  id: number;
  userId: string;
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresAt: string;
  refreshExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: SmartcarTokenRow): SmartcarTokenRecord => ({
  id: row.id,
  userId: row.userId,
  accessToken: row.accessToken,
  refreshToken: row.refreshToken,
  scope: row.scope,
  expiresAt: row.expiresAt,
  refreshExpiresAt: row.refreshExpiresAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const upsertSmartcarToken = async (input: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresAt: string;
  refreshExpiresAt?: string | null;
}): Promise<void> => {
  const db = await getDatabase();
  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO smartcar_tokens (user_id, access_token, refresh_token, scope, expires_at, refresh_expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         scope = excluded.scope,
         expires_at = excluded.expires_at,
         refresh_expires_at = excluded.refresh_expires_at,
         updated_at = CURRENT_TIMESTAMP;`,
      [
        input.userId,
        input.accessToken,
        input.refreshToken,
        input.scope,
        input.expiresAt,
        input.refreshExpiresAt ?? null,
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

export const listSmartcarTokens = async (): Promise<SmartcarTokenRecord[]> => {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all<SmartcarTokenRow>(
      `SELECT id,
              user_id AS userId,
              access_token AS accessToken,
              refresh_token AS refreshToken,
              scope,
              expires_at AS expiresAt,
              refresh_expires_at AS refreshExpiresAt,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM smartcar_tokens
       ORDER BY updated_at DESC;`,
      (error, rows) => {
        if (error) {
          reject(error);
          return;
        }

        resolve((rows ?? []).map((row) => mapRow(row)));
      },
    );
  });
};

export const getSmartcarTokenByUserId = async (
  userId: string,
): Promise<SmartcarTokenRecord | null> => {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.get<SmartcarTokenRow>(
      `SELECT id,
              user_id AS userId,
              access_token AS accessToken,
              refresh_token AS refreshToken,
              scope,
              expires_at AS expiresAt,
              refresh_expires_at AS refreshExpiresAt,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM smartcar_tokens
       WHERE user_id = ?;`,
      [userId],
      (error, row) => {
        if (error) {
          reject(error);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve(mapRow(row));
      },
    );
  });
};

export const deleteSmartcarToken = async (userId: string): Promise<void> => {
  const db = await getDatabase();
  await new Promise<void>((resolve, reject) => {
    db.run('DELETE FROM smartcar_tokens WHERE user_id = ?;', [userId], (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};
