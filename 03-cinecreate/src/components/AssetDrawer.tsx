import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const CATS = ['人物','场景','道具','参考'];

interface StationItem { id: string; name: string; category: string; blobId: string; url: string; }

// Simple SVG line icons for consistency
const Icons = {
  station: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  import: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  clear: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  close: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

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

  const clearAll = useCallback(() => {
    items.forEach(i => URL.revokeObjectURL(i.url));
    setItems([]);
    db.meta.set(`station_${projectId}`, []);
  }, [items, projectId]);

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
      {/* Collapsed — distinctive floating tab */}
      {!expanded && (
        <button className="fixed right-0 top-1/2 -translate-y-1/2 z-[100] w-8 h-14 bg-white border border-[#ddd] shadow-md rounded-l-xl flex flex-col items-center justify-center gap-0.5 hover:shadow-lg hover:border-[#ccc] hover:-translate-x-0.5 transition-all text-[#666] hover:text-[#111]"
          onClick={() => setExpanded(true)}>
          {Icons.station}
          {items.length > 0 && <span className="text-[10px] font-semibold text-[#555]">{items.length}</span>}
        </button>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="fixed right-0 top-0 bottom-0 z-[100] w-56 bg-white border-l border-[#e8e5e0] shadow-lg flex flex-col">
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#eee]">
            <div className="flex gap-1.5">
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
                onChange={async e => {
                  if (e.target.files?.length) { for (const f of Array.from(e.target.files)) await addItem(f); e.target.value = ''; }
                }} />
              <button className="w-7 h-7 rounded-md hover:bg-[#f5f3ef] flex items-center justify-center text-[#888] hover:text-[#333] transition-colors"
                onClick={() => fileRef.current?.click()} title="导入">{Icons.import}</button>
              {items.length > 0 && (
                <button className="w-7 h-7 rounded-md hover:bg-[#f5f3ef] flex items-center justify-center text-[#888] hover:text-red-500 transition-colors"
                  onClick={clearAll} title="清空">{Icons.clear}</button>
              )}
            </div>
            <button className="w-7 h-7 rounded-md hover:bg-[#f5f3ef] flex items-center justify-center text-[#aaa] hover:text-[#333] transition-colors"
              onClick={() => setExpanded(false)} title="关闭">{Icons.close}</button>
          </div>

          {/* Category pills */}
          <div className="flex gap-1 px-3 py-2 border-b border-[#eee]">
            {CATS.map(c => (
              <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${filter===c?'bg-[#333] text-white':'text-[#888] hover:bg-[#f5f3ef]'}`}
                onClick={() => setFilter(c)}>{c}</button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-[10px] text-[#bbb]">拖拽 / Ctrl+V / 导入</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {filtered.map(item => (
                  <div key={item.id} className="group relative aspect-square rounded-lg overflow-hidden bg-[#f0ede8] cursor-grab hover:ring-2 hover:ring-[#ccc] transition-all"
                    draggable onDragStart={e => { e.dataTransfer.setData('text/plain', item.url); }}>
                    <img src={item.url} alt="" className="w-full h-full object-cover pointer-events-none" />
                    <button className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/40 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-all"
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
