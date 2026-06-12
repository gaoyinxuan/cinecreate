import React, { useRef } from 'react';
import { Project } from '../types';

interface Props {
  project: Project | undefined;
  onUpload: (files: File[]) => void;
  shotCount: number;
  activeSeqId: string | null;
  onShowGuide?: () => void;
}
export default function Toolbar({ project, onUpload, shotCount, activeSeqId, onShowGuide }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!project) return <div className="flex items-center px-6 py-2.5 bg-[var(--bg2)] border-b border-[var(--border)] text-xs text-[var(--muted)]">请选择一个项目</div>;

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 bg-[var(--bg2)] border-b border-[var(--border)] flex-wrap">
      {onShowGuide && <button className="text-xs w-5 h-5 rounded-full border border-[var(--border2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--dim)] flex items-center justify-center shrink-0" onClick={onShowGuide} title="查看引导">?</button>}
      <span className="text-base font-bold text-[var(--text)] min-w-[120px]">{project.name}</span>
      <span className="text-xs text-[var(--muted)]">{shotCount} 个分镜</span>
      <div className="flex-1" />
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) { onUpload(Array.from(e.target.files)); e.target.value = ''; } }} />
      {activeSeqId && (
        <button className="px-3 py-1.5 bg-gold-400 hover:bg-gold-500 text-white text-xs font-semibold rounded-lg"
          onClick={() => fileRef.current?.click()}>📷 上传图片</button>
      )}
    </div>
  );
}
