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
import AssetDrawer from './components/AssetDrawer';
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
  const normShot = (s: any): Shot => {
    const meta = safeObj((s as any).metadata);
    return {
      ...s,
      title: s.title || meta.purpose || '',
      shotNo: s.shotNo ?? meta.shotNo ?? 0,
      sceneId: s.sceneId ?? meta.sceneId,
      variants: safeArr(s.variants),
      tags: safeArr(s.tags),
      sourceAssets: safeArr(s.sourceAssets).length > 0 ? safeArr(s.sourceAssets) : [],
      videoOutputs: safeArr(s.videoOutputs).length > 0 ? safeArr(s.videoOutputs) : safeArr(meta.videoOutputs),
      shotType: s.shotType ?? meta.shotType ?? '',
      imagePrompt: s.imagePrompt ?? meta.imagePrompt ?? '',
      videoPrompt: s.videoPrompt ?? meta.videoPrompt ?? '',
      metadata: meta,
    };
  };

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
  const toShotRow = (s: any) => ({...s, variants: JSON.stringify(s.variants||[]), tags: JSON.stringify(s.tags||[]), metadata: JSON.stringify((s as any).metadata||{})});

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
        tags: shots[i].tags, sourceAssets: [], videoOutputs: [], orderIndex: i
      }));
      setShots(prev => [...prev, s]);
    }
    // Switch to storyboard view
    setActiveSeqId(seq.id);
    setSelectedDraftId(null);
  }, [activeId, sequences]);

  // ── Draft → Storyboard import (Sync Mode) ──
  const importShotsToStoryboard = useCallback(async (draftAssets: any) => {
    if (!activeId) return null;
    const { scenes, sequences: seqs, shots: draftShots } = draftAssets;
    if (!scenes?.length) return null;

    // Flatten all planned shots from sequences with global numbering + scene mapping
    // Build a flat list: [{shotNumber:1, scene:{name,id}, planned:{duration,shotType,purpose,transition}}, ...]
    const allPlanned: any[] = [];
    let gNum = 1;
    for (const g of (seqs || [])) {
      const scene = scenes[g.sceneIndex];
      if (!scene) continue;
      for (const sh of (g.shots || [])) {
        allPlanned.push({ ...sh, shotNumber: gNum++, scene });
      }
    }

    // Only import scenes that have shots
    const sceneHasShots = new Set<number>();
    for (const p of allPlanned) sceneHasShots.add(scenes.indexOf(p.scene));

    // Step 1: Sync Sequences — only for scenes with shots, ordered by scene index
    const sceneToSeqId: Record<string, string> = {};
    let seqCount = 0;
    for (let si = 0; si < scenes.length; si++) {
      if (!sceneHasShots.has(si)) continue; // skip empty scenes
      const existing = sequences.find(s => s.projectId === activeId && s.name === scenes[si].name);
      if (existing) {
        sceneToSeqId[scenes[si].id || String(si)] = existing.id;
        // Update orderIndex to match scene order
        if (existing.orderIndex !== si) await db.sequences.update(existing.id, { orderIndex: si });
      } else {
        const seq = await db.sequences.create({ projectId: activeId, name: scenes[si].name, orderIndex: si });
        if (seq?.id) {
          const ns = normSeq(seq);
          setSequences(prev => [...prev, ns]);
          sceneToSeqId[scenes[si].id || String(si)] = ns.id;
          seqCount++;
        }
      }
    }

    // Step 2: Build draft shot lookup by sceneId + planned shotNumber
    const draftShotMap = new Map<string, any>();
    for (const ds of (draftShots || [])) {
      // Match draft shot to planned shot by finding the planned entry with matching scene+shotNumber
      for (const p of allPlanned) {
        if (p.shotNumber === ds.shotNumber && p.scene?.name === ds.sceneName) {
          draftShotMap.set(`${p.scene?.id}_${p.shotNumber}`, ds);
          break;
        }
      }
    }

    // Step 3: Sync Shots — match by sceneId + shotNumber
    const projectShots = shots.filter(s => s.projectId === activeId);
    let shotCreated = 0, shotUpdated = 0;
    let preservedVideos = 0, preservedImages = 0;

    for (const planned of allPlanned) {
      const sceneIdx = scenes.indexOf(planned.scene);
      const sceneId = planned.scene?.id || String(sceneIdx);
      const seqId = sceneToSeqId[sceneId];
      if (!seqId) continue;

      const ds = draftShotMap.get(`${sceneId}_${planned.shotNumber}`);
      if (!ds) continue; // No draft data for this planned shot

      // Find existing shot by sceneId + shotNumber (stored in metadata)
      const existing = projectShots.find(s => {
        const m = safeObj((s as any).metadata);
        return (m.sceneId === sceneId || m.sceneId === String(sceneIdx)) && (m.shotNo || s.shotNo) === planned.shotNumber;
      });

      const existingMeta = safeObj((existing || {} as any).metadata);
      const newMeta = {
        ...existingMeta,
        sceneId, shotNo: planned.shotNumber,
        duration: planned.duration || ds.duration || existingMeta.duration || '',
        purpose: planned.purpose || existingMeta.purpose || '',
        shotType: planned.shotType || existingMeta.shotType || '',
        generationMode: ds.generationMode || existingMeta.generationMode || '',
        imagePrompt: (ds.imagePrompts?.[0]?.prompt || ds.imagePrompt || existingMeta.imagePrompt || ''),
        videoPrompt: (ds.videoPrompt || existingMeta.videoPrompt || ''),
        importedFrom: 'draft', importedAt: new Date().toISOString()
      };

      if (existing) {
        // Update metadata/Prompts, PRESERVE media assets
        const updatedShot = {
          ...existing,
          title: '',
          description: ds.visualContent || existing.description,
          duration: planned.duration || ds.duration || existing.duration,
          shotType: planned.shotType || ds.shotType || existing.shotType,
          atmosphere: ds.atmosphere || existing.atmosphere,
          composition: ds.composition || existing.composition,
          cameraMovement: ds.cameraMovement || existing.cameraMovement,
          sequenceId: seqId,
          shotNo: planned.shotNumber,
          metadata: newMeta,
          // PRESERVE media
          sourceAssets: existing.sourceAssets || [],
          videoOutputs: existing.videoOutputs || [],
        };
        await db.shots.update(existing.id, updatedShot);
        setShots(prev => prev.map(s => s.id === existing.id ? updatedShot : s));
        preservedVideos += (existing.videoOutputs || []).length;
        preservedImages += (existing.sourceAssets || []).length;
        shotUpdated++;
      } else {
        // Create new shot
        const newShot = {
          projectId: activeId, sequenceId: seqId,
          shotNo: planned.shotNumber,
          title: '',
          description: ds.visualContent || '',
          duration: planned.duration || ds.duration || '5s',
          shotType: planned.shotType || ds.shotType || '',
          atmosphere: ds.atmosphere || '',
          composition: ds.composition || '',
          cameraMovement: ds.cameraMovement || '',
          sourceAssets: [], videoOutputs: [],
          tags: [], metadata: newMeta,
          orderIndex: planned.shotNumber - 1,
        };
        const s = await db.shots.create(newShot);
        if (s?.id) {
          setShots(prev => [...prev, normShot(s)]);
          shotCreated++;
        }
      }
    }

    // Reorder all sequences & shots to match scene order
    const seqOrder = Object.entries(sceneToSeqId);
    for (let si = 0; si < seqOrder.length; si++) {
      const [sId, seqId] = seqOrder[si];
      await db.sequences.update(seqId, { orderIndex: si });
      // Reorder shots within this sequence by shotNo
      const seqShots = shots.filter(s => s.projectId === activeId && s.sequenceId === seqId);
      seqShots.sort((a, b) => (a.shotNo || 0) - (b.shotNo || 0));
      for (let shi = 0; shi < seqShots.length; shi++) {
        if (seqShots[shi].orderIndex !== shi) {
          await db.shots.update(seqShots[shi].id, { orderIndex: shi } as any);
        }
      }
    }
    // Refresh state
    const freshSeqs = (await db.sequences.getAll()).map(normSeq);
    const freshShots = (await db.shots.getAll()).map(normShot);
    setSequences(freshSeqs);
    setShots(freshShots);

    return { sequences: seqCount, shotsCreated: shotCreated, shotsUpdated: shotUpdated, preservedVideos, preservedImages };
  }, [activeId, sequences, shots]);

  const renameSequence = useCallback((id: string, name: string) => {
    setSequences(prev => prev.map(s => s.id===id ? {...s, name} : s));
  }, []);
  const deleteSequence = useCallback((id: string) => {
    setSequences(prev => prev.filter(s => s.id !== id));
    setShots(prev => prev.filter(s => s.sequenceId !== id));
    if (activeSeqId === id) setActiveSeqId(null);
    db.sequences.delete(id).catch(()=>{});
  }, [activeSeqId]);
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
        const v = s.variants?.[0];
        if (v) {
          (f as any)._variantId = v.id;
          db.blobs.save(v.id, f).then(() => {
            setShots(prev => prev.map(x => x.id===s.id ? {...x, variants: (x.variants||[]).map((v2:any) => v2.id===v.id ? {...v2, imageBlob: f} : v2)} : x));
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
      <AssetDrawer projectId={activeId} />
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
        {/* ToolsPanel — always mounted, never unmount */}
        <div style={toolMode&&activeId?{flex:1,display:'flex',flexDirection:'column'}:{position:'absolute',inset:0,visibility:'hidden',opacity:0,pointerEvents:'none',overflow:'hidden'}}><ToolsPanel key="tools-panel" mode={toolMode||'image'} /></div>
        {/* All other views */}
        <div style={toolMode?{position:'absolute',inset:0,visibility:'hidden',opacity:0,pointerEvents:'none',overflow:'hidden'}:{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        {!activeId && !selectedDraftId ? (
          <WelcomePage onCreateProject={() => { const n = `项目 ${String(projects.length + 1).padStart(2,'0')}`; createProject(n); }} />
        ) : selectedDraftId && activeId ? (
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}><DraftWorkspace projectId={activeId} draftId={selectedDraftId} onDraftCreated={(id)=>setSelectedDraftId(id)} onImportToStoryboard={importShotsToStoryboard} /></div>
        ) : activeId && viewMode === 'storyboard' ? (
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <Toolbar project={activeProject} onUpload={addImages} shotCount={projectShots.length} activeSeqId={activeSeqId} onShowGuide={showStoryGuide} />
              {activeProject && (
                <SequenceTabs
                  sequences={projectSequences} activeSeqId={activeSeqId} onSelect={setActiveSeqId}
                  onCreate={createSequence} onRename={renameSequence} onDelete={deleteSequence}
                  shotsBySeq={shotsBySeq} />
              )}
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
          </div>
        ) : toolMode && activeId ? (
          <ToolsPanel mode={toolMode} />
        ) : activeId ? (
          <PreviewPanel projectId={activeId} projectName={activeProject?.name || ''} />
        ) : null}
        </div>
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
