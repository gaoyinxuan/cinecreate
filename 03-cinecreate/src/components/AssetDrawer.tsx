import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const CATS = ['人物','场景','道具','参考'];

interface StationItem { id: string; name: string; category: string; blobId: string; url: string; }

// Clean SVG icons — bolder, more recognizable
const Icons = {
  station: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 9h20"/><path d="M9 21V9"/><circle cx="7" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="6" r="1" fill="currentColor" stroke="none"/></svg>,
  import: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v14"/><polyline points="6 11 12 17 18 11"/><path d="M3 21h18"/></svg>,
  clear: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12"/></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
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
