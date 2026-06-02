"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.initDatabase = initDatabase;
exports.persist = persist;
/**
 * SQLite database via sql.js (pure JS, no native deps).
 * Database stored at: AppData/Roaming/ai-storyboard/data/storyboard.db
 */
const sql_js_1 = __importDefault(require("sql.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
let db = null;
function dbPath() {
    const dir = path_1.default.join(electron_1.app.getPath('userData'), 'data');
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return path_1.default.join(dir, 'storyboard.db');
}
function getDatabase() {
    return db;
}
async function initDatabase() {
    const SQL = await (0, sql_js_1.default)();
    const dbFile = dbPath();
    const backupFile = dbFile + '.backup';
    // Try loading existing DB
    if (fs_1.default.existsSync(dbFile)) {
        try {
            const buffer = fs_1.default.readFileSync(dbFile);
            db = new SQL.Database(buffer);
        }
        catch {
            // Corrupted — try backup
            if (fs_1.default.existsSync(backupFile)) {
                fs_1.default.copyFileSync(backupFile, dbFile);
                db = new SQL.Database(fs_1.default.readFileSync(dbFile));
            }
            else {
                db = new SQL.Database();
            }
        }
    }
    else {
        db = new SQL.Database();
    }
    createTables();
    autoBackup(dbFile, backupFile);
}
function createTables() {
    if (!db)
        return;
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
function autoBackup(dbFile, backupFile) {
    // Backup every 5 minutes
    setInterval(() => {
        if (db) {
            try {
                const data = db.export();
                fs_1.default.writeFileSync(dbFile, Buffer.from(data));
                fs_1.default.copyFileSync(dbFile, backupFile);
            }
            catch { }
        }
    }, 300000);
    // Save on app exit
    process.on('exit', () => {
        if (db) {
            try {
                fs_1.default.writeFileSync(dbFile, Buffer.from(db.export()));
            }
            catch { }
        }
    });
}
// Persist helper — call after writes
function persist() {
    if (!db)
        return;
    try {
        const dbFile = dbPath();
        fs_1.default.writeFileSync(dbFile, Buffer.from(db.export()));
    }
    catch { }
}
//# sourceMappingURL=db.js.map