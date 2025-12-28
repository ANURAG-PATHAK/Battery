BEGIN TRANSACTION;

DROP TABLE IF EXISTS insights_log;
DROP TABLE IF EXISTS telemetry_snapshots;
DROP TABLE IF EXISTS vehicles;
DELETE FROM migrations WHERE name = '0001_initial';

COMMIT;
