import React, { useState } from 'react';
import { Sequence, Shot } from '../types';
import { useToast } from './ToastProvider';
import InlinePrompt from './InlinePrompt';

const api = (window as any).electronAPI;

interface Props {
  sequences: Sequence[]; activeSeqId: string | null;
  onSelect: (id: string | null) => void; onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
  shotsBySeq: Record<string, Shot[]>;
}
export default function SequenceTabs({ sequences, activeSeqId, onSelect, onCreate, onRename, onDelete, shotsBySeq }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToast();

  const startRename = (s: Sequence) => { setEditId(s.id); setEditName(s.name); };
  const confirmRename = (id: string) => {
    const n = editName.trim(); if (!n) { toast('名称不能为空'); return; }
    onRename(id, n); setEditId(null);
  };
  const handleDelete = async (s: Sequence) => {
    const ok = api ? await api.confirm('删除序列及其中所有分镜？', '删除确认') : window.confirm('删除序列及其中所有分镜？');
    if (ok) onDelete(s.id);
  };
  const handleCreate = (name: string) => { onCreate(name); setShowCreate(false); };

  return (
    <div className="flex items-center gap-3 px-6 py-2 bg-[var(--bg2)] border-b border-[var(--border)] overflow-x-auto">
      <button className={`shrink-0 text-xs px-3 py-1 rounded-lg transition-colors ${!activeSeqId ? 'bg-[var(--accent-bg)] text-[var(--text)] border border-gold-400/30' : 'text-[var(--dim)] hover:text-[var(--text2)] border border-transparent hover:border-[var(--border2)]'}`}
        onClick={() => onSelect(null)}>全部</button>
      <span className="text-[var(--border)] mx-1">|</span>
      {(sequences||[]).map(s => {
        const count = (shotsBySeq[s.id] || []).length;
        const active = s.id === activeSeqId;
        return (
          <div key={s.id}
            className={`shrink-0 group flex items-center gap-1 text-xs px-3 py-1 rounded-lg cursor-pointer transition-colors ${active ? 'bg-[var(--accent-bg)] text-[var(--text)] border border-gold-400/30' : 'text-[var(--text3)] hover:text-[var(--text2)] border border-transparent hover:border-[var(--border2)]'}`}
            onClick={() => onSelect(s.id)} onDoubleClick={() => startRename(s)}>
            {editId === s.id ? (
              <input className="bg-[var(--card2)] border border-gold-400 rounded px-1 py-0 text-xs text-[var(--text)] outline-none w-20"
                value={editName} onChange={e => setEditName(e.target.value)}
                onBlur={() => confirmRename(s.id)} onKeyDown={e => { if(e.key==='Enter') confirmRename(s.id); if(e.key==='Escape') setEditId(null); }}
                autoFocus onClick={e => e.stopPropagation()} />
            ) : <span>{s.name}</span>}
            <span className="text-xs text-[var(--muted)]">({count})</span>
            <span className="hidden group-hover:flex items-center ml-1 gap-0.5">
              <button className="text-[var(--muted)] hover:text-[var(--text2)]" onClick={e=>{e.stopPropagation();startRename(s);}}>✎</button>
              <button className="text-[var(--muted)] hover:text-red-400" onClick={e=>{e.stopPropagation();handleDelete(s);}}>✕</button>
            </span>
          </div>
        );
      })}
      <button className="shrink-0 text-[var(--muted)] hover:text-gold-500 text-lg px-2" onClick={() => setShowCreate(true)}>+</button>
      {showCreate && <InlinePrompt title="输入序列名称" onConfirm={handleCreate} onCancel={() => setShowCreate(false)} />}
    </div>
  );
}
