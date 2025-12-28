import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

import { logger } from '../utils/logger';

sqlite3.verbose();

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'battery.sqlite');
const resolveMigrationsDirectory = (migrationsDir?: string): string =>
  migrationsDir || path.resolve(process.cwd(), 'migrations');

let db: sqlite3.Database | null = null;

const resolveDatabasePath = (): string => {
  const configured = process.env.DATABASE_PATH;
  if (configured && configured.trim().length > 0) {
    return configured;
  }

  return DEFAULT_DB_PATH;
};

const ensureDirectory = (targetPath: string): void => {
  if (targetPath === ':memory:' || targetPath.startsWith('file:')) {
    return;
  }

  const directory = path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });
};

const run = (
  database: sqlite3.Database,
  sql: string,
  params: unknown[] = [],
): Promise<void> =>
  new Promise((resolve, reject) => {
    database.run(sql, params, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const all = <T>(
  database: sqlite3.Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> =>
  new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows as T[]);
    });
  });

const exec = async (database: sqlite3.Database, sql: string): Promise<void> => {
  const execAsync = promisify(database.exec.bind(database));
  await execAsync(sql);
};

const ensureMigrationsTable = async (database: sqlite3.Database): Promise<void> => {
  await exec(
    database,
    `CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  );
};

const listAppliedMigrations = async (
  database: sqlite3.Database,
): Promise<Set<string>> => {
  type Row = { name: string };
  const rows = await all<Row>(database, 'SELECT name FROM migrations ORDER BY name ASC;');
  return new Set(rows.map((row) => row.name));
};

const createDatabase = async (): Promise<sqlite3.Database> => {
  if (db) {
    return db;
  }

  const databasePath = resolveDatabasePath();
  ensureDirectory(databasePath);

  db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const instance = new sqlite3.Database(databasePath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(instance);
    });
  });

  db.configure('busyTimeout', 5000);
  await exec(db, 'PRAGMA foreign_keys = ON;');
  logger.info({ databasePath }, 'sqlite database ready');
  return db;
};

const applyMigration = async (
  database: sqlite3.Database,
  name: string,
  sql: string,
): Promise<void> => {
  logger.info({ migration: name }, 'running migration');
  await exec(database, sql);
  await run(database, 'INSERT INTO migrations (name) VALUES (?);', [name]);
};

export const getDatabase = async (): Promise<sqlite3.Database> => {
  if (db) {
    return db;
  }

  return createDatabase();
};

export const closeDatabase = async (): Promise<void> => {
  if (!db) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    db?.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  logger.info('sqlite connection closed');
  db = null;
};

export const runMigrations = async (migrationsDir?: string): Promise<void> => {
  const database = await getDatabase();
  await ensureMigrationsTable(database);

  const directory = resolveMigrationsDirectory(migrationsDir);
  if (!fs.existsSync(directory)) {
    logger.warn({ directory }, 'no migrations directory found, skipping');
    return;
  }

  const applied = await listAppliedMigrations(database);
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
    .sort();

  await files.reduce<Promise<void>>(async (previous, file) => {
    await previous;

    const migrationName = file.replace(/\.sql$/, '');
    if (applied.has(migrationName)) {
      return Promise.resolve();
    }

    const filePath = path.join(directory, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    await applyMigration(database, migrationName, sql);

    return Promise.resolve();
  }, Promise.resolve());

  logger.info('migration check complete');
};

export const getDatabasePath = (): string => resolveDatabasePath();

export type DatabaseHealth = {
  connected: boolean;
  path: string;
  lastMigration?: string | null;
  error?: string;
};

export const getDatabaseHealth = async (): Promise<DatabaseHealth> => {
  const database = await getDatabase();
  try {
    await ensureMigrationsTable(database);
    type Row = { name: string | null };
    const rows = await all<Row>(
      database,
      'SELECT name FROM migrations ORDER BY applied_at DESC LIMIT 1;',
    );
    const lastMigration = rows[0]?.name ?? null;
    return {
      connected: true,
      path: getDatabasePath(),
      lastMigration,
    };
  } catch (error) {
    logger.error({ error }, 'database health check failed');
    return {
      connected: false,
      path: getDatabasePath(),
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
};

export type MigrationStatus = {
  applied: string[];
  pending: string[];
};

export const getMigrationStatus = async (
  migrationsDir?: string,
): Promise<MigrationStatus> => {
  const database = await getDatabase();
  await ensureMigrationsTable(database);

  const appliedSet = await listAppliedMigrations(database);
  const applied = Array.from(appliedSet.values()).sort();

  const directory = resolveMigrationsDirectory(migrationsDir);
  if (!fs.existsSync(directory)) {
    return { applied, pending: [] };
  }

  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
    .sort();

  const pending = files
    .map((file) => file.replace(/\.sql$/, ''))
    .filter((name) => !appliedSet.has(name));

  return { applied, pending };
};
