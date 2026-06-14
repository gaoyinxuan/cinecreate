/**
 * Document Editor — single doc view, no tree duplication.
 */
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/dbService';
import AIAssistant from './AIAssistant';

interface Props { projectId: string; docId: string; onDocUpdated: () => void; }

export default function DocEditor({ projectId, docId, onDocUpdated }: Props) {
  const [doc, setDoc] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<any>(null);
  const loadedId = useRef<string|null>(null);

  useEffect(() => {
    loadedId.current = docId;
    db.docs.getAll(projectId).then(docs => {
      const d = docs.find((x:any) => x.id === docId);
      if (d) { setDoc(d); setTitle(d.title); setContent(d.content||''); setDirty(false); }
    }).catch(()=>{});
  }, [projectId, docId]);

  // Auto-save
  useEffect(() => {
    if (!doc || !dirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await db.docs.update(doc.id, { title, content }).catch(()=>{});
      setDirty(false);
      onDocUpdated();
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [title, content, dirty, doc, onDocUpdated]);

  const handleChange = (newTitle: string, newContent: string) => {
    setTitle(newTitle); setContent(newContent); setDirty(true);
  };

  if (!doc) return <div className="flex-1 flex items-center justify-center text-sm text-[var(--muted)]">加载中...</div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 bg-[var(--bg2)] border-b border-[var(--border)]">
        <input className="bg-transparent text-base font-bold text-[var(--text)] outline-none border-b border-transparent hover:border-[#333] focus:border-accent-400 flex-1"
          value={title} onChange={e => handleChange(e.target.value, content)} />
        <span className={`text-xs ${dirty ? 'text-yellow-400' : 'text-[var(--muted)]'}`}>{dirty ? '● 未保存' : '✓ 已保存'}</span>
      </div>

      {/* Editor + AI Assistant split */}
      <div className="flex-1 flex overflow-hidden">
        <textarea className="flex-1 bg-[var(--bg)] text-sm text-[var(--text)] outline-none resize-none p-5 font-mono leading-relaxed"
          style={{ fontFamily: 'Consolas, "Courier New", monospace' }}
          value={content} onChange={e => handleChange(title, e.target.value)}
          placeholder="输入 Markdown 内容..." />
        <div className="w-64 shrink-0 border-l border-[var(--border)] flex flex-col">
          <AIAssistant projectId={projectId} contextDoc={{id:doc.id, title, content}} onDocCreated={() => { onDocUpdated(); /* reload */ }} />
        </div>
      </div>
    </div>
  );
}
