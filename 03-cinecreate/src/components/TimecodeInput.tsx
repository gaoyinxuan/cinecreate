import React, { useState } from 'react';

interface Props { value: string; onChange: (v: string) => void; placeholder?: string; hasError?: boolean; }
export default function TimecodeInput({ value, onChange, placeholder = '00:00', hasError }: Props) {
  const [focused, setFocused] = useState(false);
  const parseAndFormat = (raw: string) => {
    const cleaned = raw.replace(/[^0-9:]/g, '').replace(/:+/g, ':').slice(0, 8);
    const m = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (m) { const mm = parseInt(m[1]), ss = parseInt(m[2]); if (ss > 59) return cleaned; return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
    const num = parseInt(cleaned);
    if (!isNaN(num) && num >= 0) { const mm = Math.floor(num/60), ss = num%60; return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
    return cleaned;
  };
  return (
    <input className={`bg-[var(--card2)] border rounded px-2 py-1 text-[var(--text)] w-20 text-center font-mono text-xs focus:outline-none ${hasError ? 'border-red-500/50' : 'border-[var(--border2)] focus:border-gold-400'}`}
      placeholder={placeholder} value={focused ? value : (value || '')}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); if (value?.trim()) { const f = parseAndFormat(value); if (f !== value) onChange(f); } }}
      onChange={e => { const c = e.target.value.replace(/[^0-9:]/g, '').replace(/:+/g, ':').slice(0, 8); onChange(c); }} />
  );
}
