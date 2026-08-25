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
  isCompressed?: boolean;
  compressedSize?: number;
  compressionRatio?: number;
  compressionAlgo?: string | null;
}

export interface StorageObject {
  hash: string;
  size: number; // Original uncompressed size
  refCount: number;
  storedAt: string;
  lastVerifiedAt: string;
  isCompressed: boolean;
  compressedSize: number;
  compressionAlgo: string | null;
}

export interface CategorySavings {
  category: string;
  logicalBytes: number;
  physicalBytes: number;
  savedBytes: number;
  reductionPercentage: number;
  fileCount: number;
}

export interface StorageMetrics {
  totalDiskSpace: number;
  availableDiskSpace: number;
  usedDiskSpace: number;
  vaultManagedBytes: number; // Actual disk usage of CAS store (compressed + uncompressed objects)
  vaultRawLogicalBytes: number; // Total logical size of active files (uncompressed, with duplicates)
  vaultUniqueLogicalBytes: number; // Sum of unique CAS object original sizes
  deduplicatedSavingsBytes: number; // Savings strictly from deduplication
  compressionSavingsBytes: number; // Savings strictly from compression
  totalSavingsBytes: number; // deduplicated + compression savings
  overallReductionPercentage: number;
  totalFiles: number;
  totalFolders: number;
  totalObjects: number;
  compressedObjectsCount: number;
  vaultPath: string;
  categorySavings: CategorySavings[];
}

export type CompressionProfile = 'FAST' | 'BALANCED' | 'MAXIMUM';
export type CompressionMode = 'automatic' | 'maximum_savings' | 'performance' | 'off';

export interface CompressionSettings {
  autoCompression: boolean;
  mode: CompressionMode;
  profile: CompressionProfile;
  minSavingsThresholdPercent: number; // e.g. 5 (5%)
  minFileSizeToCompress: number; // e.g. 1024 (1 KB)
  backgroundCpuLimitPercent: number; // e.g. 50 (50%)
}

export interface OptimizationAnalysis {
  totalFiles: number;
  totalBytes: number;
  optimizableFilesCount: number;
  optimizableBytes: number;
  estimatedSavingsBytes: number;
  alreadyOptimizedCount: number;
  skippedCount: number;
}

export type OptimizationStatus = 'idle' | 'analyzing' | 'optimizing' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface OptimizationProgress {
  status: OptimizationStatus;
  totalToProcess: number;
  processedCount: number;
  optimizedCount: number;
  skippedCount: number;
  failedCount: number;
  bytesProcessed: number;
  bytesSaved: number;
  currentFileName: string;
  speedBytesPerSec: number;
  percent: number;
  error?: string | null;
  integrityVerified: boolean;
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
  compressedObjectsVerified: number;
  details: string[];
}

export interface FilePreviewData {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  physicalSize: number;
  hash: string;
  refCount: number;
  isCompressed: boolean;
  compressionAlgo: string | null;
  savedBytes: number;
  reductionPercentage: number;
  integrityVerified: boolean;
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

