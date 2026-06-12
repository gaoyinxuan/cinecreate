/**
 * Welcome Page — shown when no project is selected.
 */
import React from 'react';

interface Props { onCreateProject: () => void; onClose?: () => void; }

export default function WelcomePage({ onCreateProject, onClose }: Props) {
  const cards = [
    { icon:'📝', title:'文稿', items:['故事大纲','角色设定','场景规划','镜头制作'] },
    { icon:'🔧', title:'工具', items:['AI 生图','AI 视频','Prompt 验证','素材生成'] },
    { icon:'🎬', title:'分镜', items:['图片管理','视频管理','镜头整理','项目归档'] },
  ];

  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--bg)] p-8 overflow-y-auto">
      <div className="text-center max-w-3xl w-full">
        {onClose && (
          <button className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] text-sm"
            onClick={onClose}>✕</button>
        )}

        {/* Logo: Plan F SVG */}
        <svg width="56" height="56" viewBox="0 0 256 256" fill="none" className="mx-auto mb-5 text-[var(--accent-solid)]">
          <circle cx="128" cy="128" r="72" stroke="currentColor" stroke-width="34" fill="none" stroke-dasharray="350 103" stroke-dashoffset="25" stroke-linecap="round"/>
          <path d="M148 112L148 144L174 128Z" fill="currentColor"/>
        </svg>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-1">影创 CineCreate</h1>
        <p className="text-sm text-[var(--dim)] mb-10">AI 视频创作工作台</p>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {cards.map(c => (
            <div key={c.title} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 text-left">
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-sm font-semibold text-[var(--text2)] mb-2">{c.title}</div>
              <ul className="text-xs text-[var(--text3)] space-y-1">
                {c.items.map(i => <li key={i}>• {i}</li>)}
              </ul>
            </div>
          ))}
        </div>

        {/* Demo Showcase */}
        <div className="mb-10">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl overflow-hidden border border-[var(--border)]">
              <img src="assets/images/K08.png" alt="" className="w-full aspect-video object-cover" />
            </div>
            <div className="rounded-xl overflow-hidden border border-[var(--border)]">
              <video src="assets/videos/3-1.mp4" autoPlay muted loop playsInline className="w-full aspect-video object-cover" />
            </div>
            <div className="rounded-xl overflow-hidden border border-[var(--border)]">
              <img src="assets/images/K11.png" alt="" className="w-full aspect-video object-cover" />
            </div>
          </div>
        </div>

        {/* Workflow */}
        <div className="flex items-center justify-center gap-3 text-sm text-[var(--muted)] mb-8">
          <span>📝 文稿</span><span>→</span><span>🔧 工具</span><span>→</span><span>🎬 分镜</span>
        </div>
        <p className="text-xs text-[var(--muted)] mb-6">先完成故事创作 → 再生成素材 → 最后统一管理</p>

        <button className="px-8 py-3 bg-[var(--accent-solid)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl shadow-lg transition-all"
          onClick={onCreateProject}>
          ✨ 创建第一个项目
        </button>
      </div>
    </div>
  );
}
