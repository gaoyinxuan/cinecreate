import React, { useMemo, useEffect, useState } from 'react';

interface Props { imageBlob: Blob; title?: string; onClose: () => void; }
export default function Lightbox({ imageBlob, title, onClose }: Props) {
  const url = useMemo(() => URL.createObjectURL(imageBlob), [imageBlob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key==='Escape') onClose(); }; document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[998] bg-black/90 flex items-center justify-center cursor-zoom-out" onClick={onClose}>
      <span className="absolute top-5 right-6 text-3xl text-white opacity-70 hover:opacity-100">&times;</span>
      <img src={url} className="max-w-[92vw] max-h-[92vh] rounded-lg shadow-2xl" alt={title||''} />
    </div>
  );
}

export function LightboxCompare({ variants, primaryId, altId, onSwitch, onClose }: { variants: any[]; primaryId: string; altId: string; onSwitch: (id: string) => void; onClose: () => void; }) {
  const p = variants.find(v => v.id===primaryId);
  const a = variants.find(v => v.id===altId);
  const others = variants.filter(v => v.id!==primaryId && v.id!==altId);
  const urlA = useMemo(() => p?.imageBlob ? URL.createObjectURL(p.imageBlob) : null, [p]);
  const urlB = useMemo(() => a?.imageBlob ? URL.createObjectURL(a.imageBlob) : null, [a]);
  useEffect(() => () => { if(urlA) URL.revokeObjectURL(urlA); if(urlB) URL.revokeObjectURL(urlB); }, [urlA, urlB]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if(e.key==='Escape') onClose(); }; document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h); }, [onClose]);
  if (!p || !a) return null;
  return (
    <div className="fixed inset-0 z-[998] compare-overlay flex flex-col items-center justify-center" style={{ background: 'rgba(8,8,20,0.72)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex items-center gap-4 mb-6 px-5 py-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }} onClick={e=>e.stopPropagation()}>
        <span className="text-xs text-[var(--text)]/90">{p.label}</span>
        <span className="text-xs text-[var(--muted)]">vs</span>
        <span className="text-xs text-[var(--dim)]">{a.label}</span>
        {others.length > 0 && <><span className="w-px h-4 bg-white/[0.08]" />{others.map(o => <button key={o.id} className="text-xs px-2 py-1 rounded-full text-[var(--dim)] hover:text-[var(--text)] hover:bg-white/[0.08]" onClick={e=>{e.stopPropagation();onSwitch(o.id);}}>{o.label}</button>)}</>}
      </div>
      <div className="relative z-10 flex items-center gap-8 px-8" onClick={e=>e.stopPropagation()}>
        <div className="compare-img-enter flex flex-col items-center gap-3" style={{animationDelay:'0s'}}>
          <img src={urlA!} className="max-w-[42vw] max-h-[68vh] rounded-xl object-contain shadow-[0_8px_40px_rgba(124,111,247,0.12)]" alt="" />
          <span className="text-xs text-[var(--text)]/70">{p.label}</span>
        </div>
        <span className="text-xl text-white/10 font-light">vs</span>
        <div className="compare-img-enter flex flex-col items-center gap-3" style={{animationDelay:'0.08s'}}>
          <img src={urlB!} className="max-w-[42vw] max-h-[68vh] rounded-xl object-contain shadow-[0_8px_40px_rgba(0,0,0,0.3)]" alt="" />
          <span className="text-xs text-[var(--text3)]">{a.label}</span>
        </div>
      </div>
      <div className="relative z-10 mt-6">
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.10] text-white/30 hover:text-white/70 text-lg" onClick={onClose}>&times;</button>
      </div>
    </div>
  );
}
