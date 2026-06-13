/**
 * Preload script: exposes safe IPC bridge to renderer via contextBridge.
 * All database operations go through ipcRenderer.invoke.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Projects
  getProjects: () => ipcRenderer.invoke('db:getProjects'),
  createProject: (name: string) => ipcRenderer.invoke('db:createProject', name),
  updateProject: (id: string, data: any) => ipcRenderer.invoke('db:updateProject', id, data),
  deleteProject: (id: string) => ipcRenderer.invoke('db:deleteProject', id),

  // Sequences
  getSequences: (projectId?: string) => ipcRenderer.invoke('db:getSequences', projectId),
  createSequence: (seq: any) => ipcRenderer.invoke('db:createSequence', seq),
  updateSequence: (id: string, data: any) => ipcRenderer.invoke('db:updateSequence', id, data),
  deleteSequence: (id: string) => ipcRenderer.invoke('db:deleteSequence', id),

  // Shots
  getShots: (projectId?: string) => ipcRenderer.invoke('db:getShots', projectId),
  createShot: (shot: any) => ipcRenderer.invoke('db:createShot', shot),
  updateShot: (id: string, data: any) => ipcRenderer.invoke('db:updateShot', id, data),
  deleteShot: (id: string) => ipcRenderer.invoke('db:deleteShot', id),
  reorderShots: (fromId: string, toId: string) => ipcRenderer.invoke('db:reorderShots', fromId, toId),

  // Blobs
  saveBlob: (blobId: string, buffer: ArrayBuffer) => ipcRenderer.invoke('db:saveBlob', blobId, buffer),
  loadBlob: (blobId: string): Promise<ArrayBuffer | null> => ipcRenderer.invoke('db:loadBlob', blobId),
  deleteBlob: (blobId: string) => ipcRenderer.invoke('db:deleteBlob', blobId),

  // AI Director
  getStories: (projectId?: string) => ipcRenderer.invoke('db:getStories', projectId),
  createStory: (story: any) => ipcRenderer.invoke('db:createStory', story),
  updateStory: (id: string, data: any) => ipcRenderer.invoke('db:updateStory', id, data),
  deleteStory: (id: string) => ipcRenderer.invoke('db:deleteStory', id),
  getCharacters: (storyId?: string) => ipcRenderer.invoke('db:getCharacters', storyId),
  createCharacter: (char: any) => ipcRenderer.invoke('db:createCharacter', char),
  updateCharacter: (id: string, data: any) => ipcRenderer.invoke('db:updateCharacter', id, data),
  deleteCharacter: (id: string) => ipcRenderer.invoke('db:deleteCharacter', id),

  // Documents Center
  getDocuments: (projectId: string, parentId?: string|null) => ipcRenderer.invoke('db:getDocuments', projectId, parentId),
  createDocument: (doc: any) => ipcRenderer.invoke('db:createDocument', doc),
  updateDocument: (id: string, data: any) => ipcRenderer.invoke('db:updateDocument', id, data),
  deleteDocument: (id: string) => ipcRenderer.invoke('db:deleteDocument', id),

  // Drafts
  getDrafts: (projectId: string) => ipcRenderer.invoke('db:getDrafts', projectId),
  createDraft: (draft: any) => ipcRenderer.invoke('db:createDraft', draft),
  updateDraft: (id: string, data: any) => ipcRenderer.invoke('db:updateDraft', id, data),
  deleteDraft: (id: string) => ipcRenderer.invoke('db:deleteDraft', id),

  // Meta
  getMeta: (key: string) => ipcRenderer.invoke('db:getMeta', key),
  setMeta: (key: string, value: any) => ipcRenderer.invoke('db:setMeta', key, value),

  // App
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  getApiKey: (): Promise<string> => ipcRenderer.invoke('app:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('app:setApiKey', key),

  // Tool tab events
  onToolOpenTab: (callback: (url: string) => void) => {
    const handler = (_event: any, url: string) => callback(url);
    ipcRenderer.on('tool:open-tab', handler);
    return () => ipcRenderer.removeListener('tool:open-tab', handler);
  },

  // Dialogs
  confirm: (message: string, title?: string): Promise<boolean> => ipcRenderer.invoke('dialog:confirm', message, title),
});
