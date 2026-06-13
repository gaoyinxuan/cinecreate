import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/dbService';

const CATS = ['全部','人物','场景','道具','参考','Prompt'];

interface AssetItem { id: string; name: string; category: string; blobId: string; url: string; createdAt: string; }

export default function AssetBoard({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [filter, setFilter] = useState('全部');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<AssetItem|null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
        } else setAssets([]);
      } catch { setAssets([]); }
    })();
  }, [projectId]);

  const removeSelected = useCallback(async () => {
    const toRemove = assets.filter(a => selected.has(a.id));
    for (const a of toRemove) {
      URL.revokeObjectURL(a.url);
      try { await db.blobs.delete(a.blobId); } catch {}
    }
    const remaining = assets.filter(a => !selected.has(a.id));
    setAssets(remaining);
    setSelected(new Set());
    await db.meta.set(`assetlib_${projectId}`, remaining.map(({url,...r})=>r));
  }, [assets, selected, projectId]);

  const filtered = assets.filter(a => {
    if (filter !== '全部' && a.category !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg)] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--border)] shrink-0 bg-[var(--bg2)]">
        <span className="text-sm font-bold text-[var(--text)]">素材</span>
        <span className="text-[11px] text-[var(--muted)]">{assets.length} 项</span>
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        {CATS.map(c => (
          <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${filter===c?'bg-[var(--accent-solid)] text-white':'text-[var(--text3)] hover:text-[var(--text)]'}`}
            onClick={() => setFilter(c)}>{c}</button>
        ))}
        <input className="w-40 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1 text-[11px] text-[var(--text)] outline-none focus:border-gold-400 ml-auto"
          placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
        {selected.size > 0 && (
          <button className="text-[11px] px-3 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-500 rounded-lg transition-colors"
            onClick={removeSelected}>删除 ({selected.size})</button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-3xl mb-3 opacity-20">📂</div>
              <div className="text-sm text-[var(--muted)]">暂无素材</div>
              <div className="text-xs text-[var(--dim)] mt-1">使用右下角 📦 导入素材</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {filtered.map(a => (
              <div key={a.id}
                className={`group bg-[var(--card)] border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md ${selected.has(a.id) ? 'ring-2 ring-[var(--accent-text)] border-[var(--accent-text)]' : 'border-[var(--border)]'}`}
                onClick={() => toggleSelect(a.id)}
                onDoubleClick={() => setPreview(a)}>
                <div className="aspect-[4/3] bg-black">
                  <img src={a.url} alt={a.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                </div>
                <div className="p-2.5">
                  <div className="text-[11px] text-[var(--text2)] truncate font-medium">{a.name}</div>
                  <span className="text-[10px] bg-[var(--card2)] px-1.5 py-0.5 rounded text-[var(--text3)] mt-1 inline-block">{a.category}</span>
                </div>
                {selected.has(a.id) && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-[var(--accent-text)] text-white rounded-full flex items-center justify-center text-[10px]">✓</div>
                )}
              </div>
            ))}
          </div>
        )}
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
