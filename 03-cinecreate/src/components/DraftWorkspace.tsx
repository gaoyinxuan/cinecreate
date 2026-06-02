/**
 * DraftWorkspace — 5-phase AI video creation workflow.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/dbService';
import { setApiKey as setServiceKey, getApiKey } from '../services/aiService';
import InlinePrompt from './InlinePrompt';
import OnboardingGuide, { useOnboarding } from './OnboardingGuide';

const api = (window as any).electronAPI;
const DS = 'https://api.deepseek.com/v1/chat/completions';

interface Message { role: 'user'|'assistant'; content: string; timestamp: string; }

const PHASES = ['故事大纲','角色设定','分镜规划','镜头制作'];
const ASSET_KEYS = ['story','characters','storyboard','shots'];

const SYSTEM_PROMPTS: Record<number,string> = {
  1: `你是AI导演/编剧。当前阶段：故事大纲。

【输出格式要求 - 非常重要】
用自然文稿形式输出，像导演写给制片人的创意提案。要有标题、分段、画面感。
不要输出JSON。不要输出代码块。不要用字段堆叠格式。

输出结构：
## 故事名称
（一句话概括类型和基调）
## 剧情简介
（200字以内的引人入胜的概要）
## 世界观设定
（时代、地点、科技水平、社会背景）
## 故事结构
### 第一幕 · 开端
（完整段落，有画面感）
### 第二幕 · 发展
（完整段落，有画面感）
### 第三幕 · 结局
（完整段落，有画面感）
## 视觉风格建议
（摄影风格、色调、节奏感）

最后用 <json>{"title":"...","logline":"...","worldBuilding":"...","structure":"第一幕:...\\n第二幕:...\\n第三幕:...","visualStyle":"..."}</json> 标记结构数据。`,
  2: `你是AI角色设计师。当前阶段：角色定妆。

【输出格式 - 非常重要】
用人物小传形式输出。每个角色独立成章。不要JSON。不要代码块。

格式：
## 角色
### 主角：[姓名]
**定位**：（一句话）
**外貌**：（自然描述）
**服装**：（自然描述）
**性格**：（自然描述）
**背景故事**：（简短的背景）
**角色定妆Prompt·中文**
（完整中文Prompt）
**角色定妆Prompt·English**
（完整英文Prompt）

### 配角：[姓名]
（同上结构）

最后用 <json>[{"name":"...","role":"主角|配角|反派","appearance":"...","costume":"...","personality":"...","background":"...","promptCN":"...","promptEN":"..."}]</json> 标记数据。`,
  3: `你是AI分镜导演。当前阶段：分镜规划——只负责整体设计，不生成画面描述和Prompt。
输出内容：总时长、镜头数量、情绪曲线、剧情节奏。每个镜头仅输出：编号、名称、作用、景别、建议时长、转场方式。
禁止输出画面描述、角色细节、环境细节、光影描述、任何Prompt。
最后用<json>[{"scene":1,"name":"...","purpose":"...","shotType":"远景|中景|特写...","duration":"...","transition":"..."}]</json>标记。`,
  4: `你是AI镜头制作设计师。当前阶段：镜头制作——基于前面完成的故事、角色、分镜规划，为每个镜头生成完整的画面描述、生图Prompt和动态Prompt。
每个镜头独立输出：画面描述、生图中文Prompt、生图英文Prompt、动态中文Prompt、动态英文Prompt、运镜说明。
最后用<json>[{"scene":1,"description":"...","imagePromptCN":"...","imagePromptEN":"...","motionPromptCN":"...","motionPromptEN":"...","motionDesc":"..."}]</json>标记。`
};

export default function DraftWorkspace({ projectId, draftId, onDraftCreated }: { projectId: string; draftId?: string|null; onDraftCreated?: (id:string)=>void }) {
  const [draft, setDraft] = useState<any>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<any>(null);
  const [pendingMsgIdx, setPendingMsgIdx] = useState<number | null>(null);
  const [savedMsgIdx, setSavedMsgIdx] = useState<number | null>(null);
  const [pendingOriginal, setPendingOriginal] = useState<any>(null);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keySet, setKeySet] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<any>(null);
  const [showOnboard, dismissOnboard] = useOnboarding('onboard-first-project');

  useEffect(() => {
    if (api) api.getApiKey().then((k:string)=>{ if(k){ setServiceKey(k); setKeySet(true); } });
  }, []);

  // Load draft
  useEffect(() => {
    (async () => {
      if (!projectId) return;
      if (draftId) {
        const all = await db.dts.getAll(projectId);
        const d = all.find((x:any)=>x.id===draftId);
        if (d) { setDraft(d); const conv = p(d.conversation); setMsgs(conv.length ? conv : [a('你好！我是AI导演助手 👋\n\n让我们从故事大纲开始。请告诉我：\n1. 你想做什么类型的故事？\n2. 主角是什么样的人？\n3. 希望什么视觉风格？\n4. 大概时长？\n5. 有没有参考作品？')]); return; }
      }
      const all = await db.dts.getAll(projectId);
      if (all.length) {
        setDraft(all[0]); setMsgs(p(all[0].conversation));
        if (onDraftCreated) onDraftCreated(all[0].id);
      } else {
        const d = await db.dts.create({ projectId, name:'草稿V1', currentStep:1, confirmedAssets:{}, conversation:[] });
        setDraft(d); setMsgs([]);
        if (onDraftCreated) onDraftCreated(d.id);
        // AI initiates
        setMsgs([a('你好！我是AI导演助手 👋\n\n让我们从故事大纲开始。请告诉我：\n1. 你想做什么类型的故事？（科幻/奇幻/悬疑/现实/...）\n2. 主角是什么样的人？\n3. 希望什么视觉风格？\n4. 大概时长？\n5. 有没有参考作品？')]);
      }
    })();
  }, [projectId, draftId]);

  useEffect(() => { chatEnd.current?.scrollIntoView({behavior:'smooth'}); }, [msgs]);

  const p = (s:any) => typeof s==='string' ? JSON.parse(s||'[]') : (s||[]);
  function a(text:string): Message { return { role:'assistant', content: text, timestamp: new Date().toISOString() }; }

  // Auto-save
  const save = useCallback(async (messages: Message[]) => {
    if (!draft?.id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => db.dts.update(draft.id, { conversation: messages }).catch(()=>{}), 500);
  }, [draft]);

  const addMsg = (role:'user'|'assistant', text:string) => {
    setMsgs(prev => { const next = [...prev, {role,content:text,timestamp:new Date().toISOString()}]; save(next); return next; });
  };

  // Send
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const key = getApiKey();
    if (!key) { setShowKey(true); return; }
    const userText = input.trim(); setInput(''); addMsg('user', userText); setLoading(true);
    try {
      const step = draft?.currentStep || 1;
      const assets = typeof draft?.confirmedAssets==='string' ? JSON.parse(draft.confirmedAssets||'{}') : (draft?.confirmedAssets||{});
      const ctx = step > 1 ? `已确认的故事: ${JSON.stringify(assets.story||{}).slice(0,500)}。已确认的角色: ${JSON.stringify(assets.characters||[]).slice(0,500)}。` : '';
      const res = await fetch(DS, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
        body: JSON.stringify({ model:'deepseek-chat', messages: [
          { role:'system', content: SYSTEM_PROMPTS[step]+'\n'+ctx },
          ...msgs.slice(-8).map(m=>({role:m.role,content:m.content})),
          { role:'user', content: userText }
        ], temperature:0.8, max_tokens: 4096 })
      });
      const data = await res.json();
      const aiText = data.choices?.[0]?.message?.content || '';
      addMsg('assistant', aiText);
      // Try to parse JSON for pending asset
      try {
        const m = aiText.match(/```json\s*([\s\S]*?)```/) || [null, aiText];
        const parsed = JSON.parse(m[1]?.trim() || aiText);
        if (parsed && (parsed.title || Array.isArray(parsed))) setPendingAsset(parsed);
      } catch {}
    } catch(e:any) { addMsg('assistant', '❌ 网络错误: '+(e.message||'请检查API Key和网络连接')); }
    finally { setLoading(false); }
  };

  // Confirm asset
  const confirmAsset = async () => {
    if (!pendingAsset || !draft?.id) return;
    const assets = typeof draft.confirmedAssets==='string' ? JSON.parse(draft.confirmedAssets||'{}') : (draft.confirmedAssets||{});
    // For step 4 (镜头制作): merge into 'shots' array by matching scene number
    if (step === 4 && Array.isArray(pendingAsset)) {
      const existing = Array.isArray(assets.shots) ? [...assets.shots] : [];
      for (const item of pendingAsset) {
        const idx = existing.findIndex((e:any) => e.scene === item.scene);
        if (idx >= 0) existing[idx] = { ...existing[idx], ...item };
        else existing.push(item);
      }
      assets.shots = existing;
    } else if (step <= 2) {
      const key = ASSET_KEYS[step-1];
      assets[key] = pendingAsset;
    }
    const nextStep = step + 1;
    const updated = { ...draft, currentStep: nextStep, confirmedAssets: assets };
    setDraft(updated);
    await db.dts.update(draft.id, { currentStep: nextStep, confirmedAssets: assets }).catch(()=>{});
    setSavedMsgIdx(pendingMsgIdx); setPendingAsset(null); setPendingMsgIdx(null); setPendingOriginal(null); setHasUnsaved(false);
    addMsg('assistant', '✅ 已确认并保存到资产库。');
    if (nextStep <= 4) {
      const nextGuide: Record<number,string> = {
        2: '下一步：基于故事设定角色。告诉我主角的外貌、性格、风格偏好。',
        3: '下一步：规划分镜。告诉我镜头数量、节奏偏好、景别风格。',
        4: '下一步：为每个镜头生成完整Prompt。我会逐镜头生成，包含生图Prompt和动态Prompt。'
      };
      addMsg('assistant', nextGuide[nextStep] || '');
    }
    if (nextStep === 4) addMsg('assistant', '现在进入最终阶段：镜头制作。请确认后我开始逐镜头生成。');
    if (nextStep > 4) addMsg('assistant', '🎉 全部4个阶段已完成！所有Prompt资产已可在右侧查看和复制。');
  };

  const rejectAsset = () => { setPendingAsset(null); setPendingMsgIdx(null); setPendingOriginal(null); addMsg('assistant', '好的，请告诉我需要调整什么？'); };

  // Exit protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (hasUnsaved || pendingAsset) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved, pendingAsset]);

  // Simplified chatAboutAsset
  const chatAboutAsset = (key: string) => {
    const data = assets[key];
    if (!data) {
      setInput(`请帮我生成${PHASES[ASSET_KEYS.indexOf(key)]}的内容。请描述你的需求：`);
      const ta = document.querySelector('.chat-input-area textarea') as HTMLTextAreaElement;
      if (ta) { ta.style.height = '100px'; ta.focus(); }
      return;
    }
    addMsg('user', `请帮我优化${PHASES[ASSET_KEYS.indexOf(key)]}的内容：\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\``);
  };

  const assets = draft && typeof draft.confirmedAssets==='string' ? JSON.parse(draft.confirmedAssets||'{}') : (draft?.confirmedAssets||{});
  const step = draft?.currentStep || 1;

  // Bilingual prompt helpers
  const getPromptCN = (item: any): string => {
    if (!item) return ''; if (typeof item==='string') return item;
    return item.promptCN || item.portraitPromptCN || item.prompt || item.portraitPrompt || '';
  };
  const getPromptEN = (item: any): string => {
    if (!item) return '';
    return item.promptEN || item.portraitPromptEN || '';
  };
  const copyToClipboard = (text: string) => { navigator.clipboard?.writeText(text).catch(()=>{}); };

  // [优化] button: fill input with prompt context
  const optimizePrompt = (item: any, label?: string) => {
    if (!item || Object.keys(item).length === 0) {
      setInput(`请帮我生成${label||'新的'}内容。请描述你的需求：`);
      setPendingOriginal(null);
    } else {
      const cn = getPromptCN(item); const en = getPromptEN(item);
      setPendingOriginal(item); // track "before" for diff
      const text = cn ? `当前Prompt(中文)：\n${cn}\n\n${en ? `当前Prompt(英文)：\n${en}\n\n` : ''}请基于以上Prompt进行修改：` : `请帮我优化这个Prompt`;
      setInput(text);
    }
    const ta = document.querySelector('.chat-input-area textarea') as HTMLTextAreaElement;
    if (ta) ta.style.height = '120px';
    setHasUnsaved(true);
  };

  // Edit handler — targets specific array item via key-index
  const startEditAsset = (key: string, item?: any, idx?: number) => {
    const data = item ?? assets[key];
    setEditingAsset(key + (idx!==undefined ? `-${idx}` : ''));
    setEditText(JSON.stringify(data, null, 2));
  };
  const saveAsset = async () => {
    if (!editingAsset || !draft?.id) return;
    try {
      const parsed = JSON.parse(editText);
      const [key, idxStr] = editingAsset.split('-'); const idx = idxStr ? parseInt(idxStr) : undefined;
      let updated: any;
      if (idx !== undefined && Array.isArray(assets[key])) { const arr = [...assets[key]]; arr[idx]=parsed; updated={...assets, [key]:arr}; }
      else { updated = {...assets, [key]:parsed}; }
      setDraft({...draft, confirmedAssets:updated});
      await db.dts.update(draft.id,{confirmedAssets:updated}).catch(()=>{});
      setEditingAsset(null);
    } catch {}
  };

  const assetList = [
    { key:'story', label:'故事大纲', data: assets.story, hint:'标题、世界观、剧情结构', isArray:false },
    { key:'characters', label:'角色设定', data: assets.characters, hint:'角色列表与定妆Prompt', isArray:true },
    { key:'storyboard', label:'分镜规划', data: assets.storyboard, hint:'镜头数量、顺序、节奏、景别', isArray:true },
    { key:'shots', label:'镜头制作', data: assets.shots, hint:'每个镜头的生图Prompt与动态Prompt', isArray:true },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex items-center gap-3 px-6 py-2.5">
        <span className="text-base font-bold text-[var(--text)]">{draft?.name||'草稿'}</span>
        {!keySet && <button className="text-xs px-2 py-1 text-[var(--muted)] hover:text-[var(--text2)] rounded border border-[#333]" onClick={()=>setShowKey(true)}>🔑 API Key</button>}
        <div className="flex-1" />
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {msgs.map((m, i) => {
              let display = m.content;
              let jsonData: any = null;
              if (m.role === 'assistant') {
                // Extract <json>...</json> block for structured parsing
                const jm = display.match(/<json>([\s\S]*?)<\/json>/);
                if (jm) { try { jsonData = JSON.parse(jm[1].trim()); } catch {}; display = display.replace(/<json>[\s\S]*?<\/json>/g, '').trim(); }
                // Also try ```json code blocks as fallback
                if (!jsonData) {
                  const cm = display.match(/```json\s*([\s\S]*?)```/);
                  if (cm) { try { jsonData = JSON.parse(cm[1].trim()); } catch {}; display = display.replace(/```json[\s\S]*?```/g, '').trim(); }
                }
                // Auto-set pendingAsset only if JSON matches expected asset format for current step
                if (jsonData && !pendingAsset && !loading) {
                  const isValidAsset = (step: number, data: any): boolean => {
                    if (!data) return false;
                    if (step === 1) return !!(data.title && data.logline);
                    if (step === 2) return Array.isArray(data) && data.length>0 && !!data[0].name && !!data[0].appearance;
                    if (step === 3) return Array.isArray(data) && data.length>0 && data[0].scene !== undefined && !!data[0].purpose;
                    if (step === 4) return Array.isArray(data) && data.length>0 && !!(data[0].imagePromptCN || data[0].promptCN);
                    return false;
                  };
                  if (isValidAsset(step, jsonData)) { setPendingAsset(jsonData); setPendingMsgIdx(i); setHasUnsaved(true); }
                }
              }
              // Simple markdown rendering
              const renderMd = (text: string) => {
                return text
                  .replace(/^### (.+)$/gm, '<div class="text-sm text-[var(--text)] font-semibold mt-3 mb-1">$1</div>')
                  .replace(/^## (.+)$/gm, '<div class="text-base text-[var(--text)] font-bold mt-4 mb-2 border-b border-[var(--border2)] pb-1">$1</div>')
                  .replace(/^# (.+)$/gm, '<div class="text-lg text-[var(--text)] font-bold mt-4 mb-2">$1</div>')
                  .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--text)]">$1</strong>')
                  .replace(/\n\n/g, '<br/><br/>')
                  .replace(/^---$/gm, '<hr class="border-[var(--border2)] my-3"/>')
                  .replace(/^- (.+)$/gm, '<div class="ml-2 text-[var(--text2)]">• $1</div>');
              };
              return (
              <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${m.role==='user'?'bg-indigo-500/15 text-[var(--text)]':'bg-[var(--card)] text-[var(--text)] border border-[var(--border2)]'}`}>
                  <div dangerouslySetInnerHTML={{__html: renderMd(display)}} />
                  {/* Confirm buttons — only on this specific message, not during loading */}
                  {!loading && pendingAsset && i === pendingMsgIdx && (
                    <div className="mt-3 pt-3 border-t border-[var(--border2)] space-y-2">
                      <div className="flex justify-center gap-3">
                        <button className="px-4 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-semibold rounded-lg border border-green-500/20" onClick={confirmAsset}>✓ 确认保存</button>
                        <button className="px-4 py-1.5 bg-[#333] hover:bg-[#444] text-[var(--text3)] text-xs rounded-lg" onClick={rejectAsset}>{pendingOriginal ? '保留原版本' : '修改'}</button>
                      </div>
                    </div>
                  )}
                  {i === savedMsgIdx && (
                    <div className="mt-2 text-center text-xs text-green-500/60">✓ 已保存到资产库</div>
                  )}
                </div>
              </div>
            )})}
            {loading && <div className="text-center text-xs text-[var(--muted)] animate-pulse">AI 思考中...</div>}
            <div ref={chatEnd} />
          </div>
          <div className="p-3 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <textarea className="chat-input-area flex-1 bg-[var(--card2)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-indigo-500 resize-none"
                style={{height: input.length > 100 ? '120px' : '48px', transition: 'height 0.2s'}}
                placeholder="输入回复..." value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleSend(); }}} />
              <button className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold ${loading?'bg-[#333] text-[var(--dim)]':'bg-indigo-500 hover:bg-indigo-400 text-white'}`}
                disabled={loading} onClick={handleSend}>发送</button>
            </div>
          </div>
        </div>

        {/* Right: Asset Library */}
        <div className="w-[38%] min-w-[280px] shrink-0 border-l border-[var(--border)] overflow-y-auto p-3 space-y-2 bg-[var(--surface)]">
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs text-[var(--dim)] font-semibold uppercase">资产库</span>
            <div className="flex-1" />
            <div className="flex gap-0.5">
              {[1,2,3,4].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < step ? 'bg-green-500/60' : i === step ? 'bg-indigo-500' : 'bg-[#333]'}`} />
              ))}
            </div>
          </div>
          {assetList.map((item, ai) => {
            const isActive = (ai+1) === step;
            const hasData = !!item.data;
            const isExpanded = expandedAsset === item.key;
            const isEditing = editingAsset?.startsWith(item.key);
            const arr = item.isArray && Array.isArray(item.data) ? item.data : (item.data ? [item.data] : []);
            return (
            <div key={item.key} className={`bg-[var(--card2)] border rounded-lg overflow-hidden transition-colors ${isActive ? 'ring-1 ring-indigo-500/40 border-indigo-500/30' : 'border-[var(--border)]'}`}>
              <div className="flex items-center gap-1.5 p-3 cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpandedAsset(isExpanded ? null : item.key)}>
                <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                <span className={`text-xs flex-1 ${isActive ? 'text-[var(--text)] font-semibold' : 'text-[var(--text3)]'}`}>{item.label}</span>
                {hasData && <span className="text-xs text-green-500/70">✓</span>}
                {isActive && <span className="text-xs text-indigo-400/60">当前</span>}
                <span className="text-xs text-[var(--muted)]">{arr.length ? arr.length+'项' : ''}</span>
              </div>
              {isExpanded && (
                <div className="border-t border-[var(--border)] p-3 space-y-3">
                  {isEditing ? (
                    <>
                      <textarea className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2 text-xs text-[var(--text2)] font-mono outline-none focus:border-indigo-500 resize-none" rows={8} value={editText} onChange={e=>setEditText(e.target.value)} />
                      <div className="flex gap-2"><button className="flex-1 text-xs px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded" onClick={saveAsset}>保存</button><button className="text-xs px-2 py-1 text-[var(--muted)] hover:text-[var(--text2)] rounded" onClick={()=>setEditingAsset(null)}>取消</button></div>
                    </>
                  ) : arr.length > 0 ? (
                    <>
                      {arr.map((d:any, di:number) => {
                        // Shots have imagePrompt + motionPrompt sub-sections
                        const isShot = item.key === 'shots';
                        const isPlan = item.key === 'storyboard';
                        const isChar = item.key === 'characters';
                        const cn = isShot ? (d.imagePromptCN || '') : (getPromptCN(d));
                        const en = isShot ? (d.imagePromptEN || '') : (getPromptEN(d));
                        const motionCN = isShot ? (d.motionPromptCN || '') : '';
                        const motionEN = isShot ? (d.motionPromptEN || '') : '';
                        return (
                          <div key={di} className="space-y-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[var(--text2)] font-medium">{d.name || (d.scene ? `镜头${d.scene}` : `${item.label} #${di+1}`)}</span>
                              {d.role && <span className={`text-xs px-1.5 py-0.5 rounded ${d.role==='主角'?'bg-yellow-500/20 text-yellow-400':d.role==='反派'?'bg-red-500/20 text-red-400':'bg-[#333] text-[var(--text3)]'}`}>{d.role}</span>}
                              {isShot && d.duration && <span className="text-xs text-[var(--muted)]">{d.duration}</span>}
                            </div>
                            {isShot && d.description && <p className="text-xs text-[var(--text3)]">{d.description?.slice(0,100)}</p>}
                            {isChar && d.appearance && <p className="text-xs text-[var(--text3)]">{d.appearance?.slice(0,80)}</p>}
                            {isPlan && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                                {d.purpose && <span className="text-[var(--text3)]">作用: <span className="text-[var(--text2)]">{d.purpose}</span></span>}
                                {d.shotType && <span className="text-[var(--text3)]">景别: <span className="text-[var(--text2)]">{d.shotType}</span></span>}
                                {d.duration && <span className="text-[var(--text3)]">时长: <span className="text-[var(--text2)]">{d.duration}</span></span>}
                                {d.transition && <span className="text-[var(--text3)]">转场: <span className="text-[var(--text2)]">{d.transition}</span></span>}
                              </div>
                            )}
                            {/* Image prompt section */}
                            {cn && (
                              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2">
                                <div className="text-[9px] text-[var(--muted)] mb-1">{isShot ? '🖼️ 生图Prompt' : 'Prompt'}</div>
                                <p className="text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap">{cn}</p>
                                {en && <p className="text-xs text-[var(--text2)] leading-relaxed mt-1.5 pt-1.5 border-t border-[var(--border)]">{en}</p>}
                                <div className="flex gap-1 mt-1.5">
                                  <button className="text-[9px] px-1.5 py-0.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded" onClick={(e)=>{e.stopPropagation();copyToClipboard(cn);}}>复中</button>
                                  {en && <button className="text-[9px] px-1.5 py-0.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded" onClick={(e)=>{e.stopPropagation();copyToClipboard(en);}}>复英</button>}
                                </div>
                              </div>
                            )}
                            {/* Motion prompt section */}
                            {motionCN && (
                              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2">
                                <div className="text-[9px] text-[var(--muted)] mb-1">🎥 动态Prompt</div>
                                <p className="text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap">{motionCN}</p>
                                {motionEN && <p className="text-xs text-[var(--text2)] leading-relaxed mt-1.5 pt-1.5 border-t border-[var(--border)]">{motionEN}</p>}
                                <div className="flex gap-1 mt-1.5">
                                  <button className="text-[9px] px-1.5 py-0.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded" onClick={(e)=>{e.stopPropagation();copyToClipboard(motionCN);}}>复中</button>
                                  {motionEN && <button className="text-[9px] px-1.5 py-0.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded" onClick={(e)=>{e.stopPropagation();copyToClipboard(motionEN);}}>复英</button>}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <button className="text-xs px-2 py-1 bg-[var(--card)] hover:bg-[#2a2b48] text-[var(--text3)] hover:text-[var(--text)] rounded" onClick={(e)=>{e.stopPropagation();startEditAsset(item.key,d,di);}}>✎ 编辑</button>
                              <button className="text-xs px-2 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 text-[var(--text)] rounded" onClick={(e)=>{e.stopPropagation();optimizePrompt(d,item.label);}}>🔧 优化</button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-[var(--muted)]">暂无内容 · {item.hint}</p>
                      <div className="flex gap-2">
                        <button className="text-xs px-2 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 text-[var(--text)] rounded" onClick={() => { chatAboutAsset(item.key); }}>💬 AI 生成</button>
                        <button className="text-xs px-2 py-1 bg-[var(--card)] hover:bg-[#2a2b48] text-[var(--text3)] hover:text-[var(--text)] rounded" onClick={() => startEditAsset(item.key)}>✎ 手动创建</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )})}
        </div>
      </div>
      {showKey && <InlinePrompt title="DeepSeek API Key" onConfirm={k=>{ setServiceKey(k); if(api)api.setApiKey(k); setShowKey(false); setKeySet(true); }} onCancel={()=>setShowKey(false)} />}
      {/* Onboarding */}
      {showOnboard && (
        <OnboardingGuide title="欢迎使用 AI 导演" storageKey="onboard-drafts" onClose={dismissOnboard}
          buttons={[{label:'前往配置 API',primary:true,onClick:()=>{dismissOnboard();setShowKey(true);}},{label:'稍后配置',onClick:dismissOnboard}]}>
          <p>文稿模块用于故事大纲创作、角色设定设计、分镜规划设计、镜头 Prompt 生成。</p>
          <p>开始使用前，请先配置 AI 模型 API（支持 DeepSeek、OpenAI、Gemini 及兼容 OpenAI 格式的模型服务）。</p>
        </OnboardingGuide>
      )}
      {/* API warning banner */}
      {!keySet && !showOnboard && (
        <div className="absolute top-12 left-0 right-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-1.5 text-xs text-yellow-400/80 pointer-events-auto cursor-pointer"
            onClick={()=>setShowKey(true)}>⚠ 尚未配置 AI 模型 API，AI 导演功能暂不可用 — 点击配置</div>
        </div>
      )}
    </div>
  );
}
