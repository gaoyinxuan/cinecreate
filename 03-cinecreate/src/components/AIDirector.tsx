/**
 * AI Director Panel — multi-step agent workflow.
 * Step ①: Input creative → Step ②: Generate Story → Step ③: Generate Characters → Import to project.
 */
import React, { useState, useCallback } from 'react';
import { generateStory, generateCharacters, setApiKey as setServiceKey, getApiKey } from '../services/aiService';
import { db } from '../services/dbService';
import { useToast } from './ToastProvider';
import InlinePrompt from './InlinePrompt';

const api = (window as any).electronAPI;

export default function AIDirector({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [step, setStep] = useState(1); // 1=input, 2=story done, 3=characters done
  const [creative, setCreative] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [story, setStory] = useState<any>(null);
  const [storyEditable, setStoryEditable] = useState('');
  const [characters, setCharacters] = useState<any[]>([]);
  const [charsEditable, setCharsEditable] = useState('');
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const toast = useToast();

  // Load API key on mount
  React.useEffect(() => {
    if (api) {
      api.getApiKey().then((k: string) => { if (k) setServiceKey(k); });
    }
  }, []);

  const ensureKey = useCallback(() => {
    if (getApiKey()) return true;
    setShowKeyPrompt(true);
    return false;
  }, []);

  const handleSetKey = useCallback(async (key: string) => {
    setServiceKey(key);
    if (api) await api.setApiKey(key);
    setShowKeyPrompt(false);
    toast('API Key 已保存');
  }, [toast]);

  // ── Generate Story ──
  const handleGenerateStory = async () => {
    if (!creative.trim()) { setError('请输入创意描述'); return; }
    if (!(await ensureKey())) return;
    setError(''); setLoading(true);
    try {
      const result = await generateStory(creative.trim());
      setStory(result);
      setStoryEditable(JSON.stringify(result, null, 2));
      setStep(2);
    } catch (e: any) { setError(e.message || '生成失败'); }
    finally { setLoading(false); }
  };

  // ── Generate Characters ──
  const handleGenerateChars = async () => {
    if (!story) return;
    if (!(await ensureKey())) return;
    setError(''); setLoading(true);
    try {
      // Use edited story if changed
      let storyData = story;
      try { const parsed = JSON.parse(storyEditable); if (parsed && parsed.title) storyData = parsed; } catch {}
      const chars = await generateCharacters(storyData);
      setCharacters(Array.isArray(chars) ? chars : []);
      setCharsEditable(JSON.stringify(chars, null, 2));
      setStep(3);
    } catch (e: any) { setError(e.message || '生成失败'); }
    finally { setLoading(false); }
  };

  // ── Import to Project ──
  const handleImport = async () => {
    if (!story) return;
    // Use edited versions
    let storyData = story;
    let charsData = characters;
    try { const p = JSON.parse(storyEditable); if (p?.title) storyData = p; } catch {}
    try { const p = JSON.parse(charsEditable); if (Array.isArray(p)) charsData = p; } catch {}

    const storyId = (storyData.id as string) || (crypto.randomUUID?.() ?? Date.now().toString());
    await db.ai.stories.create({
      id: storyId, projectId,
      title: storyData.title || '未命名故事',
      logline: storyData.logline || '',
      fullContent: storyData,
      status: 'completed'
    });
    for (const c of charsData) {
      if (c.name) {
        await db.ai.characters.create({
          storyId, projectId,
          name: c.name, age: c.age || '', role: c.role || '配角',
          appearance: c.appearance || '', costume: c.costume || '',
          personality: c.personality || '', background: c.background || '',
          portraitPrompt: c.portraitPrompt || ''
        });
      }
    }
    toast(`已导入: ${storyData.title} + ${charsData.length} 个角色`);
    onClose();
  };

  const steps = ['创意', '故事', '角色'];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 bg-[var(--bg2)] border-b border-[var(--border)]">
        <span className="text-base font-bold text-[var(--text)]">🤖 AI 导演</span>
        <div className="flex items-center gap-1 ml-4">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-[var(--dim)] text-xs">→</span>}
              <span className={`text-xs px-2 py-1 rounded-full ${step > i+1 ? 'bg-green-500/20 text-green-400' : step === i+1 ? 'bg-indigo-500/20 text-[var(--text)]' : 'bg-[var(--card)] text-[var(--muted)]'}`}>
                {step > i+1 ? '✓' : ''} {s}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div className="flex-1" />
        <button className="text-[var(--muted)] hover:text-[var(--text2)] text-sm" onClick={onClose}>✕ 关闭</button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Input */}
        <div className="w-80 shrink-0 border-r border-[var(--border)] p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="text-xs text-[var(--dim)] font-semibold uppercase">创意输入</div>
          <textarea className="flex-1 bg-[var(--card2)] border border-[var(--border2)] rounded-lg p-3 text-sm text-[var(--text)] outline-none focus:border-indigo-500 resize-none min-h-[120px]"
            placeholder="输入你的创意描述...&#10;&#10;例如：一个老年物理学家发现宇宙即将毁灭，驾驶飞船寻找人类最后的希望。"
            value={creative} onChange={e => setCreative(e.target.value)} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">风格:</span>
            <select className="bg-[var(--card2)] border border-[var(--border2)] rounded px-2 py-1 text-xs text-[var(--text)] outline-none"
              value={style} onChange={e => setStyle(e.target.value)}>
              <option value="cinematic">影视级</option>
              <option value="anime">动漫</option>
              <option value="realistic">写实</option>
              <option value="scifi">科幻</option>
            </select>
          </div>
          <button className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${loading ? 'bg-[var(--card2)] text-[var(--muted)] border border-[var(--border2)] cursor-wait' : 'bg-indigo-500 hover:bg-indigo-400 text-white'}`}
            disabled={loading} onClick={handleGenerateStory}>
            {loading ? '生成中...' : '① 生成故事'}
          </button>
          {story && (
            <button className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${loading ? 'bg-[var(--card2)] text-[var(--muted)] border border-[var(--border2)] cursor-wait' : 'bg-indigo-500/50 hover:bg-indigo-400/50 text-[var(--text)] border border-indigo-500/30'}`}
              disabled={loading} onClick={handleGenerateChars}>
              {loading ? '生成中...' : '② 生成角色'}
            </button>
          )}
          {error && <div className="text-xs text-red-400 p-2 bg-red-500/10 rounded-lg">{error}</div>}
        </div>

        {/* Right: Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-4 py-2 bg-[var(--bg)] border-b border-[var(--border)]">
            {['故事', '角色'].map(tab => (
              <button key={tab} className={`text-xs px-3 py-1 rounded-lg ${(tab === '故事' && story) || (tab === '角色' && characters.length) ? 'text-[var(--text2)]' : 'text-[var(--muted)]'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!story ? (
              <div className="text-center py-16 text-sm text-[var(--muted)]">
                在左侧输入创意并点击生成
              </div>
            ) : (
              <div className="space-y-4">
                {/* Story preview */}
                <div className="bg-[var(--card2)] border border-[var(--border2)] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-[var(--dim)] font-semibold">故事大纲</span>
                    <span className="text-xs text-[var(--muted)]">可编辑 JSON</span>
                  </div>
                  {storyEditable && (
                    <textarea className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--text2)] outline-none focus:border-indigo-500 resize-none font-mono"
                      style={{ minHeight: '300px' }}
                      value={storyEditable} onChange={e => setStoryEditable(e.target.value)} />
                  )}
                </div>
                {/* Character preview */}
                {characters.length > 0 && (
                  <div className="bg-[var(--card2)] border border-[var(--border2)] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-[var(--dim)] font-semibold">角色设计 ({characters.length})</span>
                      <span className="text-xs text-[var(--muted)]">可编辑 JSON</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {characters.map((c: any, i: number) => (
                        <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-[var(--text2)] font-semibold">{c.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${c.role==='主角' ? 'bg-yellow-500/20 text-yellow-600' : c.role==='反派' ? 'bg-red-500/20 text-red-500' : 'bg-[var(--card2)] text-[var(--text3)]'}`}>{c.role}</span>
                          </div>
                          <div className="text-xs text-[var(--text3)] line-clamp-3">{c.appearance}</div>
                        </div>
                      ))}
                    </div>
                    <textarea className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--text2)] outline-none focus:border-indigo-500 resize-none font-mono"
                      style={{ minHeight: '150px' }}
                      value={charsEditable} onChange={e => setCharsEditable(e.target.value)} />
                  </div>
                )}
                {/* Import button */}
                {story && (
                  <button className="w-full py-2.5 rounded-lg text-sm font-semibold bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors"
                    onClick={handleImport}>
                    ✓ 导入到项目
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* API Key prompt */}
      {showKeyPrompt && (
        <InlinePrompt title="输入 DeepSeek API Key" onConfirm={handleSetKey} onCancel={() => setShowKeyPrompt(false)} />
      )}
    </div>
  );
}
