import React, { useState, useMemo } from 'react';
import { Shot } from '../types';
import VariantGallery from './VariantGallery';
import TimecodeInput from './TimecodeInput';
import PresetTags from './PresetTags';
import Lightbox from './Lightbox';

interface Props { shot: Shot; globalNum: number; onChange: (s: Shot) => void; onDelete: () => void; }
export default function ShotCard({ shot, globalNum, onChange, onDelete }: Props) {
  const [lightbox, setLightbox] = useState<{ blob: Blob; title: string } | null>(null);
  const [compare, setCompare] = useState<{ altId: string } | null>(null);
  const variants = shot.variants || [];

  const durationSec = useMemo(() => {
    const parse = (s: string) => { const m = s.match(/^(\d+):(\d{2})$/); return m ? parseInt(m[1])*60+parseInt(m[2]) : null; };
    const a = parse(shot.startTime), b = parse(shot.endTime);
    if (a===null||b===null||b<a) return null;
    return b-a;
  }, [shot.startTime, shot.endTime]);

  const endErr = useMemo(() => {
    const parse = (s: string) => { const m = s.match(/^(\d+):(\d{2})$/); return m ? parseInt(m[1])*60+parseInt(m[2]) : null; };
    const a = parse(shot.startTime), b = parse(shot.endTime);
    return a!==null && b!==null && b<a;
  }, [shot.startTime, shot.endTime]);

  const field = (k: keyof Shot) => (v: any) => onChange({ ...shot, [k]: v });
  const updateTime = (k: 'startTime'|'endTime') => (v: string) => {
    const u = { ...shot, [k]: v };
    const parse = (s: string) => { const m = s.match(/^(\d+):(\d{2})$/); return m ? parseInt(m[1])*60+parseInt(m[2]) : null; };
    const d = parse(u.startTime)!=null && parse(u.endTime)!=null ? (parse(u.endTime)! - parse(u.startTime)!) : null;
    if (d !== null && d >= 0) { const mm = Math.floor(d/60); const ss = d%60; u.duration = `${mm}m ${ss}s`; }
    onChange(u);
  };

  return (
    <div id={`shot-${shot.id}`} className="bg-[var(--card)] border border-[var(--border2)] rounded-xl overflow-hidden hover:border-[var(--border2)] transition-colors group">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/5">
        <span className="bg-[var(--accent-solid)] text-white text-xs font-bold px-2.5 py-1 rounded-full">Shot {globalNum || '?'}</span>
        {durationSec !== null && <span className="text-xs text-gold-500 font-mono ml-1">⏱ {Math.floor(durationSec/60)}m {durationSec%60}s</span>}
        <span className="text-xs text-[var(--muted)] ml-auto">{shot.startTime || '--:--'} → {shot.endTime || '--:--'}</span>
        <span className="text-xs text-[var(--text2)]">{variants.length > 1 ? `${variants.length} 方案` : ''}</span>
        <button className="text-[var(--muted)] hover:text-red-400 text-sm px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100" onClick={onDelete}>✕</button>
      </div>
      <div className="flex gap-4 p-4">
        <div className="shrink-0 w-[260px]">
          <VariantGallery variants={variants} onUpdate={v => field('variants')(v)}
            onLightbox={(b,l) => setLightbox({ blob: b, title: l })}
            onCompare={(altId) => setCompare({ altId })}
            shotId={shot.id} />
        </div>
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <input className="bg-transparent text-base font-semibold text-[var(--text)] outline-none border-b border-transparent focus:border-gold-400 pb-1" placeholder="分镜标题" value={shot.title} onChange={e => field('title')(e.target.value)} />
          <textarea className="flex-1 bg-[var(--card2)] border border-[var(--border2)] rounded-lg p-3 text-sm text-[var(--text)] outline-none resize-none focus:border-gold-400 min-h-[80px]" placeholder="分镜描述、旁白文案、镜头说明..." value={shot.description} onChange={e => field('description')(e.target.value)} />
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-[var(--text3)] w-8">开始</span>
            <TimecodeInput value={shot.startTime} onChange={updateTime('startTime')} />
            <span className="text-[var(--text2)] text-xs">→</span>
            <span className="text-xs text-[var(--text3)] w-8">结束</span>
            <TimecodeInput value={shot.endTime} onChange={updateTime('endTime')} hasError={endErr} />
            {durationSec !== null && <span className="text-xs text-gold-500 font-mono font-semibold">{Math.floor(durationSec/60)}m {durationSec%60}s</span>}
            {endErr && <span className="text-xs text-red-400">结束时间不能小于开始时间</span>}
          </div>
          <PresetTags tags={shot.tags || []} onChange={t => field('tags')(t)} />
        </div>
      </div>
      {lightbox && <Lightbox imageBlob={lightbox.blob} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </div>
  );
}
