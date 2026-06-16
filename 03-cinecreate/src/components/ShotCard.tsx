import React, { useState, useRef, useEffect } from 'react';
import { Shot } from '../types';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const api = (window as any).electronAPI;

interface Props { shot: Shot; shotNo: number; onChange: (s: Shot) => void; onDelete: () => void; }
export default function ShotCard({ shot, shotNo, onChange, onDelete }: Props) {
  const [hydrated, setHydrated] = useState(false);

  // Load blobs from blobIds on mount (for sample projects / DB-loaded shots)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updated = { ...shot };
      let changed = false;
      // Load source asset blobs
      if (updated.sourceAssets?.length) {
        const loaded = await Promise.all(updated.sourceAssets.map(async a => {
          if (a.blobId && !a.blob && api) {
            try { const buf = await api.loadBlob(a.blobId); if (buf && !cancelled) return { ...a, blob: new Blob([buf]) }; } catch {}
          }
          return a;
        }));
        if (!cancelled) { updated.sourceAssets = loaded; changed = true; }
      }
      // Load video output blobs
      if (updated.videoOutputs?.length) {
        const loaded = await Promise.all(updated.videoOutputs.map(async v => {
          if (v.blobId && !v.blob && api) {
            try { const buf = await api.loadBlob(v.blobId); if (buf && !cancelled) return { ...v, blob: new Blob([buf]) }; } catch {}
          }
          return v;
        }));
        if (!cancelled) { updated.videoOutputs = loaded; changed = true; }
      }
      if (changed && !cancelled) { onChange(updated); }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [shot.id]); // Only on mount / shot change

  const videos = shot.videoOutputs || [];
  const assets = shot.sourceAssets || [];
  const primaryVideo = videos.find(v => v.isPrimary) || videos[0];

  const firstFrames = assets.filter(a => a.type === 'firstFrame');
  const lastFrames = assets.filter(a => a.type === 'lastFrame');
  const primaryFirst = firstFrames[0];
  const primaryLast = lastFrames[0];

  const addVideo = (files: File[]) => {
    const vids = files.filter(f => f.type.match(/^video\/(mp4|webm)$/));
    if (!vids.length) return;
    const news = vids.map((v, i) => ({
      id: uid(), label: `方案 ${String.fromCharCode(65 + videos.length + i)}`,
      letter: String.fromCharCode(65 + videos.length + i), isPrimary: videos.length === 0 && i === 0,
      blob: v, createdAt: new Date().toISOString()
    }));
    onChange({ ...shot, videoOutputs: [...videos, ...news] });
  };

  const addFrame = (type: 'firstFrame' | 'lastFrame', file: File) => {
    const frames = assets.filter(a => a.type === type);
    const letter = String.fromCharCode(65 + frames.length);
    const item = { id: uid(), type, label: `${type === 'firstFrame' ? '首帧' : '尾帧'} ${letter}`, blob: file };
    onChange({ ...shot, sourceAssets: [...assets, item] });
  };

  const removeMedia = (id: string) => {
    const restVids = videos.filter(v => v.id !== id);
    if (restVids.length !== videos.length) {
      if (restVids.length > 0 && videos.find(v => v.id === id)?.isPrimary) restVids[0].isPrimary = true;
      return onChange({ ...shot, videoOutputs: restVids });
    }
    onChange({ ...shot, sourceAssets: assets.filter(a => a.id !== id) });
  };

  const setPrimary = (id: string) => {
    // Check videos
    const vidIdx = videos.findIndex(v => v.id === id);
    if (vidIdx >= 0) {
      return onChange({ ...shot, videoOutputs: videos.map(v => ({ ...v, isPrimary: v.id === id })) });
    }
    // For frames, reorder: move selected to front
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    const sameType = assets.filter(a => a.type === asset.type && a.id !== id);
    const others = assets.filter(a => a.type !== asset.type);
    onChange({ ...shot, sourceAssets: [...others, asset, ...sameType] });
  };

  const imgUrl = (blob?: Blob) => blob ? URL.createObjectURL(blob) : null;

  return (
    <div className="bg-[var(--card)] border border-[var(--border2)] rounded-xl overflow-hidden hover:border-[var(--border)] transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[var(--border)]">
        <span className="bg-[var(--accent-solid)] text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0">Shot {shotNo}</span>
        <input className="bg-transparent text-xs font-normal text-[var(--text2)] outline-none flex-1 min-w-0"
          placeholder="镜头标题" value={shot.title} onChange={e => onChange({ ...shot, title: e.target.value })} />
        <span className="text-xs text-[var(--muted)] shrink-0">{shot.duration || '--'}</span>
        <button className="text-[var(--muted)] hover:text-red-400 text-sm px-1 py-0.5 rounded opacity-0 hover:opacity-100 shrink-0"
          onClick={onDelete}>✕</button>
      </div>

      {/* Three-column grid */}
      <div className="grid grid-cols-3 gap-3 p-4">
        {/* ── Video Column ── */}
        <div className="flex flex-col">
          <MediaColumn label="视频" hasContent={!!primaryVideo?.blob}
            media={primaryVideo?.blob ? (
              <video key={primaryVideo.id} src={imgUrl(primaryVideo.blob)!} className="w-full h-full object-contain bg-black animate-fadeIn" controls preload="metadata" />
            ) : (
              <EmptyUploader icon="🎬" label="视频" onUpload={addVideo} accept="video/mp4,video/webm" multiple />
            )}
            controls={<VariantRow items={videos} primaryId={primaryVideo?.id} onSelect={setPrimary} onRemove={removeMedia} onAdd={addVideo} accept="video/mp4,video/webm" multiple />}
          />
          <PromptBlock label="视频 Prompt" text={shot.videoPrompt} />
        </div>

        {/* ── First Frame Column ── */}
        <div className="flex flex-col">
          <MediaColumn label="首帧" hasContent={!!primaryFirst?.blob}
            media={primaryFirst?.blob ? (
              <img key={primaryFirst.id} src={imgUrl(primaryFirst.blob)!} className="w-full h-full object-contain bg-black/40 animate-fadeIn" alt="首帧" />
            ) : (
              <EmptyUploader icon="🖼" label="首帧" onUpload={(f: File) => addFrame('firstFrame', f)} accept="image/png,image/jpeg,image/webp" />
            )}
            controls={<VariantRow items={firstFrames} primaryId={primaryFirst?.id} onSelect={setPrimary} onRemove={removeMedia} onAdd={f => addFrame('firstFrame', f)} accept="image/png,image/jpeg,image/webp" />}
          />
          <PromptBlock label="首帧 Prompt" text={shot.imagePrompt} />
        </div>

        {/* ── Last Frame Column ── */}
        <div className="flex flex-col">
          <MediaColumn label="尾帧" hasContent={!!primaryLast?.blob}
            media={primaryLast?.blob ? (
              <img key={primaryLast.id} src={imgUrl(primaryLast.blob)!} className="w-full h-full object-contain bg-black/40 animate-fadeIn" alt="尾帧" />
            ) : (
              <EmptyUploader icon="🖼" label="尾帧" onUpload={(f: File) => addFrame('lastFrame', f)} accept="image/png,image/jpeg,image/webp" />
            )}
            controls={<VariantRow items={lastFrames} onSelect={setPrimary} onRemove={removeMedia} onAdd={f => addFrame('lastFrame', f)} accept="image/png,image/jpeg,image/webp" />}
          />
          <PromptBlock label="尾帧 Prompt" text={shot.imagePrompt} />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function MediaColumn({ label, hasContent, media, controls }: { label: string; hasContent: boolean; media: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className={`relative rounded-lg overflow-hidden border group/media w-full ${hasContent ? 'border-[var(--border2)] bg-black/20' : 'border-dashed border-[var(--border2)] bg-[var(--card2)]'}`}
        style={{ aspectRatio: '16/9' }}>
        {media}
      </div>
      {controls}
    </div>
  );
}

function PromptBlock({ label, text }: { label: string; text?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-0.5 px-1">
      <button className="text-[10px] text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-0.5"
        onClick={() => setOpen(!open)}>
        <span className="leading-none">{open ? '▼' : '▶'}</span> {label}
      </button>
      {open && <div className="mt-1 text-[10px] text-[var(--text2)] leading-relaxed bg-[var(--card2)] rounded p-1.5 whitespace-pre-wrap break-all">{text || '暂无'}</div>}
    </div>
  );
}

function VariantRow({ items, primaryId, onSelect, onRemove, onAdd, accept, multiple }: {
  items: any[]; primaryId?: string; onSelect: (id: string) => void; onRemove: (id: string) => void;
  onAdd: (f: any) => void; accept: string; multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    if (multiple) onAdd(Array.from(files));
    else if (files[0]) onAdd(files[0]);
  };
  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5 px-1">
      {items.map((item, i) => {
        const isActive = item.id === primaryId || (primaryId === undefined && i === 0);
        return (
          <div key={item.id} className="flex items-center group/var">
            <button className={`text-[9px] px-1.5 py-0.5 rounded-full transition-all duration-200 ${isActive ? 'bg-[var(--accent-solid)] text-white' : 'bg-[var(--card2)] text-[var(--text3)] hover:text-[var(--text)]'}`}
              onClick={() => onSelect(item.id)}>
              {item.letter || String.fromCharCode(65 + i)}
            </button>
            <button className="text-[7px] text-[var(--muted)] hover:text-red-400 ml-0.5 opacity-0 group-hover/var:opacity-100 transition-opacity"
              onClick={e => { e.stopPropagation(); onRemove(item.id); }}>✕</button>
          </div>
        );
      })}
      <button className="text-[9px] px-1.5 py-0.5 text-[var(--muted)] hover:text-[var(--text)] rounded-full border border-dashed border-[var(--border2)]"
        onClick={() => ref.current?.click()}>+</button>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

function EmptyUploader({ icon, label, onUpload, accept, multiple }: {
  icon: string; label: string; onUpload: any; accept: string; multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) { onUpload(multiple ? files : files[0]); return; }
    // Check for transfer station blob ID first
    const blobId = e.dataTransfer.getData('cinecreate-blob-id');
    if (blobId) {
      try {
        const buf = await (window as any).electronAPI.loadBlob(blobId);
        if (buf) {
          const blob = new Blob([buf], { type: 'image/png' });
          const file = new File([blob], 'asset.png', { type: 'image/png' });
          onUpload(multiple ? [file] : file);
          return;
        }
      } catch {}
    }
    // Fallback: URL drop
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && url.match(/^(https?|blob):\/\//)) {
      try { const resp = await fetch(url); const blob = await resp.blob(); onUpload(multiple ? [new File([blob], 'img.'+(blob.type.split('/')[1]||'png'),{type:blob.type})] : new File([blob], 'img.'+(blob.type.split('/')[1]||'png'),{type:blob.type})); } catch {}
    }
  };
  return (
    <>
      <button className="absolute inset-0 flex flex-col items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/[0.02] transition-colors"
        onClick={() => ref.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}>
        <span className="text-lg mb-0.5 opacity-30">{icon}</span>
        <span className="text-[10px]">{label}</span>
      </button>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e => { onUpload(multiple ? Array.from(e.target.files||[]) : (e.target.files?.[0])); e.target.value = ''; }} />
    </>
  );
}
