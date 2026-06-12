import React, { useState, useCallback, createContext, useContext } from 'react';

const ToastCtx = createContext<(msg: string) => void>(() => {});

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([]);
  const show = useCallback((msg: string) => {
    const id = crypto.randomUUID?.() ?? Date.now().toString();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="toast-enter bg-[var(--accent-solid)] text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg pointer-events-auto">{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() { return useContext(ToastCtx); }
