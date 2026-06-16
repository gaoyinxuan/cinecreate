import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shot, Sequence } from '../types';

interface Props {
  shots: Shot[]; sequences: Sequence[]; activeSeqId: string | null;
  scrollContainerRef: any; onReorderShots: (fromId: string, toId: string) => void;
  shotGlobalNum: Record<string, number>;
}
export default function Timeline({ shots, sequences, activeSeqId, scrollContainerRef, onReorderShots, shotGlobalNum }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [dragShotId, setDragShotId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [insertPos, setInsertPos] = useState<'before'|'after'>('before');
  const [landedId, setLandedId] = useState<string | null>(null);
  const [collapsedSeqs, setCollapsedSeqs] = useState<Record<string,boolean>>({});
  const visibleRef = useRef<Record<string,any>>({});
  const suppressRef = useRef(false);
  const timerRef = useRef<any>(null);
  const prevShotsRef = useRef(shots);

  useEffect(() => { setActiveShotId(null); visibleRef.current = {}; }, [shots]);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container || !shots.length) return;
    const handle = () => {
      if (suppressRef.current) return;
      const entries = Object.values(visibleRef.current) as any[];
      let best: any = null, bestR = 0;
      for (const e of entries) { if (e.isIntersecting && e.intersectionRatio > bestR) { bestR = e.intersectionRatio; best = e; } }
      if (best) { const id = (best.target as HTMLElement).dataset.shotId; setActiveShotId((p:any) => p===id ? p : id); }
    };
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) { visibleRef.current[(e.target as HTMLElement).dataset.shotId || ''] = e; }
      handle();
    }, { root: container, threshold: [0,0.25,0.5,0.75,1] });
    shots.forEach(s => { const el = document.getElementById(`shot-${s.id}`); if (el) { (el as HTMLElement).dataset.shotId = s.id; obs.observe(el); } });
    const onScrollEnd = () => { suppressRef.current = false; handle(); };
    container.addEventListener('scrollend', onScrollEnd);
    return () => { obs.disconnect(); container.removeEventListener('scrollend', onScrollEnd); };
  }, [shots, scrollContainerRef]);

  const jumpTo = useCallback((id: string) => {
    suppressRef.current = true; setActiveShotId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`shot-${id}`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => { suppressRef.current = false; }, 600); }
      else suppressRef.current = false;
    });
  }, []);

  if (!shots.length) return null;
  if (collapsed) return <div className="w-8 bg-[var(--bg2)] border-l border-[var(--border)] flex items-center justify-center cursor-pointer hover:bg-[#1a1a32] shrink-0" onClick={()=>setCollapsed(false)}><span className="text-xs text-[var(--muted)]" style={{writingMode:'vertical-rl'}}>时间轴</span></div>;

  const seqMap: Record<string,Sequence> = {}; sequences.forEach(s => { seqMap[s.id] = s; });
  const groups: { seq: Sequence|undefined; seqId: string; shots: Shot[] }[] = [];
  if (!activeSeqId) {
    const bySeq: Record<string,Shot[]> = {};
    shots.forEach(s => { const sid = s.sequenceId || '__none__'; if (!bySeq[sid]) bySeq[sid] = []; bySeq[sid].push(s); });
    for (const [sid, shts] of Object.entries(bySeq)) groups.push({ seq: seqMap[sid], seqId: sid, shots: shts });
    groups.sort((a,b) => (a.seq?.orderIndex??999) - (b.seq?.orderIndex??999));
  } else groups.push({ seq: seqMap[activeSeqId], seqId: activeSeqId, shots });

  const clearDrag = () => { setDragShotId(null); setDragOverId(null); setInsertPos('before'); };
  const handleDrop = (targetId: string) => {
    if (dragShotId && dragShotId !== targetId) {
      const src = shots.find(s=>s.id===dragShotId), tgt = shots.find(s=>s.id===targetId);
      if (src && tgt && src.sequenceId===tgt.sequenceId) { onReorderShots(dragShotId, targetId); setLandedId(dragShotId); setTimeout(()=>setLandedId(null), 600); }
    }
    clearDrag();
  };

  return (
    <div className="w-48 bg-[var(--bg2)] border-l border-[var(--border)] flex flex-col h-full shrink-0 overflow-hidden">
      <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex items-center gap-3 px-6 py-2.5">
        <span className="text-base font-bold text-[var(--text)]">时间轴</span>
        <div className="flex-1" />
        <button className="text-xs text-[var(--muted)] hover:text-[var(--text2)]" onClick={()=>setCollapsed(true)}>◀</button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {(groups||[]).map(group => {
          const seq = group.seq; const isCollapsed = collapsedSeqs[group.seqId];
          return (<div key={group.seqId} className="mb-1">
            {!activeSeqId && seq && (
              <div className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-white/[0.03] rounded text-xs" onClick={()=>setCollapsedSeqs(p=>({...p,[group.seqId]:!p[group.seqId]}))}>
                <span className="text-xs">{isCollapsed?'▶':'▼'}</span>
                <span className="text-[var(--text2)] font-medium truncate flex-1">{seq.name}</span>
                <span className="text-xs text-[var(--muted)]">{group.shots.length}</span>
              </div>
            )}
            {(!activeSeqId && seq && isCollapsed) ? null : (group.shots||[]).map((s, li) => {
              const isActive = s.id === activeShotId;
              const isDragging = s.id === dragShotId;
              const isOver = s.id === dragOverId;
              return (
                <div key={s.id}
                  className={`relative flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-200 ${isActive?'bg-[var(--accent-solid)]/15 border border-gold-400/20':'hover:bg-white/[0.04] border border-transparent'} ${isDragging?'tl-dragging':''} ${landedId===s.id?'tl-landed':''}`}
                  style={{cursor:isDragging?'grabbing':'pointer'}}
                  draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',s.id);setDragShotId(s.id);setDragOverId(null);}}
                  onDragOver={e=>{e.preventDefault();if(s.id!==dragShotId){setInsertPos(e.clientY<(e.currentTarget as HTMLElement).getBoundingClientRect().top+(e.currentTarget as HTMLElement).getBoundingClientRect().height/2?'before':'after');setDragOverId(s.id);}}}
                  onDragLeave={()=>setDragOverId(null)}
                  onDrop={e=>{e.preventDefault();handleDrop(s.id);}}
                  onDragEnd={clearDrag}
                  onClick={()=>jumpTo(s.id)}>
                  {isOver && insertPos==='before' && <div className="absolute left-2 right-2 top-0 h-[3px] bg-[#a78bfa] rounded-sm z-10" style={{transform:'translateY(-3px)',boxShadow:'0 0 6px rgba(124,111,247,0.4)'}} />}
                  {isOver && insertPos==='after' && <div className="absolute left-2 right-2 bottom-0 h-[3px] bg-[#a78bfa] rounded-sm z-10" style={{transform:'translateY(6px)',boxShadow:'0 0 6px rgba(124,111,247,0.4)'}} />}
                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isActive?'bg-[var(--accent-solid)] text-white':'bg-[var(--border)] text-[var(--dim)]'}`}>{shotGlobalNum[s.id] || li+1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[var(--text2)] truncate">{s.title || `Shot ${shotGlobalNum[s.id] || li+1}`}</div>
                    <div className="text-[10px] text-[var(--muted)]">{[s.shotType, s.duration].filter(Boolean).join(' · ') || '--'}</div>
                  </div>
                </div>
              );
            })}
          </div>);
        })}
      </div>
    </div>
  );
}
