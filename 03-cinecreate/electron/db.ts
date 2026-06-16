/**
 * SQLite database via sql.js (pure JS, no native deps).
 * Database stored at: AppData/Roaming/ai-storyboard/data/storyboard.db
 */
import initSqlJs, { Database as SqlJsDB } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

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
  // AI Director tables
  db.run(`CREATE TABLE IF NOT EXISTS ai_story (
    id TEXT PRIMARY KEY, projectId TEXT,
    title TEXT DEFAULT '', logline TEXT DEFAULT '',
    fullContent TEXT DEFAULT '{}',
    status TEXT DEFAULT 'draft', createdAt TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS ai_character (
    id TEXT PRIMARY KEY, storyId TEXT, projectId TEXT,
    name TEXT DEFAULT '', age TEXT DEFAULT '',
    appearance TEXT DEFAULT '', costume TEXT DEFAULT '',
    personality TEXT DEFAULT '', background TEXT DEFAULT '',
    portraitPrompt TEXT DEFAULT '', role TEXT DEFAULT '配角',
    createdAt TEXT)`);
  // Documents Center
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, projectId TEXT NOT NULL, parentId TEXT,
    type TEXT DEFAULT 'document', title TEXT NOT NULL,
    content TEXT DEFAULT '', metadata TEXT DEFAULT '{}',
    sortOrder INTEGER DEFAULT 0, createdAt TEXT, updatedAt TEXT)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sequences_project ON sequences(projectId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shots_project ON shots(projectId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_aistory_project ON ai_story(projectId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_aicharacter_story ON ai_character(storyId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(projectId)`);
  // Drafts (AI video creation workflow)
  db.run(`CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY, projectId TEXT NOT NULL,
    name TEXT DEFAULT '草稿V1',
    currentStep INTEGER DEFAULT 1,
    confirmedAssets TEXT DEFAULT '{}',
    conversation TEXT DEFAULT '[]',
    createdAt TEXT, updatedAt TEXT)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_drafts_project ON drafts(projectId)`);
  // Migrate old draft schema if needed
  try {
    const cols = db.exec("PRAGMA table_info(drafts)");
    if (cols.length) {
      const names = cols[0].values.map((r:any) => r[1]);
      if (names.includes('story') && !names.includes('confirmedAssets')) {
        db.run("ALTER TABLE drafts ADD COLUMN currentStep INTEGER DEFAULT 1");
        db.run("ALTER TABLE drafts ADD COLUMN confirmedAssets TEXT DEFAULT '{}'");
      }
    }
  } catch {}
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

// Seed sample project on first launch
function run(sql: string, params: any[] = []) { if (db) { db.run(sql, params); } }
function qAll(sql: string, params: any[] = []): any[] {
  if (!db) return [];
  const stmt = db.prepare(sql); stmt.bind(params); const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free(); return rows;
}

export function seedSampleProject(forceName?: string) {
  if (!db) return null;
  try {
    if (!forceName) {
      const r = qAll('SELECT COUNT(*) as c FROM projects');
      if (r[0]?.c > 0) return null;
    }

    // Find sample JSON — production: resourcesPath, dev: appPath
    let jsonPath = path.join(process.resourcesPath || '', 'sample-project.json');
    if (!fs.existsSync(jsonPath)) {
      jsonPath = path.join(app.getAppPath(), 'public', 'sample-project.json');
    }
    if (!fs.existsSync(jsonPath)) {
      jsonPath = path.join(app.getAppPath(), '..', 'public', 'sample-project.json');
    }
    if (!fs.existsSync(jsonPath)) return null;

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.project) return null;

    const now = new Date().toISOString();
    const pid = uuidv4();

    // Create project
    run('INSERT INTO projects (id,name,createdAt,updatedAt,aiConfig) VALUES (?,?,?,?,?)',
      [pid, forceName || '案例（默认）', now, now, '{}']);

    // Import blobs
    if (data.blobs) {
      const blobDir = path.join(app.getPath('userData'), 'blobs');
      if (!fs.existsSync(blobDir)) fs.mkdirSync(blobDir, { recursive: true });
      for (const [blobId, b64] of Object.entries(data.blobs)) {
        try {
          fs.writeFileSync(path.join(blobDir, blobId), Buffer.from(b64 as string, 'base64'));
        } catch {}
      }
    }

    // Import sequences
    const seqIdMap: Record<string, string> = {};
    if (data.sequences) {
      for (const seq of data.sequences) {
        const sid = uuidv4();
        run('INSERT INTO sequences (id,projectId,name,description,startTime,endTime,orderIndex,createdAt) VALUES (?,?,?,?,?,?,?,?)',
          [sid, pid, seq.name, seq.description||'', seq.startTime||'', seq.endTime||'', seq.orderIndex||0, now]);
        seqIdMap[seq.id] = sid;
      }
    }

    // Import shots
    if (data.shots) {
      for (const shot of data.shots) {
        const sid = uuidv4();
        const meta = typeof shot.metadata === 'string' ? shot.metadata : JSON.stringify(shot.metadata || {});
        run('INSERT INTO shots (id,projectId,sequenceId,title,description,variants,startTime,endTime,duration,tags,metadata,orderIndex,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [sid, pid, seqIdMap[shot.sequenceId]||'', shot.title||'', shot.description||'',
           typeof shot.variants==='string'?shot.variants:JSON.stringify(shot.variants||[]),
           shot.startTime||'', shot.endTime||'', shot.duration||'',
           typeof shot.tags==='string'?shot.tags:JSON.stringify(shot.tags||[]),
           meta, shot.orderIndex||0, now]);
      }
    }

    persist();
    console.log('Sample project seeded:', pid);
    return pid;
  } catch (e) { console.error('Seed failed:', e); return null; }
}

export function restoreSampleProject(name: string) {
  return seedSampleProject(name);
}

// Persist helper — call after writes
export function persist() {
  if (!db) return;
  try {
    const dbFile = dbPath();
    fs.writeFileSync(dbFile, Buffer.from(db.export()));
  } catch {}
}
