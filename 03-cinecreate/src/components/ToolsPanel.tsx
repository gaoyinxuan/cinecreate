import React, { useState, useEffect, useRef } from 'react';
import OnboardingGuide, { useOnboarding } from './OnboardingGuide';

type ToolCategory = 'image'|'video';
interface Tool { name:string; url:string; cat:ToolCategory; }
interface PageTab { id:string; url:string; title:string; }

const DEF_TOOLS: Tool[] = [
  { name:'GPT Image', url:'https://chatgpt.com/?model=gpt-4o', cat:'image' },
  { name:'Seedream', url:'https://www.doubao.com/chat/create-image', cat:'image' },
  { name:'Nano Banana', url:'https://gemini.google.com/app', cat:'image' },
  { name:'Qwen Image', url:'https://tongyi.aliyun.com/qianwen', cat:'image' },
  { name:'Seedance', url:'https://jimeng.jianying.com/ai-tool/image', cat:'video' },
  { name:'Kling', url:'https://app.klingai.com', cat:'video' },
  { name:'Happy Horse', url:'https://www.happyhorse.cn/creation/generation', cat:'video' },
];

let tid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

interface Props { mode: ToolCategory; }

export default function ToolsPanel({ mode }: Props) {
  const [customTools, setCustomTools] = useState<Tool[]>([]);
  const tools = [...DEF_TOOLS, ...customTools];
  const [activeIdx, setActiveIdx] = useState(0);
  const [errors, setErrors] = useState<Record<string,boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [nm, setNm] = useState(''); const [ur, setUr] = useState('');
  const [showOnboard, dismissOnboard, showGuide] = useOnboarding('onboard-tools');

  // Page tabs per tool — each is a webview
  const [tabsByTool, setTabsByTool] = useState<Record<string,PageTab[]>>({});
  const [activeTabByTool, setActiveTabByTool] = useState<Record<string,string>>({});

  const filtered = tools.filter(t=>t.cat===mode);
  useEffect(() => { if(activeIdx >= filtered.length) setActiveIdx(0); }, [filtered.length]);

  // Ensure every tool has at least its default tab
  useEffect(() => {
    filtered.forEach(t => {
      if (!tabsByTool[t.name]) {
        const init = { id: tid(), url: t.url, title: t.name };
        setTabsByTool(prev => ({...prev, [t.name]: [init]}));
        setActiveTabByTool(prev => ({...prev, [t.name]: init.id}));
      }
    });
  }, [mode]);

  const activeTool = filtered[activeIdx];
  const currentTabs = activeTool ? (tabsByTool[activeTool.name] || []) : [];
  const currentActiveId = activeTool ? (activeTabByTool[activeTool.name] || currentTabs[0]?.id) : '';

  const addTab = (toolName: string) => {
    const tool = tools.find(t => t.name === toolName);
    const url = tool?.url || 'https://www.google.com';
    const tab: PageTab = { id: tid(), url, title: toolName };
    setTabsByTool(prev => ({...prev, [toolName]: [...(prev[toolName]||[]), tab]}));
    setActiveTabByTool(prev => ({...prev, [toolName]: tab.id}));
  };

  const closeTab = (toolName: string, tabId: string) => {
    setTabsByTool(prev => {
      const remaining = (prev[toolName]||[]).filter(t => t.id !== tabId);
      if (remaining.length === 0) return prev;
      return {...prev, [toolName]: remaining};
    });
    setActiveTabByTool(prev => {
      if (prev[toolName] === tabId) {
        const remaining = (tabsByTool[toolName]||[]).filter(t => t.id !== tabId);
        return {...prev, [toolName]: remaining[0]?.id || ''};
      }
      return prev;
    });
  };

  const selectTab = (toolName: string, tabId: string) => {
    setActiveTabByTool(prev => ({...prev, [toolName]: tabId}));
  };

  // IPC listener: main process sends URLs captured from webviews
  const api = (window as any).electronAPI;
  useEffect(() => {
    if (!api || !activeTool) return;
    return api.onToolOpenTab((url: string) => {
      const tab: PageTab = { id: tid(), url, title: '加载中...' };
      setTabsByTool(prev => ({...prev, [activeTool.name]: [...(prev[activeTool.name]||[]), tab]}));
      setActiveTabByTool(prev => ({...prev, [activeTool.name]: tab.id}));
    });
  }, [activeTool?.name]);

  // When webview loads, track URL + title. When user navigates away, create new tab.
  const onPageTitleUpdated = (toolName: string, tabId: string) => (e: any) => {
    updateTabTitle(toolName, tabId, e.title || '新标签页');
  };
  const onWillNavigate = (toolName: string) => (e: any) => {
    console.log('[will-navigate]', e.url);
    e.preventDefault();
    const tab: PageTab = { id: tid(), url: e.url, title: '加载中...' };
    setTabsByTool(prev => ({...prev, [toolName]: [...(prev[toolName]||[]), tab]}));
    setActiveTabByTool(prev => ({...prev, [toolName]: tab.id}));
  };
  const onNewWindow = (toolName: string) => (e: any) => {
    console.log('[new-window]', e.url);
    e.preventDefault();
    if (e.url && e.url !== 'about:blank') {
      const tab: PageTab = { id: tid(), url: e.url, title: '加载中...' };
      setTabsByTool(prev => ({...prev, [toolName]: [...(prev[toolName]||[]), tab]}));
      setActiveTabByTool(prev => ({...prev, [toolName]: tab.id}));
    }
  };
  const onDomReady = () => { console.log('[dom-ready] webview loaded'); };

  const updateTabTitle = (toolName: string, tabId: string, title: string) => {
    setTabsByTool(prev => ({
      ...prev,
      [toolName]: (prev[toolName]||[]).map(t => t.id === tabId ? {...t, title} : t)
    }));
  };

  const addTool = () => { if(!nm.trim()||!ur.trim()) return; setCustomTools(p=>[...p,{name:nm.trim(),url:ur.trim(),cat:mode}]); setShowAdd(false); };
  const deleteTool = (t:Tool) => { setCustomTools(p=>p.filter(x=>x!==t)); if(activeIdx>=filtered.length-1) setActiveIdx(Math.max(0,activeIdx-1)); };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Row 1: Tool tabs */}
      <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex items-center gap-0 px-4 py-2">
        <button className="text-xs w-5 h-5 rounded-full border border-[var(--border2)] text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center shrink-0 mr-2" onClick={showGuide}>?</button>
        {filtered.map((t,i)=>(
          <div key={t.name} className="group flex items-center">
            <button className={`text-xs px-3 py-1 rounded transition-colors ${i===activeIdx?'bg-[var(--accent-solid)]/20 text-[var(--text)] font-semibold':'text-[var(--dim)] hover:text-[var(--text2)]'}`}
              onClick={()=>setActiveIdx(i)}>{t.name}</button>
            {!DEF_TOOLS.some(dt=>dt.name===t.name)&&<button className="text-[8px] text-[var(--muted)] hover:text-red-400 hidden group-hover:block -ml-1" onClick={()=>deleteTool(t)}>✕</button>}
          </div>
        ))}
        <button className="text-xs px-2 py-1 text-[var(--muted)] hover:text-gold-500" onClick={()=>{setNm('');setUr('');setShowAdd(true);}}>＋ 添加</button>
        <div className="flex-1" />
        <button className="text-xs px-2 py-0.5 text-[var(--muted)] hover:text-[var(--text2)] rounded border border-[var(--border2)]"
          onClick={()=>{ setRefreshing(true); const tName = activeTool?.name; if(tName) setErrors(p=>({...p,[tName]:false})); setTimeout(()=>setRefreshing(false),2000); }}
          disabled={refreshing}>{refreshing?'刷新中...':'刷新当前'}</button>
      </div>

      {/* Row 2: Page tabs — Chrome style */}
      {activeTool && (
        <div className="bg-[var(--bg2)] flex items-end px-1 overflow-x-auto shrink-0" style={{minHeight:36}}>
          {currentTabs.map(pt => {
            const active = pt.id === currentActiveId;
            return (
              <div key={pt.id} className={`group flex items-center gap-1.5 px-3 h-8 rounded-t-lg cursor-pointer text-[12px] whitespace-nowrap max-w-[180px] select-none shrink-0 transition-colors ${active ? 'bg-[var(--bg)] text-[var(--text)] font-medium' : 'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--bg)]/50'}`}
                onClick={() => selectTab(activeTool.name, pt.id)}>
                <div className="w-3.5 h-3.5 rounded-full bg-[var(--text3)]/20 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--text3)]/40" />
                </div>
                <span className="truncate">{pt.title}</span>
                <button className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all shrink-0"
                  onClick={e => { e.stopPropagation(); closeTab(activeTool.name, pt.id); }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Webview area — show active tool's active tab */}
      <div className="flex-1 relative bg-[var(--bg)]">
        {filtered.map((t,i) => (
          <div key={t.name} className="absolute inset-0" style={{display:i===activeIdx?'block':'none'}}>
            {errors[t.name] ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3 max-w-md px-8">
                  <div className="text-3xl opacity-40">🌐</div>
                  <div className="text-sm text-[var(--text3)]">{t.name} 暂时无法加载</div>
                  <button className="px-4 py-1.5 bg-[var(--accent-solid)]/20 hover:bg-[var(--accent-solid)]/30 text-[var(--text)] text-xs rounded-lg" onClick={()=>setErrors(p=>({...p,[t.name]:false}))}>重新加载</button>
                </div>
              </div>
            ) : (
              (tabsByTool[t.name]||[]).map(pt => (
                <div key={pt.id} className="absolute inset-0" style={{display:pt.id===(activeTabByTool[t.name]||'')?'block':'none'}}>
                  <webview src={pt.url} className="w-full h-full" style={{height:'100%'}}
                    partition={`persist:tool-${t.name.replace(/[^a-zA-Z0-9]/g,'')}`}
                    onDomReady={onDomReady}
                    onPageTitleUpdated={onPageTitleUpdated(t.name, pt.id)}
                    onWillNavigate={onWillNavigate(t.name)}
                    onNewWindow={onNewWindow(t.name)}
                    onDidFailLoad={()=>setErrors(p=>({...p,[t.name]:true}))}
                  />
                </div>
              ))
            )}
          </div>
        ))}
        {filtered.length===0 && <div className="flex items-center justify-center h-full text-sm text-[var(--muted)]">暂无工具，点击「＋ 添加」</div>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60" onClick={()=>setShowAdd(false)}>
          <div className="bg-[var(--card)] border border-[var(--border2)] rounded-xl p-6 w-80 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="text-sm text-[var(--text)] font-semibold mb-3">添加{mode==='image'?'生图':'视频'}工具</div>
            <input className="w-full bg-[var(--card2)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-gold-400 mb-3" placeholder="工具名称" value={nm} onChange={e=>setNm(e.target.value)} />
            <input className="w-full bg-[var(--card2)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-gold-400 mb-4" placeholder="网址" value={ur} onChange={e=>setUr(e.target.value)} />
            <div className="flex gap-2"><button className="flex-1 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-lg" onClick={addTool}>添加</button><button className="px-3 py-2 text-sm text-[var(--text3)]" onClick={()=>setShowAdd(false)}>取消</button></div>
          </div>
        </div>
      )}
      {showOnboard && (
        <OnboardingGuide title="工具模块" storageKey="onboard-tools" onClose={dismissOnboard}
          buttons={[{label:'优先打开国内工具',primary:true,onClick:()=>{dismissOnboard();if(mode==='image')setActiveIdx(1);else setActiveIdx(0);}},{label:'开始使用',onClick:dismissOnboard}]}>
          <p>工具模块用于 AI 生图、AI 视频生成、Prompt 验证、素材制作。</p>
        </OnboardingGuide>
      )}
    </div>
  );
}
