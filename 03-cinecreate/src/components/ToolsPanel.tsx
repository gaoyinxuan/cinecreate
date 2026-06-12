/**
 * Tools Panel — persistent webviews with tab switching.
 * All webviews stay alive when switching tabs or modules.
 */
import React, { useState, useEffect } from 'react';
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
  const [activeIdx, setActiveIdx] = useState(0);
  const [errors, setErrors] = useState<Record<string,boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [nm, setNm] = useState(''); const [ur, setUr] = useState('');
  const [showOnboard, dismissOnboard, showGuide] = useOnboarding('onboard-tools');

  const filtered = tools.filter(t=>t.cat===mode);
  useEffect(() => { if(activeIdx >= filtered.length) setActiveIdx(0); }, [filtered.length]);

  const addTool = () => {
    if(!nm.trim()||!ur.trim()) return;
    setCustomTools(p=>[...p,{name:nm.trim(),url:ur.trim(),cat:mode}]);
    setShowAdd(false);
  };
  const deleteTool = (t:Tool) => {
    setCustomTools(p=>p.filter(x=>x!==t));
    if(activeIdx>=filtered.length-1) setActiveIdx(Math.max(0,activeIdx-1));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex items-center gap-0 px-6 py-2.5">
        <button className="text-xs w-5 h-5 rounded-full border border-[var(--border2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--dim)] flex items-center justify-center shrink-0 mr-2" onClick={showGuide} title="查看引导">?</button>
        {filtered.map((t,i)=>(
          <div key={t.name} className="group flex items-center">
            <button className={`text-xs px-3 py-1 rounded transition-colors ${i===activeIdx?'bg-gold-400/20 text-[var(--text)] font-semibold':'text-[var(--dim)] hover:text-[var(--text2)]'}`}
              onClick={()=>setActiveIdx(i)}>{t.name}</button>
            {!DEF_TOOLS.some(dt=>dt.name===t.name)&&<button className="text-[8px] text-[var(--muted)] hover:text-red-400 hidden group-hover:block -ml-1" onClick={()=>deleteTool(t)}>✕</button>}
          </div>
        ))}
        <button className="text-xs px-2 py-1 text-[var(--muted)] hover:text-gold-500" onClick={()=>{setNm('');setUr('');setShowAdd(true);}}>＋ 添加</button>
        <div className="flex-1" />
        <button className="text-xs px-2 py-0.5 text-[var(--muted)] hover:text-[var(--text2)] rounded border border-[#333]"
          onClick={()=>{ const t = filtered[activeIdx]; if(t) { setRefreshing(true); setRefreshKey(k=>k+1); setErrors(p=>({...p,[t.name]:false})); setTimeout(()=>setRefreshing(false), 2000); } }}
          disabled={refreshing}>{refreshing ? '刷新中...' : '刷新当前'}</button>
      </div>

      {/* Webview container — all stay mounted, only active visible */}
      <div className="flex-1 relative bg-[var(--bg)]">
        {filtered.map((t,i) => (
          <div key={t.name} className="absolute inset-0" style={{display:i===activeIdx?'block':'none'}}>
            {errors[t.name] ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3 max-w-md px-8">
                  <div className="text-3xl opacity-40">🌐</div>
                  <div className="text-sm text-[var(--text3)]">{t.name} 暂时无法加载</div>
                  <div className="text-xs text-[var(--muted)] space-y-1">可能原因：网络问题、需要特殊网络环境、网站服务异常</div>
                  <button className="px-4 py-1.5 bg-gold-400/20 hover:bg-gold-400/30 text-[var(--text)] text-xs rounded-lg" onClick={()=>setErrors(p=>({...p,[t.name]:false}))}>重新加载</button>
                  {mode==='image' && <button className="px-4 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 text-xs rounded-lg" onClick={()=>setActiveIdx(1)}>切换到豆包</button>}
                  {mode==='video' && <button className="px-4 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 text-xs rounded-lg" onClick={()=>setActiveIdx(0)}>切换到即梦</button>}
                </div>
              </div>
            ) : (
              <webview key={`${t.name}-${refreshKey}`} src={t.url} className="w-full h-full" style={{height:'100%'}}
                partition={`persist:tool-${t.name.replace(/[^a-zA-Z0-9]/g,'')}`}
                onDidFailLoad={()=>setErrors(p=>({...p,[t.name]:true}))}
                // @ts-ignore
                allowpopups="true" />
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
            <div className="flex gap-2"><button className="flex-1 py-2 bg-gold-400 hover:bg-gold-500 text-white text-sm font-semibold rounded-lg" onClick={addTool}>添加</button><button className="px-3 py-2 text-sm text-[var(--text3)]" onClick={()=>setShowAdd(false)}>取消</button></div>
          </div>
        </div>
      )}
      {showOnboard && (
        <OnboardingGuide title="工具模块" storageKey="onboard-tools" onClose={dismissOnboard}
          buttons={[
            {label:'优先打开国内工具',primary:true,onClick:()=>{dismissOnboard();if(mode==='image')setActiveIdx(1);else setActiveIdx(0);}},
            {label:'开始使用',onClick:dismissOnboard}]}>
          <p>工具模块用于 AI 生图、AI 视频生成、Prompt 验证、素材制作。</p>
          <p>部分海外工具可能需要特殊网络环境和海外账号。如果当前环境无法访问海外服务，建议优先使用豆包（生图）、即梦（视频）等国内可直接访问的工具。</p>
        </OnboardingGuide>
      )}
    </div>
  );
}
