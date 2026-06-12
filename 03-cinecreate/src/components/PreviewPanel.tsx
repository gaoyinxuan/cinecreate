/**
 * PreviewPanel — project overview with video upload for final showcase.
 */
import React, { useState, useRef, useCallback } from 'react';

interface Props {
  projectName: string;
}

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

interface VideoItem {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  duration: string;
}

export default function PreviewPanel({ projectName }: Props) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addVideos = useCallback((files: File[]) => {
    const vids = files.filter(f => f.type.startsWith('video/'));
    const news: VideoItem[] = vids.map(v => ({
      id: uid(),
      name: v.name,
      blob: v,
      url: URL.createObjectURL(v),
      duration: '',
    }));
    setVideos(prev => [...prev, ...news]);
  }, []);

  const removeVideo = useCallback((id: string) => {
    setVideos(prev => {
      const item = prev.find(v => v.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter(v => v.id !== id);
    });
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg)] p-8 overflow-y-auto">
      <div className="text-center max-w-2xl w-full">
        {/* Header */}
        <svg width="48" height="48" viewBox="0 0 256 256" fill="none" className="mx-auto mb-5 text-[var(--accent-solid)] opacity-30">
          <circle cx="128" cy="128" r="72" stroke="currentColor" stroke-width="34" fill="none" stroke-dasharray="350 103" stroke-dashoffset="25" stroke-linecap="round"/>
          <path d="M148 112L148 144L174 128Z" fill="currentColor"/>
        </svg>
        <h2 className="text-lg font-bold text-[var(--text)] mb-1">{projectName}</h2>
        <p className="text-xs text-[var(--dim)] mb-10">成品展示</p>

        {/* Upload zone */}
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${dragOver ? 'border-[var(--accent-text)] bg-[var(--accent-bg)]' : videos.length ? 'border-[var(--border)]' : 'border-[var(--border2)] hover:border-[var(--accent-text)]/40'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); addVideos(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept="video/*" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) { addVideos(Array.from(e.target.files)); e.target.value = ''; } }} />
          <div className="text-3xl mb-3 opacity-40">🎥</div>
          <div className="text-sm text-[var(--text2)] font-medium mb-1">拖拽视频到此处上传</div>
          <div className="text-xs text-[var(--muted)]">或点击选择文件 · 支持 MP4 / WebM</div>
        </div>

        {/* Video list */}
        {videos.length > 0 && (
          <div className="mt-8 text-left">
            <div className="text-xs text-[var(--muted)] font-medium mb-3 uppercase tracking-wider">已上传 {videos.length} 个视频</div>
            <div className="space-y-3">
              {videos.map(v => (
                <div key={v.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="flex gap-4 p-3">
                    <div className="shrink-0 w-[200px] aspect-video bg-black rounded-lg overflow-hidden">
                      <video src={v.url} className="w-full h-full object-contain"
                        onLoadedMetadata={e => {
                          const d = Math.round((e.target as HTMLVideoElement).duration);
                          if (d && !v.duration) {
                            const mm = Math.floor(d / 60);
                            const ss = String(d % 60).padStart(2, '0');
                            setVideos(prev => prev.map(x => x.id === v.id ? { ...x, duration: `${mm}:${ss}` } : x));
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="text-sm font-medium text-[var(--text)] truncate">{v.name}</div>
                      <div className="text-xs text-[var(--text3)] mt-1">{v.duration || '--:--'}</div>
                    </div>
                    <button className="shrink-0 text-[var(--muted)] hover:text-red-400 text-sm self-center"
                      onClick={e => { e.stopPropagation(); removeVideo(v.id); }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
