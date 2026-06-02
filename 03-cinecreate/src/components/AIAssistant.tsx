/**
 * AI Assistant — inline panel inside Documents Center.
 * Generates content based on selected document context.
 */
import React, { useState, useCallback } from 'react';
import { generateStory, generateCharacters, setApiKey as setServiceKey, getApiKey } from '../services/aiService';
import { db } from '../services/dbService';
import { useToast } from './ToastProvider';
import InlinePrompt from './InlinePrompt';

const api = (window as any).electronAPI;

interface Props { projectId: string; contextDoc?: { id:string; title:string; content:string } | null; onDocCreated: () => void; }

export default function AIAssistant({ projectId, contextDoc, onDocCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const toast = useToast();

  React.useEffect(() => { if (api) api.getApiKey().then((k:string) => { if(k) setServiceKey(k); }); }, []);

  const ensureKey = () => { if (getApiKey()) return true; setShowKey(true); return false; };
  const handleSetKey = async (key:string) => { setServiceKey(key); if(api) await api.setApiKey(key); setShowKey(false); toast('API Key 已保存'); };

  const runAgent = useCallback(async (agent: string, prompt: string) => {
    if (!ensureKey()) return;
    setError(''); setLoading(true);
    try {
      let result: any;
      if (agent === 'story') result = await generateStory(prompt);
      else if (agent === 'characters') result = await generateCharacters(JSON.parse(contextDoc?.content || '{}'));
      // Create a new document for the result
      const title = agent === 'story' ? (result.title || '故事大纲') : '角色设定';
      const content = agent === 'story' ? JSON.stringify(result, null, 2) : (Array.isArray(result) ? result.map((c:any) => `## ${c.name} (${c.role})\n- 年龄: ${c.age}\n- 外貌: ${c.appearance}\n- 服装: ${c.costume}\n- 性格: ${c.personality}\n- 背景: ${c.background}\n- 定妆照 Prompt: ${c.portraitPrompt}\n`).join('\n\n') : JSON.stringify(result, null, 2));
      await db.docs.create({ projectId, parentId: null, type: 'document', title, content, metadata: { generatedBy: agent, contextDocId: contextDoc?.id } });
      toast(`已生成: ${title}`);
      onDocCreated();
    } catch(e: any) { setError(e.message || '生成失败'); }
    finally { setLoading(false); }
  }, [projectId, contextDoc, onDocCreated, toast, ensureKey]);

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--dim)] font-semibold uppercase">🤖 AI 助手</span>
        {contextDoc && <span className="text-xs text-[var(--muted)] truncate">上下文: {contextDoc.title}</span>}
      </div>
      <textarea className="w-full bg-[var(--card2)] border border-[var(--border2)] rounded-lg p-2 text-xs text-[var(--text)] outline-none focus:border-indigo-500 resize-none h-16"
        placeholder="输入创意描述，或基于选中文稿生成..."
        id="aiPrompt" />
      <div className="flex flex-wrap gap-1.5">
        <button className="text-xs px-2.5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-[var(--text)] rounded-lg border border-indigo-500/20 disabled:opacity-40"
          disabled={loading} onClick={() => { const inp = (document.getElementById('aiPrompt') as HTMLTextAreaElement)?.value; if(inp.trim()) runAgent('story', inp.trim()); else setError('请输入创意描述'); }}>
          {loading ? '⏳' : '📖'} 生成故事
        </button>
        <button className="text-xs px-2.5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-[var(--text)] rounded-lg border border-indigo-500/20 disabled:opacity-40"
          disabled={loading || !contextDoc} onClick={() => runAgent('characters', '')}>
          {loading ? '⏳' : '👤'} 生成角色
        </button>
        <button className="text-xs px-2.5 py-1.5 text-[var(--muted)] hover:text-[var(--text2)] rounded-lg" onClick={() => setShowKey(true)}>🔑 Key</button>
      </div>
      {error && <div className="text-xs text-red-400 p-1.5 bg-red-500/10 rounded">{error}</div>}
      {showKey && <InlinePrompt title="DeepSeek API Key" onConfirm={handleSetKey} onCancel={() => setShowKey(false)} />}
    </div>
  );
}
