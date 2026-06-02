/**
 * SQLite database via sql.js (pure JS, no native deps).
 * Database stored at: AppData/Roaming/ai-storyboard/data/storyboard.db
 */
import initSqlJs, { Database as SqlJsDB } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: SqlJsDB | null = null;

function dbPath(): string {
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'storyboard.db');
}

export function getDatabase(): SqlJsDB | null {
  return db;
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();
  const dbFile = dbPath();
  const backupFile = dbFile + '.backup';

  // Try loading existing DB
  if (fs.existsSync(dbFile)) {
    try {
      const buffer = fs.readFileSync(dbFile);
      db = new SQL.Database(buffer);
    } catch {
      // Corrupted — try backup
      if (fs.existsSync(backupFile)) {
        fs.copyFileSync(backupFile, dbFile);
        db = new SQL.Database(fs.readFileSync(dbFile));
      } else {
        db = new SQL.Database();
      }
    }
  } else {
    db = new SQL.Database();
  }

  createTables();
  autoBackup(dbFile, backupFile);
}

function createTables() {
  if (!db) return;
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT DEFAULT '未命名项目',
    createdAt TEXT, updatedAt TEXT, aiConfig TEXT DEFAULT '{}')`);
  db.run(`CREATE TABLE IF NOT EXISTS sequences (
    id TEXT PRIMARY KEY, projectId TEXT,
    name TEXT DEFAULT '默认序列', description TEXT DEFAULT '',
    startTime TEXT DEFAULT '', endTime TEXT DEFAULT '',
    videoSegments TEXT DEFAULT '[]',
    orderIndex INTEGER DEFAULT 0, createdAt TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS shots (
    id TEXT PRIMARY KEY, projectId TEXT, sequenceId TEXT,
    title TEXT DEFAULT '', description TEXT DEFAULT '',
    variants TEXT DEFAULT '[]',
    startTime TEXT DEFAULT '', endTime TEXT DEFAULT '', duration TEXT DEFAULT '',
    tags TEXT DEFAULT '[]', metadata TEXT DEFAULT '{}',
    orderIndex INTEGER DEFAULT 0, createdAt TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sequences_project ON sequences(projectId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shots_project ON shots(projectId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shots_sequence ON shots(sequenceId)`);
}

function autoBackup(dbFile: string, backupFile: string) {
  // Backup every 5 minutes
  setInterval(() => {
    if (db) {
      try {
        const data = db.export();
        fs.writeFileSync(dbFile, Buffer.from(data));
        fs.copyFileSync(dbFile, backupFile);
      } catch {}
    }
  }, 300000);

  // Save on app exit
  process.on('exit', () => {
    if (db) {
      try { fs.writeFileSync(dbFile, Buffer.from(db.export())); } catch {}
    }
  });
}

// Persist helper — call after writes
export function persist() {
  if (!db) return;
  try {
    const dbFile = dbPath();
    fs.writeFileSync(dbFile, Buffer.from(db.export()));
  } catch {}
}
