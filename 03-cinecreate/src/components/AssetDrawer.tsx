import React, { useState } from 'react';

export default function AssetDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <button
        className="fixed bottom-5 right-5 z-[100] w-10 h-10 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-lg flex items-center justify-center text-lg hover:scale-110 hover:shadow-xl transition-all"
        onClick={() => setOpen(!open)}
        title="素材库"
      >
        📦
      </button>

      {/* Mini panel */}
      {open && (
        <div className="fixed bottom-16 right-5 z-[99] w-80 max-h-[480px] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--text)]">素材库</span>
            <button className="text-[var(--muted)] hover:text-[var(--text)] text-sm" onClick={() => setOpen(false)}>✕</button>
          </div>
          {/* Search */}
          <div className="px-4 py-2">
            <input className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent-text)]/30" placeholder="搜索资产..." />
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 px-4 pb-2">
            {['全部','图片','视频','Prompt'].map(t => (
              <button key={t} className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${t==='全部'?'bg-[var(--accent-solid)] text-white':'bg-[var(--card2)] text-[var(--text3)] hover:text-[var(--text)]'}`}>{t}</button>
            ))}
          </div>
          {/* Empty state */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="text-2xl mb-2 opacity-20">📂</div>
              <div className="text-xs text-[var(--muted)]">暂无资产</div>
              <div className="text-[10px] text-[var(--dim)] mt-1">拖拽文件到此处导入</div>
            </div>
          </div>
          {/* Footer */}
          <div className="flex gap-2 px-4 py-3 border-t border-[var(--border)]">
            <button className="flex-1 py-1.5 text-[11px] bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg transition-colors">+ 导入</button>
            <button className="flex-1 py-1.5 text-[11px] bg-[var(--card2)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] rounded-lg transition-colors">打开全部</button>
          </div>
        </div>
      )}
    </>
  );
}
