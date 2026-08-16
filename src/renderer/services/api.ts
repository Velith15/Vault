import { VaultNode, StorageMetrics, SearchQuery, FilePreviewData, IntegrityReport } from '@shared/types';

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
      getFilePreview: (nodeId: string) => Promise<FilePreviewData>;
      getObjectBlobUrl: (hash: string) => Promise<string>;
      getStorageMetrics: () => Promise<StorageMetrics>;
      runIntegrityCheck: () => Promise<IntegrityReport>;
    };
  }
}

export const api = window.vaultApi;
