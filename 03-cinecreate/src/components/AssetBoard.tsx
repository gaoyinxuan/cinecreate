import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const CATS = ['人物','场景','道具','参考','Prompt'];

interface AssetItem { id: string; name: string; category: string; blobId: string; url: string; createdAt: string; x?:number; y?:number; w?:number; }

export default function AssetBoard({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [filter, setFilter] = useState('人物');
  const [search, setSearch] = useState('');
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
    const baseIdx = assets.length;
    const news: AssetItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i], id = uid(), blobId = uid();
      try {
        await db.blobs.save(blobId, f);
        const col = (baseIdx + i) % 4, row = Math.floor((baseIdx + i) / 4);
        news.push({ id, name: f.name, category: cat, blobId, url: URL.createObjectURL(f),
          createdAt: new Date().toISOString(), x: 48 + col * 232, y: 32 + row * 240, w: 216 });
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
    <div className="flex-1 flex flex-col bg-[#f9f8f6] overflow-hidden">
      {/* Top bar — minimal, floating feel */}
      <div className="flex items-center gap-2 px-6 py-3 shrink-0" style={{background:'rgba(249,248,246,0.9)',backdropFilter:'blur(8px)'}}>
        <span className="text-[13px] font-semibold text-[#333] tracking-tight">素材</span>
        <span className="text-[11px] text-[#999] ml-0.5">{assets.length}</span>
        <div className="flex gap-1 ml-4">
          {CATS.map(c => (
            <button key={c} className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all ${filter===c?'bg-[#333] text-white shadow-sm':'text-[#888] hover:text-[#333] hover:bg-black/5'}`}
              onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
        <div className="flex-1" />
        <input className="w-36 bg-white/70 border border-[#e8e5e0] rounded-lg px-3 py-1.5 text-[11px] text-[#333] outline-none focus:border-[#d4c8b0] focus:bg-white transition-colors"
          placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) { handleFiles(Array.from(e.target.files)); e.target.value = ''; } }} />
        <button className="text-[11px] px-4 py-1.5 bg-[#333] hover:bg-[#1a1a1a] text-white rounded-lg font-medium transition-colors"
          onClick={() => fileRef.current?.click()}>导入</button>
      </div>

      {/* Import category picker */}
      {importing && (
        <div className="px-6 py-2 flex items-center gap-2" style={{background:'rgba(249,248,246,0.95)'}}>
          <span className="text-[11px] text-[#666]">{importing.files.length} 个文件 →</span>
          {CATS.map(c => (
            <button key={c} className={`text-[10px] px-3 py-1 rounded-full ${importCat===c?'bg-[#333] text-white':'bg-white border border-[#e8e5e0] text-[#888]'}`}
              onClick={() => setImportCat(c)}>{c}</button>
          ))}
          <button className="text-[10px] px-3 py-1 bg-[#333] hover:bg-[#1a1a1a] text-white rounded-lg"
            onClick={() => doImport(importing.files, importCat)}>确认导入</button>
          <button className="text-[10px] text-[#999] hover:text-[#666]" onClick={() => setImporting(null)}>取消</button>
        </div>
      )}

      {/* Canvas */}
      <div
        className={`flex-1 overflow-auto relative transition-colors ${dragOver ? 'bg-[#f0ece4]' : ''}`}
        style={{ backgroundImage: 'radial-gradient(circle, #e8e5e0 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
      >
        <div className="absolute inset-0" style={{ minWidth: 4000, minHeight: 3000 }}>
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center" style={{ width: '100vw', height: '65vh' }}>
              <div className="text-center">
                <div className="text-4xl mb-4" style={{opacity:0.15}}>📂</div>
                <div className="text-sm text-[#999] font-medium">拖拽图片到此处</div>
                <div className="text-xs text-[#bbb] mt-1.5">支持 PNG / JPG / WebP</div>
                <button className="mt-5 text-xs px-4 py-2 bg-[#333] hover:bg-[#1a1a1a] text-white rounded-lg font-medium transition-colors"
                  onClick={() => fileRef.current?.click()}>导入第一批素材</button>
              </div>
            </div>
          ) : (
            filtered.map(a => (
              <CanvasCard key={a.id} item={a}
                onMove={(x,y) => updatePos(a.id, x, y)}
                onRemove={() => removeAsset(a)}
                onPreview={() => setPreview(a)} />
            ))
          )}
        </div>
      </div>

      {/* Preview lightbox */}
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setPreview(null)}>
          <img src={preview.url} alt={preview.name} className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-6 right-8 text-3xl text-white/40 hover:text-white/80 transition-colors" onClick={() => setPreview(null)}>✕</button>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur rounded-full px-5 py-2 text-sm text-white/80">{preview.name} · {preview.category}</div>
        </div>
      )}
    </div>
  );
}

function CanvasCard({ item, onMove, onRemove, onPreview }: {
  item: AssetItem; onMove: (x:number,y:number)=>void; onRemove: ()=>void; onPreview: ()=>void;
}) {
  const [pos, setPos] = useState({ x: item.x ?? 48, y: item.y ?? 32 });
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
      const parent = ref.current?.parentElement;
      if (!parent) return;
      const pRect = parent.getBoundingClientRect();
      setPos({ x: Math.max(0, e.clientX - pRect.left - offset.current.x), y: Math.max(0, e.clientY - pRect.top - offset.current.y) });
    };
    const onUp = () => { setDragging(false); onMove(pos.x, pos.y); };
    window.addEventListener('mousemove', onMove_); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove_); window.removeEventListener('mouseup', onUp); };
  }, [dragging, pos]);

  return (
    <div ref={ref}
      className={`absolute group transition-shadow duration-200 ${dragging ? 'z-50' : 'z-10'}`}
      style={{ left: pos.x, top: pos.y, width: 216, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown} onDoubleClick={onPreview}>
      {/* Card — Milanote-inspired */}
      <div className={`bg-white rounded-2xl overflow-hidden transition-all duration-200 ${dragging ? 'shadow-2xl scale-[1.02]' : 'shadow-sm hover:shadow-md hover:-translate-y-0.5'}`}>
        {/* Image */}
        <div className="aspect-[4/3] bg-[#f0ede8] pointer-events-none relative">
          <img src={item.url} alt={item.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
        </div>
        {/* Meta */}
        <div className="px-3 py-2.5 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-[#333] truncate font-medium leading-tight">{item.name}</div>
            <div className="text-[10px] text-[#aaa] mt-0.5">{item.category}</div>
          </div>
          <button className="text-[#ccc] hover:text-[#e55] text-xs ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all"
            onClick={e => { e.stopPropagation(); onRemove(); }}>✕</button>
        </div>
      </div>
    </div>
  );
}
