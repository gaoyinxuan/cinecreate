import React, { useState } from 'react';

const GROUPS = {
  scene:  { label:'场景', opts: ['Interior','Exterior','Day','Night'] },
  shot:   { label:'镜头', opts: ['Wide Shot','Medium Shot','Close-up','Extreme CU'] },
  motion: { label:'运动', opts: ['Static','Slow Motion','Pan','Tracking'] },
};

interface Props { tags: string[]; onChange: (t: string[]) => void; }
export default function PresetTags({ tags, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const toggle = (t: string) => onChange(tags.includes(t) ? tags.filter(x => x!==t) : [...tags, t]);
  const count = tags.length;
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button className={`text-xs px-2 py-1 rounded flex items-center gap-1 max-w-[200px] ${count ? 'bg-gold-400/15 text-[var(--text)] border border-gold-400/20' : 'text-[var(--muted)] hover:text-[var(--text3)] border border-transparent hover:border-[var(--border2)]'}`}
        onClick={() => setOpen(!open)}>
        <span>🏷</span>
        {count > 0 ? <span className="text-xs truncate">{tags.join(', ')}</span> : <span className="text-xs opacity-50">标签</span>}
        <span className="text-xs ml-1 opacity-50 shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 bg-[var(--card)] border border-[var(--border2)] rounded-xl p-3 shadow-2xl z-50 w-80" onClick={e => e.stopPropagation()}>
          {Object.entries(GROUPS).map(([key, g]) => (
            <div key={key} className="mb-2 last:mb-0">
              <div className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">{g.label}</div>
              <div className="flex flex-wrap gap-1">
                {g.opts.map(opt => {
                  const active = tags.includes(opt);
                  return <button key={opt} className={`text-xs px-2 py-1 rounded-full ${active ? 'bg-gold-400 text-white' : 'bg-[var(--card2)] text-[var(--dim)] hover:text-[var(--text2)] hover:bg-[var(--border)]'}`}
                    onClick={() => toggle(opt)}>{opt}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
