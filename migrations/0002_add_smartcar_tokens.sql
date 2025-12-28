CREATE TABLE IF NOT EXISTS smartcar_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  refresh_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_smartcar_tokens_updated_at
AFTER UPDATE ON smartcar_tokens
FOR EACH ROW
BEGIN
  UPDATE smartcar_tokens SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
