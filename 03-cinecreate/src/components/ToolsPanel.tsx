import React, { useState, useEffect, useCallback, useRef } from 'react';
import OnboardingGuide, { useOnboarding } from './OnboardingGuide';

type ToolCategory = 'image'|'video';
interface Tool { name:string; url:string; cat:ToolCategory; }

const DEF_TOOLS: Tool[] = [
  { name:'GPT Image', url:'https://chatgpt.com/?model=gpt-4o', cat:'image' },
  { name:'Seedream', url:'https://www.doubao.com/chat/create-image', cat:'image' },
  { name:'Nano Banana', url:'https://gemini.google.com/app', cat:'image' },
  { name:'Qwen Image', url:'https://tongyi.aliyun.com/qianwen', cat:'image' },
  { name:'Seedance', url:'https://jimeng.jianying.com/ai-tool/image', cat:'video' },
  { name:'Kling', url:'https://app.klingai.com', cat:'video' },
  { name:'Happy Horse', url:'https://www.happyhorse.cn/creation/generation', cat:'video' },
];

interface Props { mode: ToolCategory; }

export default function ToolsPanel({ mode }: Props) {
  const [customTools, setCustomTools] = useState<Tool[]>([]);
  const tools = [...DEF_TOOLS, ...customTools];
  const [activeTool, setActiveTool] = useState(DEF_TOOLS[0].name);
  const [errors, setErrors] = useState<Record<string,boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [nm, setNm] = useState(''); const [ur, setUr] = useState('');
  const [showOnboard, dismissOnboard, showGuide] = useOnboarding('onboard-tools');

  const filtered = tools.filter(t=>t.cat===mode);

  // On mode switch, ensure active tool belongs to current mode
  useEffect(() => {
    const current = tools.find(t => t.name === activeTool);
    if (!current || current.cat !== mode) {
      const first = tools.find(t => t.cat === mode);
      if (first) setActiveTool(first.name);
    }
  }, [mode]);

  const wvRefs = useRef<Record<string,any>>({});
  const makeWvRef = useCallback((name: string) => (el: any) => {
    if (!el) return;
    if (wvRefs.current[name] === el) return;
    wvRefs.current[name] = el;
  }, []);

  const addTool = () => {
    if(!nm.trim()||!ur.trim()) return;
    setCustomTools(p=>[...p,{name:nm.trim(),url:ur.trim(),cat:mode}]);
    setShowAdd(false);
  };
  const deleteTool = (t:Tool) => {
    setCustomTools(p=>p.filter(x=>x!==t));
    if (activeTool === t.name) {
      const remaining = tools.filter(x => x.name !== t.name && x.cat === mode);
      if (remaining.length) setActiveTool(remaining[0].name);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tool tabs — filtered nav */}
      <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex items-center gap-0 px-6 py-2.5">
        <button className="text-xs w-5 h-5 rounded-full border border-[var(--border2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--dim)] flex items-center justify-center shrink-0 mr-2" onClick={showGuide} title="查看引导">?</button>
        {filtered.map((t)=>(
          <div key={t.name} className="group flex items-center">
            <button className={`text-xs px-3 py-1 rounded transition-colors ${t.name===activeTool?'bg-[var(--accent-solid)]/20 text-[var(--text)] font-semibold':'text-[var(--dim)] hover:text-[var(--text2)]'}`}
              onClick={()=>setActiveTool(t.name)}>{t.name}</button>
            {!DEF_TOOLS.some(dt=>dt.name===t.name)&&<button className="text-[8px] text-[var(--muted)] hover:text-red-400 hidden group-hover:block -ml-1" onClick={()=>deleteTool(t)}>✕</button>}
          </div>
        ))}
        <button className="text-xs px-2 py-1 text-[var(--muted)] hover:text-gold-500" onClick={()=>{setNm('');setUr('');setShowAdd(true);}}>＋ 添加</button>
        <div className="flex-1" />
        <button className="text-xs px-2 py-0.5 text-[var(--muted)] hover:text-[var(--text2)] rounded border border-[#333]"
          onClick={()=>{ const t = tools.find(x=>x.name===activeTool); if(t) { setRefreshing(true); setRefreshKey(k=>k+1); setErrors(p=>({...p,[t.name]:false})); setTimeout(()=>setRefreshing(false), 2000); } }}
          disabled={refreshing}>{refreshing ? '刷新中...' : '刷新当前'}</button>
      </div>

      {/* Webview area — all tools always mounted */}
      <div className="flex-1 relative bg-[var(--bg)]">
        {tools.map(t => {
          const isActive = t.name === activeTool && t.cat === mode;
          return (
          <div key={t.name} className="absolute inset-0" style={isActive?{inset:0}:{position:'absolute',inset:0,visibility:'hidden',opacity:0,pointerEvents:'none'}}>
            {errors[t.name] ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3 max-w-md px-8">
                  <div className="text-3xl opacity-40">🌐</div>
                  <div className="text-sm text-[var(--text3)]">{t.name} 暂时无法加载</div>
                  <button className="px-4 py-1.5 bg-[var(--accent-solid)]/20 hover:bg-[var(--accent-solid)]/30 text-[var(--text)] text-xs rounded-lg" onClick={()=>setErrors(p=>({...p,[t.name]:false}))}>重新加载</button>
                </div>
              </div>
            ) : (
              <webview key={`${t.name}-${refreshKey}`} src={t.url} className="w-full h-full" style={{height:'100%'}}
                ref={makeWvRef(t.name)}
                partition={`persist:tool-${t.name.replace(/[^a-zA-Z0-9]/g,'')}`}
                onDidFailLoad={()=>setErrors(p=>({...p,[t.name]:true}))}
                // @ts-ignore
                allowpopups="true" />
            )}
          </div>
        )})}
        {tools.length===0 && <div className="flex items-center justify-center h-full text-sm text-[var(--muted)]">暂无工具</div>}
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
          buttons={[{label:'优先打开国内工具',primary:true,onClick:()=>{dismissOnboard();setActiveTool(mode==='image'?'Seedream':'Seedance');}},{label:'开始使用',onClick:dismissOnboard}]}>
          <p>工具模块用于 AI 生图、AI 视频生成、Prompt 验证、素材制作。</p>
        </OnboardingGuide>
      )}
    </div>
  );
}
