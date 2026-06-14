import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

interface StationItem { id: string; name: string; category: string; blobId: string; url: string; }

export default function AssetDrawer({ projectId, onOpenPanel }: { projectId: string | null; onOpenPanel: () => void }) {
  const [items, setItems] = useState<StationItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load station items from db on project switch
  useEffect(() => {
    if (!projectId) { setItems([]); return; }
    (async () => {
      const meta = await db.meta.get(`station_${projectId}`);
      if (meta && Array.isArray(meta)) {
        const loaded = await Promise.all(meta.slice(-12).map(async (m: any) => {
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
    const item: StationItem = { id: uid(), name: file.name, category: '参考', blobId, url: URL.createObjectURL(file) };
    setItems(prev => {
      const next = [...prev, item].slice(-12);
      db.meta.set(`station_${projectId}`, next.map(({url,...r})=>r));
      // Also save to main library
      db.meta.get(`assetlib_${projectId}`).then(meta => {
        const list = Array.isArray(meta) ? meta : [];
        list.push({ id: item.id, name: item.name, category: '参考', blobId: item.blobId, createdAt: new Date().toISOString() });
        db.meta.set(`assetlib_${projectId}`, list);
      });
      return next;
    });
    setExpanded(true);
  }, [projectId]);

  const removeItem = useCallback(async (item: StationItem) => {
    URL.revokeObjectURL(item.url);
    try { await db.blobs.delete(item.blobId); } catch {}
    setItems(prev => {
      const next = prev.filter(i => i.id !== item.id);
      db.meta.set(`station_${projectId}`, next.map(({url,...r})=>r));
      return next;
    });
  }, [projectId]);

  // Global Ctrl+V paste handler
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

  if (!projectId || items.length === 0) return null;

  return (
    <>
      {/* Collapsed pill */}
      {!expanded && (
        <button className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-white border border-[#e8e5e0] shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-[12px] text-[#555] hover:shadow-xl transition-all"
          onClick={() => setExpanded(true)}>
          <span>📦</span>
          <span className="font-medium">{items.length} 项素材</span>
        </button>
      )}

      {/* Expanded strip */}
      {expanded && (
        <div className="fixed bottom-3 left-4 right-4 z-[100] bg-white/95 backdrop-blur border border-[#e8e5e0] shadow-xl rounded-2xl p-3 flex items-center gap-2">
          {/* Thumbnails */}
          <div className="flex gap-2 overflow-x-auto flex-1 pb-1">
            {items.map(item => (
              <div key={item.id} className="group relative shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-[#f0ede8] border border-[#eee] cursor-grab hover:shadow-md transition-all"
                draggable
                onDragStart={e => { e.dataTransfer.setData('text/plain', item.url); }}>
                <img src={item.url} alt={item.name} className="w-full h-full object-cover pointer-events-none" />
                <button className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-all"
                  onClick={e => { e.stopPropagation(); removeItem(item); }}>✕</button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0 border-l border-[#eee] pl-3">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
              onChange={async e => {
                if (e.target.files?.length) {
                  for (const f of Array.from(e.target.files)) await addItem(f);
                  e.target.value = '';
                }
              }} />
            <button className="w-8 h-8 rounded-lg hover:bg-[#f5f3ef] flex items-center justify-center text-sm text-[#888] transition-colors"
              onClick={() => fileRef.current?.click()} title="导入">📷</button>
            <button className="w-8 h-8 rounded-lg hover:bg-[#f5f3ef] flex items-center justify-center text-sm text-[#888] transition-colors"
              onClick={onOpenPanel} title="素材库">🗂</button>
            <button className="w-8 h-8 rounded-lg hover:bg-[#f5f3ef] flex items-center justify-center text-sm text-[#888] transition-colors"
              onClick={() => { setItems([]); db.meta.set(`station_${projectId}`, []); }} title="清空">🗑</button>
            <button className="w-8 h-8 rounded-lg hover:bg-[#f5f3ef] flex items-center justify-center text-[10px] text-[#aaa] transition-colors"
              onClick={() => setExpanded(false)} title="收起">▲</button>
          </div>
        </div>
      )}
    </>
  );
}
