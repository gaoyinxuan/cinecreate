import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const CATS = ['人物','场景','道具','参考','Prompt'];
const GRID_COLS = { sm: 3, md: 4, lg: 5 };

interface AssetItem { id: string; name: string; category: string; blobId: string; url: string; createdAt: string; x?:number; y?:number; }

export default function AssetBoard({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [filter, setFilter] = useState('人物');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid'|'canvas'>('grid');
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState<{files:File[]}|null>(null);
  const [importCat, setImportCat] = useState('参考');
  const [preview, setPreview] = useState<AssetItem|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const meta = await db.meta.get(`assetlib_${projectId}`);
        if (meta && Array.isArray(meta)) {
          const items = await Promise.all(meta.map(async (m: any) => {
            const blob = await db.blobs.load(m.blobId);
            return blob ? { ...m, url: URL.createObjectURL(blob) } : null;
          }));
          setAssets(items.filter(Boolean) as AssetItem[]);
        } else { setAssets([]); }
      } catch { setAssets([]); }
    })();
  }, [projectId]);

  const saveMeta = useCallback(async (items: AssetItem[]) => {
    if (!projectId) return;
    await db.meta.set(`assetlib_${projectId}`, items.map(({url,...r})=>r));
  }, [projectId]);

  const doImport = useCallback(async (files: File[], cat: string) => {
    const news: AssetItem[] = [];
    for (const f of files) {
      const id = uid(), blobId = uid();
      try {
        await db.blobs.save(blobId, f);
        news.push({ id, name: f.name, category: cat, blobId, url: URL.createObjectURL(f), createdAt: new Date().toISOString() });
      } catch {}
    }
    if (news.length) {
      const all = [...assets, ...news];
      setAssets(all); saveMeta(all);
    }
    setImporting(null);
  }, [assets, saveMeta]);

  const handleFiles = (files: File[]) => {
    if (!files.length) return;
    setImporting({files: Array.from(files)}); setImportCat('参考');
  };

  const removeAsset = useCallback(async (item: AssetItem) => {
    URL.revokeObjectURL(item.url);
    try { await db.blobs.delete(item.blobId); } catch {}
    const f = assets.filter(a => a.id !== item.id);
    setAssets(f); saveMeta(f);
  }, [assets, saveMeta]);

  const updatePos = useCallback((id: string, x: number, y: number) => {
    setAssets(prev => { const n = prev.map(a => a.id===id?{...a,x,y}:a); saveMeta(n); return n; });
  }, [saveMeta]);

  const filtered = assets.filter(a => {
    if (a.category !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 bg-[var(--bg2)] border-b border-[var(--border)] shrink-0">
        <span className="text-base font-bold text-[var(--text)]">素材</span>
        <span className="text-xs text-[var(--muted)]">{assets.length} 项</span>
        <div className="flex-1" />
        <div className="flex bg-[var(--card)] rounded-lg p-0.5">
          <button className={`text-[11px] px-3 py-1 rounded-md transition-colors ${viewMode==='grid'?'bg-[var(--accent-solid)] text-white':'text-[var(--text3)]'}`}
            onClick={()=>setViewMode('grid')}>网格</button>
          <button className={`text-[11px] px-3 py-1 rounded-md transition-colors ${viewMode==='canvas'?'bg-[var(--accent-solid)] text-white':'text-[var(--text3)]'}`}
            onClick={()=>setViewMode('canvas')}>画布</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-[var(--border)] shrink-0">
        <input className="w-48 bg-[var(--card2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent-text)]/30"
          placeholder="搜索素材..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1">
          {CATS.map(c => (
            <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${filter===c?'bg-[var(--accent-solid)] text-white':'bg-[var(--card2)] text-[var(--text3)] hover:text-[var(--text)]'}`}
              onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) { handleFiles(Array.from(e.target.files)); e.target.value = ''; } }} />
        <button className="text-[11px] px-3 py-1.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
          onClick={() => fileRef.current?.click()}>+ 导入</button>
      </div>

      {/* Import category picker */}
      {importing && (
        <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--card2)] flex items-center gap-3">
          <span className="text-[11px] text-[var(--text2)]">{importing.files.length} 个文件 →</span>
          <div className="flex gap-1">
            {CATS.map(c => (
              <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${importCat===c?'bg-[var(--accent-solid)] text-white':'bg-[var(--card)] border border-[var(--border)] text-[var(--text3)]'}`}
                onClick={() => setImportCat(c)}>{c}</button>
            ))}
          </div>
          <button className="text-[11px] px-3 py-1 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white rounded-lg"
            onClick={() => doImport(importing.files, importCat)}>确认</button>
          <button className="text-[11px] px-3 py-1 text-[var(--muted)]" onClick={() => setImporting(null)}>取消</button>
        </div>
      )}

      {/* Content */}
      <div
        className={`flex-1 overflow-auto p-6 ${dragOver ? 'bg-[var(--accent-bg)]' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-3xl mb-3 opacity-20">📂</div>
              <div className="text-sm text-[var(--muted)]">暂无「{filter}」素材</div>
              <div className="text-xs text-[var(--dim)] mt-2">拖拽文件到此处，或点击「+ 导入」</div>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {filtered.map(a => (
              <div key={a.id} className="group bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent-text)]/30 rounded-xl overflow-hidden transition-colors cursor-pointer"
                onClick={() => setPreview(a)}>
                <div className="aspect-[4/3] bg-black">
                  <img src={a.url} alt={a.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                </div>
                <div className="p-2.5">
                  <div className="text-[11px] text-[var(--text2)] truncate font-medium">{a.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] bg-[var(--card2)] px-1.5 py-0.5 rounded text-[var(--text3)]">{a.category}</span>
                    <button className="text-[var(--muted)] hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => { e.stopPropagation(); removeAsset(a); }}>删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Canvas mode */
          <div className="relative min-h-[600px]">
            {filtered.map((a, i) => (
              <CanvasCard key={a.id} item={a} onMove={(x,y) => updatePos(a.id,x,y)}
                onRemove={() => removeAsset(a)} onPreview={() => setPreview(a)} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Preview lightbox */}
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center" onClick={() => setPreview(null)}>
          <img src={preview.url} alt={preview.name} className="max-w-[85vw] max-h-[85vh] rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-6 right-8 text-3xl text-white/60 hover:text-white" onClick={() => setPreview(null)}>✕</button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/80">{preview.name} · {preview.category}</div>
        </div>
      )}
    </div>
  );
}

/* Draggable canvas card */
function CanvasCard({ item, onMove, onRemove, onPreview, index }: {
  item: AssetItem; onMove: (x:number,y:number)=>void; onRemove: ()=>void; onPreview: ()=>void; index: number;
}) {
  const [pos, setPos] = useState({ x: item.x ?? (20 + (index%4)*220), y: item.y ?? (20 + Math.floor(index/4)*180) });
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const offset = useRef({x:0,y:0});

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    setDragging(true);
    const r = ref.current!.getBoundingClientRect();
    offset.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove_ = (e: MouseEvent) => {
      const parent = ref.current?.parentElement?.getBoundingClientRect();
      if (!parent) return;
      const nx = Math.max(0, Math.min(e.clientX - parent.left - offset.current.x, parent.width - 220));
      const ny = Math.max(0, Math.min(e.clientY - parent.top - offset.current.y, parent.height - 150));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => { setDragging(false); onMove(pos.x, pos.y); };
    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove_); window.removeEventListener('mouseup', onUp); };
  }, [dragging, pos]);

  return (
    <div ref={ref} className={`absolute w-[200px] bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-lg transition-shadow ${dragging ? 'shadow-2xl z-50 cursor-grabbing border-[var(--accent-text)]' : 'cursor-grab hover:shadow-xl'}`}
      style={{ left: pos.x, top: pos.y }} onMouseDown={onMouseDown} onDoubleClick={onPreview}>
      <div className="aspect-[4/3] bg-black pointer-events-none">
        <img src={item.url} alt={item.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
      </div>
      <div className="p-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-[var(--text2)] truncate font-medium max-w-[120px]">{item.name}</div>
          <span className="text-[9px] text-[var(--text3)]">{item.category}</span>
        </div>
        <button className="text-[var(--muted)] hover:text-red-400 text-xs" onClick={e => { e.stopPropagation(); onRemove(); }}>✕</button>
      </div>
    </div>
  );
}
