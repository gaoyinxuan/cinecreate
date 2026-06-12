/**
 * Documents Center — tree-based document management with Markdown editor.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/dbService';
import { useToast } from './ToastProvider';
import InlinePrompt from './InlinePrompt';
import AIAssistant from './AIAssistant';

interface DocItem { id: string; parentId: string|null; type: string; title: string; content: string; metadata: any; sortOrder: number; }

export default function DocumentsPanel({ projectId, onImportToStoryboard }: { projectId: string; onImportToStoryboard?: (doc: DocItem) => void }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [showNew, setShowNew] = useState<'file'|'folder'|null>(null);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<any>(null);
  const toast = useToast();

  const loadDocs = useCallback(async () => {
    try { setDocs(await db.docs.getAll(projectId)); } catch {}
  }, [projectId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const selected = docs.find(d => d.id === selectedId);
  const rootDocs = docs.filter(d => !d.parentId);
  const childrenOf = (parentId: string) => docs.filter(d => d.parentId === parentId);

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!selectedId || !dirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await db.docs.update(selectedId, { title: editTitle, content: editContent }); setDirty(false); } catch {}
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [editContent, editTitle, selectedId, dirty]);

  // Load selected document into editor
  useEffect(() => {
    if (selected) { setEditTitle(selected.title); setEditContent(selected.content||''); setDirty(false); }
  }, [selected?.id]);

  // ── Actions ──
  const handleCreate = async (type: string, parentId: string|null) => {
    const doc = await db.docs.create({ projectId, parentId, type, title: type==='folder'?'新文件夹':'新文稿', content:'', metadata:{} });
    setDocs(prev => [...prev, doc]);
    setShowNew(null);
    if (type !== 'folder') setSelectedId(doc.id);
    toast(type==='folder'?'文件夹已创建':'文稿已创建');
  };

  const handleDelete = async (id: string) => {
    await db.docs.delete(id);
    if (selectedId === id) setSelectedId(null);
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleRename = (id: string, name: string) => {
    setDocs(prev => prev.map(d => d.id===id ? {...d, title:name} : d));
    db.docs.update(id, { title: name }).catch(()=>{});
  };

  // ── Tree Node ──
  const TreeNode = ({ doc, depth }: { doc: DocItem; depth: number }) => {
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(doc.title);
    const kids = childrenOf(doc.id);
    const isFolder = doc.type === 'folder';
    const isSelected = selectedId === doc.id;
    const [expanded, setExpanded] = useState(true);

    return (
      <div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs group ${isSelected ? 'bg-[var(--accent-bg)] text-[var(--text)]' : 'text-[var(--text2)] hover:bg-white/[0.04]'}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => { if (isFolder) setExpanded(!expanded); else setSelectedId(doc.id); }}>
          {isFolder && <span className="text-xs w-3">{expanded ? '▼' : '▶'}</span>}
          <span className="shrink-0">{isFolder ? (expanded ? '📂' : '📁') : '📄'}</span>
          {renaming ? (
            <input className="flex-1 bg-[var(--card)] border border-gold-400 rounded px-1 text-xs text-[var(--text)] outline-none"
              value={name} onChange={e => setName(e.target.value)}
              onBlur={() => { setRenaming(false); if(name.trim()) handleRename(doc.id, name.trim()); }}
              onKeyDown={e => { if(e.key==='Enter'){setRenaming(false);if(name.trim())handleRename(doc.id,name.trim());}if(e.key==='Escape')setRenaming(false); }}
              autoFocus onClick={e => e.stopPropagation()} />
          ) : (
            <span className="flex-1 truncate" onDoubleClick={() => setRenaming(true)}>{doc.title}</span>
          )}
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button className="text-[var(--muted)] hover:text-[var(--text2)]" onClick={e=>{e.stopPropagation();setRenaming(true);}}>✎</button>
            <button className="text-[var(--muted)] hover:text-red-400" onClick={e=>{e.stopPropagation();handleDelete(doc.id);}}>✕</button>
          </div>
        </div>
        {isFolder && expanded && kids.map(k => <TreeNode key={k.id} doc={k} depth={depth+1} />)}
      </div>
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Tree */}
      <div className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
          <span className="text-xs text-[var(--dim)] font-semibold uppercase">文稿</span>
          <div className="flex gap-1">
            <button className="text-xs text-[var(--muted)] hover:text-[var(--text2)] px-1" onClick={()=>setShowNew('file')} title="新建文稿">+📄</button>
            <button className="text-xs text-[var(--muted)] hover:text-[var(--text2)] px-1" onClick={()=>setShowNew('folder')} title="新建文件夹">+📁</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {rootDocs.map(d => <TreeNode key={d.id} doc={d} depth={0} />)}
          {rootDocs.length === 0 && (
            <div className="text-xs text-[var(--muted)] text-center py-8">暂无文稿，点击 + 创建</div>
          )}
        </div>
        <AIAssistant projectId={projectId} contextDoc={selected ? {id:selected.id, title:selected.title, content:selected.content} : null} onDocCreated={loadDocs} />
      </div>

      {/* Right: Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg)]">
              <input className="bg-transparent text-sm font-semibold text-[var(--text)] outline-none border-b border-transparent hover:border-[#333] focus:border-gold-400 flex-1"
                value={editTitle} onChange={e => { setEditTitle(e.target.value); setDirty(true); }} />
              <span className={`text-xs ${dirty ? 'text-yellow-400' : 'text-[var(--muted)]'}`}>{dirty ? '● 未保存' : '✓ 已保存'}</span>
              {onImportToStoryboard && (
                <button className="text-xs px-2 py-1 bg-gold-600/20 hover:bg-gold-600/30 text-[#7A8B5A] rounded border border-gold-600/20"
                  onClick={() => onImportToStoryboard(selected)}>→ 导入分镜</button>
              )}
            </div>
            <textarea className="flex-1 bg-[var(--bg)] text-sm text-[var(--text)] outline-none resize-none p-4 font-mono leading-relaxed"
              style={{ fontFamily: 'Consolas, "Courier New", monospace' }}
              placeholder="输入 Markdown 内容..."
              value={editContent} onChange={e => { setEditContent(e.target.value); setDirty(true); }} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--muted)]">
            选择左侧文稿开始编辑
          </div>
        )}
      </div>

      {/* New dialog */}
      {showNew && (
        <InlinePrompt
          title={showNew==='folder'?'新建文件夹名称':'新建文稿名称'}
          onConfirm={name => handleCreate(showNew==='folder'?'folder':'document', selectedId)}
          onCancel={() => setShowNew(null)} />
      )}
    </div>
  );
}
