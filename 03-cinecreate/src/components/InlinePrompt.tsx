import React, { useState, useRef, useEffect } from 'react';

interface Props { title: string; defaultValue?: string; onConfirm: (value: string) => void; onCancel: () => void; }
export default function InlinePrompt({ title, defaultValue, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState(defaultValue || '');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = () => { const v = value.trim(); if (v) onConfirm(v); else onCancel(); };
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-[var(--card)] border border-[var(--border2)] rounded-xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-sm text-[var(--text)] mb-3">{title}</div>
        <input ref={ref} className="w-full bg-[var(--card2)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-indigo-500 mb-4"
          value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }} />
        <div className="flex justify-end gap-2">
          <button className="px-4 py-1.5 text-xs text-[var(--text3)] hover:text-[var(--text)] rounded-lg hover:bg-white/[0.04]" onClick={onCancel}>取消</button>
          <button className="px-4 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-semibold" onClick={submit}>确定</button>
        </div>
      </div>
    </div>
  );
}
