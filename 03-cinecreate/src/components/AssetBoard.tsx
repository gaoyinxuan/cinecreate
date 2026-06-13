import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/dbService';

const CATS = ['人物','场景','道具','参考','Prompt'];

interface AssetItem { id: string; name: string; category: string; blobId: string; url: string; createdAt: string; }

export default function AssetBoard({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [filter, setFilter] = useState('人物');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<AssetItem|null>(null);

  const load = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const changeCategory = useCallback(async (id: string, cat: string) => {
    const updated = assets.map(a => a.id===id ? {...a, category: cat} : a);
    setAssets(updated);
    await db.meta.set(`assetlib_${projectId}`, updated.map(({url,...r})=>r));
  }, [assets, projectId]);

  const removeAsset = useCallback(async (item: AssetItem) => {
    URL.revokeObjectURL(item.url);
    try { await db.blobs.delete(item.blobId); } catch {}
    const filtered = assets.filter(a => a.id !== item.id);
    setAssets(filtered);
    await db.meta.set(`assetlib_${projectId}`, filtered.map(({url,...r})=>r));
  }, [assets, projectId]);

  const filtered = assets.filter(a => {
    if (a.category !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#fcfbf9] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 shrink-0 bg-white/80 backdrop-blur border-b border-[#eee]">
        <span className="text-[13px] font-semibold text-[#333]">素材</span>
        <span className="text-[11px] text-[#aaa] ml-0.5">{assets.length}</span>
        <div className="flex gap-1 ml-4">
          {CATS.map(c => (
            <button key={c} className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all ${filter===c?'bg-[#333] text-white shadow-sm':'text-[#888] hover:text-[#333] hover:bg-black/5'}`}
              onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
        <div className="flex-1" />
        <input className="w-36 bg-[#f5f3ef] border-0 rounded-lg px-3 py-1.5 text-[11px] text-[#333] outline-none focus:ring-1 focus:ring-[#d4c8b0]"
          placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4 opacity-15">📂</div>
              <div className="text-sm text-[#999] font-medium">暂无「{filter}」素材</div>
              <div className="text-xs text-[#bbb] mt-1.5">使用右下角 📦 导入，或 Ctrl+V 粘贴图片</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {filtered.map(a => (
              <div key={a.id}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                onDoubleClick={() => setPreview(a)}>
                {/* Image — natural aspect ratio via padding trick */}
                <div className="relative bg-[#f0ede8] overflow-hidden" style={{paddingBottom:'75%'}}>
                  <img src={a.url} alt={a.name} className="absolute inset-0 w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <button className="absolute top-2 right-2 w-6 h-6 bg-white/90 hover:bg-red-500 text-[#999] hover:text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    onClick={e => { e.stopPropagation(); removeAsset(a); }}>✕</button>
                </div>
                {/* Info */}
                <div className="p-3">
                  <div className="text-[12px] text-[#333] truncate font-medium leading-tight">{a.name}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <select className="text-[10px] bg-[#f5f3ef] border-0 rounded-md px-2 py-0.5 text-[#888] outline-none cursor-pointer"
                      value={a.category} onChange={e => changeCategory(a.id, e.target.value)}>
                      {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setPreview(null)}>
          <img src={preview.url} alt={preview.name} className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-6 right-8 text-3xl text-white/40 hover:text-white/80 transition-colors" onClick={() => setPreview(null)}>✕</button>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur rounded-full px-5 py-2 text-sm text-white/80">
            {preview.name} · {preview.category}
            <button className="ml-3 text-white/60 hover:text-white/90 text-xs"
              onClick={(e) => { e.stopPropagation(); changeCategory(preview.id, preview.category==='参考'?'人物':preview.category==='人物'?'场景':preview.category==='场景'?'道具':preview.category==='道具'?'Prompt':preview.category==='Prompt'?'参考':'参考'); }}>
              切换分类
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
