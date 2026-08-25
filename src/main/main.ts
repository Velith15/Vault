import { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { DatabaseService } from './services/database/DatabaseService';
import { StorageEngine } from './services/storage/StorageEngine';
import { OptimizationQueue } from './services/storage/OptimizationQueue';
import { StorageMetricsService } from './services/metrics/StorageMetricsService';
import { UpdateService } from './services/update/UpdateService';
import { SearchQuery, CompressionProfile, CompressionSettings } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;
let storageEngine: StorageEngine;
let optimizationQueue: OptimizationQueue;
let metricsService: StorageMetricsService;
let updateService: UpdateService;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function getVaultDataDir(): string {
  const userData = app.getPath('userData');
  const vaultDir = path.join(userData, 'vault_data');
  return vaultDir;
}

function getAppIconPath(): string {
  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  const isWindows = process.platform === 'win32';
  const iconExt = isWindows ? 'icon.ico' : 'icon.png';

  const possiblePaths = isDev
    ? [
        path.join(app.getAppPath(), 'build', iconExt),
        path.join(app.getAppPath(), 'build', 'icon.png'),
        path.join(process.cwd(), 'build', iconExt),
        path.join(process.cwd(), 'build', 'icon.png'),
      ]
    : [
        path.join(process.resourcesPath, 'build', iconExt),
        path.join(process.resourcesPath, 'build', 'icon.png'),
        path.join(app.getAppPath(), 'build', iconExt),
        path.join(app.getAppPath(), 'build', 'icon.png'),
      ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return path.join(app.getAppPath(), 'build', 'icon.png');
}

function createWindow() {
  const vaultDir = getVaultDataDir();
  const dbPath = path.join(vaultDir, 'metadata', 'vault.db');

  dbService = new DatabaseService(dbPath);
  storageEngine = new StorageEngine(vaultDir, dbService);
  optimizationQueue = new OptimizationQueue(storageEngine, dbService);
  metricsService = new StorageMetricsService(vaultDir, dbService);

  // Hook up optimization queue events to IPC
  optimizationQueue.on('progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vault:optimization-progress-changed', progress);
    }
  });

  // Run startup integrity check & 7-day trash auto-purge
  storageEngine.runIntegrityCheck().then(async (report) => {
    console.log('[Vault Startup] Integrity Report:', report);
    await storageEngine.purgeExpiredTrash(7);
  }).catch((err) => {
    console.error('[Vault Startup] Integrity Check Error:', err);
  });

  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Vault',
    icon: iconPath,
    backgroundColor: '#FAFAFA',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);
  Menu.setApplicationMenu(null);

  if (iconPath && fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath);
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (updateService) updateService.setMainWindow(null);
  });

  if (updateService) {
    updateService.setMainWindow(mainWindow);
    updateService.checkForUpdates(false).catch((err) => {
      console.error('[Vault Startup] Auto update check error:', err);
    });
  }
}

// Setup IPC Handlers
function setupIpcHandlers() {
  ipcMain.handle('vault:get-nodes', async (_, query: SearchQuery) => {
    return dbService.getNodes(query);
  });

  ipcMain.handle('vault:get-node-by-id', async (_, id: string) => {
    return dbService.getNodeById(id);
  });

  ipcMain.handle('vault:get-folder-ancestors', async (_, folderId: string) => {
    return dbService.getFolderAncestors(folderId);
  });

  ipcMain.handle('vault:create-folder', async (_, name: string, parentId?: string | null) => {
    return storageEngine.createFolder(name, parentId || null);
  });

  ipcMain.handle('vault:rename-node', async (_, id: string, newName: string) => {
    return dbService.renameNode(id, newName);
  });

  ipcMain.handle('vault:move-node', async (_, id: string, newParentId: string | null) => {
    return dbService.moveNode(id, newParentId);
  });

  ipcMain.handle('vault:toggle-starred', async (_, id: string) => {
    return dbService.toggleStarred(id);
  });

  ipcMain.handle('vault:trash-node', async (_, id: string, trashed: boolean) => {
    return dbService.trashNode(id, trashed);
  });

  ipcMain.handle('vault:delete-permanently', async (_, id: string) => {
    return storageEngine.deletePermanently(id);
  });

  ipcMain.handle('vault:empty-trash', async () => {
    return storageEngine.emptyTrash();
  });

  ipcMain.handle('vault:select-and-import-files', async (event, parentFolderId?: string | null, deleteSource: boolean = true) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      title: 'Import Files into Vault',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { successful: [], failed: [] };
    }

    const successful: any[] = [];
    const failed: any[] = [];

    for (const filePath of result.filePaths) {
      try {
        const node = await storageEngine.importLocalFile(filePath, parentFolderId || null, undefined, deleteSource);
        successful.push(node);
      } catch (err: any) {
        failed.push({ name: path.basename(filePath), error: err.message });
      }
    }

    return { successful, failed };
  });

  ipcMain.handle('vault:import-file-paths', async (_, filePaths: string[], parentFolderId?: string | null, deleteSource: boolean = true) => {
    const successful: any[] = [];
    const failed: any[] = [];

    for (const filePath of filePaths) {
      try {
        const node = await storageEngine.importLocalFile(filePath, parentFolderId || null, undefined, deleteSource);
        successful.push(node);
      } catch (err: any) {
        failed.push({ name: path.basename(filePath), error: err.message });
      }
    }

    return { successful, failed };
  });

  ipcMain.handle('vault:import-buffer', async (_, buffer: Uint8Array, name: string, parentFolderId?: string | null) => {
    return storageEngine.importBuffer(Buffer.from(buffer), name, parentFolderId || null);
  });

  ipcMain.handle('vault:export-file', async (event, nodeId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const node = dbService.getNodeById(nodeId);
    if (!node) throw new Error('File not found');

    const result = await dialog.showSaveDialog(win!, {
      defaultPath: node.name,
      title: 'Export File from Vault',
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return storageEngine.exportFile(nodeId, path.dirname(result.filePath));
  });

  ipcMain.handle('vault:open-with-default-app', async (_, nodeId: string) => {
    const node = dbService.getNodeById(nodeId);
    if (!node || !node.objectHash) throw new Error('File not found');

    const tempExportPath = path.join(app.getPath('temp'), `vault_view_${Date.now()}_${node.name}`);
    const decompressed = await storageEngine.getObjectBuffer(node.objectHash);
    await fs.promises.writeFile(tempExportPath, decompressed);
    await shell.openPath(tempExportPath);
  });

  ipcMain.on('vault:start-drag', async (event, nodeId: string) => {
    try {
      const node = dbService.getNodeById(nodeId);
      const { filePath } = await storageEngine.prepareDragOut(nodeId);
      
      let dragIcon = nativeImage.createEmpty();
      
      // If file is an image and under 20MB, try to generate a thumbnail icon for the drag preview
      if (node && node.mimeType?.startsWith('image/') && node.size < 20 * 1024 * 1024) {
        try {
          const img = nativeImage.createFromPath(filePath);
          if (!img.isEmpty()) {
            dragIcon = img.resize({ width: 48, height: 48 });
          }
        } catch {}
      }

      // If no image thumbnail, use resized application icon (32x32 minimal size)
      if (dragIcon.isEmpty()) {
        const iconPath = getAppIconPath();
        if (iconPath && fs.existsSync(iconPath)) {
          const rawAppIcon = nativeImage.createFromPath(iconPath);
          dragIcon = rawAppIcon.resize({ width: 32, height: 32 });
        }
      }

      event.sender.startDrag({
        file: filePath,
        icon: dragIcon
      });
    } catch (err) {
      console.error('[Vault DragOut] Failed to start native drag:', err);
    }
  });

  ipcMain.handle('vault:get-file-preview', async (_, nodeId: string) => {
    return storageEngine.getFilePreviewData(nodeId);
  });

  ipcMain.handle('vault:get-object-data-url', async (_, hash: string) => {
    const decompressed = await storageEngine.getObjectBuffer(hash);
    if (decompressed.length > 100 * 1024 * 1024) {
      throw new Error('File is too large for inline preview Data URL (>100MB)');
    }
    const node = dbService.getNodeByHash(hash);
    const mimeType = node?.mimeType || 'application/octet-stream';
    const base64 = decompressed.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  });

  ipcMain.handle('vault:get-storage-metrics', async () => {
    return metricsService.getMetrics();
  });

  ipcMain.handle('vault:run-integrity-check', async () => {
    return storageEngine.runIntegrityCheck();
  });

  // Storage Optimization IPC Handlers
  ipcMain.handle('vault:get-compression-settings', async () => {
    return dbService.getCompressionSettings();
  });

  ipcMain.handle('vault:set-compression-settings', async (_, settings: Partial<CompressionSettings>) => {
    return dbService.setCompressionSettings(settings);
  });

  ipcMain.handle('vault:analyze-optimization', async () => {
    return storageEngine.analyzeStorageOptimization();
  });

  ipcMain.handle('vault:start-optimization', async (_, profile?: CompressionProfile) => {
    return optimizationQueue.startOptimization(profile);
  });

  ipcMain.handle('vault:pause-optimization', async () => {
    optimizationQueue.pause();
    return optimizationQueue.getProgress();
  });

  ipcMain.handle('vault:resume-optimization', async () => {
    optimizationQueue.resume();
    return optimizationQueue.getProgress();
  });

  ipcMain.handle('vault:cancel-optimization', async () => {
    optimizationQueue.cancel();
    return optimizationQueue.getProgress();
  });

  ipcMain.handle('vault:get-optimization-progress', async () => {
    return optimizationQueue.getProgress();
  });

  // Update handlers
  ipcMain.handle('vault:get-update-state', async () => {
    return updateService.getState();
  });

  ipcMain.handle('vault:check-for-updates', async (_, manual?: boolean) => {
    return updateService.checkForUpdates(manual);
  });

  ipcMain.handle('vault:download-update', async () => {
    return updateService.downloadUpdate();
  });

  ipcMain.handle('vault:install-update', async () => {
    return updateService.installUpdate();
  });

  ipcMain.handle('vault:dismiss-update', async (_, version: string) => {
    return updateService.dismissUpdate(version);
  });

  ipcMain.handle('vault:get-app-version', async () => {
    return updateService.getCurrentVersion();
  });
}

app.whenReady().then(() => {
  updateService = new UpdateService();
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (dbService) dbService.close();
    app.quit();
  }
});
