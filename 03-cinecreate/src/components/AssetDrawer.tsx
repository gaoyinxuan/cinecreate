import React, { useState, useEffect, useRef, useCallback } from 'react';

const api = (window as any).electronAPI;

interface AssetFile { name: string; path: string; size: number; mtime: string; }

export default function AssetDrawer({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'global'|string>('global');
  const [files, setFiles] = useState<AssetFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{x:number;y:number;file:AssetFile}|null>(null);
  const [paths, setPaths] = useState<{global:string;project:string}>({global:'',project:''});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!api) return;
    api.assetGetPath().then((p: string) => setPaths(prev => ({...prev, global: p})));
  }, []);

  useEffect(() => {
    if (!api) return;
    if (scope !== 'global' && projectId) {
      api.assetGetProjectPath(projectId).then((p: string) => setPaths(prev => ({...prev, project: p})));
    }
  }, [scope, projectId]);

  const loadFiles = useCallback(async () => {
    if (!api) return;
    const s = scope === 'global' ? 'global' : (projectId || 'global');
    const list = await api.assetList(s);
    setFiles(list);
    setOpen(true);
  }, [scope, projectId]);

  useEffect(() => { if (open) loadFiles(); }, [open, scope]);

  const importFiles = useCallback(async (fls: File[]) => {
    if (!api) return;
    const s = scope === 'global' ? 'global' : (projectId || 'global');
    for (const f of fls) {
      const buf = await f.arrayBuffer();
      await api.assetSave(s, f.name, buf);
    }
    loadFiles();
  }, [scope, projectId, loadFiles]);

  const removeFile = useCallback(async (f: AssetFile) => {
    if (!api) return;
    await api.assetDelete(f.path);
    setFiles(prev => prev.filter(x => x.path !== f.path));
  }, []);

  const openFilePath = (f: AssetFile) => {
    if (api) api.assetGetPath().then(() => {});
    // Copy path to clipboard
    navigator.clipboard?.writeText(f.path);
  };

  // Close ctx menu on outside click
  useEffect(() => {
    const h = () => setCtxMenu(null);
    if (ctxMenu) document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [ctxMenu]);

  const typeIcon = (f: AssetFile) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (['png','jpg','jpeg','webp','gif','bmp'].includes(ext||'')) return '🖼️';
    if (['mp4','webm','mov','avi'].includes(ext||'')) return '🎥';
    return '📄';
  };

  return (
    <>
      <button
        className="fixed bottom-5 right-5 z-[100] w-10 h-10 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-lg flex items-center justify-center text-lg hover:scale-110 hover:shadow-xl transition-all"
        onClick={() => setOpen(!open)}
        title="素材库"
      >📦</button>

      {open && (
        <div className="fixed inset-4 z-[99] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] shrink-0">
            <span className="text-sm font-bold text-[var(--text)]">素材库</span>
            <div className="flex bg-[var(--card2)] rounded-lg p-0.5">
              <button className={`text-[11px] px-3 py-1 rounded-md transition-colors ${scope==='global'?'bg-[var(--accent-solid)] text-white':'text-[var(--text3)] hover:text-[var(--text)]'}`}
                onClick={() => setScope('global')}>全局</button>
              <button className={`text-[11px] px-3 py-1 rounded-md transition-colors ${scope!=='global'?'bg-[var(--accent-solid)] text-white':'text-[var(--text3)] hover:text-[var(--text)]'}`}
                onClick={() => projectId && setScope(projectId)} disabled={!projectId}>项目</button>
            </div>
            <div className="flex-1" />
            <span className="text-[10px] text-[var(--muted)] truncate max-w-[200px]" title={scope==='global'?paths.global:paths.project}>
              {scope==='global'?paths.global:paths.project}
            </span>
            <button className="text-[var(--muted)] hover:text-[var(--text)] text-sm" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-5 py-2 border-b border-[var(--border)] shrink-0">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) { importFiles(Array.from(e.target.files)); e.target.value = ''; } }} />
            <button className="text-[11px] px-3 py-1.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
              onClick={() => fileRef.current?.click()}>+ 导入</button>
            <span className="text-[10px] text-[var(--muted)] ml-2">{files.length} 个文件</span>
            <span className="text-[10px] text-[var(--dim)] ml-auto">拖拽排列 · 滚轮缩放</span>
          </div>

          {/* Canvas */}
          <div
            className={`flex-1 overflow-auto p-6 relative ${dragOver ? 'bg-[var(--accent-bg)]' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) importFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => setCtxMenu(null)}
          >
            {files.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl mb-3 opacity-20">📂</div>
                  <div className="text-sm text-[var(--muted)]">拖拽文件到此处，或点击「+ 导入」</div>
                  <div className="text-xs text-[var(--dim)] mt-2">支持 PNG / JPG / WebP / MP4 / WebM</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                {files.map(f => (
                  <div key={f.path}
                    className="group bg-[var(--card2)] border border-[var(--border)] hover:border-[var(--accent-text)]/30 rounded-xl overflow-hidden cursor-grab transition-colors"
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({x:e.clientX, y:e.clientY, file:f}); }}
                  >
                    <div className="aspect-[4/3] bg-black flex items-center justify-center text-2xl">
                      {typeIcon(f) === '🖼️' ? (
                        <img src={`file://${f.path}`} alt={f.name} className="w-full h-full object-cover" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : typeIcon(f) === '🎥' ? (
                        <video src={`file://${f.path}`} className="w-full h-full object-cover" />
                      ) : (
                        <span className="opacity-30">{typeIcon(f)}</span>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-[11px] text-[var(--text2)] truncate">{f.name}</div>
                      <div className="text-[10px] text-[var(--muted)] mt-0.5">{(f.size/1024).toFixed(0)} KB</div>
                    </div>
                    <button className="absolute top-2 right-2 w-5 h-5 bg-black/60 hover:bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      onClick={e => { e.stopPropagation(); removeFile(f); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Context menu */}
          {ctxMenu && (
            <div className="fixed z-[200] bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl py-1 min-w-[140px]"
              style={{left: ctxMenu.x, top: ctxMenu.y}}>
              <button className="block w-full text-left text-[11px] px-3 py-1.5 text-[var(--text2)] hover:bg-black/5"
                onClick={() => { openFilePath(ctxMenu.file); setCtxMenu(null); }}>复制路径</button>
              <button className="block w-full text-left text-[11px] px-3 py-1.5 text-[var(--text2)] hover:bg-black/5"
                onClick={() => { removeFile(ctxMenu.file); setCtxMenu(null); }}>删除</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
