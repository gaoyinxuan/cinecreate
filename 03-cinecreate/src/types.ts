// ── Source Assets ──
export interface SourceAsset {
  id: string;
  type: 'firstFrame' | 'lastFrame' | 'characterRef' | 'sceneRef' | 'propRef' | 'general';
  label: string;
  blob?: Blob;
  blobId?: string;
}

// ── Video Output ──
export interface VideoOutput {
  id: string;
  label: string;
  letter: string;
  isPrimary: boolean;
  blob?: Blob;
  blobId?: string;
  provider?: string;       // "seedance" | "kling" | "manual"
  createdAt: string;
}

// ── Shot (video-first model) ──
export interface Shot {
  id: string;
  projectId: string;
  sequenceId: string;
  shotNo: number;           // global sequential
  sceneId?: string;         // draft scene link

  title: string;
  description: string;
  duration: string;
  shotType?: string;
  atmosphere?: string;
  composition?: string;
  cameraMovement?: string;

  imagePrompt?: string;
  videoPrompt?: string;

  sourceAssets: SourceAsset[];
  videoOutputs: VideoOutput[];

  startTime: string;
  endTime: string;
  tags: string[];
  orderIndex: number;
  createdAt: string;

  // backward compat — deprecated
  variants?: any[];
}

// ── Sequence ──
export interface Sequence {
  id: string; projectId: string;
  name: string; description: string;
  startTime: string; endTime: string;
  orderIndex: number; createdAt: string;
  // deprecated
  videoSegments?: any[];
}

// ── Project ──
export interface Project {
  id: string; name: string;
  createdAt: string; updatedAt: string;
  aiConfig: Record<string, any>;
}

// ── Deprecated (kept for backward compat) ──
/** @deprecated Use SourceAsset */
export interface Variant {
  id: string; imageBlob?: Blob; imageBlobId?: string;
  label: string; letter: string; isPrimary: boolean;
  tags: Record<string,string>;
}
/** @deprecated */
export interface VariantTagSet { version?: string; style?: string; camera?: string; lighting?: string; motion?: string; }
/** @deprecated Use VideoOutput */
export interface VideoSegment {
  id: string; videoBlob?: Blob; videoBlobId?: string;
  name: string; format: string; duration: string;
  exportDate: string; versionNote: string;
}
