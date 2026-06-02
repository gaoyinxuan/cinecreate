/**
 * Reusable first-time onboarding overlay.
 */
import React from 'react';

interface Props {
  title: string;
  children: React.ReactNode;
  buttons: { label: string; primary?: boolean; onClick: () => void }[];
  onClose: () => void;
  storageKey: string;
}

export default function OnboardingGuide({ title, children, buttons, onClose, storageKey }: Props) {
  React.useEffect(() => {
    localStorage.setItem(storageKey, 'shown');
  }, [storageKey]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[var(--card)] border border-[var(--border2)] rounded-xl p-6 w-[420px] max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-base text-[var(--text)] font-bold mb-3">{title}</div>
        <div className="text-xs text-[var(--text3)] space-y-2 mb-5">{children}</div>
        <div className="flex gap-2 flex-wrap">
          {buttons.map((b, i) => (
            <button key={i} className={`text-xs px-4 py-2 rounded-lg font-semibold ${b.primary ? 'bg-[var(--accent-text)] hover:opacity-90 text-white' : 'bg-[var(--card2)] hover:bg-[var(--border)] text-[var(--text)]'}`}
              onClick={b.onClick}>{b.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function useOnboarding(key: string): [boolean, () => void] {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (!localStorage.getItem(key)) setShow(true);
  }, [key]);
  const dismiss = () => setShow(false);
  return [show, dismiss];
}
