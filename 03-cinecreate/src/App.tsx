import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Project, Sequence, Shot } from './types';
import { db } from './services/dbService';
import ProjectSidebar from './components/ProjectSidebar';
import SequenceTabs from './components/SequenceTabs';
import Toolbar from './components/Toolbar';
import ShotBoard from './components/ShotBoard';
import Timeline from './components/Timeline';
import AIDirector from './components/AIDirector';
import DraftWorkspace from './components/DraftWorkspace';
import ToolsPanel from './components/ToolsPanel';
import OnboardingGuide, { useOnboarding } from './components/OnboardingGuide';
import WelcomePage from './components/WelcomePage';
import PreviewPanel from './components/PreviewPanel';
import { getTheme, toggleTheme } from './services/themeService';
import VideoOutputPanel from './components/VideoOutputPanel';
import ToastProvider from './components/ToastProvider';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const debounce = (fn: Function, ms: number) => { let t: any; return (...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSeqId, setActiveSeqId] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<'image'|'video'|null>(null);
  const [viewMode, setViewMode] = useState<'preview'|'storyboard'>('preview');
  const [loaded, setLoaded] = useState(false);
  const [showStoryOnboard, dismissStoryOnboard, showStoryGuide] = useOnboarding('onboard-storyboard', loaded);
  const [showWelcome, setShowWelcome] = useState(true);
  const [theme, setTheme] = useState(getTheme());
  const navigatorRef = useRef<any>(null);

  // Normalize DB row (JSON strings → JS objects), robust against all edge cases
  const safeArr = (v: any) => { if (Array.isArray(v)) return v; if (typeof v==='string') { try { const p=JSON.parse(v); return Array.isArray(p)?p:[]; } catch { return []; } } return []; };
  const safeObj = (v: any) => { if (v && typeof v==='object' && !Array.isArray(v)) return v; if (typeof v==='string') { try { const p=JSON.parse(v); return (p && typeof p==='object' && !Array.isArray(p))?p:{}; } catch { return {}; } } return {}; };
  const normSeq = (s: any): Sequence => ({...s, videoSegments: safeArr(s.videoSegments)});
  const normShot = (s: any): Shot => ({...s, variants: safeArr(s.variants), tags: safeArr(s.tags), metadata: safeObj(s.metadata)});

  // Load
  useEffect(() => {
    (async () => {
      try {
        const [projs, seqs, shts, onboardingState] = await Promise.all([
          db.projects.getAll(), db.sequences.getAll(), db.shots.getAll(), db.meta.get('onboarding')
        ]);
        if (onboardingState) {
          Object.entries(onboardingState).forEach(([k, v]) => { if (v) localStorage.setItem(k, 'shown'); });
        } else if (projs.length > 0) {
          const allDone = { 'onboard-drafts': true, 'onboard-tools': true, 'onboard-storyboard': true };
          Object.entries(allDone).forEach(([k]) => localStorage.setItem(k, 'shown'));
          db.meta.set('onboarding', allDone).catch(() => {});
        }
        setProjects(projs.map((p:any) => ({aiConfig: typeof p.aiConfig==='string' ? JSON.parse(p.aiConfig||'{}') : (p.aiConfig||{}), ...p})));
        setSequences(seqs.map(normSeq));
        setShots(shts.map(normShot));
        // Migrate old ai_story/ai_character to documents (one-time)
        setTimeout(async () => {
          try {
            const stories = await db.ai.stories.getAll();
            for (const s of stories) {
              const existing = await db.docs.getAll(s.projectId);
              if (!existing.some(d => d.title === (s.title || '') && d.metadata?._migrated)) {
                await db.docs.create({ projectId: s.projectId, parentId: null, type: 'document', title: `[历史] ${s.title||'未命名故事'}`, content: typeof s.fullContent==='string' ? s.fullContent : JSON.stringify(s.fullContent,null,2), metadata: { _migrated: true, sourceTable: 'ai_story', originalId: s.id } });
                const chars = await db.ai.characters.getAll(s.id);
                if (chars.length) {
                  const charMd = chars.map((c:any) => `## ${c.name} (${c.role})\n- 年龄: ${c.age}\n- 外貌: ${c.appearance}\n- 性格: ${c.personality}\n- 定妆照: ${c.portraitPrompt}`).join('\n\n');
                  await db.docs.create({ projectId: s.projectId, parentId: null, type: 'document', title: `[历史] 角色: ${s.title||''}`, content: charMd, metadata: { _migrated: true, sourceTable: 'ai_character', storyId: s.id } });
                }
              }
            }
          } catch {}
        }, 1000);
      } catch(e) { console.error('Load failed:', e); }
      setLoaded(true);
    })();
  }, []);

  // Persist active project
  useEffect(() => { if (activeId && loaded) db.meta.set('activeProjectId', activeId).catch(()=>{}); }, [activeId, loaded]);

  // Auto-save
  const saveItems = useCallback(debounce(async (type: string, items: any[], toRow: (item:any)=>any) => {
    for (const item of items) {
      try {
        if (type === 'projects') await db.projects.update(item.id, item);
        if (type === 'sequences') await db.sequences.update(item.id, toRow(item));
        if (type === 'shots') await db.shots.update(item.id, toRow(item));
      } catch { /* will be created by explicit create calls */ }
    }
  }, 600), []);

  const toSeqRow = (s: any) => ({...s, videoSegments: JSON.stringify(s.videoSegments||[])});
  const toShotRow = (s: any) => ({...s, variants: JSON.stringify(s.variants||[]), tags: JSON.stringify(s.tags||[]), metadata: JSON.stringify(s.metadata||{})});

  useEffect(() => { if (loaded) { saveItems('shots', shots, toShotRow); saveItems('sequences', sequences, toSeqRow); } }, [shots, sequences, loaded]);
  useEffect(() => { if (loaded) saveItems('projects', projects, (p:any)=>({...p,aiConfig:JSON.stringify(p.aiConfig||{})})); }, [projects, loaded]);

  // Auto-select sequence
  useEffect(() => {
    const seqs = sequences.filter(s => s.projectId === activeId);
    setActiveSeqId(seqs.length > 0 ? seqs[0].id : null);
  }, [activeId]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeId), [projects, activeId]);
  const projectSequences = useMemo(() => sequences.filter(s => s.projectId === activeId), [sequences, activeId]);
  const sortedProjectShots = useMemo(() => {
    const list = shots.filter(s => s.projectId === activeId);
    const seqOrder: Record<string,number> = {};
    projectSequences.forEach((s,i) => { seqOrder[s.id] = i; });
    list.sort((a,b) => { const sa=seqOrder[a.sequenceId]??999; const sb=seqOrder[b.sequenceId]??999; if(sa!==sb) return sa-sb; return (a.orderIndex??0)-(b.orderIndex??0); });
    return list;
  }, [shots, activeId, projectSequences]);
  const shotGlobalNum = useMemo(() => {
    const map: Record<string,number> = {};
    sortedProjectShots.forEach((s,i) => { map[s.id] = i+1; });
    return map;
  }, [sortedProjectShots]);
  const projectShots = useMemo(() =>
    activeSeqId ? sortedProjectShots.filter(s => s.sequenceId === activeSeqId) : sortedProjectShots,
    [sortedProjectShots, activeSeqId]
  );
  const shotsBySeq = useMemo(() => {
    const map: Record<string,Shot[]> = {};
    shots.filter(s => s.projectId === activeId).forEach(s => {
      const sid = s.sequenceId || '__none__';
      if (!map[sid]) map[sid] = [];
      map[sid].push(s);
    });
    return map;
  }, [shots, activeId]);

  // ── Project CRUD ──
  const createProject = useCallback(async (name: string) => {
    try {
      const p = await db.projects.create(name);
      if (!p?.id) { console.error('createProject failed'); return; }
      setProjects(prev => [...prev, p]);
      setActiveId(p.id);
      // Show onboarding on first project creation
      if (projects.length === 0) localStorage.setItem('onboard-first-project', '');
      const seq = await db.sequences.create({ projectId: p.id, name: 'Sequence 01', orderIndex: 0 });
      if (seq?.id) {
        const ns = normSeq(seq);
        setSequences(prev => [...prev, ns]);
        setActiveSeqId(ns.id);
      }
      const draft = await db.dts.create({ projectId: p.id, name:'草稿V1', currentStep:1, confirmedAssets:{}, conversation:[] });
      if (draft?.id) setSelectedDraftId(draft.id);
    } catch(e) { console.error('createProject error:', e); }
  }, []);
  const renameProject = useCallback((id: string, name: string) => {
    setProjects(prev => prev.map(p => p.id===id ? {...p, name, updatedAt: new Date().toISOString()} : p));
  }, []);
  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setSequences(prev => prev.filter(s => s.projectId !== id));
    setShots(prev => prev.filter(s => s.projectId !== id));
    if (activeId === id) setActiveId(null);
    db.projects.delete(id).catch(()=>{});
  }, [activeId]);

  // ── Sequence CRUD ──
  const createSequence = useCallback((name: string) => {
    if (!activeId) return;
    db.sequences.create({ projectId: activeId, name, orderIndex: sequences.filter(s=>s.projectId===activeId).length })
      .then(s => { if(s?.id){ setSequences(prev => [...prev, normSeq(s)]); setActiveSeqId(s.id); } });
  }, [activeId, sequences]);
  // Document → Storyboard import
  const importDocToShots = useCallback(async (doc: any) => {
    if (!activeId) return;
    // Create a new sequence for the imported shots
    const seq = normSeq(await db.sequences.create({ projectId: activeId, name: doc.title || '导入序列', orderIndex: sequences.filter(s=>s.projectId===activeId).length }));
    setSequences(prev => [...prev, seq]);
    // Parse doc content into shots
    const content = doc.content || '';
    let shots: any[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // JSON array: each item is a shot
        shots = parsed.map((item: any, i: number) => ({
          title: item.name || item.title || `Shot ${i+1}`,
          description: item.description || item.sceneDescription || item.summary || '',
          startTime: item.startTime || '', endTime: '', duration: item.duration || '',
          tags: item.tags || []
        }));
      } else if (parsed.chapterOutline) {
        // Story JSON: use chapter outline
        shots = (parsed.chapterOutline || []).map((ch: any, i: number) => ({
          title: ch.title || `Chapter ${ch.chapter}`,
          description: ch.summary || '',
          startTime: '', endTime: '', duration: '', tags: []
        }));
      }
    } catch {
      // Markdown: split by ## headings
      const sections = content.split(/^## /m).filter(Boolean);
      shots = sections.map((sec: string, i: number) => {
        const lines = sec.split('\n');
        return { title: lines[0].trim(), description: lines.slice(1).join('\n').trim(), startTime: '', endTime: '', duration: '', tags: [] };
      });
    }
    if (!shots.length) shots = [{ title: doc.title || '导入分镜', description: content.slice(0, 500), startTime: '', endTime: '', duration: '', tags: [] }];
    // Create all shots
    for (let i = 0; i < shots.length; i++) {
      const s = normShot(await db.shots.create({
        projectId: activeId, sequenceId: seq.id,
        title: shots[i].title, description: shots[i].description,
        startTime: shots[i].startTime, endTime: shots[i].endTime, duration: shots[i].duration,
        tags: shots[i].tags, variants: [], metadata: { sourceDocId: doc.id }, orderIndex: i
      }));
      setShots(prev => [...prev, s]);
    }
    // Switch to storyboard view
    setActiveSeqId(seq.id);
    setSelectedDraftId(null);
  }, [activeId, sequences]);

  const renameSequence = useCallback((id: string, name: string) => {
    setSequences(prev => prev.map(s => s.id===id ? {...s, name} : s));
  }, []);
  const deleteSequence = useCallback((id: string) => {
    setSequences(prev => prev.filter(s => s.id !== id));
    setShots(prev => prev.filter(s => s.sequenceId !== id));
    if (activeSeqId === id) setActiveSeqId(null);
    db.sequences.delete(id).catch(()=>{});
  }, [activeSeqId]);
  const updateSeqVideo = useCallback((updatedSeq: Sequence) => {
    setSequences(prev => prev.map(s => s.id === updatedSeq.id ? updatedSeq : s));
  }, []);

  // Normalize DB row (JSON strings → JS objects)
  // ── Shot CRUD ──
  const addImages = useCallback((files: File[]) => {
    if (!activeId) return;
    if (!activeSeqId) return;
    const sid = activeSeqId;
    const baseIdx = shots.filter(s => s.projectId===activeId && s.sequenceId===sid).length;
    files.forEach((f, i) => {
      db.shots.create({
        projectId: activeId, sequenceId: sid,
        variants: [{ id: uid(), label: '主方案', letter: '方案 A', isPrimary: true, tags: {} }],
        orderIndex: baseIdx + i
      } as any).then(s => {
        // Store image blob separately
        const v = s.variants[0];
        if (v) {
          (f as any)._variantId = v.id;
          db.blobs.save(v.id, f).then(() => {
            setShots(prev => prev.map(x => x.id===s.id ? {...x, variants: x.variants.map((v2:any) => v2.id===v.id ? {...v2, imageBlob: f} : v2)} : x));
          });
        }
        setShots(prev => [...prev, normShot(s)]);
      });
    });
  }, [activeId, activeSeqId, shots]);

  const addImagesToShot = useCallback((shotId: string, files: File[]) => {
    setShots(prev => prev.map(s => {
      if (s.id !== shotId) return s;
      const existing = s.variants || [];
      const newVariants = files.map((f, i) => ({ id: uid(), label: `方案 ${String.fromCharCode(65 + existing.length + i)}`, letter: `方案 ${String.fromCharCode(65 + existing.length + i)}`, isPrimary: false, tags: {} }));
      return { ...s, variants: [...existing, ...newVariants] };
    }));
  }, []);

  const updateShot = useCallback((updated: Shot) => {
    setShots(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, []);

  const deleteShot = useCallback((id: string) => {
    setShots(prev => {
      const target = prev.find(s => s.id === id);
      if (!target) return prev;
      const filtered = prev.filter(s => s.id !== id);
      const seqShots = filtered.filter(s => s.sequenceId===target.sequenceId && s.projectId===target.projectId);
      const otherShots = filtered.filter(s => !(s.sequenceId===target.sequenceId && s.projectId===target.projectId));
      seqShots.forEach((s,i) => s.orderIndex = i);
      return [...otherShots, ...seqShots];
    });
    db.shots.delete(id).catch(()=>{});
  }, []);

  const reorderShots = useCallback((fromShotId: string, toShotId: string) => {
    setShots(prev => {
      const src = prev.find(s => s.id === fromShotId);
      const tgt = prev.find(s => s.id === toShotId);
      if (!src || !tgt || src.sequenceId !== tgt.sequenceId) return prev;
      const seqShots = prev.filter(s => s.sequenceId===src.sequenceId && s.projectId===src.projectId);
      const otherShots = prev.filter(s => !(s.sequenceId===src.sequenceId && s.projectId===src.projectId));
      const fi = seqShots.findIndex(s => s.id===fromShotId);
      const ti = seqShots.findIndex(s => s.id===toShotId);
      const [moved] = seqShots.splice(fi, 1);
      seqShots.splice(ti, 0, moved);
      seqShots.forEach((s,i) => s.orderIndex = i);
      db.shots.reorder(fromShotId, toShotId).catch(()=>{});
      return [...otherShots, ...seqShots];
    });
  }, []);

  if (!loaded) return <div className="flex h-screen items-center justify-center text-[var(--muted)]">加载中...</div>;

  return (
    <ToastProvider>
      <div className="flex h-screen">
        <ProjectSidebar
          projects={projects} activeId={activeId} activeSeqId={activeSeqId}
          onSelect={(id) => { setActiveId(id); setSelectedDraftId(null); setViewMode('preview'); }}
          onCreate={createProject} onRename={renameProject} onDelete={deleteProject}
          onSelectDraft={(draftId) => { setSelectedDraftId(draftId); setToolMode(null); }}
          selectedDraftId={selectedDraftId}
          onSelectStoryboard={() => { setSelectedDraftId(null); setToolMode(null); setViewMode('storyboard'); }}
          onSelectImageTools={() => { setSelectedDraftId(null); setToolMode('image'); }}
          onSelectVideoTools={() => { setSelectedDraftId(null); setToolMode('video'); }}
          activeMode={selectedDraftId ? 'drafts' : toolMode ? `tools-${toolMode}` : viewMode}
          onShowWelcome={() => { setActiveId(null); setSelectedDraftId(null); setToolMode(null); }} />
        {!activeId && !toolMode && !selectedDraftId ? (
          <WelcomePage onCreateProject={() => { const n = prompt('项目名称：'); if (n?.trim()) createProject(n.trim()); }} />
        ) : toolMode && activeId ? (
          <ToolsPanel mode={toolMode} />
        ) : selectedDraftId && activeId ? (
          <DraftWorkspace projectId={activeId} draftId={selectedDraftId} onDraftCreated={(id)=>setSelectedDraftId(id)} />
        ) : activeId && viewMode === 'storyboard' ? (
          <>
            <div className="flex-1 flex flex-col min-w-0">
              {activeProject && (
                <SequenceTabs
                  sequences={projectSequences} activeSeqId={activeSeqId} onSelect={setActiveSeqId}
                  onCreate={createSequence} onRename={renameSequence} onDelete={deleteSequence}
                  shotsBySeq={shotsBySeq} />
              )}
              {activeSeqId && (() => {
                const as = projectSequences.find(s => s.id === activeSeqId);
                return as ? <VideoOutputPanel sequence={as} onUpdate={updateSeqVideo} /> : null;
              })()}
              <Toolbar project={activeProject} onUpload={addImages} shotCount={projectShots.length} activeSeqId={activeSeqId} onShowGuide={showStoryGuide} />
              <ShotBoard
                project={activeProject} shots={projectShots} shotGlobalNum={shotGlobalNum}
                onChangeShot={updateShot} onDeleteShot={deleteShot}
                onAddImages={addImages} onAddImagesToShot={addImagesToShot}
                navigatorRef={navigatorRef} activeSeqId={activeSeqId} />
            </div>
            {activeProject && (
              <Timeline shots={projectShots} sequences={projectSequences} activeSeqId={activeSeqId}
                scrollContainerRef={navigatorRef} onReorderShots={reorderShots} shotGlobalNum={shotGlobalNum} />
            )}
          </>
        ) : activeId ? (
          <PreviewPanel projectId={activeId} projectName={activeProject?.name || ''} />
        ) : null}
      </div>
      {showStoryOnboard && (
        <OnboardingGuide title="分镜管理" storageKey="onboard-storyboard" onClose={dismissStoryOnboard}
          buttons={[{label:'开始管理分镜',primary:true,onClick:dismissStoryOnboard}]}>
          <p>分镜模块是项目最终资产管理区。你可以在这里保存故事内容、角色设定、分镜规划、Prompt 资产、图片/视频素材。</p>
          <p>建议流程：文稿创作 → 工具生成素材 → 分镜统一管理。</p>
        </OnboardingGuide>
      )}
    </ToastProvider>
  );
}
