import { contextBridge, ipcRenderer } from 'electron';
import { SearchQuery, VaultNode, StorageMetrics, FilePreviewData, IntegrityReport, UpdateState } from '../shared/types';

export const vaultApi = {
  // Nodes
  getNodes: (query: SearchQuery): Promise<VaultNode[]> => ipcRenderer.invoke('vault:get-nodes', query),
  getNodeById: (id: string): Promise<VaultNode | null> => ipcRenderer.invoke('vault:get-node-by-id', id),
  getFolderAncestors: (folderId: string): Promise<Array<{ id: string; name: string }>> => ipcRenderer.invoke('vault:get-folder-ancestors', folderId),
  createFolder: (name: string, parentId?: string | null): Promise<VaultNode> => ipcRenderer.invoke('vault:create-folder', name, parentId),
  renameNode: (id: string, newName: string): Promise<void> => ipcRenderer.invoke('vault:rename-node', id, newName),
  moveNode: (id: string, newParentId: string | null): Promise<void> => ipcRenderer.invoke('vault:move-node', id, newParentId),
  toggleStarred: (id: string): Promise<boolean> => ipcRenderer.invoke('vault:toggle-starred', id),
  trashNode: (id: string, trashed: boolean): Promise<void> => ipcRenderer.invoke('vault:trash-node', id, trashed),
  deletePermanently: (id: string): Promise<void> => ipcRenderer.invoke('vault:delete-permanently', id),
  emptyTrash: () => ipcRenderer.invoke('vault:empty-trash'),

  // Import / Export
  selectAndImportFiles: (parentFolderId?: string | null, deleteSource?: boolean): Promise<any> => ipcRenderer.invoke('vault:select-and-import-files', parentFolderId, deleteSource !== undefined ? deleteSource : true),
  importFilePaths: (filePaths: string[], parentFolderId?: string | null, deleteSource?: boolean): Promise<any> => ipcRenderer.invoke('vault:import-file-paths', filePaths, parentFolderId, deleteSource !== undefined ? deleteSource : true),
  importBuffer: (buffer: Uint8Array, name: string, parentFolderId?: string | null): Promise<VaultNode> => ipcRenderer.invoke('vault:import-buffer', buffer, name, parentFolderId),
  exportFile: (nodeId: string): Promise<string> => ipcRenderer.invoke('vault:export-file', nodeId),
  openWithDefaultApp: (nodeId: string): Promise<void> => ipcRenderer.invoke('vault:open-with-default-app', nodeId),

  // Previews & Metrics
  getFilePreview: (nodeId: string): Promise<FilePreviewData> => ipcRenderer.invoke('vault:get-file-preview', nodeId),
  getObjectBlobUrl: (hash: string): Promise<string> => ipcRenderer.invoke('vault:get-object-data-url', hash),
  getStorageMetrics: (): Promise<StorageMetrics> => ipcRenderer.invoke('vault:get-storage-metrics'),
  runIntegrityCheck: (): Promise<IntegrityReport> => ipcRenderer.invoke('vault:run-integrity-check'),

  // Automatic Updates
  getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke('vault:get-update-state'),
  checkForUpdates: (manual?: boolean): Promise<UpdateState> => ipcRenderer.invoke('vault:check-for-updates', manual),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('vault:download-update'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('vault:install-update'),
  dismissUpdate: (version: string): Promise<void> => ipcRenderer.invoke('vault:dismiss-update', version),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('vault:get-app-version'),
  onUpdateStateChange: (callback: (state: UpdateState) => void) => {
    const subscription = (_: any, state: UpdateState) => callback(state);
    ipcRenderer.on('vault:update-state-changed', subscription);
    return () => {
      ipcRenderer.removeListener('vault:update-state-changed', subscription);
    };
  },
};

contextBridge.exposeInMainWorld('vaultApi', vaultApi);

