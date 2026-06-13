import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/dbService';

let uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

interface ImageNode { type:'image'; id:string; name:string; blobId:string; url:string; x:number; y:number; w:number; h:number; }
interface TextNode { type:'text'; id:string; content:string; fontSize:number; bold:boolean; x:number; y:number; w:number; }

type BoardNode = ImageNode | TextNode;

export default function AssetBoard({ projectId }: { projectId: string }) {
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [zoom, setZoom] = useState(80);
  const [dragOver, setDragOver] = useState(false);
  const [editingText, setEditingText] = useState<string|null>(null);
  const [preview, setPreview] = useState<ImageNode|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const saved = await db.meta.get(`board_${projectId}`);
        if (saved && Array.isArray(saved)) {
          const loaded = await Promise.all(saved.map(async (n: any) => {
            if (n.type === 'image') {
              const blob = await db.blobs.load(n.blobId);
              return blob ? { ...n, url: URL.createObjectURL(blob) } : null;
            }
            return n;
          }));
          setNodes(loaded.filter(Boolean) as BoardNode[]);
        }
      } catch { setNodes([]); }
    })();
  }, [projectId]);

  const saveBoard = useCallback(async (n: BoardNode[]) => {
    if (!projectId) return;
    const cleaned = n.map(node => node.type === 'image' ? (({url,...r})=>r)(node) : node);
    await db.meta.set(`board_${projectId}`, cleaned);
  }, [projectId]);

  const addImageNodes = useCallback(async (files: File[]) => {
    const news: ImageNode[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const id = uid(), blobId = uid();
      try {
        await db.blobs.save(blobId, f);
        news.push({ type:'image', id, name: f.name, blobId, url: URL.createObjectURL(f),
          x: 100 + (nodes.length + i) % 5 * 260, y: 80 + Math.floor((nodes.length + i) / 5) * 220, w: 240, h: 180 });
      } catch {}
    }
    if (news.length) { const all = [...nodes, ...news]; setNodes(all); saveBoard(all); }
  }, [nodes, saveBoard]);

  const addTextNode = useCallback(() => {
    const n: TextNode = { type:'text', id: uid(), content: '双击编辑文字', fontSize: 16, bold: false,
      x: 200 + (nodes.length % 5) * 260, y: 100 + Math.floor(nodes.length / 5) * 200, w: 240 };
    const all = [...nodes, n]; setNodes(all); saveBoard(all); setEditingText(n.id);
  }, [nodes, saveBoard]);

  const updateNode = useCallback((id: string, patch: Partial<BoardNode>) => {
    setNodes(prev => { const n = prev.map(x => x.id===id?{...x,...patch}:x); saveBoard(n); return n; });
  }, [saveBoard]);

  const removeNode = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node?.type === 'image') URL.revokeObjectURL((node as ImageNode).url);
    const f = nodes.filter(n => n.id !== id); setNodes(f); saveBoard(f);
  }, [nodes, saveBoard]);

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        for (const t of item.types) {
          if (t.startsWith('image/')) { const blob = await (item as any).getType(t); files.push(new File([blob], 'paste.png', {type:t})); break; }
        }
      }
      if (files.length) addImageNodes(files);
    } catch {}
  }, [addImageNodes]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey||e.metaKey) && e.key === 'v') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault(); handlePaste();
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [handlePaste]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#fcfbf9]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 shrink-0 border-b border-[#eee] bg-white/80 backdrop-blur">
        <span className="text-[13px] font-semibold text-[#333]">素材画布</span>
        <span className="text-[11px] text-[#aaa]">{nodes.length} 节点</span>
        <div className="flex-1" />
        <button className="text-[12px] px-3 py-1.5 hover:bg-[#f0ede8] rounded-lg text-[#666] transition-colors"
          onClick={addTextNode}>✏️ 文字</button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) { addImageNodes(Array.from(e.target.files)); e.target.value = ''; } }} />
        <button className="text-[12px] px-3 py-1.5 hover:bg-[#f0ede8] rounded-lg text-[#666] transition-colors"
          onClick={() => fileRef.current?.click()}>📷 图片</button>
        <div className="flex items-center gap-1 ml-3 bg-[#f5f3ef] rounded-lg px-2 py-1">
          <button className="text-[#999] hover:text-[#333] text-sm px-1" onClick={() => setZoom(z => Math.max(20, z-20))}>−</button>
          <span className="text-[11px] text-[#888] w-10 text-center font-medium">{zoom}%</span>
          <button className="text-[#999] hover:text-[#333] text-sm px-1" onClick={() => setZoom(z => Math.min(300, z+20))}>+</button>
        </div>
      </div>

      {/* Canvas */}
      <div
        className={`flex-1 overflow-auto relative ${dragOver ? 'bg-[#f5f0e8]' : ''}`}
        style={{
          backgroundImage: 'radial-gradient(circle, #e0dcd4 1px, transparent 1px)',
          backgroundSize: `${24 * zoom/100}px ${24 * zoom/100}px`
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addImageNodes(Array.from(e.dataTransfer.files)); }}
        onDoubleClick={e => {
          if (e.target === e.currentTarget) addTextNode();
        }}
      >
        <div className="absolute inset-0" style={{
          minWidth: Math.max(5000, zoom * 50),
          minHeight: Math.max(4000, zoom * 40),
          transform: `scale(${zoom/100})`,
          transformOrigin: '0 0'
        }}>
          {nodes.map(n => n.type === 'image' ? (
            <CanvasImage key={n.id} node={n} onMove={(x,y) => updateNode(n.id, {x,y})}
              onRemove={() => removeNode(n.id)} onPreview={() => setPreview(n)} />
          ) : (
            <CanvasText key={n.id} node={n} onChange={(patch) => updateNode(n.id, patch)}
              onRemove={() => removeNode(n.id)} isEditing={editingText===n.id}
              setEditing={(v) => setEditingText(v ? n.id : null)} />
          ))}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setPreview(null)}>
          <img src={preview.url} alt={preview.name} className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-6 right-8 text-3xl text-white/40 hover:text-white/80" onClick={() => setPreview(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

/* ── Image Node ── */
function CanvasImage({ node, onMove, onRemove, onPreview }: {
  node: ImageNode; onMove: (x:number,y:number)=>void; onRemove: ()=>void; onPreview: ()=>void;
}) {
  const [pos, setPos] = useState({ x: node.x, y: node.y });
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const off = useRef({x:0,y:0});

  const down = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    setDragging(true);
    const r = ref.current!.getBoundingClientRect();
    off.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  useEffect(() => {
    if (!dragging) return;
    const mv = (e: MouseEvent) => {
      const p = ref.current?.parentElement?.getBoundingClientRect();
      if (!p) return;
      setPos({ x: Math.max(0, e.clientX - p.left - off.current.x), y: Math.max(0, e.clientY - p.top - off.current.y) });
    };
    const up = () => { setDragging(false); onMove(pos.x, pos.y); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [dragging, pos]);

  return (
    <div ref={ref} className={`absolute group bg-white rounded-2xl shadow-sm hover:shadow-md overflow-hidden transition-shadow ${dragging?'shadow-xl z-50':'z-10'}`}
      style={{ left: pos.x, top: pos.y, width: node.w, cursor: dragging?'grabbing':'grab' }}
      onMouseDown={down} onDoubleClick={onPreview}>
      <div className="aspect-[4/3] bg-[#f0ede8] pointer-events-none">
        <img src={node.url} alt={node.name} className="w-full h-full object-cover" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
      </div>
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] text-[#555] truncate flex-1">{node.name}</span>
        <button className="text-[#ccc] hover:text-red-400 text-xs ml-1 opacity-0 group-hover:opacity-100" onClick={e=>{e.stopPropagation();onRemove()}}>✕</button>
      </div>
    </div>
  );
}

/* ── Text Node ── */
function CanvasText({ node, onChange, onRemove, isEditing, setEditing }: {
  node: TextNode; onChange: (p:Partial<TextNode>)=>void; onRemove: ()=>void; isEditing:boolean; setEditing:(v:boolean)=>void;
}) {
  const [pos, setPos] = useState({ x: node.x, y: node.y });
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const off = useRef({x:0,y:0});

  const down = (e: React.MouseEvent) => {
    if (isEditing) return;
    setDragging(true);
    const r = ref.current!.getBoundingClientRect();
    off.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  useEffect(() => {
    if (!dragging) return;
    const mv = (e: MouseEvent) => {
      const p = ref.current?.parentElement?.getBoundingClientRect();
      if (!p) return;
      setPos({ x: Math.max(0, e.clientX - p.left - off.current.x), y: Math.max(0, e.clientY - p.top - off.current.y) });
    };
    const up = () => { setDragging(false); onChange({ x: pos.x, y: pos.y }); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [dragging, pos]);

  return (
    <div ref={ref} className={`absolute group bg-white rounded-xl shadow-sm ${dragging?'shadow-lg z-50':'z-10'}`}
      style={{ left: pos.x, top: pos.y, minWidth: 180, cursor: dragging?'grabbing':(isEditing?'text':'grab') }}
      onMouseDown={down} onDoubleClick={() => setEditing(true)}>
      <div className="p-3">
        {isEditing ? (
          <textarea className="w-full bg-transparent outline-none resize-none text-[#333] min-h-[60px]"
            style={{ fontSize: node.fontSize, fontWeight: node.bold ? 700 : 400, lineHeight: 1.5 }}
            value={node.content} placeholder="输入文字..."
            onChange={e => onChange({ content: e.target.value })}
            onBlur={() => setEditing(false)}
            autoFocus
          />
        ) : (
          <div style={{ fontSize: node.fontSize, fontWeight: node.bold ? 700 : 400, lineHeight: 1.5, color: '#333', whiteSpace: 'pre-wrap' }}>
            {node.content}
          </div>
        )}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#f0ede8] opacity-0 group-hover:opacity-100 transition-opacity">
          <button className={`text-[10px] px-2 py-0.5 rounded ${node.fontSize===14?'bg-[#333] text-white':'bg-[#f0ede8] text-[#888]'}`}
            onClick={e=>{e.stopPropagation();onChange({fontSize:14})}}>小</button>
          <button className={`text-[10px] px-2 py-0.5 rounded ${node.fontSize===18?'bg-[#333] text-white':'bg-[#f0ede8] text-[#888]'}`}
            onClick={e=>{e.stopPropagation();onChange({fontSize:18})}}>中</button>
          <button className={`text-[10px] px-2 py-0.5 rounded ${node.fontSize===24?'bg-[#333] text-white':'bg-[#f0ede8] text-[#888]'}`}
            onClick={e=>{e.stopPropagation();onChange({fontSize:24})}}>大</button>
          <div className="w-px h-4 bg-[#e0dcd4] mx-1" />
          <button className={`text-[10px] px-2 py-0.5 rounded ${node.bold?'bg-[#333] text-white':'bg-[#f0ede8] text-[#888]'}`}
            onClick={e=>{e.stopPropagation();onChange({bold:!node.bold})}}><b>B</b></button>
          <div className="flex-1" />
          <button className="text-[10px] text-[#ccc] hover:text-red-400" onClick={e=>{e.stopPropagation();onRemove()}}>✕</button>
        </div>
      </div>
    </div>
  );
}
