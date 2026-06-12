import React, { useState, useRef, useCallback, useEffect } from 'react';
import { db } from '../services/dbService';

interface Props { projectId: string; projectName: string; }

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function PreviewPanel({ projectId, projectName }: Props) {
  const [video, setVideo] = useState<{name:string; url:string; blobId:string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load saved video for this project on mount / project switch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const meta = await db.meta.get(`preview_${projectId}`);
        if (meta && !cancelled) {
          const blob = await db.blobs.load(meta.blobId);
          if (blob && !cancelled) {
            if (video) URL.revokeObjectURL(video.url);
            setVideo({ name: meta.name, url: URL.createObjectURL(blob), blobId: meta.blobId });
          }
        } else {
          if (video) { URL.revokeObjectURL(video.url); }
          setVideo(null);
        }
      } catch {} finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('video/')) return;
    // Cleanup old
    if (video) {
      URL.revokeObjectURL(video.url);
      db.blobs.delete(video.blobId).catch(()=>{});
    }
    const blobId = uid();
    try {
      await db.blobs.save(blobId, f);
      const meta = { blobId, name: f.name };
      await db.meta.set(`preview_${projectId}`, meta);
      setVideo({ name: f.name, url: URL.createObjectURL(f), blobId });
    } catch { /* fallback: keep in-memory only */ }
  }, [video, projectId]);

  const removeVideo = useCallback(async () => {
    if (!video) return;
    try {
      await db.blobs.delete(video.blobId);
      await db.meta.set(`preview_${projectId}`, null);
    } catch {}
    URL.revokeObjectURL(video.url);
    setVideo(null);
  }, [video, projectId]);

  const dropZone = (
    <div
      className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${dragOver ? 'border-[var(--accent-text)] bg-[var(--accent-bg)]' : 'border-[var(--border2)] hover:border-[var(--accent-text)]/40'}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => fileRef.current?.click()}
    >
      <input ref={fileRef} type="file" accept="video/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <div className="text-3xl mb-3 opacity-30">🎥</div>
      <div className="text-sm text-[var(--text2)] mb-1">拖拽视频到此处</div>
      <div className="text-xs text-[var(--muted)]">或点击上传 · MP4 / WebM</div>
    </div>
  );

  if (loading) return <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">加载中...</div>;

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg)] p-8">
      <div className="text-sm text-[var(--text)] font-semibold mb-6">成果预览</div>
      {video ? (
        <div className="w-full max-w-3xl">
          <div className="bg-black rounded-xl overflow-hidden shadow-lg">
            <video src={video.url} controls className="w-full max-h-[70vh]" />
          </div>
          <div className="flex items-center justify-between mt-4 px-2">
            <span className="text-sm text-[var(--text2)] truncate flex-1">{video.name}</span>
            <button className="text-xs text-[var(--muted)] hover:text-red-400 border border-[var(--border)] hover:border-red-400/30 rounded-lg px-3 py-1.5 transition-colors"
              onClick={removeVideo}>删除视频</button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xl">{dropZone}</div>
      )}
    </div>
  );
}
