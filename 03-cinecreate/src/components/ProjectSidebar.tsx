import React, { useState, useEffect, useCallback } from 'react';
import { Project } from '../types';
import { db } from '../services/dbService';
import { getTheme, onThemeChange, toggleTheme } from '../services/themeService';
const api = (window as any).electronAPI;

interface Props {
  projects: Project[]; activeId: string | null; activeSeqId: string | null;
  onSelect: (id: string) => void; onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
  onSelectDraft: (draftId: string) => void; selectedDraftId: string | null;
  onSelectStoryboard: () => void;
  onSelectImageTools: () => void; onSelectVideoTools: () => void;
  activeMode: string | null;
  onShowWelcome?: () => void;
}

export default function ProjectSidebar(props: Props) {
  const { projects, activeId, onSelect, onCreate, onRename, onDelete, onSelectDraft, selectedDraftId, onSelectStoryboard, onSelectImageTools, onSelectVideoTools, activeMode, onShowWelcome } = props;

  const [editId, setEditId] = useState<string|null>(null);
  const [editName, setEditName] = useState('');
  const [editDraftId, setEditDraftId] = useState<string|null>(null);
  const [editDraftName, setEditDraftName] = useState('');
  const [delProjId, setDelProjId] = useState<string|null>(null);
  const [delDraftId, setDelDraftId] = useState<string|null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuOpen, setMenuOpen] = useState<string|null>(null);
  const [expanded, setExpanded] = useState<any>({});
  const [showDocs, setShowDocs] = useState<any>({});
  const [showTool, setShowTool] = useState<any>({});
  const [drafts, setDrafts] = useState<any[]>([]);
  const [theme, setTheme] = useState(getTheme());
  useEffect(() => onThemeChange(() => setTheme(getTheme())), []);

  const loadDrafts = useCallback(async () => {
    if (!activeId) return;
    try {
      const all = await db.dts.getAll(activeId);
      if (all.length===0) { const d = await db.dts.create({projectId:activeId,name:'草稿V1',currentStep:1,confirmedAssets:{},conversation:[]}); setDrafts([d]); }
      else setDrafts(all);
    } catch { setDrafts([]); }
  }, [activeId]);
  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  useEffect(() => { const h = () => { setMenuOpen(null); }; document.addEventListener('click',h); return ()=>document.removeEventListener('click',h); }, []);

  const submitCreate = () => { const n=newName.trim(); if(n){onCreate(n);setCreating(false);setNewName('');} };
  const addDraft = async (prjId: string) => {
    const count = drafts.length;
    const d = await db.dts.create({projectId:prjId, name:`草稿V${count+1}`, currentStep:1, confirmedAssets:{}, conversation:[]});
    setDrafts(p=>[...p,d]); setShowDocs({[prjId]:true}); onSelectDraft(d.id);
  };

  // ── Shared styles ──
  const rowBase = 'flex items-center h-7 rounded cursor-pointer transition-colors group';
  const rowActive = 'bg-black/5 text-[var(--text)]';
  const rowIdle = 'text-[var(--text3)] hover:bg-black/3 hover:text-[var(--text2)]';
  const chevron = (open:boolean) => (
    <svg width="10" height="10" viewBox="0 0 10 10" className={`shrink-0 mr-1 transition-transform ${open?'rotate-90':''}`}>
      <path d="M3.5 1.5L6.5 5L3.5 8.5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  );

  const DelBar = ({msg,onConfirm,onCancel}:{msg:string;onConfirm:()=>void;onCancel:()=>void}) => (
    <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/15 rounded px-2 py-1.5 text-[11px] text-red-500/80">
      <span className="flex-1">{msg}</span>
      <button className="px-1.5 py-0.5 bg-red-500/15 hover:bg-red-500/25 rounded text-[11px]" onClick={onConfirm}>确认</button>
      <button className="px-1.5 py-0.5 text-[var(--text3)] hover:text-[var(--text)] text-[11px]" onClick={onCancel}>取消</button>
    </div>
  );

  return (
    <div className="w-56 bg-[var(--bg2)] border-r border-[var(--border)] flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 256 256" fill="none" className="shrink-0 text-[var(--accent-solid)]"><circle cx="128" cy="128" r="72" stroke="currentColor" stroke-width="34" fill="none" stroke-dasharray="350 103" stroke-dashoffset="25" stroke-linecap="round"/><path d="M148 112L148 144L174 128Z" fill="currentColor"/></svg>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-[var(--text)]">影创</div>
              <div className="text-[10px] text-[var(--muted)]">CineCreate</div>
            </div>
          </div>
          <button className="text-[11px] text-[var(--muted)] hover:text-[var(--text2)]" onClick={() => { toggleTheme(); window.dispatchEvent(new Event('themechange')); }} title="切换主题">
            {theme==='dark'?'☀️':'🌙'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {/* Guide */}
        {onShowWelcome && (
          <div className={`flex items-center gap-2 h-7 px-2 rounded cursor-pointer mb-1 text-[12px] ${!activeId?'bg-black/5 text-[var(--text)] font-medium':'text-[var(--text3)] hover:text-[var(--text)] hover:bg-black/3'}`}
            onClick={onShowWelcome}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 opacity-50"><circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1"/><circle cx="5" cy="3.5" r="0.5" fill="currentColor"/><path d="M4.5 5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            <span>新手引导</span>
          </div>
        )}

        {/* Section header */}
        <div className="flex items-center justify-between px-2 h-7 mb-0.5">
          <span className="text-[12px] text-[var(--muted)] font-medium">项目</span>
          <button className="text-[var(--dim)] hover:text-[var(--text2)] text-sm leading-none" onClick={()=>{setCreating(true);setNewName('');}}>+</button>
        </div>

        {/* Inline create project */}
        {creating && (
          <div className="mb-1 px-1">
            <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--accent-text)]/20 rounded px-2 py-1">
              <input className="flex-1 bg-transparent text-[11px] text-[var(--text)] outline-none min-w-0" placeholder="项目名称..."
                value={newName} onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')submitCreate();if(e.key==='Escape'){setCreating(false);setNewName('');}}} autoFocus />
              <button className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white rounded" onClick={submitCreate}>确定</button>
              <button className="text-[10px] text-[var(--text3)] hover:text-[var(--text)]" onClick={()=>{setCreating(false);setNewName('');}}>取消</button>
            </div>
          </div>
        )}

        {delProjId && (
          <div className="mb-1"><DelBar msg="永久删除此项目？" onConfirm={()=>{onDelete(delProjId);setDelProjId(null);}} onCancel={()=>setDelProjId(null)}/></div>
        )}

        {/* Project list */}
        {projects.map(prj => {
          const isActive = activeId===prj.id, isExp = !!expanded[prj.id];
          return (<div key={prj.id} className="mb-0.5">
            <div className={`${rowBase} pl-2 ${isActive?rowActive:rowIdle}`}
              onClick={()=>{if(isActive)setExpanded({[prj.id]:!isExp});else{onSelect(prj.id);setExpanded({[prj.id]:true});}}}>
              <span className="w-4 flex items-center justify-center shrink-0">
                {isActive ? chevron(isExp) : <span className="w-[10px]" />}
              </span>
              {editId===prj.id ? (
                <input className="flex-1 bg-[var(--card)] border border-[var(--accent-text)]/20 rounded px-1 py-0 text-[11px] text-[var(--text)] outline-none min-w-0"
                  value={editName} onChange={e=>setEditName(e.target.value)}
                  onBlur={()=>{if(editName.trim())onRename(prj.id,editName.trim());setEditId(null);}}
                  onKeyDown={e=>{if(e.key==='Enter'){if(editName.trim())onRename(prj.id,editName.trim());setEditId(null);}if(e.key==='Escape')setEditId(null);}}
                  autoFocus onClick={e=>e.stopPropagation()} />
              ) : (
                <span className={`flex-1 truncate text-[12px] ${isActive?'font-semibold':'font-medium'}`}>{prj.name}</span>
              )}
              <div className="hidden group-hover:flex items-center relative shrink-0" onClick={e=>e.stopPropagation()}>
                <button className="text-[var(--muted)] hover:text-[var(--text2)] text-xs px-0.5" onClick={()=>setMenuOpen(menuOpen===prj.id?null:prj.id)}>⋯</button>
                {menuOpen===prj.id && (
                  <div className="absolute right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg z-50 py-0.5 min-w-[90px]">
                    <button className="block w-full text-left text-[11px] px-3 py-1 text-[var(--text2)] hover:bg-black/4"
                      onClick={()=>{setEditId(prj.id);setEditName(prj.name);setMenuOpen(null);}}>重命名</button>
                    <button className="block w-full text-left text-[11px] px-3 py-1 text-[var(--text2)] hover:bg-red-500/8 hover:text-red-500"
                      onClick={()=>{setDelProjId(prj.id);setMenuOpen(null);}}>删除</button>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded tree */}
            {isActive && isExp && (
              <div className="ml-5 border-l border-[var(--border)] pl-2 space-y-0">
                {/* 文稿 */}
                <div>
                  <div className={`${rowBase} px-1 ${activeMode==='drafts'?'bg-black/5 text-[var(--text)] font-medium':'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                    onClick={()=>setShowDocs({[prj.id]:!showDocs[prj.id]})}>
                    <span className="w-3.5 flex items-center justify-center shrink-0">
                      {showDocs[prj.id] ? chevron(true) : <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50"><rect x="1.5" y="1" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1"/><line x1="3.5" y1="3.5" x2="6.5" y2="3.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/><line x1="3.5" y1="5.5" x2="6.5" y2="5.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/><line x1="3.5" y1="7.5" x2="5" y2="7.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/></svg>}
                    </span>
                    <span className="text-[11px] flex-1">文稿</span>
                    <button className="text-[var(--muted)] hover:text-[var(--text2)] text-xs shrink-0 leading-none"
                      onClick={e=>{e.stopPropagation();setShowDocs({[prj.id]:true});addDraft(prj.id);}}>+</button>
                  </div>
                  {showDocs[prj.id] && <div className="ml-3">
                    {delDraftId && <DelBar msg="永久删除此草稿？" onConfirm={()=>{db.dts.delete(delDraftId).catch(()=>{});setDrafts(p=>p.filter(x=>x.id!==delDraftId));setDelDraftId(null);}} onCancel={()=>setDelDraftId(null)}/>}
                    {drafts.map((d:any)=>(
                      <div key={d.id} className={`${rowBase} text-[11px] px-1 ${selectedDraftId===d.id?'text-[var(--text)] font-medium bg-black/4':'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-black/2'}`}
                        onClick={()=>onSelectDraft(d.id)}>
                        <span className="w-3.5 shrink-0" />
                        <span className="flex-1 truncate">{d.name}</span>
                        <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button className="text-[var(--muted)] hover:text-[var(--text2)] text-[10px]" onClick={e=>{e.stopPropagation();setEditDraftId(d.id);setEditDraftName(d.name);}}>✎</button>
                          <button className="text-[var(--muted)] hover:text-red-400 text-[10px]" onClick={e=>{e.stopPropagation();setDelDraftId(d.id);}}>✕</button>
                        </span>
                      </div>
                    ))}
                  </div>}
                </div>

                {/* 素材 */}
                <div className={`${rowBase} px-1 text-[var(--text3)] hover:text-[var(--text2)]`}>
                  <span className="w-3.5 flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50"><rect x="0.5" y="0.5" width="4" height="4" rx="0.5" stroke="currentColor" stroke-width="1"/><rect x="5.5" y="0.5" width="4" height="4" rx="0.5" stroke="currentColor" stroke-width="1"/><rect x="0.5" y="5.5" width="4" height="4" rx="0.5" stroke="currentColor" stroke-width="1"/><rect x="5.5" y="5.5" width="4" height="4" rx="0.5" stroke="currentColor" stroke-width="1"/></svg>
                  </span>
                  <span className="text-[11px]">素材</span>
                </div>

                {/* 工具 */}
                <div>
                  <div className={`${rowBase} px-1 ${activeMode==='tools-image'||activeMode==='tools-video'?'bg-black/5 text-[var(--text)] font-medium':'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                    onClick={()=>setShowTool({[prj.id]:!showTool[prj.id]})}>
                    <span className="w-3.5 flex items-center justify-center shrink-0">
                      {showTool[prj.id] ? chevron(true) : <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50"><circle cx="5" cy="5" r="1.5" stroke="currentColor" stroke-width="1"/><circle cx="5" cy="5" r="0.5" fill="currentColor"/><g stroke="currentColor" stroke-width="0.8" stroke-linecap="round"><line x1="5" y1="2.5" x2="5" y2="1"/><line x1="7.16" y1="3.54" x2="8.06" y2="3.06"/><line x1="7.5" y1="5" x2="8.5" y2="5"/><line x1="3.54" y1="7.16" x2="3.06" y2="8.06"/></g></svg>}
                    </span>
                    <span className="text-[11px] flex-1">工具</span>
                  </div>
                  {showTool[prj.id] && <div className="ml-3">
                    <div className={`${rowBase} text-[11px] px-1 ${activeMode==='tools-image'?'text-[var(--text)] font-medium bg-black/4':'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-black/2'}`}
                      onClick={()=>onSelectImageTools()}><span className="w-3.5 shrink-0" /><span className="flex-1">生图</span></div>
                    <div className={`${rowBase} text-[11px] px-1 ${activeMode==='tools-video'?'text-[var(--text)] font-medium bg-black/4':'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-black/2'}`}
                      onClick={()=>onSelectVideoTools()}><span className="w-3.5 shrink-0" /><span className="flex-1">视频</span></div>
                  </div>}
                </div>

                {/* 分镜 */}
                <div className={`${rowBase} px-1 ${activeMode==='storyboard'?'bg-black/5 text-[var(--text)] font-medium':'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                  onClick={()=>onSelectStoryboard()}>
                  <span className="w-3.5 flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50"><rect x="0.5" y="0.5" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1"/><rect x="1.5" y="1.5" width="3" height="3" rx="0.3" stroke="currentColor" stroke-width="0.7"/><rect x="5.5" y="1.5" width="3" height="3" rx="0.3" stroke="currentColor" stroke-width="0.7"/><rect x="1.5" y="5.5" width="3" height="3" rx="0.3" stroke="currentColor" stroke-width="0.7"/><polygon points="6.2,6.2 6.2,7.8 7.8,7" fill="currentColor"/></svg>
                  </span>
                  <span className="text-[11px]">分镜</span>
                </div>

              </div>
            )}
          </div>);
        })}
        {projects.length===0 && <div className="text-[11px] text-[var(--muted)] text-center py-8">暂无项目</div>}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--muted)]">{projects.length} 个项目</div>

      {/* Rename draft dialog */}
      {editDraftId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={()=>setEditDraftId(null)}>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 w-72 shadow-xl" onClick={e=>e.stopPropagation()}>
            <div className="text-[11px] text-[var(--text3)] mb-2">重命名草稿</div>
            <input className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-text)]/30 mb-3"
              value={editDraftName} onChange={e=>setEditDraftName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'){if(editDraftName.trim()){db.dts.update(editDraftId,{name:editDraftName.trim()}).catch(()=>{});setDrafts(p=>p.map(x=>x.id===editDraftId?{...x,name:editDraftName.trim()}:x));}setEditDraftId(null);}if(e.key==='Escape')setEditDraftId(null);}} autoFocus />
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-medium rounded-lg" onClick={()=>{if(editDraftName.trim()){db.dts.update(editDraftId,{name:editDraftName.trim()}).catch(()=>{});setDrafts(p=>p.map(x=>x.id===editDraftId?{...x,name:editDraftName.trim()}:x));}setEditDraftId(null);}}>确定</button>
              <button className="flex-1 py-1.5 bg-[var(--card2)] border border-[var(--border)] text-[var(--text2)] text-[11px] rounded-lg" onClick={()=>setEditDraftId(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
