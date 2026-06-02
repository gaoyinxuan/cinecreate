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
  activeMode: string | null; // 'drafts' | 'tools-image' | 'tools-video' | 'storyboard' | null
  onShowWelcome?: () => void;
}

export default function ProjectSidebar(props: Props) {
  const { projects, activeId, onSelect, onCreate, onRename, onDelete, onSelectDraft, selectedDraftId, onSelectStoryboard, onSelectImageTools, onSelectVideoTools, activeMode, onShowWelcome } = props;

  // ── State ──
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

  // Close menus on outside click
  useEffect(() => { const h = () => { setMenuOpen(null); }; document.addEventListener('click',h); return ()=>document.removeEventListener('click',h); }, []);

  const submitCreate = () => { const n=newName.trim(); if(n){onCreate(n);setCreating(false);setNewName('');} };
  const addDraft = async (prjId: string) => {
    const count = drafts.length;
    const d = await db.dts.create({projectId:prjId, name:`草稿V${count+1}`, currentStep:1, confirmedAssets:{}, conversation:[]});
    setDrafts(p=>[...p,d]); setShowDocs({[prjId]:true}); onSelectDraft(d.id);
  };

  // ── Render helpers ──
  const aw = 'w-4 text-xs text-center shrink-0 select-none inline-block leading-none';

  // Shared: all sub-items under project share the same left alignment
  const indent = 'ml-4'; // indent for children of Section

  // L1: Section header (文稿/工具) — clickable, expandable
  const Section = ({show,toggle,label,extra,children,active}:{show:boolean;toggle:()=>void;label:string;extra?:any;children?:any;active?:boolean}) => (
    <div>
      <div className={`flex items-center h-7 cursor-pointer transition-colors ${active?'text-[var(--text)] font-semibold':'text-[var(--text2)] hover:text-[var(--text)]'}`} onClick={toggle}>
        <span className={aw}>{show?'▼':'▶'}</span><span className="text-xs font-semibold">{label}</span>{extra}
      </div>
      {show && <div className={indent}>{children}</div>}
    </div>
  );

  // L2: Leaf item — uses same arrow placeholder width as Section for text alignment
  const Leaf = ({active,onClick,icon,label,onEdit,onDelete,hoverBtns}:{active?:boolean;onClick:()=>void;icon:string;label:string;onEdit?:()=>void;onDelete?:()=>void;hoverBtns?:boolean}) => (
    <div className={`group flex items-center h-7 rounded cursor-pointer ${active?'bg-indigo-500/15 text-[var(--text)] font-semibold':'text-[var(--text2)] hover:bg-white/[0.04]'}`} onClick={onClick}>
      <span className={aw}>&nbsp;</span>
      <span className="text-xs font-semibold truncate flex-1">{icon} {label}</span>
      {hoverBtns && (
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 pr-1">
          {onEdit&&<button className="text-[var(--muted)] hover:text-[var(--text2)] text-xs" onClick={e=>{e.stopPropagation();onEdit();}}>✎</button>}
          {onDelete&&<button className="text-[var(--muted)] hover:text-red-400 text-xs" onClick={e=>{e.stopPropagation();onDelete();}}>✕</button>}
        </div>
      )}
    </div>
  );

  // Inline delete confirm bar
  const DelBar = ({msg,onConfirm,onCancel}:{msg:string;onConfirm:()=>void;onCancel:()=>void}) => (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400/80">
      <span className="flex-1">{msg}</span>
      <button className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 rounded text-xs" onClick={onConfirm}>确认</button>
      <button className="px-2 py-0.5 text-[var(--text3)] hover:text-[var(--text)] text-xs" onClick={onCancel}>取消</button>
    </div>
  );

  return (
    <div className="w-56 bg-[var(--bg2)] border-r border-[var(--border)] flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-[var(--text)] tracking-wide">🎬 影创</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">CineCreate</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="text-xs text-[var(--muted)] hover:text-[var(--text2)] flex items-center gap-1" onClick={() => { toggleTheme(); window.dispatchEvent(new Event('themechange')); }} title="切换主题">{theme==='dark'?'🌙':'☀️'}<span className="text-[var(--muted)]">{theme==='dark'?'深色':'浅色'}</span></button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-2">
          {/* Onboarding guide */}
          {onShowWelcome && (
            <div className="mb-2">
              <div className="flex items-center gap-2 h-7 px-3 rounded cursor-pointer text-[var(--text2)] hover:text-[var(--text)] transition-colors"
                onClick={onShowWelcome}>
                <span className="text-sm">📖</span>
                <span className="text-xs">新手引导</span>
              </div>
            </div>
          )}

          {/* Section header */}
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-sm text-[var(--text2)] font-semibold uppercase tracking-wider">项目</span>
            <button className="text-[var(--dim)] hover:text-[var(--text2)] text-sm leading-none px-1 outline-none focus:outline-none" onClick={()=>{setCreating(true);setNewName('');}}>+</button>
          </div>

          {/* Inline create project */}
          {creating && (
            <div className="mb-2 px-1">
              <div className="flex items-center gap-1 bg-[var(--card)] border border-indigo-500/50 rounded-lg px-2 py-1">
                <span className="text-xs">📁</span>
                <input className="flex-1 bg-transparent text-xs text-[var(--text)] outline-none min-w-0" placeholder="项目名称..."
                  value={newName} onChange={e=>setNewName(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')submitCreate();if(e.key==='Escape'){setCreating(false);setNewName('');}}} autoFocus />
                <button className="text-xs px-2 py-0.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded" onClick={submitCreate}>确定</button>
                <button className="text-xs text-[var(--text3)] hover:text-[var(--text)]" onClick={()=>{setCreating(false);setNewName('');}}>取消</button>
              </div>
            </div>
          )}

          {/* Delete confirm */}
          {delProjId && (
            <div className="mb-2"><DelBar msg="永久删除此项目？" onConfirm={()=>{onDelete(delProjId);setDelProjId(null);}} onCancel={()=>setDelProjId(null)}/></div>
          )}

          {/* Project list */}
          {projects.map(prj => {
            const isActive = activeId===prj.id, isExp = !!expanded[prj.id];
            return (<div key={prj.id} className="mb-0.5">
              {/* Project row */}
              <div className={`group flex items-center gap-1 h-8 rounded-lg cursor-pointer transition-colors ${isActive?'bg-indigo-500/15 text-[var(--text)] border border-indigo-500/20':'hover:bg-white/[0.03] text-[var(--text2)] border border-transparent'}`}
                onClick={()=>{if(isActive)setExpanded({[prj.id]:!isExp});else{onSelect(prj.id);setExpanded({[prj.id]:true});}}}>
                <span className="w-4 text-center text-xs shrink-0">{isActive?(isExp?'▼':'▶'):''}</span>
                {editId===prj.id ? (
                  <input className="flex-1 bg-[var(--card)] border border-indigo-500 rounded px-1 py-0 text-xs text-[var(--text)] outline-none min-w-0"
                    value={editName} onChange={e=>setEditName(e.target.value)}
                    onBlur={()=>{if(editName.trim())onRename(prj.id,editName.trim());setEditId(null);}}
                    onKeyDown={e=>{if(e.key==='Enter'){if(editName.trim())onRename(prj.id,editName.trim());setEditId(null);}if(e.key==='Escape')setEditId(null);}}
                    autoFocus onClick={e=>e.stopPropagation()} />
                ) : (
                  <span className="flex-1 text-sm font-medium truncate">📁 {prj.name}</span>
                )}
                <div className="hidden group-hover:flex items-center relative" onClick={e=>e.stopPropagation()}>
                  <button className="text-[var(--muted)] hover:text-[var(--text2)] text-sm px-1 leading-none" onClick={()=>setMenuOpen(menuOpen===prj.id?null:prj.id)}>⋯</button>
                  {menuOpen===prj.id && (
                    <div className="absolute right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border2)] rounded-lg shadow-xl z-50 py-1 min-w-[100px]">
                      <button className="block w-full text-left text-xs px-3 py-1.5 text-[var(--text2)] hover:bg-white/[0.06] hover:text-[var(--text)]"
                        onClick={()=>{setEditId(prj.id);setEditName(prj.name);setMenuOpen(null);}}>✎ 重命名</button>
                      <button className="block w-full text-left text-xs px-3 py-1.5 text-[var(--text2)] hover:bg-red-500/10 hover:text-red-400"
                        onClick={()=>{setDelProjId(prj.id);setMenuOpen(null);}}>✕ 删除</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded tree — all items at same indent level */}
              {isActive && isExp && (
                <div className="ml-4 border-l border-[var(--border)] pl-2 space-y-0.5">
                  {/* ── 文稿 ── */}
                  <Section show={!!showDocs[prj.id]} toggle={()=>setShowDocs({[prj.id]:!showDocs[prj.id]})} label="📝 文稿" active={activeMode==='drafts'}
                    extra={<button className="text-sm text-[var(--muted)] hover:text-[var(--text2)] ml-auto shrink-0 leading-none" onClick={e=>{e.stopPropagation();setShowDocs({[prj.id]:true});addDraft(prj.id);}}>+</button>}>
                    {delDraftId && <DelBar msg="永久删除此草稿？" onConfirm={()=>{db.dts.delete(delDraftId).catch(()=>{});setDrafts(p=>p.filter(x=>x.id!==delDraftId));setDelDraftId(null);}} onCancel={()=>setDelDraftId(null)}/>}
                    {drafts.map((d:any)=>(
                      <Leaf key={d.id} active={selectedDraftId===d.id} hoverBtns
                        onClick={()=>onSelectDraft(d.id)} icon="📄" label={d.name}
                        onEdit={()=>{setEditDraftId(d.id);setEditDraftName(d.name);}}
                        onDelete={()=>setDelDraftId(d.id)} />
                    ))}
                  </Section>

                  {/* ── 工具 ── */}
                  <Section show={!!showTool[prj.id]} toggle={()=>setShowTool({[prj.id]:!showTool[prj.id]})} label="🔧 工具" active={activeMode==='tools-image'||activeMode==='tools-video'}>
                    <Leaf onClick={()=>{onSelectImageTools();}} icon="🖼️" label="生图" active={activeMode==='tools-image'} />
                    <Leaf onClick={()=>{onSelectVideoTools();}} icon="🎥" label="视频" active={activeMode==='tools-video'} />
                  </Section>

                  {/* ── 分镜 ── */}
                  <div className={`flex items-center h-7 cursor-pointer transition-colors ${activeMode==='storyboard'?'text-[var(--text)] font-semibold':'text-[var(--text2)] hover:text-[var(--text)]'}`}
                    onClick={()=>onSelectStoryboard()}>
                    <span className={aw}>&nbsp;</span><span className="text-xs font-semibold">🎬 分镜</span>
                  </div>
                </div>
              )}
            </div>);
          })}
          {projects.length===0 && <div className="text-xs text-[var(--muted)] text-center py-6">暂无项目，点击 + 创建</div>}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-[var(--border)] text-xs text-[var(--muted)]">{projects.length} 个项目</div>

      {/* Inline rename inputs for drafts */}
      {editDraftId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setEditDraftId(null)}>
          <div className="bg-[var(--card)] border border-[var(--border2)] rounded-xl p-4 w-72 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="text-xs text-[var(--text3)] mb-2">重命名草稿</div>
            <input className="w-full bg-[var(--card2)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-indigo-500 mb-3"
              value={editDraftName} onChange={e=>setEditDraftName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'){if(editDraftName.trim()){db.dts.update(editDraftId,{name:editDraftName.trim()}).catch(()=>{});setDrafts(p=>p.map(x=>x.id===editDraftId?{...x,name:editDraftName.trim()}:x));}setEditDraftId(null);}if(e.key==='Escape')setEditDraftId(null);}} autoFocus />
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold rounded-lg" onClick={()=>{if(editDraftName.trim()){db.dts.update(editDraftId,{name:editDraftName.trim()}).catch(()=>{});setDrafts(p=>p.map(x=>x.id===editDraftId?{...x,name:editDraftName.trim()}:x));}setEditDraftId(null);}}>确定</button>
              <button className="flex-1 py-1.5 bg-[#2a2b48] text-[var(--text2)] text-xs rounded-lg" onClick={()=>setEditDraftId(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
