import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDatabase, getDatabase, persist } from './db';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: '影创 CineCreate',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  // Intercept all popups from webviews — two-pronged approach
  const blockPopups = (wc: any) => {
    try {
      wc.setWindowOpenHandler(({ url }: any) => {
        if (url && url !== 'about:blank' && mainWindow) {
          mainWindow.webContents.send('tool:open-tab', url);
        }
        return { action: 'deny' };
      });
    } catch {}
  };
  // Hook 1: when webview attaches to main window
  mainWindow.webContents.on('did-attach-webview', (_e, wc) => { blockPopups(wc); });
  // Hook 2: global catch-all for any new webContents
  app.on('web-contents-created', (_e, wc) => {
    if (wc.hostWebContents?.id === mainWindow?.webContents.id) {
      blockPopups(wc);
    }
  });

  // In dev mode (no built renderer), load from Vite; otherwise load built files
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  if (!fs.existsSync(rendererPath)) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(rendererPath);
  }
}

// sql.js query helpers
function db() { return getDatabase()!; }
function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db().prepare(sql); stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function queryOne(sql: string, params: any[] = []): any | undefined {
  const rows = queryAll(sql, params); return rows[0];
}
function exec(sql: string, params: any[] = []) {
  db().run(sql, params); persist();
}

async function bootstrap() {
  try { await initDatabase(); console.log('DB initialized:', !!getDatabase()); } catch (e) { console.error('DB init failed:', e); }
  createWindow();
}

app.whenReady().then(bootstrap);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC Handlers ────────────────────────────────

ipcMain.handle('db:getProjects', () => queryAll('SELECT * FROM projects ORDER BY createdAt'));
ipcMain.handle('db:createProject', (_e, name: string) => {
  const id = uuidv4(); const now = new Date().toISOString();
  exec('INSERT INTO projects (id,name,createdAt,updatedAt,aiConfig) VALUES (?,?,?,?,?)', [id,name,now,now,'{}']);
  return queryOne('SELECT * FROM projects WHERE id=?', [id]);
});
ipcMain.handle('db:updateProject', (_e, id: string, data: any) => {
  const now = new Date().toISOString();
  if (data.name) exec('UPDATE projects SET name=?, updatedAt=? WHERE id=?', [data.name, now, id]);
  return queryOne('SELECT * FROM projects WHERE id=?', [id]);
});
ipcMain.handle('db:deleteProject', (_e, id: string) => {
  exec('DELETE FROM projects WHERE id=?', [id]);
  exec('DELETE FROM sequences WHERE projectId=?', [id]);
  exec('DELETE FROM shots WHERE projectId=?', [id]);
});

ipcMain.handle('db:getSequences', (_e, projectId?: string) => {
  return projectId ? queryAll('SELECT * FROM sequences WHERE projectId=? ORDER BY orderIndex', [projectId])
    : queryAll('SELECT * FROM sequences ORDER BY orderIndex');
});
ipcMain.handle('db:createSequence', (_e, seq: any) => {
  const id = uuidv4(); const now = new Date().toISOString();
  exec('INSERT INTO sequences (id,projectId,name,description,startTime,endTime,orderIndex,createdAt) VALUES (?,?,?,?,?,?,?,?)',
    [id, seq.projectId, seq.name||'默认序列', seq.description||'', seq.startTime||'', seq.endTime||'', seq.orderIndex||0, now]);
  return queryOne('SELECT * FROM sequences WHERE id=?', [id]);
});
ipcMain.handle('db:updateSequence', (_e, id: string, data: any) => {
  const sets: string[] = []; const vals: any[] = [];
  if (data.name !== undefined) { sets.push('name=?'); vals.push(data.name); }
  if (data.videoSegments !== undefined) { sets.push('videoSegments=?'); vals.push(JSON.stringify(data.videoSegments)); }
  if (sets.length) { vals.push(id); exec(`UPDATE sequences SET ${sets.join(',')} WHERE id=?`, vals); }
  return queryOne('SELECT * FROM sequences WHERE id=?', [id]);
});
ipcMain.handle('db:deleteSequence', (_e, id: string) => {
  exec('DELETE FROM sequences WHERE id=?', [id]);
  exec('DELETE FROM shots WHERE sequenceId=?', [id]);
});

ipcMain.handle('db:getShots', (_e, projectId?: string) => {
  return projectId ? queryAll('SELECT * FROM shots WHERE projectId=? ORDER BY orderIndex', [projectId])
    : queryAll('SELECT * FROM shots ORDER BY orderIndex');
});
ipcMain.handle('db:createShot', (_e, shot: any) => {
  const id = uuidv4(); const now = new Date().toISOString();
  exec('INSERT INTO shots (id,projectId,sequenceId,title,description,variants,startTime,endTime,duration,tags,metadata,orderIndex,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, shot.projectId, shot.sequenceId, shot.title||'', shot.description||'', JSON.stringify(shot.variants||[]),
     shot.startTime||'', shot.endTime||'', shot.duration||'', JSON.stringify(shot.tags||[]), JSON.stringify(shot.metadata||{}),
     shot.orderIndex||0, now]);
  return queryOne('SELECT * FROM shots WHERE id=?', [id]);
});
ipcMain.handle('db:updateShot', (_e, id: string, data: any) => {
  const sets: string[] = []; const vals: any[] = [];
  const map: Record<string,string> = {title:'title',description:'description',startTime:'startTime',endTime:'endTime',duration:'duration',orderIndex:'orderIndex'};
  for (const [k,v] of Object.entries(map)) { if (data[k] !== undefined) { sets.push(`${v}=?`); vals.push(data[k]); } }
  if (data.variants !== undefined) { sets.push('variants=?'); vals.push(JSON.stringify(data.variants)); }
  if (data.tags !== undefined) { sets.push('tags=?'); vals.push(JSON.stringify(data.tags)); }
  if (data.metadata !== undefined) { sets.push('metadata=?'); vals.push(JSON.stringify(data.metadata)); }
  if (data.sequenceId !== undefined) { sets.push('sequenceId=?'); vals.push(data.sequenceId); }
  if (sets.length) { vals.push(id); exec(`UPDATE shots SET ${sets.join(',')} WHERE id=?`, vals); }
  return queryOne('SELECT * FROM shots WHERE id=?', [id]);
});
ipcMain.handle('db:deleteShot', (_e, id: string) => { exec('DELETE FROM shots WHERE id=?', [id]); });
ipcMain.handle('db:reorderShots', (_e, fromId: string, toId: string) => {
  const all = queryAll('SELECT * FROM shots ORDER BY orderIndex');
  const from = all.find((s:any)=>s.id===fromId), to = all.find((s:any)=>s.id===toId);
  if (!from||!to||from.sequenceId!==to.sequenceId) return {ok:false};
  const sq = all.filter((s:any)=>s.sequenceId===from.sequenceId);
  const fi = sq.findIndex((s:any)=>s.id===fromId), ti = sq.findIndex((s:any)=>s.id===toId);
  const [mv] = sq.splice(fi,1); sq.splice(ti,0,mv);
  sq.forEach((s:any,i:number) => exec('UPDATE shots SET orderIndex=? WHERE id=?', [i,s.id]));
  return {ok:true};
});

// ── AI Director: Stories ────────────────────────
ipcMain.handle('db:getStories', (_e, projectId?: string) => {
  return projectId ? queryAll('SELECT * FROM ai_story WHERE projectId=? ORDER BY createdAt DESC', [projectId])
    : queryAll('SELECT * FROM ai_story ORDER BY createdAt DESC');
});
ipcMain.handle('db:createStory', (_e, story: any) => {
  const id = uuidv4(); const now = new Date().toISOString();
  exec('INSERT INTO ai_story (id,projectId,title,logline,fullContent,status,createdAt) VALUES (?,?,?,?,?,?,?)',
    [id, story.projectId, story.title||'', story.logline||'', JSON.stringify(story.fullContent||{}), story.status||'draft', now]);
  return queryOne('SELECT * FROM ai_story WHERE id=?', [id]);
});
ipcMain.handle('db:updateStory', (_e, id: string, data: any) => {
  const sets: string[] = []; const vals: any[] = [];
  if (data.title !== undefined) { sets.push('title=?'); vals.push(data.title); }
  if (data.logline !== undefined) { sets.push('logline=?'); vals.push(data.logline); }
  if (data.fullContent !== undefined) { sets.push('fullContent=?'); vals.push(JSON.stringify(data.fullContent)); }
  if (data.status !== undefined) { sets.push('status=?'); vals.push(data.status); }
  if (sets.length) { vals.push(id); exec(`UPDATE ai_story SET ${sets.join(',')} WHERE id=?`, vals); }
  return queryOne('SELECT * FROM ai_story WHERE id=?', [id]);
});
ipcMain.handle('db:deleteStory', (_e, id: string) => {
  exec('DELETE FROM ai_character WHERE storyId=?', [id]);
  exec('DELETE FROM ai_story WHERE id=?', [id]);
});

// ── AI Director: Characters ─────────────────────
ipcMain.handle('db:getCharacters', (_e, storyId?: string) => {
  return storyId ? queryAll('SELECT * FROM ai_character WHERE storyId=? ORDER BY createdAt', [storyId])
    : queryAll('SELECT * FROM ai_character ORDER BY createdAt');
});
ipcMain.handle('db:createCharacter', (_e, char: any) => {
  const id = uuidv4(); const now = new Date().toISOString();
  exec('INSERT INTO ai_character (id,storyId,projectId,name,age,appearance,costume,personality,background,portraitPrompt,role,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, char.storyId, char.projectId, char.name||'', char.age||'', char.appearance||'', char.costume||'',
     char.personality||'', char.background||'', char.portraitPrompt||'', char.role||'配角', now]);
  return queryOne('SELECT * FROM ai_character WHERE id=?', [id]);
});
ipcMain.handle('db:updateCharacter', (_e, id: string, data: any) => {
  const map: Record<string,string> = {name:'name',age:'age',appearance:'appearance',costume:'costume',personality:'personality',background:'background',portraitPrompt:'portraitPrompt',role:'role'};
  const sets: string[] = []; const vals: any[] = [];
  for (const [k,v] of Object.entries(map)) { if (data[k] !== undefined) { sets.push(`${v}=?`); vals.push(data[k]); } }
  if (sets.length) { vals.push(id); exec(`UPDATE ai_character SET ${sets.join(',')} WHERE id=?`, vals); }
  return queryOne('SELECT * FROM ai_character WHERE id=?', [id]);
});
ipcMain.handle('db:deleteCharacter', (_e, id: string) => {
  exec('DELETE FROM ai_character WHERE id=?', [id]);
});

// ── Documents Center ────────────────────────────
ipcMain.handle('db:getDocuments', (_e, projectId: string, parentId?: string|null) => {
  if (parentId === null || parentId === undefined) {
    return queryAll('SELECT * FROM documents WHERE projectId=? AND parentId IS NULL ORDER BY sortOrder, createdAt', [projectId]);
  }
  if (parentId) {
    return queryAll('SELECT * FROM documents WHERE projectId=? AND parentId=? ORDER BY sortOrder, createdAt', [projectId, parentId]);
  }
  return queryAll('SELECT * FROM documents WHERE projectId=? ORDER BY sortOrder, createdAt', [projectId]);
});
ipcMain.handle('db:createDocument', (_e, doc: any) => {
  const id = uuidv4(); const now = new Date().toISOString();
  exec(`INSERT INTO documents (id,projectId,parentId,type,title,content,metadata,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, doc.projectId, doc.parentId||null, doc.type||'document', doc.title||'未命名文稿', doc.content||'', JSON.stringify(doc.metadata||{}), doc.sortOrder||0, now, now]);
  return queryOne('SELECT * FROM documents WHERE id=?', [id]);
});
ipcMain.handle('db:updateDocument', (_e, id: string, data: any) => {
  const map: Record<string,string> = {title:'title',content:'content',type:'type',parentId:'parentId',sortOrder:'sortOrder'};
  const sets: string[] = ['updatedAt=?']; const vals: any[] = [new Date().toISOString()];
  for (const [k,v] of Object.entries(map)) { if (data[k] !== undefined) { sets.push(`${v}=?`); vals.push(data[k]); } }
  if (data.metadata !== undefined) { sets.push('metadata=?'); vals.push(JSON.stringify(data.metadata)); }
  vals.push(id); exec(`UPDATE documents SET ${sets.join(',')} WHERE id=?`, vals);
  return queryOne('SELECT * FROM documents WHERE id=?', [id]);
});
ipcMain.handle('db:deleteDocument', (_e, id: string) => {
  // Delete children recursively
  function delChildren(pid: string) {
    const kids = queryAll('SELECT id FROM documents WHERE parentId=?', [pid]);
    for (const k of kids) delChildren(k.id);
    exec('DELETE FROM documents WHERE parentId=?', [pid]);
  }
  delChildren(id);
  exec('DELETE FROM documents WHERE id=?', [id]);
});

// ── Drafts (AI workspace) ────────────────────────
ipcMain.handle('db:getDrafts', (_e, projectId: string) => {
  return queryAll('SELECT * FROM drafts WHERE projectId=? ORDER BY createdAt', [projectId]);
});
ipcMain.handle('db:createDraft', (_e, draft: any) => {
  const id = uuidv4(); const now = new Date().toISOString();
  exec(`INSERT INTO drafts (id,projectId,name,currentStep,confirmedAssets,conversation,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)`,
    [id, draft.projectId, draft.name||'草稿V1', draft.currentStep||1,
     JSON.stringify(draft.confirmedAssets||{}), JSON.stringify(draft.conversation||[]), now, now]);
  return queryOne('SELECT * FROM drafts WHERE id=?', [id]);
});
ipcMain.handle('db:updateDraft', (_e, id: string, data: any) => {
  const map: Record<string,string> = {name:'name', currentStep:'currentStep'};
  const sets: string[] = ['updatedAt=?']; const vals: any[] = [new Date().toISOString()];
  for (const [k,v] of Object.entries(map)) { if (data[k] !== undefined) { sets.push(`${v}=?`); vals.push(v === 'currentStep' ? data[k] : data[k]); } }
  if (data.confirmedAssets !== undefined) { sets.push('confirmedAssets=?'); vals.push(typeof data.confirmedAssets==='string' ? data.confirmedAssets : JSON.stringify(data.confirmedAssets)); }
  if (data.conversation !== undefined) { sets.push('conversation=?'); vals.push(typeof data.conversation==='string' ? data.conversation : JSON.stringify(data.conversation)); }
  vals.push(id); exec(`UPDATE drafts SET ${sets.join(',')} WHERE id=?`, vals);
  return queryOne('SELECT * FROM drafts WHERE id=?', [id]);
});
ipcMain.handle('db:deleteDraft', (_e, id: string) => {
  exec('DELETE FROM drafts WHERE id=?', [id]);
});

// Blobs
ipcMain.handle('db:saveBlob', (_e, blobId: string, buffer: ArrayBuffer) => {
  const dir = path.join(app.getPath('userData'), 'blobs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, blobId), Buffer.from(buffer));
  return { blobId, size: buffer.byteLength };
});
ipcMain.handle('db:loadBlob', (_e, blobId: string) => {
  const p = path.join(app.getPath('userData'), 'blobs', blobId);
  return fs.existsSync(p) ? fs.readFileSync(p).buffer : null;
});
ipcMain.handle('db:deleteBlob', (_e, blobId: string) => {
  const p = path.join(app.getPath('userData'), 'blobs', blobId);
  if (fs.existsSync(p)) fs.unlinkSync(p); return true;
});

// Meta
ipcMain.handle('db:getMeta', (_e, key: string) => {
  const r = queryOne('SELECT value FROM meta WHERE key=?', [key]); return r ? JSON.parse(r.value) : null;
});
ipcMain.handle('db:setMeta', (_e, key: string, value: any) => {
  exec('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)', [key, JSON.stringify(value)]);
});

ipcMain.handle('app:getPath', (_e, name: string) => app.getPath(name as any));

// API Key management (stored in meta)
ipcMain.handle('app:getApiKey', () => {
  const r = queryOne('SELECT value FROM meta WHERE key=?', ['apiKey']);
  return r ? JSON.parse(r.value) : '';
});
ipcMain.handle('app:setApiKey', (_e, key: string) => {
  exec('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)', ['apiKey', JSON.stringify(key)]);
  return true;
});

// Native dialogs (replaces blocked prompt/confirm in renderer)
import { dialog } from 'electron';
ipcMain.handle('dialog:prompt', async (_e, title: string, defaultValue: string) => {
  if (!mainWindow) return null;
  // Use a simple approach: send back to renderer to show inline dialog
  // For now, use showMessageBox + a second renderer call
  return null; // Will be replaced by inline React dialog
});
ipcMain.handle('dialog:confirm', async (_e, message: string, title: string) => {
  if (!mainWindow) return false;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question', title: title || '确认', message,
    buttons: ['取消', '确认'], defaultId: 1, cancelId: 0
  });
  return response === 1;
});
