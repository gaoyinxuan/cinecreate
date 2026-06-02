import React, { useRef } from 'react';
import { Project } from '../types';

interface Props {
  project: Project | undefined;
  onUpload: (files: File[]) => void;
  shotCount: number;
  activeSeqId: string | null;
}
export default function Toolbar({ project, onUpload, shotCount, activeSeqId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!project) return <div className="flex items-center px-6 py-2.5 bg-[var(--bg2)] border-b border-[var(--border)] text-xs text-[var(--muted)]">请选择一个项目</div>;

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 bg-[var(--bg2)] border-b border-[var(--border)] flex-wrap">
      <span className="text-base font-bold text-[var(--text)] min-w-[120px]">{project.name}</span>
      <span className="text-xs text-[var(--muted)]">{shotCount} 个分镜</span>
      <div className="flex-1" />
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) { onUpload(Array.from(e.target.files)); e.target.value = ''; } }} />
      {activeSeqId && (
        <button className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold rounded-lg"
          onClick={() => fileRef.current?.click()}>📷 上传图片</button>
      )}
    </div>
  );
}
