/**
 * Renderer-side database service.
 * All calls go through IPC → main process → SQLite.
 * Falls back to mock if electronAPI is not available (browser mode).
 */
import { Project, Sequence, Shot, VideoSegment } from '../types';

const api = (window as any).electronAPI;
const hasAPI = !!api;

if (!hasAPI) {
  console.warn('electronAPI not available — running in browser-only mode. Data will NOT persist.');
}

function call(fn: any, ...args: any[]) {
  if (!fn) { console.warn('API not available'); return Promise.resolve(null); }
  return fn(...args);
}

// ── Projects ────────────────────────────────────
export const db = {
  projects: {
    getAll: (): Promise<Project[]> => hasAPI ? api.getProjects() : Promise.resolve([]),
    create: (name: string): Promise<Project> => hasAPI ? api.createProject(name) : Promise.reject(new Error('Electron required')),
    update: (id: string, data: Partial<Project>): Promise<Project> => hasAPI ? api.updateProject(id, data) : Promise.resolve(data as any),
    delete: (id: string): Promise<void> => hasAPI ? api.deleteProject(id) : Promise.resolve(),
  },
  sequences: {
    getAll: (projectId?: string): Promise<Sequence[]> => hasAPI ? api.getSequences(projectId) : Promise.resolve([]),
    create: (seq: Partial<Sequence>): Promise<Sequence> => hasAPI ? api.createSequence(seq) : Promise.reject(new Error('Electron required')),
    update: (id: string, data: Partial<Sequence>): Promise<Sequence> => hasAPI ? api.updateSequence(id, data) : Promise.resolve(data as any),
    delete: (id: string): Promise<void> => hasAPI ? api.deleteSequence(id) : Promise.resolve(),
  },
  shots: {
    getAll: (projectId?: string): Promise<Shot[]> => hasAPI ? api.getShots(projectId) : Promise.resolve([]),
    create: (shot: Partial<Shot>): Promise<Shot> => hasAPI ? api.createShot(shot) : Promise.reject(new Error('Electron required')),
    update: (id: string, data: Partial<Shot>): Promise<Shot> => hasAPI ? api.updateShot(id, data) : Promise.resolve(data as any),
    delete: (id: string): Promise<void> => hasAPI ? api.deleteShot(id) : Promise.resolve(),
    reorder: (fromId: string, toId: string): Promise<{ok:boolean}> => hasAPI ? api.reorderShots(fromId, toId) : Promise.resolve({ok:false}),
  },
  blobs: {
    save: (blobId: string, blob: Blob) => hasAPI ? blob.arrayBuffer().then(buf => api.saveBlob(blobId, buf)) : Promise.resolve({blobId,size:0}),
    load: async (blobId: string): Promise<Blob | null> => hasAPI ? (async () => { const buf = await api.loadBlob(blobId); return buf ? new Blob([buf]) : null; })() : Promise.resolve(null),
    delete: (blobId: string): Promise<void> => hasAPI ? api.deleteBlob(blobId) : Promise.resolve(),
  },
  meta: {
    get: (key: string): Promise<any> => hasAPI ? api.getMeta(key) : Promise.resolve(null),
    set: (key: string, value: any): Promise<void> => hasAPI ? api.setMeta(key, value) : Promise.resolve(),
  },
  // AI Director
  ai: {
    stories: {
      getAll: (projectId?: string): Promise<any[]> => hasAPI ? api.getStories(projectId) : Promise.resolve([]),
      create: (story: any): Promise<any> => hasAPI ? api.createStory(story) : Promise.reject(new Error('Electron required')),
      update: (id: string, data: any): Promise<any> => hasAPI ? api.updateStory(id, data) : Promise.resolve(data),
      delete: (id: string): Promise<void> => hasAPI ? api.deleteStory(id) : Promise.resolve(),
    },
    characters: {
      getAll: (storyId?: string): Promise<any[]> => hasAPI ? api.getCharacters(storyId) : Promise.resolve([]),
      create: (char: any): Promise<any> => hasAPI ? api.createCharacter(char) : Promise.reject(new Error('Electron required')),
      update: (id: string, data: any): Promise<any> => hasAPI ? api.updateCharacter(id, data) : Promise.resolve(data),
      delete: (id: string): Promise<void> => hasAPI ? api.deleteCharacter(id) : Promise.resolve(),
    },
  },
  // Documents Center
  docs: {
    getAll: (projectId: string, parentId?: string|null): Promise<any[]> => hasAPI ? api.getDocuments(projectId, parentId) : Promise.resolve([]),
    create: (doc: any): Promise<any> => hasAPI ? api.createDocument(doc) : Promise.reject(new Error('Electron required')),
    update: (id: string, data: any): Promise<any> => hasAPI ? api.updateDocument(id, data) : Promise.resolve(data),
    delete: (id: string): Promise<void> => hasAPI ? api.deleteDocument(id) : Promise.resolve(),
  },
  // Drafts (AI workspace)
  dts: {
    getAll: (projectId: string): Promise<any[]> => hasAPI ? api.getDrafts(projectId) : Promise.resolve([]),
    create: (draft: any): Promise<any> => hasAPI ? api.createDraft(draft) : Promise.reject(new Error('Electron required')),
    update: (id: string, data: any): Promise<any> => hasAPI ? api.updateDraft(id, data) : Promise.resolve(data),
    delete: (id: string): Promise<void> => hasAPI ? api.deleteDraft(id) : Promise.resolve(),
  }
};
