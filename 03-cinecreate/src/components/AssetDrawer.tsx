import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const CATS = ['人物','场景','道具','参考','Prompt'];

interface StationItem { id: string; name: string; category: string; blobId: string; url: string; }

export default function AssetDrawer({ projectId }: { projectId: string | null; onOpenPanel?: () => void }) {
  const [items, setItems] = useState<StationItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('参考');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) { setItems([]); return; }
    (async () => {
      const meta = await db.meta.get(`station_${projectId}`);
      if (meta && Array.isArray(meta)) {
        const loaded = await Promise.all(meta.slice(-20).map(async (m: any) => {
          const blob = await db.blobs.load(m.blobId);
          return blob ? { ...m, url: URL.createObjectURL(blob) } : null;
        }));
        setItems(loaded.filter(Boolean) as StationItem[]);
      } else setItems([]);
    })();
  }, [projectId]);

  const addItem = useCallback(async (file: File) => {
    if (!projectId) return;
    const blobId = uid();
    await db.blobs.save(blobId, file);
    const item: StationItem = { id: uid(), name: file.name, category: filter, blobId, url: URL.createObjectURL(file) };
    setItems(prev => {
      const next = [...prev, item].slice(-20);
      db.meta.set(`station_${projectId}`, next.map(({url,...r})=>r));
      db.meta.get(`assetlib_${projectId}`).then(meta => {
        const list = Array.isArray(meta) ? meta : [];
        list.push({ id: item.id, name: item.name, category: filter, blobId, createdAt: new Date().toISOString() });
        db.meta.set(`assetlib_${projectId}`, list);
      });
      return next;
    });
    setExpanded(true);
  }, [projectId, filter]);

  const removeItem = useCallback(async (item: StationItem) => {
    URL.revokeObjectURL(item.url);
    try { await db.blobs.delete(item.blobId); } catch {}
    setItems(prev => {
      const next = prev.filter(i => i.id !== item.id);
      db.meta.set(`station_${projectId}`, next.map(({url,...r})=>r));
      return next;
    });
  }, [projectId]);

  useEffect(() => {
    const h = async (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (!e.clipboardData?.items) return;
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) await addItem(blob);
        }
      }
    };
    window.addEventListener('paste', h);
    return () => window.removeEventListener('paste', h);
  }, [addItem]);

  const filtered = items.filter(i => i.category === filter);
  if (!projectId) return null;

  return (
    <>
      {/* Collapsed — just an icon on the right edge */}
      {!expanded && (
        <button className="fixed right-0 top-1/2 -translate-y-1/2 z-[100] w-8 h-20 bg-white border border-[#e8e5e0] shadow-sm rounded-l-xl flex flex-col items-center justify-center gap-1 hover:shadow-md transition-all"
          onClick={() => setExpanded(true)}>
          <span className="text-base">📦</span>
          {items.length > 0 && <span className="text-[10px] text-[#888] font-medium">{items.length}</span>}
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="fixed right-0 top-0 bottom-0 z-[100] w-56 bg-white border-l border-[#e8e5e0] shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#eee]">
            <div className="flex gap-1">
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
                onChange={async e => {
                  if (e.target.files?.length) { for (const f of Array.from(e.target.files)) await addItem(f); e.target.value = ''; }
                }} />
              <button className="w-7 h-7 rounded-lg hover:bg-[#f5f3ef] flex items-center justify-center text-sm transition-colors"
                onClick={() => fileRef.current?.click()} title="导入">📷</button>
              <button className="w-7 h-7 rounded-lg hover:bg-[#f5f3ef] flex items-center justify-center text-sm transition-colors"
                onClick={() => { setItems([]); items.forEach(i => URL.revokeObjectURL(i.url)); db.meta.set(`station_${projectId}`, []); }} title="清空">🗑</button>
            </div>
            <button className="w-7 h-7 rounded-lg hover:bg-[#f5f3ef] flex items-center justify-center text-sm text-[#aaa] transition-colors"
              onClick={() => setExpanded(false)}>✕</button>
          </div>

          {/* Category pills */}
          <div className="flex gap-1 px-3 py-2 border-b border-[#eee] flex-wrap">
            {CATS.map(c => (
              <button key={c} className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${filter===c?'bg-[#333] text-white':'text-[#888] hover:bg-[#f5f3ef]'}`}
                onClick={() => setFilter(c)}>{c}</button>
            ))}
          </div>

          {/* Thumbnail grid */}
          <div className="flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-[10px] text-[#bbb]">拖拽 / Ctrl+V / 📷</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {filtered.map(item => (
                  <div key={item.id} className="group relative aspect-square rounded-lg overflow-hidden bg-[#f0ede8] cursor-grab hover:ring-2 hover:ring-[#d4c8b0] transition-all"
                    draggable onDragStart={e => { e.dataTransfer.setData('text/plain', item.url); }}>
                    <img src={item.url} alt="" className="w-full h-full object-cover pointer-events-none" />
                    <button className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-all"
                      onClick={e => { e.stopPropagation(); removeItem(item); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
