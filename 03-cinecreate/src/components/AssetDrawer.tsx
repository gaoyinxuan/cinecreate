import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

const CATEGORIES = ['全部','人物','场景','道具','参考','Prompt'];

interface AssetItem {
  id: string; name: string; category: string;
  blobId: string; url: string; createdAt: string;
}

export default function AssetDrawer({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [filter, setFilter] = useState('全部');
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState<{files:File[]}|null>(null);
  const [importCat, setImportCat] = useState('参考');
  const fileRef = useRef<HTMLInputElement>(null);

  // Load
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
      setAssets(all);
      saveMeta(all);
    }
    setImporting(null);
  }, [assets, saveMeta]);

  const handleFiles = (files: File[]) => {
    if (!files.length) return;
    setImporting({files: Array.from(files)});
    setImportCat('参考');
    setOpen(true);
  };

  const removeAsset = useCallback(async (item: AssetItem) => {
    URL.revokeObjectURL(item.url);
    try { await db.blobs.delete(item.blobId); } catch {}
    const filtered = assets.filter(a => a.id !== item.id);
    setAssets(filtered);
    saveMeta(filtered);
  }, [assets, saveMeta]);

  const filtered = assets.filter(a => {
    if (filter !== '全部' && a.category !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <button
        className="fixed bottom-5 right-5 z-[100] w-10 h-10 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-lg flex items-center justify-center text-lg hover:scale-110 hover:shadow-xl transition-all"
        onClick={() => setOpen(!open)}
        title="素材库"
      >📦</button>

      {open && (
        <div
          className={`fixed bottom-16 right-5 z-[99] w-80 max-h-[520px] bg-[var(--card)] border rounded-xl shadow-2xl flex flex-col overflow-hidden ${dragOver ? 'border-[var(--accent-text)] bg-[var(--accent-bg)]' : 'border-[var(--border)]'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--text)]">素材库{assets.length ? ` · ${assets.length}` : ''}</span>
            <button className="text-[var(--muted)] hover:text-[var(--text)] text-sm" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Import category picker */}
          {importing && (
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--card2)]">
              <div className="text-[11px] text-[var(--text2)] mb-2">{importing.files.length} 个文件，选择分类：</div>
              <div className="flex gap-1 flex-wrap mb-2">
                {CATEGORIES.filter(c=>c!=='全部').map(c => (
                  <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${importCat===c?'bg-[var(--accent-solid)] text-white':'bg-[var(--card)] border border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)]'}`}
                    onClick={() => setImportCat(c)}>{c}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-1 text-[11px] bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
                  onClick={() => doImport(importing.files, importCat)}>确认导入</button>
                <button className="flex-1 py-1 text-[11px] bg-[var(--card)] border border-[var(--border)] text-[var(--text2)] rounded-lg"
                  onClick={() => setImporting(null)}>取消</button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="px-4 py-2">
            <input className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent-text)]/30" placeholder="搜索素材..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Category filter tabs */}
          <div className="flex gap-1 px-4 pb-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${filter===c?'bg-[var(--accent-solid)] text-white':'bg-[var(--card2)] text-[var(--text3)] hover:text-[var(--text)]'}`}
                onClick={() => setFilter(c)}>{c}</button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto px-4 py-2 min-h-[120px]">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full py-10">
                <div className="text-center">
                  <div className="text-2xl mb-2 opacity-20">📂</div>
                  <div className="text-xs text-[var(--muted)]">{assets.length ? '无匹配结果' : '暂无素材'}</div>
                  <div className="text-[10px] text-[var(--dim)] mt-1">拖拽文件到此处导入</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filtered.map(a => (
                  <div key={a.id} className="group relative aspect-square rounded-lg overflow-hidden bg-black border border-[var(--border)]">
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button className="text-white text-xs bg-black/60 hover:bg-red-500/80 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        onClick={e => { e.stopPropagation(); removeAsset(a); }}>✕</button>
                    </div>
                    <div className="absolute top-1 left-1 bg-black/60 text-[8px] text-white px-1 rounded">{a.category}</div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white truncate px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{a.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-4 py-3 border-t border-[var(--border)]">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) { handleFiles(Array.from(e.target.files)); e.target.value = ''; } }} />
            <button className="flex-1 py-1.5 text-[11px] bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg transition-colors"
              onClick={() => fileRef.current?.click()}>+ 导入</button>
            <button className="flex-1 py-1.5 text-[11px] bg-[var(--card2)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] rounded-lg transition-colors"
              onClick={() => setOpen(false)}>关闭</button>
          </div>
        </div>
      )}
    </>
  );
}
