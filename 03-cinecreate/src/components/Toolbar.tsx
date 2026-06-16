import React from 'react';
import { Project } from '../types';

interface Props {
  project: Project | undefined;
  onUpload: (files: File[]) => void;
  shotCount: number;
  activeSeqId: string | null;
  onShowGuide?: () => void;
}
export default function Toolbar({ project, shotCount, onShowGuide }: Props) {
  if (!project) return <div className="flex items-center px-6 py-2.5 bg-[var(--bg2)] border-b border-[var(--border)] text-xs text-[var(--muted)]">请选择一个项目</div>;

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 bg-[var(--bg2)] border-b border-[var(--border)]">
      {onShowGuide && <button className="text-xs w-5 h-5 rounded-full border border-[var(--border2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--dim)] flex items-center justify-center shrink-0" onClick={onShowGuide} title="查看引导">?</button>}
      <span className="text-base font-bold text-[var(--text)]">{project.name}</span>
      <span className="text-xs text-[var(--muted)]">{shotCount} 个分镜</span>
      <div className="flex-1" />
    </div>
  );
}
