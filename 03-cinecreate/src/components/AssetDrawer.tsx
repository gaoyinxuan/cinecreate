import React, { useState, useRef } from 'react';

export default function AssetDrawer({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = [
    { icon:'📷', label:'导入', action: () => fileRef.current?.click() },
    { icon:'✏️', label:'文字', action: () => { setOpen(false); /* jump to asset board */ } },
    { icon:'📋', label:'粘贴', action: async () => {
      try { const items = await navigator.clipboard.read(); for (const item of items) {
        for (const t of item.types) { if (t.startsWith('image/')) { const blob = await (item as any).getType(t); /* handle blob */ break; } }
      } } catch {}
      setOpen(false);
    }},
    { icon:'🗂', label:'浏览', action: () => { setOpen(false); /* jump to board */ } },
  ];

  return (
    <>
      <button className="fixed bottom-5 right-5 z-[100] w-10 h-10 rounded-full bg-white border border-[#e8e5e0] shadow-md flex items-center justify-center text-lg hover:shadow-lg hover:scale-105 transition-all"
        onClick={() => setOpen(!open)} title="工具">📦</button>

      {open && (
        <div className="fixed bottom-16 right-5 z-[99] bg-white border border-[#e8e5e0] rounded-2xl shadow-xl py-1.5 min-w-[120px] flex flex-col">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) { e.target.value = ''; } setOpen(false); }} />
          {items.map((it, i) => (
            <button key={i} className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#555] hover:bg-[#f5f3ef] hover:text-[#111] transition-colors text-left"
              onClick={it.action}>
              <span className="text-sm w-5 text-center">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          ))}
          <div className="border-t border-[#eee] my-0.5" />
          <button className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#888] hover:bg-[#f5f3ef] hover:text-[#111] transition-colors text-left"
            onClick={() => setOpen(false)}>
            <span className="text-sm w-5 text-center">✕</span>
            <span>关闭</span>
          </button>
        </div>
      )}
    </>
  );
}
