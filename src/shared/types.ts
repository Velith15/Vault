export type NodeType = 'file' | 'folder';

export interface VaultNode {
  id: string;
  parentId: string | null;
  name: string;
  type: NodeType;
  objectHash: string | null;
  size: number;
  mimeType: string | null;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  createdAt: string;
  modifiedAt: string;
  // Computed / joined fields
  refCount?: number;
  duplicateCount?: number;
}

export interface StorageObject {
  hash: string;
  size: number;
  refCount: number;
  storedAt: string;
  lastVerifiedAt: string;
}

export interface StorageMetrics {
  totalDiskSpace: number;
  availableDiskSpace: number;
  usedDiskSpace: number;
  vaultManagedBytes: number;
  vaultRawLogicalBytes: number;
  deduplicatedSavingsBytes: number;
  totalFiles: number;
  totalFolders: number;
  totalObjects: number;
  vaultPath: string;
}

export interface SearchQuery {
  term?: string;
  type?: 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'folder';
  parentId?: string | null;
  isStarred?: boolean;
  isTrashed?: boolean;
  sortBy?: 'name' | 'size' | 'modifiedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface IntegrityReport {
  timestamp: string;
  databaseValid: boolean;
  orphanedObjectsCount: number;
  missingObjectsCount: number;
  repairedRecordsCount: number;
  corruptedObjectsCount: number;
  details: string[];
}

export interface FilePreviewData {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  hash: string;
  refCount: number;
  contentUrl?: string;
  textContent?: string;
  createdAt: string;
  modifiedAt: string;
}

export interface ImportResult {
  successful: Array<{ id: string; name: string; size: number; isDuplicate: boolean; hash: string }>;
  failed: Array<{ name: string; error: string }>;
}

export type UpdateStatus = 
  | 'idle' 
  | 'checking' 
  | 'available' 
  | 'not-available' 
  | 'downloading' 
  | 'downloaded' 
  | 'error' 
  | 'offline';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
  files?: Array<{ url: string; sha512: string; size?: number }>;
  path?: string;
  sha512?: string;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  updateInfo?: UpdateInfo | null;
  progress?: UpdateProgress | null;
  error?: string | null;
  lastCheckedAt?: string | null;
  dismissedVersion?: string | null;
  isManualCheck?: boolean;
}

