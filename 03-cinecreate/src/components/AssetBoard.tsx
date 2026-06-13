import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const CATS = ['人物','场景','道具','参考','Prompt'];

interface AssetItem { id: string; name: string; category: string; blobId: string; url: string; createdAt: string; x?:number; y?:number; }

export default function AssetBoard({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [filter, setFilter] = useState('人物');
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState<{files:File[]}|null>(null);
  const [importCat, setImportCat] = useState('参考');
  const [preview, setPreview] = useState<AssetItem|null>(null);
  const [zoom, setZoom] = useState(100);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
    const COL = 220, ROW = 200;
    const baseIdx = assets.length;
    const news: AssetItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i], id = uid(), blobId = uid();
      try {
        await db.blobs.save(blobId, f);
        news.push({ id, name: f.name, category: cat, blobId,
          url: URL.createObjectURL(f), createdAt: new Date().toISOString(),
          x: 40 + ((baseIdx + i) % 5) * COL, y: 20 + Math.floor((baseIdx + i) / 5) * ROW });
      } catch {}
    }
    if (news.length) { const all = [...assets, ...news]; setAssets(all); saveMeta(all); }
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
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--border)] shrink-0 bg-[var(--bg2)]">
        <span className="text-sm font-bold text-[var(--text)]">素材</span>
        <span className="text-[11px] text-[var(--muted)]">{assets.length} 项</span>
        <div className="w-px h-5 bg-[var(--border)] mx-1" />
        {CATS.map(c => (
          <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${filter===c?'bg-[var(--accent-solid)] text-white':'text-[var(--text3)] hover:text-[var(--text)]'}`}
            onClick={() => setFilter(c)}>{c}</button>
        ))}
        <input className="w-40 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent-text)]/30 ml-auto"
          placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) { handleFiles(Array.from(e.target.files)); e.target.value = ''; } }} />
        <button className="text-[11px] px-3 py-1.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
          onClick={() => fileRef.current?.click()}>导入</button>
        <div className="flex items-center gap-1 ml-2">
          <button className="text-[var(--muted)] hover:text-[var(--text)] text-sm" onClick={() => setZoom(z => Math.max(20, z-20))}>−</button>
          <span className="text-[10px] text-[var(--muted)] w-10 text-center">{zoom}%</span>
          <button className="text-[var(--muted)] hover:text-[var(--text)] text-sm" onClick={() => setZoom(z => Math.min(200, z+20))}>+</button>
        </div>
      </div>

      {/* Import bar */}
      {importing && (
        <div className="px-5 py-2 border-b border-[var(--border)] bg-[var(--accent-bg)] flex items-center gap-2">
          <span className="text-[11px] text-[var(--text2)]">{importing.files.length} 个文件 →</span>
          {CATS.map(c => (
            <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full ${importCat===c?'bg-[var(--accent-solid)] text-white':'bg-[var(--card)] border border-[var(--border)] text-[var(--text3)]'}`}
              onClick={() => setImportCat(c)}>{c}</button>
          ))}
          <button className="text-[10px] px-3 py-1 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white rounded-lg"
            onClick={() => doImport(importing.files, importCat)}>确认</button>
          <button className="text-[10px] text-[var(--muted)]" onClick={() => setImporting(null)}>取消</button>
        </div>
      )}

      {/* Canvas */}
      <div ref={canvasRef}
        className={`flex-1 overflow-auto relative ${dragOver ? 'bg-[var(--accent-bg)]' : ''}`}
        style={{ backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)', backgroundSize: `${20 * zoom/100}px ${20 * zoom/100}px` }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
      >
        <div className="absolute inset-0" style={{ minWidth: zoom*20, minHeight: zoom*15, transform: `scale(${zoom/100})`, transformOrigin: '0 0' }}>
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center" style={{ width: '100vw', height: '60vh' }}>
              <div className="text-center" style={{ transform: `scale(${100/zoom})` }}>
                <div className="text-3xl mb-3 opacity-20">📂</div>
                <div className="text-sm text-[var(--muted)]">拖拽文件到画布，或点击「导入」</div>
                <div className="text-xs text-[var(--dim)] mt-1">素材将出现在画布上，可自由拖动排布</div>
              </div>
            </div>
          ) : (
            filtered.map(a => (
              <CanvasCard key={a.id} item={a} zoom={zoom} onMove={(x,y) => updatePos(a.id, x, y)}
                onRemove={() => removeAsset(a)} onPreview={() => setPreview(a)} />
            ))
          )}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center" onClick={() => setPreview(null)}>
          <img src={preview.url} alt={preview.name} className="max-w-[88vw] max-h-[88vh] rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-6 right-8 text-3xl text-white/50 hover:text-white" onClick={() => setPreview(null)}>✕</button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/70">{preview.name} · {preview.category}</div>
        </div>
      )}
    </div>
  );
}

function CanvasCard({ item, zoom, onMove, onRemove, onPreview }: {
  item: AssetItem; zoom: number; onMove: (x:number,y:number)=>void; onRemove: ()=>void; onPreview: ()=>void;
}) {
  const [pos, setPos] = useState({ x: item.x ?? 40, y: item.y ?? 20 });
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const offset = useRef({x:0,y:0});

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    setDragging(true);
    const r = ref.current!.getBoundingClientRect();
    offset.current = { x: (e.clientX - r.left) / (zoom/100), y: (e.clientY - r.top) / (zoom/100) };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove_ = (e: MouseEvent) => {
      const parent = ref.current?.parentElement;
      if (!parent) return;
      const pRect = parent.getBoundingClientRect();
      const nx = (e.clientX - pRect.left) / (zoom/100) - offset.current.x;
      const ny = (e.clientY - pRect.top) / (zoom/100) - offset.current.y;
      setPos({ x: Math.max(0, nx), y: Math.max(0, ny) });
    };
    const onUp = () => { setDragging(false); onMove(pos.x, pos.y); };
    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove_); window.removeEventListener('mouseup', onUp); };
  }, [dragging, pos, zoom]);

  return (
    <div ref={ref}
      className={`absolute bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow ${dragging ? 'shadow-2xl z-50 border-[var(--accent-text)]' : ''}`}
      style={{ left: pos.x, top: pos.y, width: 180, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown} onDoubleClick={onPreview}>
      <div className="aspect-[4/3] bg-black pointer-events-none">
        <img src={item.url} alt={item.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
      </div>
      <div className="p-2 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-[var(--text2)] truncate">{item.name}</div>
          <span className="text-[9px] text-[var(--text3)]">{item.category}</span>
        </div>
        <button className="text-[var(--muted)] hover:text-red-400 text-xs ml-1 shrink-0"
          onClick={e => { e.stopPropagation(); onRemove(); }}>✕</button>
      </div>
    </div>
  );
}
