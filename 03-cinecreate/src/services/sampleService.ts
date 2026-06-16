/**
 * Sample project restore — triggered by user button click.
 * First-launch seeding is handled by main process (electron/db.ts seedSampleProject).
 */
import { db } from './dbService';

export async function restoreSampleProject(): Promise<string | null> {
  try {
    const api = (window as any).electronAPI;
    const result = await api.restoreSampleProject();
    if (result?.name) {
      // Refresh all state
      return result.name;
    }
    return null;
  } catch (e) {
    console.error('Failed to restore sample:', e);
    return null;
  }
}

// Legacy — no longer needed (main process handles first launch)
export async function importSampleProjectIfNeeded(): Promise<boolean> {
  return false; // Handled by main process
}
