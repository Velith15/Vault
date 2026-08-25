import { 
  VaultNode, 
  StorageMetrics, 
  SearchQuery, 
  FilePreviewData, 
  IntegrityReport, 
  UpdateState,
  CompressionSettings,
  OptimizationAnalysis,
  OptimizationProgress,
  CompressionProfile
} from '@shared/types';

declare global {
  interface Window {
    vaultApi: {
      getNodes: (query: SearchQuery) => Promise<VaultNode[]>;
      getNodeById: (id: string) => Promise<VaultNode | null>;
      getFolderAncestors: (folderId: string) => Promise<Array<{ id: string; name: string }>>;
      createFolder: (name: string, parentId?: string | null) => Promise<VaultNode>;
      renameNode: (id: string, newName: string) => Promise<void>;
      moveNode: (id: string, newParentId: string | null) => Promise<void>;
      toggleStarred: (id: string) => Promise<boolean>;
      trashNode: (id: string, trashed: boolean) => Promise<void>;
      deletePermanently: (id: string) => Promise<void>;
      emptyTrash: () => Promise<void>;
      selectAndImportFiles: (parentFolderId?: string | null, deleteSource?: boolean) => Promise<{ successful: VaultNode[]; failed: any[] }>;
      importFilePaths: (filePaths: string[], parentFolderId?: string | null, deleteSource?: boolean) => Promise<{ successful: VaultNode[]; failed: any[] }>;
      importBuffer: (buffer: Uint8Array, name: string, parentFolderId?: string | null) => Promise<VaultNode>;
      exportFile: (nodeId: string) => Promise<string | null>;
      openWithDefaultApp: (nodeId: string) => Promise<void>;
      startDrag: (nodeId: string) => void;
      getFilePreview: (nodeId: string) => Promise<FilePreviewData>;
      getObjectBlobUrl: (hash: string) => Promise<string>;
      getStorageMetrics: () => Promise<StorageMetrics>;
      runIntegrityCheck: () => Promise<IntegrityReport>;

      // Storage Optimization
      getCompressionSettings: () => Promise<CompressionSettings>;
      setCompressionSettings: (settings: Partial<CompressionSettings>) => Promise<CompressionSettings>;
      analyzeOptimization: () => Promise<OptimizationAnalysis>;
      startOptimization: (profile?: CompressionProfile) => Promise<OptimizationProgress>;
      pauseOptimization: () => Promise<OptimizationProgress>;
      resumeOptimization: () => Promise<OptimizationProgress>;
      cancelOptimization: () => Promise<OptimizationProgress>;
      getOptimizationProgress: () => Promise<OptimizationProgress>;
      onOptimizationProgressChange: (callback: (progress: OptimizationProgress) => void) => () => void;

      // Updates
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: (manual?: boolean) => Promise<UpdateState>;
      downloadUpdate: () => Promise<void>;
      installUpdate: () => Promise<void>;
      dismissUpdate: (version: string) => Promise<void>;
      getAppVersion: () => Promise<string>;
      onUpdateStateChange: (callback: (state: UpdateState) => void) => () => void;
    };
  }
}

export const api = window.vaultApi;
