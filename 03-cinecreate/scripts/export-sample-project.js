/**
 * Export "案例（默认）" project as sample-project.json
 * Run: node scripts/export-sample-project.js
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'), 'cinecreate', 'data', 'storyboard.db');
const OUTPUT = path.join(__dirname, '..', 'src', 'sample-data', 'sample-project.json');
const BLOBS_DIR = path.join(process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'), 'cinecreate', 'blobs');

async function main() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
  function queryOne(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  }

  // Find the sample project
  const projects = queryAll('SELECT * FROM projects ORDER BY createdAt');
  const sample = projects.find(p => p.name === '案例（默认）' || p.name.includes('案例'));
  if (!sample) {
    console.error('ERROR: Could not find "案例（默认）" project');
    console.log('Available projects:', projects.map(p => p.id + ':' + p.name));
    process.exit(1);
  }
  console.log('Found sample project:', sample.id, sample.name);

  const pid = sample.id;

  // Collect all related data
  const sequences = queryAll('SELECT * FROM sequences WHERE projectId=? ORDER BY orderIndex', [pid]);
  const shots = queryAll('SELECT * FROM shots WHERE projectId=? ORDER BY orderIndex', [pid]);
  const drafts = queryAll('SELECT * FROM drafts WHERE projectId=? ORDER BY createdAt', [pid]);
  const stories = queryAll('SELECT * FROM ai_story WHERE projectId=? ORDER BY createdAt DESC', [pid]);
  const documents = queryAll('SELECT * FROM documents WHERE projectId=? ORDER BY sortOrder, createdAt', [pid]);
  const stationMeta = queryOne('SELECT value FROM meta WHERE key=?', [`station_${pid}`]);

  // Get characters for all stories
  let characters = [];
  for (const story of stories) {
    const chars = queryAll('SELECT * FROM ai_character WHERE storyId=? ORDER BY createdAt', [story.id]);
    characters.push(...chars);
  }

  // Export only referenced blobs
  const blobIds = new Set();
  for (const shot of shots) {
    try { const variants = JSON.parse(shot.variants || '[]'); for (const v of variants) { if (v.imageBlobId) blobIds.add(v.imageBlobId); } } catch {}
    try { const meta = JSON.parse(shot.metadata || '{}'); for (const a of (meta.sourceAssets || [])) { if (a.blobId) blobIds.add(a.blobId); } for (const v of (meta.videoOutputs || [])) { if (v.blobId) blobIds.add(v.blobId); } } catch {}
  }
  // Station blobs
  try {
    const stationItems = JSON.parse(stationMeta?.value || '[]');
    for (const item of stationItems) { if (item.blobId) blobIds.add(item.blobId); }
  } catch {}

  const blobs = {};
  for (const bid of blobIds) {
    const blobPath = path.join(BLOBS_DIR, bid);
    if (fs.existsSync(blobPath)) {
      blobs[bid] = fs.readFileSync(blobPath).toString('base64');
    }
  }

  const sampleData = {
    project: sample,
    sequences,
    shots,
    drafts,
    stories,
    characters,
    documents,
    station: stationMeta ? JSON.parse(stationMeta.value || '[]') : [],
    blobs,
    _meta: { exportedAt: new Date().toISOString(), version: '1.3.0' }
  };

  // Create output directory
  const outDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT, JSON.stringify(sampleData, null, 2));
  console.log(`Exported to ${OUTPUT}`);
  console.log(`  ${sequences.length} sequences, ${shots.length} shots, ${drafts.length} drafts`);
  console.log(`  ${stories.length} stories, ${characters.length} characters`);
  console.log(`  ${Object.keys(blobs).length} blobs`);

  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
