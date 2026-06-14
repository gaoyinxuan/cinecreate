import React, { useState, useCallback, useRef } from 'react';
import { Sequence, VideoSegment } from '../types';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

interface Props { sequence: Sequence; onUpdate: (s: Sequence) => void; }
export default function VideoOutputPanel({ sequence, onUpdate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const segments = sequence.videoSegments || [];

  const addSegment = useCallback((files: File[]) => {
    const videos = files.filter(f => f.type.match(/^video\/(mp4|webm)$/));
    if (!videos.length) return;
    const news: VideoSegment[] = videos.map(v => ({ id: uid(), videoBlob: v, name: v.name, format: v.type, duration: '', exportDate: new Date().toISOString(), versionNote: '' }));
    onUpdate({ ...sequence, videoSegments: [...segments, ...news] });
  }, [sequence, segments, onUpdate]);

  return (
    <div className="border-b border-[var(--border)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-[var(--dim)] font-semibold uppercase">视频片段</span>
        <span className="text-xs text-[var(--muted)]">{segments.length ? `${segments.length} 个片段` : '未导入'}</span>
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept="video/mp4,video/webm" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) { addSegment(Array.from(e.target.files)); e.target.value = ''; } }} />
        <button className="text-xs px-2 py-1 text-[var(--text3)] hover:text-accent-500 hover:bg-white/[0.04] rounded" onClick={()=>fileRef.current?.click()}>+ 添加片段</button>
        <button className="text-[var(--muted)] hover:text-[var(--text2)] text-xs" onClick={()=>setCollapsed(!collapsed)}>{collapsed?'展开 ▼':'收起 ▲'}</button>
      </div>
      {!collapsed && segments.length === 0 && (
        <div className="border-2 border-dashed border-[var(--border2)] hover:border-accent-400/50 rounded-xl p-8 text-center cursor-pointer"
          onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addSegment(Array.from(e.dataTransfer.files));}} onClick={()=>fileRef.current?.click()}>
          <div className="text-3xl mb-2 opacity-40">🎥</div>
          <div className="text-sm text-[var(--text3)]">导入视频片段</div>
          <div className="text-xs text-[var(--muted)] mt-1">拖拽 MP4/WebM 或点击上传</div>
        </div>
      )}
      {!collapsed && (segments||[]).map((seg, i) => {
        const isExp = expandedId === seg.id;
        const url = seg.videoBlob ? URL.createObjectURL(seg.videoBlob) : null;
        return (
          <div key={seg.id} className={`mt-3 ${i>0?'border-t border-white/[0.04] pt-3':''}`}>
            <div className="flex items-center gap-2 cursor-pointer" onClick={()=>setExpandedId(isExp?null:seg.id)}>
              <span className="text-xs text-[var(--muted)]">{isExp?'▼':'▶'}</span>
              <span className="text-xs text-[var(--text2)] truncate flex-1">{seg.name||`片段 ${i+1}`}</span>
              <span className="text-xs text-[var(--muted)]">{seg.duration||'--:--'}</span>
              <button className="text-xs text-[var(--muted)] hover:text-red-400" onClick={e=>{e.stopPropagation();onUpdate({...sequence,videoSegments:segments.filter(x=>x.id!==seg.id)});}}>✕</button>
            </div>
            {isExp && (
              <div className="flex gap-4 mt-2">
                <div className="shrink-0 w-[200px]">{url && <video src={url} controls className="w-full rounded-lg bg-black" onLoadedMetadata={e=>{const d=Math.round((e.target as HTMLVideoElement).duration);if(d&&!seg.duration){const mm=Math.floor(d/60);const ss=d%60;onUpdate({...sequence,videoSegments:segments.map(x=>x.id===seg.id?{...x,duration:`${mm}:${String(ss).padStart(2,'0')}`}:x)});}}} />}</div>
                <div className="flex-1 flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2"><span className="text-[var(--dim)] w-12">名称</span><input className="flex-1 bg-[var(--card2)] border border-[var(--border2)] rounded px-2 py-1 text-[var(--text)] outline-none focus:border-accent-400" value={seg.name} onChange={e=>onUpdate({...sequence,videoSegments:segments.map(x=>x.id===seg.id?{...x,name:e.target.value}:x)})} /></div>
                  <div className="flex items-center gap-2"><span className="text-[var(--dim)] w-12">格式</span><span className="text-[var(--text3)]">{seg.format||'--'}</span><span className="text-[var(--dim)] ml-4 w-12">时长</span><span className="text-[var(--text3)]">{seg.duration||'--'}</span></div>
                  <div className="flex items-start gap-2"><span className="text-[var(--dim)] w-12 shrink-0 pt-1">备注</span><textarea className="flex-1 bg-[var(--card2)] border border-[var(--border2)] rounded px-2 py-1 text-[var(--text)] outline-none focus:border-accent-400 resize-none h-10" placeholder="版本备注..." value={seg.versionNote} onChange={e=>onUpdate({...sequence,videoSegments:segments.map(x=>x.id===seg.id?{...x,versionNote:e.target.value}:x)})} /></div>
                  <span className="text-xs text-[var(--muted)]">{seg.exportDate?new Date(seg.exportDate).toLocaleString('zh-CN'):''}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
