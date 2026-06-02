export interface VariantTagSet {
  version?: string; style?: string; camera?: string; lighting?: string; motion?: string;
}

export interface Variant {
  id: string; imageBlob?: Blob; imageBlobId?: string;
  label: string; letter: string; isPrimary: boolean;
  tags: VariantTagSet;
}

export interface VideoSegment {
  id: string; videoBlob?: Blob; videoBlobId?: string;
  name: string; format: string; duration: string;
  exportDate: string; versionNote: string;
}

export interface Sequence {
  id: string; projectId: string;
  name: string; description: string;
  startTime: string; endTime: string;
  coverBlob: null | string;
  videoSegments: VideoSegment[];
  orderIndex: number; createdAt: string;
}

export interface Shot {
  id: string; projectId: string; sequenceId: string;
  title: string; description: string;
  variants: Variant[];
  startTime: string; endTime: string; duration: string;
  tags: string[]; metadata: Record<string, any>;
  orderIndex: number; createdAt: string;
}

export interface Project {
  id: string; name: string;
  createdAt: string; updatedAt: string;
  aiConfig: Record<string, any>;
}

export interface AIConfig {
  defaultModel: string; defaultPrompt: string;
  styleRef?: string;
}

export interface AIGenerateRequest {
  prompt: string; model: string;
  numImages: number; style?: string;
}

export interface AIGenerateResponse {
  images: { blob: Blob; seed: number }[];
  model: string;
}
