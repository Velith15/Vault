import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { FileList } from './components/FileList';
import { PreviewDrawer } from './components/PreviewDrawer';
import { StoragePage } from './components/StoragePage';
import { SettingsPage } from './components/SettingsPage';
import { UpdateModal } from './components/UpdateModal';
import { ConfirmModal, ConfirmModalConfig } from './components/ConfirmModal';
import { VaultNode, StorageMetrics, SearchQuery, UpdateState } from '@shared/types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('files');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [ancestors, setAncestors] = useState<Array<{ id: string; name: string }>>([]);
  const [nodes, setNodes] = useState<VaultNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<VaultNode | null>(null);
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  
  // Custom Vault Dialog / Alert state
  const [confirmConfig, setConfirmConfig] = useState<ConfirmModalConfig | null>(null);

  const showAlert = (title: string, message: string) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      confirmText: 'OK',
      cancelText: null,
      variant: 'info',
      onConfirm: () => {},
    });
  };

  // Filtering & View state
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modifiedAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Update State
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);

  useEffect(() => {
    if (api?.getUpdateState) {
      api.getUpdateState().then((st) => {
        setUpdateState(st);
        if (st.status === 'available' && st.updateInfo?.version && st.updateInfo.version !== st.dismissedVersion) {
          setShowUpdateModal(true);
        }
      }).catch(() => {});
    }
    if (api?.onUpdateStateChange) {
      const unsubscribe = api.onUpdateStateChange((st) => {
        setUpdateState(st);
        if (st.status === 'available' && st.updateInfo?.version && st.updateInfo.version !== st.dismissedVersion) {
          setShowUpdateModal(true);
        } else if (st.status === 'downloaded') {
          setShowUpdateModal(true);
        } else if (st.isManualCheck && (st.status === 'not-available' || st.status === 'offline' || st.status === 'error')) {
          // Keep modal open or let user see status in Settings
        }
      });
      return unsubscribe;
    }
  }, []);

  // Load metrics
  const fetchMetrics = useCallback(async () => {
    try {
      if (api?.getStorageMetrics) {
        const m = await api.getStorageMetrics();
        setMetrics(m);
      }
    } catch (err) {
      console.error('Failed to fetch storage metrics:', err);
    }
  }, []);

  // Load nodes based on current view/tab
  const fetchNodes = useCallback(async () => {
    if (!api?.getNodes) return;

    try {
      const query: SearchQuery = {
        term: searchTerm,
        sortBy,
        sortOrder,
      };

      if (activeTab === 'trash') {
        query.isTrashed = true;
      } else if (activeTab === 'starred') {
        query.isStarred = true;
        query.isTrashed = false;
      } else if (activeTab === 'recent') {
        query.isTrashed = false;
        query.sortBy = 'modifiedAt';
        query.sortOrder = 'desc';
      } else if (activeTab === 'documents' || activeTab === 'images' || activeTab === 'videos' || activeTab === 'archives') {
        query.isTrashed = false;
        query.type = activeTab === 'documents' ? 'document' : activeTab === 'images' ? 'image' : activeTab === 'videos' ? 'video' : 'archive';
      } else {
        // Files view: scoped by parent folder
        query.isTrashed = false;
        if (!searchTerm) {
          query.parentId = currentFolderId;
        }
      }

      const result = await api.getNodes(query);
      setNodes(result);

      // Fetch ancestors if in folder
      if (currentFolderId && activeTab === 'files') {
        const anc = await api.getFolderAncestors(currentFolderId);
        setAncestors(anc);
      } else {
        setAncestors([]);
      }
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  }, [activeTab, currentFolderId, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    fetchNodes();
    fetchMetrics();
  }, [fetchNodes, fetchMetrics]);

  // Dialog state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [targetRenameNode, setTargetRenameNode] = useState<VaultNode | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Update Actions
  const handleCheckForUpdates = async () => {
    if (!api?.checkForUpdates) return;
    const st = await api.checkForUpdates(true);
    setUpdateState(st);
    if (st.status === 'available') {
      setShowUpdateModal(true);
    }
  };

  const handleStartDownload = async () => {
    if (!api?.downloadUpdate) return;
    await api.downloadUpdate();
  };

  const handleRestartInstall = async () => {
    if (!api?.installUpdate) return;
    await api.installUpdate();
  };

  const handleDismissUpdate = async (version: string) => {
    if (api?.dismissUpdate) {
      await api.dismissUpdate(version);
    }
    setShowUpdateModal(false);
  };

  // Actions
  const handleOpenCreateFolderModal = () => {
    setFolderNameInput('New Folder');
    setFolderModalOpen(true);
  };

  const handleConfirmCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!folderNameInput.trim()) return;

    try {
      await api.createFolder(folderNameInput.trim(), currentFolderId);
      setFolderModalOpen(false);
      setFolderNameInput('');
      fetchNodes();
      fetchMetrics();
    } catch (err: any) {
      showAlert('Folder Creation Error', `Could not create folder: ${err.message}`);
    }
  };

  const handleImportFiles = async () => {
    try {
      const result = await api.selectAndImportFiles(currentFolderId);
      if (result.failed && result.failed.length > 0) {
        showAlert('Import Error', `Failed to import ${result.failed.length} file(s): ${result.failed[0].error}`);
      }
      fetchNodes();
      fetchMetrics();
    } catch (err: any) {
      showAlert('Import Error', `Import failed: ${err.message}`);
    }
  };

  const handleOpenNode = (node: VaultNode) => {
    if (node.type === 'folder') {
      setCurrentFolderId(node.id);
      setActiveTab('files');
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  };

  const handleToggleStar = async (node: VaultNode, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleStarred(node.id);
      fetchNodes();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleOpenRenameModal = (node: VaultNode) => {
    setTargetRenameNode(node);
    setRenameInput(node.name);
    setRenameModalOpen(true);
  };

  const handleConfirmRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetRenameNode || !renameInput.trim() || renameInput === targetRenameNode.name) {
      setRenameModalOpen(false);
      return;
    }

    try {
      await api.renameNode(targetRenameNode.id, renameInput.trim());
      setRenameModalOpen(false);
      if (selectedNode?.id === targetRenameNode.id) {
        setSelectedNode({ ...selectedNode, name: renameInput.trim() });
      }
      fetchNodes();
    } catch (err: any) {
      showAlert('Rename Error', `Rename failed: ${err.message}`);
    }
  };

  const handleDeletePermanent = (node: VaultNode) => {
    setConfirmConfig({
      isOpen: true,
      title: `Delete "${node.name}" permanently?`,
      message: `This item will be permanently shredded from Vault storage. This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.deletePermanently(node.id);
          if (selectedNode?.id === node.id) setSelectedNode(null);
          fetchNodes();
          fetchMetrics();
        } catch (err: any) {
          showAlert('Deletion Error', `Failed to delete: ${err.message}`);
        }
      },
    });
  };

  const handleDeletePermanentMultiple = (targetNodes: VaultNode[]) => {
    setConfirmConfig({
      isOpen: true,
      title: `Delete ${targetNodes.length} items permanently?`,
      message: `Permanently shred ${targetNodes.length} items from Vault storage? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all(targetNodes.map(n => api.deletePermanently(n.id)));
          if (selectedNode && targetNodes.some(n => n.id === selectedNode.id)) setSelectedNode(null);
          fetchNodes();
          fetchMetrics();
        } catch (err: any) {
          showAlert('Deletion Error', `Failed to delete items: ${err.message}`);
        }
      },
    });
  };

  const handleRestoreNode = async (node: VaultNode) => {
    try {
      await api.trashNode(node.id, false);
      if (selectedNode?.id === node.id) setSelectedNode(null);
      fetchNodes();
      fetchMetrics();
    } catch (err: any) {
      showAlert('Restore Error', `Failed to restore: ${err.message}`);
    }
  };

  const handleRestoreMultiple = async (targetNodes: VaultNode[]) => {
    try {
      await Promise.all(targetNodes.map(n => api.trashNode(n.id, false)));
      if (selectedNode && targetNodes.some(n => n.id === selectedNode.id)) setSelectedNode(null);
      fetchNodes();
      fetchMetrics();
    } catch (err: any) {
      showAlert('Restore Error', `Failed to restore items: ${err.message}`);
    }
  };

  const handleExportNode = async (node: VaultNode) => {
    try {
      await api.exportFile(node.id);
    } catch (err: any) {
      showAlert('Export Error', `Export error: ${err.message}`);
    }
  };

  const handleExportMultiple = async (targetNodes: VaultNode[]) => {
    for (const node of targetNodes) {
      if (node.type === 'file') {
        try {
          await api.exportFile(node.id);
        } catch (err: any) {
          console.error(`Export error for ${node.name}:`, err);
        }
      }
    }
  };

  const handleToggleStarMultiple = async (targetNodes: VaultNode[]) => {
    try {
      await Promise.all(targetNodes.map(n => api.toggleStarred(n.id)));
      fetchNodes();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleOpenWithDefault = async (node: VaultNode) => {
    try {
      await api.openWithDefaultApp(node.id);
    } catch (err: any) {
      showAlert('Open Error', `Could not open file: ${err.message}`);
    }
  };

  // Drag & Drop Ingestion
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const filePaths: string[] = [];
    const bufferFiles: File[] = [];

    for (const file of files) {
      const filePath = (file as any).path;
      if (filePath) {
        filePaths.push(filePath);
      } else {
        bufferFiles.push(file);
      }
    }

    if (filePaths.length > 0) {
      try {
        const result = await api.importFilePaths(filePaths, currentFolderId, false);
        if (result.failed && result.failed.length > 0) {
          showAlert('Import Warning', `Failed to import ${result.failed.length} file(s): ${result.failed[0].error}`);
        }
      } catch (err: any) {
        console.error('Error importing file paths:', err);
      }
    }

    for (const file of bufferFiles) {
      try {
        if (file.size > 500 * 1024 * 1024) {
          showAlert('File Too Large', `File "${file.name}" is too large for buffer drag-and-drop (>500MB). Please use the Import button to select it.`);
          continue;
        }
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        await api.importBuffer(uint8, file.name, currentFolderId);
      } catch (err: any) {
        console.error(`Error importing dropped file ${file.name}:`, err);
      }
    }

    fetchNodes();
    fetchMetrics();
  };

  return (
    <div 
      className="flex h-screen w-screen overflow-hidden bg-[#FAFAFA]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#18181B]/10 backdrop-blur-xs border-2 border-dashed border-[#18181B] flex items-center justify-center pointer-events-none">
          <div className="bg-white p-4 rounded-xl shadow-lg border border-[#E4E4E7] text-[13px] font-medium text-[#09090B]">
            Drop files to store in Vault Content-Addressed Engine
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'files') setCurrentFolderId(null);
        }}
        metrics={metrics}
        onSelectRoot={() => {
          setCurrentFolderId(null);
          setActiveTab('files');
        }}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-screen min-w-0 bg-[#FFFFFF]">
        {activeTab !== 'storage' && activeTab !== 'settings' && (
          <Header
            currentFolderId={currentFolderId}
            ancestors={ancestors}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            viewMode={viewMode}
            setViewMode={setViewMode}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            onNavigateFolder={(folderId) => {
              setCurrentFolderId(folderId);
              setActiveTab('files');
            }}
            onImportClick={handleImportFiles}
            onCreateFolderClick={handleOpenCreateFolderModal}
            onRefresh={() => {
              fetchNodes();
              fetchMetrics();
            }}
          />
        )}

        {/* Dynamic Views */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-[#FFFFFF]">
          {activeTab === 'storage' ? (
            <StoragePage metrics={metrics} onRefreshMetrics={fetchMetrics} />
          ) : activeTab === 'settings' ? (
            <SettingsPage 
              onRefresh={() => { fetchNodes(); fetchMetrics(); }} 
              updateState={updateState}
              onCheckForUpdates={handleCheckForUpdates}
              onOpenUpdateModal={() => setShowUpdateModal(true)}
              onStartDownload={handleStartDownload}
              onRestartInstall={handleRestartInstall}
            />
          ) : (
            <FileList
              nodes={nodes}
              viewMode={viewMode}
              selectedNodeId={selectedNode?.id || null}
              onSelectNode={(node) => setSelectedNode(node)}
              onOpenNode={handleOpenNode}
              onToggleStar={handleToggleStar}
              onRenameNode={handleOpenRenameModal}
              onTrashNode={handleDeletePermanent}
              onRestoreNode={handleRestoreNode}
              onDeletePermanent={handleDeletePermanent}
              onExportNode={handleExportNode}
              onOpenWithDefault={handleOpenWithDefault}
              onTrashMultiple={handleDeletePermanentMultiple}
              onRestoreMultiple={handleRestoreMultiple}
              onDeletePermanentMultiple={handleDeletePermanentMultiple}
              onExportMultiple={handleExportMultiple}
              onToggleStarMultiple={handleToggleStarMultiple}
              isTrashView={activeTab === 'trash'}
            />
          )}
        </div>
      </div>

      {/* File Details / Preview Inspector */}
      {selectedNode && activeTab !== 'storage' && activeTab !== 'settings' && (
        <PreviewDrawer
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onExport={handleExportNode}
          onOpenWithDefault={handleOpenWithDefault}
          onRename={handleOpenRenameModal}
        />
      )}

      {/* New Folder Modal */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#09090B]/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white border border-[#E4E4E7] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="font-serif text-[18px] text-[#09090B] font-medium">New Folder</h3>
              <p className="text-[12px] text-[#71717A] font-sans mt-0.5">Enter a name for your new directory.</p>
            </div>
            <form onSubmit={handleConfirmCreateFolder} className="space-y-4">
              <input
                type="text"
                autoFocus
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                placeholder="Folder name"
                className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] focus:border-[#09090B] focus:bg-white rounded-lg text-[13px] font-sans text-[#09090B] outline-none transition-all"
              />
              <div className="flex items-center justify-end gap-2 pt-1 font-sans text-[13px]">
                <button
                  type="button"
                  onClick={() => setFolderModalOpen(false)}
                  className="px-3.5 h-8 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!folderNameInput.trim()}
                  className="px-4 h-8 rounded-lg bg-[#18181B] text-white font-medium hover:bg-[#27272A] disabled:opacity-50 transition-colors shadow-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModalOpen && targetRenameNode && (
        <div className="fixed inset-0 z-50 bg-[#09090B]/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white border border-[#E4E4E7] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="font-serif text-[18px] text-[#09090B] font-medium">Rename {targetRenameNode.type === 'folder' ? 'Folder' : 'File'}</h3>
              <p className="text-[12px] text-[#71717A] font-sans mt-0.5">Enter a new name for this item.</p>
            </div>
            <form onSubmit={handleConfirmRename} className="space-y-4">
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="New name"
                className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] focus:border-[#09090B] focus:bg-white rounded-lg text-[13px] font-sans text-[#09090B] outline-none transition-all"
              />
              <div className="flex items-center justify-end gap-2 pt-1 font-sans text-[13px]">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-3.5 h-8 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameInput.trim()}
                  className="px-4 h-8 rounded-lg bg-[#18181B] text-white font-medium hover:bg-[#27272A] disabled:opacity-50 transition-colors shadow-xs"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {showUpdateModal && updateState && (
        <UpdateModal
          updateState={updateState}
          onClose={() => setShowUpdateModal(false)}
          onUpdateNow={handleStartDownload}
          onRestartInstall={handleRestartInstall}
          onDismiss={handleDismissUpdate}
        />
      )}

      {/* Vault Custom Confirm / Alert Modal */}
      <ConfirmModal
        config={confirmConfig}
        onClose={() => setConfirmConfig(null)}
      />
    </div>
  );
};

