import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { DatabaseService } from './services/database/DatabaseService';
import { StorageEngine } from './services/storage/StorageEngine';
import { StorageMetricsService } from './services/metrics/StorageMetricsService';
import { UpdateService } from './services/update/UpdateService';
import { SearchQuery } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;
let storageEngine: StorageEngine;
let metricsService: StorageMetricsService;
let updateService: UpdateService;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function getVaultDataDir(): string {
  // Vault data directory inside user app data or local folder
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
  metricsService = new StorageMetricsService(vaultDir, dbService);

  // Run startup integrity check & cleanup
  storageEngine.runIntegrityCheck().then((report) => {
    console.log('[Vault Startup] Integrity Report:', report);
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
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

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
    // Non-blocking auto-check for updates on app launch
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

    const objPath = storageEngine.getObjectPath(node.objectHash!);
    await fs.promises.copyFile(objPath, result.filePath);
    return result.filePath;
  });

  ipcMain.handle('vault:open-with-default-app', async (_, nodeId: string) => {
    const node = dbService.getNodeById(nodeId);
    if (!node || !node.objectHash) throw new Error('File not found');

    // Create a temporary readable copy with original filename to open seamlessly with system app
    const tempExportPath = path.join(app.getPath('temp'), `vault_view_${Date.now()}_${node.name}`);
    const objPath = storageEngine.getObjectPath(node.objectHash);
    await fs.promises.copyFile(objPath, tempExportPath);
    await shell.openPath(tempExportPath);
  });

  ipcMain.handle('vault:get-file-preview', async (_, nodeId: string) => {
    return storageEngine.getFilePreviewData(nodeId);
  });

  ipcMain.handle('vault:get-object-data-url', async (_, hash: string) => {
    const objPath = storageEngine.getObjectPath(hash);
    if (!fs.existsSync(objPath)) {
      throw new Error('Object not found');
    }
    const stat = await fs.promises.stat(objPath);
    if (stat.size > 100 * 1024 * 1024) {
      throw new Error('File is too large for inline preview Data URL (>100MB)');
    }
    const buffer = await fs.promises.readFile(objPath);
    // Find mime
    const base64 = buffer.toString('base64');
    return `data:application/octet-stream;base64,${base64}`;
  });

  ipcMain.handle('vault:get-storage-metrics', async () => {
    return metricsService.getMetrics();
  });

  ipcMain.handle('vault:run-integrity-check', async () => {
    return storageEngine.runIntegrityCheck();
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
