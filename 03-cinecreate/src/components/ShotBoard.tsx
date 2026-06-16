import React, { useEffect, useRef } from 'react';
import { Project, Shot } from '../types';
import ShotCard from './ShotCard';

let pasteTargetRef: any = { current: null };

interface Props {
  project: Project | undefined; shots: Shot[];
  shotGlobalNum: Record<string, number>;
  onChangeShot: (s: Shot) => void; onDeleteShot: (id: string) => void;
  onAddImages: (files: File[]) => void;
  onAddImagesToShot?: (shotId: string, files: File[]) => void;
  onCreateEmptyShot?: () => void;
  navigatorRef: any; activeSeqId: string | null;
}
export default function ShotBoard({ project, shots, shotGlobalNum, onChangeShot, onDeleteShot, onAddImages, onAddImagesToShot, onCreateEmptyShot, navigatorRef, activeSeqId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (navigatorRef) navigatorRef.current = scrollRef.current; }, [navigatorRef, shots]);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const items = e.clipboardData?.items; if (!items) return;
      const files: File[] = [];
      for (const item of items) { if (item.type.startsWith('image/')) files.push(item.getAsFile()!); }
      if (!files.length) return;
      e.preventDefault();
      const target = pasteTargetRef.current;
      if (target?.type === 'variant' && target.shotId && onAddImagesToShot) onAddImagesToShot(target.shotId, files);
      // Paste only works for variant targets, NOT for creating new shots
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [onAddImages, onAddImagesToShot]);

  if (!project) {
    return <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="text-5xl mb-4 opacity-30">📂</div><div className="text-lg text-[var(--dim)] mb-1">未选择项目</div><div className="text-sm text-[var(--muted)]">在左侧创建或选择项目</div></div></div>;
  }

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 bg-[var(--bg)]">
      {!activeSeqId ? (
        shots.length === 0 ? (
          <div className="text-center py-16"><div className="text-5xl mb-4 opacity-30">📂</div><div className="text-sm text-[var(--text3)] mb-1">选择序列查看分镜</div><div className="text-xs text-[var(--muted)]">在上方标签栏点击序列名</div></div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4 pb-16">
            {(shots||[]).map((s, i) => <ShotCard key={s.id} shot={s} shotNo={shotGlobalNum[s.id] || i + 1} onChange={onChangeShot} onDelete={() => onDeleteShot(s.id)} />)}
          </div>
        )
      ) : shots.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 opacity-30">🎬</div>
          <div className="text-sm text-[var(--text3)] mb-4">暂无分镜</div>
          {onCreateEmptyShot && (
            <button className="px-4 py-2 text-xs bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-lg transition-colors"
              onClick={onCreateEmptyShot}>+ 创建空镜头</button>
          )}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-4 pb-16">
          {shots.map((s, i) => <ShotCard key={s.id} shot={s} shotNo={shotGlobalNum[s.id]} onChange={onChangeShot} onDelete={() => onDeleteShot(s.id)} />)}
          {onCreateEmptyShot && (
            <div className="text-center pt-2">
              <button className="px-4 py-2 text-xs bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-lg transition-colors"
                onClick={onCreateEmptyShot}>+ 创建空镜头</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
