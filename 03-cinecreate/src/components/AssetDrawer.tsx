import React, { useState, useRef } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function AssetDrawer({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveAsset = async (file: File, category: string) => {
    if (!projectId) return;
    const blobId = uid();
    try {
      await db.blobs.save(blobId, file);
      const meta = await db.meta.get(`assetlib_${projectId}`);
      const list = Array.isArray(meta) ? meta : [];
      list.push({ id: uid(), name: file.name, category, blobId, createdAt: new Date().toISOString() });
      await db.meta.set(`assetlib_${projectId}`, list);
    } catch {}
  };

  const handlePaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const t of item.types) {
          if (t.startsWith('image/')) {
            const blob = await (item as any).getType(t);
            const file = new File([blob], `paste-${Date.now()}.png`, {type: t});
            await saveAsset(file, '参考');
          }
        }
      }
    } catch {}
    setOpen(false);
  };

  return (
    <>
      <button className="fixed bottom-5 right-5 z-[100] w-10 h-10 rounded-full bg-white border border-[#e8e5e0] shadow-md flex items-center justify-center text-lg hover:shadow-lg hover:scale-105 transition-all"
        onClick={() => setOpen(!open)} title="工具">📦</button>

      {open && (
        <div className="fixed bottom-16 right-5 z-[99] bg-white border border-[#e8e5e0] rounded-2xl shadow-xl py-1.5 min-w-[130px] flex flex-col">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={async e => {
              if (e.target.files?.length && projectId) {
                for (const f of Array.from(e.target.files)) await saveAsset(f, '参考');
              }
              e.target.value = ''; setOpen(false);
            }} />
          <button className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#555] hover:bg-[#f5f3ef] transition-colors text-left"
            onClick={() => fileRef.current?.click()}>
            <span className="text-sm w-5 text-center">📷</span><span>导入</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#555] hover:bg-[#f5f3ef] transition-colors text-left"
            onClick={handlePaste}>
            <span className="text-sm w-5 text-center">📋</span><span>粘贴</span>
          </button>
          <div className="border-t border-[#eee] my-0.5" />
          <button className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#555] hover:bg-[#f5f3ef] transition-colors text-left"
            onClick={() => setOpen(false)}>
            <span className="text-sm w-5 text-center">✕</span><span>关闭</span>
          </button>
        </div>
      )}
    </>
  );
}
