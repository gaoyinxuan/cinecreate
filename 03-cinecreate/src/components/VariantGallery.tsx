import React, { useState, useCallback } from 'react';
import { Variant } from '../types';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
let pasteTargetRef: any = { current: null };

interface Props {
  variants: Variant[]; onUpdate: (v: Variant[]) => void;
  onLightbox: (blob: Blob, label: string) => void;
  onCompare: (altId: string) => void; shotId: string;
}
export default function VariantGallery({ variants, onUpdate, onLightbox, onCompare, shotId }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [comparePick, setComparePick] = useState(false);
  const primary = variants.find(v => v.isPrimary) || variants[0];
  const otherVariants = variants.filter(v => v.id !== primary?.id);

  const nextLetter = useCallback((all: Variant[]) => {
    const used = new Set(all.map(v => v.letter));
    for (let i = 0; i < 26; i++) { const l = `方案 ${String.fromCharCode(65+i)}`; if (!used.has(l)) return l; }
    return `方案 ${all.length}`;
  }, []);

  const addVariant = useCallback((files: File[]) => {
    const imgs = files.filter(f => f.type.match(/^image\/(png|jpe?g|webp)$/));
    if (!imgs.length) return;
    const hasPrimary = variants.some(v => v.isPrimary);
    let temp = [...variants];
    const news: Variant[] = [];
    for (const f of imgs) {
      const isFirst = !hasPrimary && temp.length === 0;
      const letter = nextLetter(temp);
      news.push({ id: uid(), label: isFirst ? '主方案' : letter, letter, isPrimary: isFirst, tags: {} });
      temp.push(news[news.length-1]);
    }
    onUpdate([...variants, ...news]);
  }, [variants, onUpdate, nextLetter]);

  const setPrimary = (id: string) => {
    onUpdate(variants.map(v => v.id===id ? {...v, label:'主方案', isPrimary:true} : v.isPrimary ? {...v, label:v.letter, isPrimary:false} : v));
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (otherVariants.length === 1) onCompare(otherVariants[0].id);
    else if (otherVariants.length >= 2) setComparePick(true);
  };

  const imgUrl = (blob?: Blob) => blob ? URL.createObjectURL(blob) : null;

  return (
    <div className={`space-y-3 ${dragOver ? 'ring-2 ring-gold-400 rounded-lg' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addVariant(Array.from(e.dataTransfer.files)); }}>
      {primary && (
        <div className="relative rounded-lg overflow-hidden bg-[var(--card2)] border border-[var(--border2)] cursor-pointer group/img" style={{ aspectRatio: '16/9' }}
          onClick={() => primary.imageBlob && onLightbox(primary.imageBlob, primary.label)}>
          {primary.imageBlob && <img src={imgUrl(primary.imageBlob)!} className="w-full h-full object-cover group-hover/img:opacity-80" alt="" />}
          <span className="absolute top-2 left-2 bg-[var(--accent-solid)] text-white text-xs font-bold px-2 py-0.5 rounded-full">{primary.label}</span>
          {otherVariants.length >= 1 && (
            <button className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/img:opacity-100"
              onClick={handleCompare}>对比 →</button>
          )}
          {comparePick && (
            <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center gap-2 rounded-lg" onClick={e => e.stopPropagation()}>
              <span className="text-xs text-[var(--text3)] mb-1">选择对比对象</span>
              {(otherVariants||[]).map(v => (
                <button key={v.id} className="text-xs px-3 py-1.5 bg-[var(--card)] hover:bg-[var(--accent-solid)]/30 text-[var(--text)] hover:text-white rounded-lg"
                  onClick={e => { e.stopPropagation(); setComparePick(false); onCompare(v.id); }}>{v.label}</button>
              ))}
              <button className="text-xs text-[var(--muted)] hover:text-[var(--text2)] mt-1" onClick={e => { e.stopPropagation(); setComparePick(false); }}>取消</button>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(variants||[]).map((v, i) => {
          const isP = v.isPrimary;
          return (
            <div key={v.id} className={`relative shrink-0 w-24 rounded-lg overflow-hidden border-2 transition-colors group/var ${isP ? 'border-gold-500' : 'border-transparent hover:border-[var(--border2)]'}`}>
              <div className="aspect-video bg-[var(--card2)] cursor-pointer" onClick={() => v.imageBlob && onLightbox(v.imageBlob, v.label)}>
                {v.imageBlob && <img src={imgUrl(v.imageBlob)!} className="w-full h-full object-cover" alt="" />}
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/var:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                <input className="bg-transparent text-xs text-white text-center w-full outline-none border-b border-white/20"
                  value={v.label} onChange={e => onUpdate(variants.map(x => x.id===v.id ? {...x, label:e.target.value} : x))} />
                {!isP && <><button className="text-xs text-yellow-400" onClick={e=>{e.stopPropagation();setPrimary(v.id);}}>☆ 设为主图</button>
                  <button className="text-xs text-red-400" onClick={e=>{e.stopPropagation();if(variants.length>1)onUpdate(variants.filter(x=>x.id!==v.id));}}>✕ 删除</button></>}
              </div>
              {isP && <span className="absolute bottom-1 left-1 text-[9px] text-[var(--text)] font-bold">主</span>}
              <span className="absolute top-1 right-1 text-[9px] text-white/60">{String.fromCharCode(65+i)}</span>
            </div>
          );
        })}
        <label className="shrink-0 w-24 aspect-video rounded-lg border-2 border-dashed border-[var(--border2)] hover:border-gold-400/50 flex flex-col items-center justify-center cursor-pointer group/add"
          onMouseEnter={() => { pasteTargetRef.current = { type: 'variant', shotId }; }}
          onMouseLeave={() => { pasteTargetRef.current = null; }}>
          <span className="text-2xl text-[var(--dim)] group-hover/add:text-[var(--dim)]">+</span>
          <span className="text-[9px] text-[var(--text2)] group-hover/add:text-[var(--dim)] mt-0.5">Ctrl+V</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={e => { if (e.target.files?.length) { addVariant(Array.from(e.target.files)); e.target.value = ''; } }} />
        </label>
      </div>
    </div>
  );
}
