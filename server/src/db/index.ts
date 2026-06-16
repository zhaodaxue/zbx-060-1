import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function initDatabase(): Database.Database {
  const dataDir = path.resolve(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'warehouse.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  return db;
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      material_code TEXT NOT NULL,
      batch_no TEXT NOT NULL UNIQUE,
      total_quantity INTEGER NOT NULL DEFAULT 0,
      remaining_quantity INTEGER NOT NULL DEFAULT 0,
      latest_inbound_time TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_batches_material_code ON batches(material_code);
    CREATE INDEX IF NOT EXISTS idx_batches_remaining ON batches(remaining_quantity);

    CREATE TABLE IF NOT EXISTS inbound_records (
      id TEXT PRIMARY KEY,
      inbound_no TEXT NOT NULL UNIQUE,
      material_code TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      inbound_time TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inbound_time ON inbound_records(inbound_time);
    CREATE INDEX IF NOT EXISTS idx_inbound_batch_no ON inbound_records(batch_no);

    CREATE TABLE IF NOT EXISTS outbound_records (
      id TEXT PRIMARY KEY,
      outbound_no TEXT NOT NULL UNIQUE,
      batch_id TEXT NOT NULL,
      material_code TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      receiver_code TEXT NOT NULL,
      outbound_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_outbound_time ON outbound_records(outbound_time);
    CREATE INDEX IF NOT EXISTS idx_outbound_batch_id ON outbound_records(batch_id);
  `);
}

export function getDb(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}
