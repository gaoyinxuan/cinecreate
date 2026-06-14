import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const CATS = ['人物','场景','道具','参考','Prompt'];

interface StationItem { id: string; name: string; category: string; blobId: string; url: string; }

export default function AssetDrawer({ projectId, onOpenPanel }: { projectId: string | null; onOpenPanel: () => void }) {
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

  const clearAll = useCallback(() => {
    items.forEach(i => URL.revokeObjectURL(i.url));
    setItems([]);
    db.meta.set(`station_${projectId}`, []);
  }, [items, projectId]);

  // Global Ctrl+V
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
      {/* Collapsed tab — right edge */}
      {!expanded && (
        <button className="fixed right-0 top-1/2 -translate-y-1/2 z-[100] bg-white border border-[#e8e5e0] shadow-md rounded-l-xl px-2 py-4 flex flex-col items-center gap-1 text-[11px] text-[#888] hover:text-[#333] hover:shadow-lg transition-all"
          onClick={() => setExpanded(true)} style={{writingMode:'vertical-rl'}}>
          <span>{items.length ? `📦${items.length}` : '📦'}</span>
          <span className="text-[9px] text-[#bbb]">中转站</span>
        </button>
      )}

      {/* Expanded panel — right side */}
      {expanded && (
        <div className="fixed right-0 top-0 bottom-0 z-[100] w-64 bg-white border-l border-[#e8e5e0] shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#eee]">
            <span className="text-[13px] font-semibold text-[#333]">中转站 {items.length ? `· ${items.length}` : ''}</span>
            <button className="text-[#aaa] hover:text-[#333] text-sm" onClick={() => setExpanded(false)}>✕</button>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-4 py-2 border-b border-[#eee] flex-wrap">
            {CATS.map(c => (
              <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${filter===c?'bg-[#333] text-white':'text-[#888] hover:text-[#333] hover:bg-[#f5f3ef]'}`}
                onClick={() => setFilter(c)}>{c}</button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-4 py-2 border-b border-[#eee]">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
              onChange={async e => {
                if (e.target.files?.length) { for (const f of Array.from(e.target.files)) await addItem(f); e.target.value = ''; }
              }} />
            <button className="flex-1 py-1.5 text-[11px] bg-[#333] hover:bg-[#1a1a1a] text-white rounded-lg transition-colors"
              onClick={() => fileRef.current?.click()}>导入</button>
            <button className="flex-1 py-1.5 text-[11px] bg-[#f5f3ef] hover:bg-[#e8e5e0] text-[#666] rounded-lg transition-colors"
              onClick={onOpenPanel}>素材库</button>
            {items.length > 0 && (
              <button className="px-3 py-1.5 text-[11px] text-[#aaa] hover:text-red-500 transition-colors"
                onClick={clearAll}>清空</button>
            )}
          </div>

          {/* Item grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-[11px] text-[#bbb]">
                {items.length ? '切换分类查看' : '拖拽文件 / Ctrl+V / 导入'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filtered.map(item => (
                  <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden bg-[#f0ede8] border border-[#eee] cursor-grab hover:shadow-md transition-all"
                    draggable onDragStart={e => { e.dataTransfer.setData('text/plain', item.url); }}>
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover pointer-events-none" />
                    <button className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-all"
                      onClick={e => { e.stopPropagation(); removeItem(item); }}>✕</button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1.5">
                      <div className="text-[9px] text-white truncate">{item.name}</div>
                    </div>
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
