BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id TEXT PRIMARY KEY,
  last_seen_at TEXT,
  last_health_score INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telemetry_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id TEXT NOT NULL,
  snapshot_timestamp TEXT NOT NULL,
  battery_percentage REAL NOT NULL,
  speed_kmph REAL NOT NULL,
  engine_on INTEGER NOT NULL,
  charging INTEGER NOT NULL,
  ambient_temperature REAL,
  odometer_km REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_vehicle_timestamp
  ON telemetry_snapshots (vehicle_id, snapshot_timestamp DESC);

CREATE TABLE IF NOT EXISTS insights_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id TEXT NOT NULL,
  health_score INTEGER NOT NULL,
  status TEXT NOT NULL,
  alerts_json TEXT NOT NULL,
  tips_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_insights_log_vehicle_created
  ON insights_log (vehicle_id, created_at DESC);

COMMIT;
