import { useCallback, useEffect, useRef } from 'react';
import { db } from '../services/dbService';

/** Debounced auto-save hook for any entity type */
export function useAutoSave<T extends { id: string }>(
  items: T[],
  saveFn: (item: T) => Promise<any>,
  delayMs = 600
) {
  const pending = useRef<Map<string, T>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const flush = useCallback(async () => {
    const items = Array.from(pending.current.values());
    pending.current.clear();
    for (const item of items) {
      try { await saveFn(item); } catch (e) { /* retry next cycle */ }
    }
  }, [saveFn]);

  useEffect(() => {
    // Mark all current items as needing save
    for (const item of items) {
      pending.current.set(item.id, item);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delayMs);
    return () => clearTimeout(timer.current);
  }, [items, flush, delayMs]);
}

/** Hook to sync state deletions to DB */
export function useDeleteSync() {
  return useCallback(async (type: 'projects'|'sequences'|'shots', id: string) => {
    try {
      if (type === 'projects') await db.projects.delete(id);
      if (type === 'sequences') await db.sequences.delete(id);
      if (type === 'shots') await db.shots.delete(id);
    } catch {}
  }, []);
}
