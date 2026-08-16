import { app, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo as ElectronUpdateInfo, ProgressInfo } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import { UpdateState, UpdateStatus, UpdateInfo, UpdateProgress } from '../../../shared/types';

interface UpdatePreferences {
  lastCheckedAt: string | null;
  dismissedVersion: string | null;
}

export class UpdateService {
  private state: UpdateState;
  private mainWindow: BrowserWindow | null = null;
  private configPath: string;
  private preferences: UpdatePreferences;
  private checkIntervalMs = 4 * 60 * 60 * 1000; // 4 hours throttle for auto-checks

  constructor() {
    const userData = app.getPath('userData');
    this.configPath = path.join(userData, 'update_preferences.json');
    this.preferences = this.loadPreferences();

    this.state = {
      status: 'idle',
      currentVersion: app.getVersion(),
      updateInfo: null,
      progress: null,
      error: null,
      lastCheckedAt: this.preferences.lastCheckedAt,
      dismissedVersion: this.preferences.dismissedVersion,
      isManualCheck: false,
    };

    this.configureAutoUpdater();
    this.setupListeners();
  }

  public setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;
    // Push initial state once window is set
    this.broadcastState();
  }

  private loadPreferences(): UpdatePreferences {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[UpdateService] Failed to load update preferences:', err);
    }
    return { lastCheckedAt: null, dismissedVersion: null };
  }

  private savePreferences() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.preferences, null, 2), 'utf-8');
    } catch (err) {
      console.error('[UpdateService] Failed to save update preferences:', err);
    }
  }

  private configureAutoUpdater() {
    autoUpdater.autoDownload = false; // User must click "Update Now" to start download
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Disable logger spam in development if needed
    autoUpdater.logger = {
      info: (msg: any) => console.log('[autoUpdater]', msg),
      warn: (msg: any) => console.warn('[autoUpdater]', msg),
      error: (msg: any) => console.error('[autoUpdater]', msg),
    };
  }

  private setupListeners() {
    autoUpdater.on('checking-for-update', () => {
      this.updateState({ status: 'checking', error: null });
    });

    autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      const formattedInfo: UpdateInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(n => typeof n === 'string' ? n : n.note).join('\n')
          : (info.releaseNotes as string) || 'No release notes provided.',
        files: info.files?.map(f => ({ url: f.url, sha512: f.sha512, size: f.size })),
        path: info.path,
        sha512: info.sha512,
      };

      const lastCheckTime = new Date().toISOString();
      this.preferences.lastCheckedAt = lastCheckTime;
      this.savePreferences();

      this.updateState({
        status: 'available',
        updateInfo: formattedInfo,
        error: null,
        lastCheckedAt: lastCheckTime,
      });
    });

    autoUpdater.on('update-not-available', () => {
      const lastCheckTime = new Date().toISOString();
      this.preferences.lastCheckedAt = lastCheckTime;
      this.savePreferences();

      this.updateState({
        status: 'not-available',
        updateInfo: null,
        error: null,
        lastCheckedAt: lastCheckTime,
      });
    });

    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      const progress: UpdateProgress = {
        bytesPerSecond: progressObj.bytesPerSecond,
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
      };

      this.updateState({
        status: 'downloading',
        progress,
        error: null,
      });
    });

    autoUpdater.on('update-downloaded', () => {
      this.updateState({
        status: 'downloaded',
        progress: null,
        error: null,
      });
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('[UpdateService] Update error:', err);
      const isOffline = err.message.includes('net::ERR_INTERNET_DISCONNECTED') || 
                        err.message.includes('ENOTFOUND') || 
                        err.message.includes('ETIMEDOUT') ||
                        err.message.includes('cannot download');

      const status: UpdateStatus = isOffline ? 'offline' : 'error';
      const errorMessage = isOffline
        ? "Unable to check for updates. You're offline or the update server is unavailable."
        : `Update error: ${err.message || 'An unknown error occurred'}`;

      const lastCheckTime = new Date().toISOString();
      this.preferences.lastCheckedAt = lastCheckTime;
      this.savePreferences();

      this.updateState({
        status,
        error: errorMessage,
        lastCheckedAt: lastCheckTime,
      });
    });
  }

  private updateState(partial: Partial<UpdateState>) {
    this.state = {
      ...this.state,
      ...partial,
    };
    this.broadcastState();
  }

  private broadcastState() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('vault:update-state-changed', this.state);
    }
  }

  public getState(): UpdateState {
    return { ...this.state };
  }

  public getCurrentVersion(): string {
    return app.getVersion();
  }

  public async checkForUpdates(manual = false): Promise<UpdateState> {
    this.state.isManualCheck = manual;

    // Check throttle for auto-checks
    if (!manual && this.preferences.lastCheckedAt) {
      const lastCheck = new Date(this.preferences.lastCheckedAt).getTime();
      const now = Date.now();
      if (now - lastCheck < this.checkIntervalMs) {
        console.log('[UpdateService] Auto-check skipped: checked recently.');
        return this.getState();
      }
    }

    // In dev mode (unpackaged app), electron-updater expects dev-app-update.yml
    if (!app.isPackaged) {
      console.log('[UpdateService] App is unpackaged (Dev Mode). Simulating check.');
      this.updateState({ status: 'checking', error: null });

      await new Promise(res => setTimeout(res, 600));

      const lastCheckTime = new Date().toISOString();
      this.preferences.lastCheckedAt = lastCheckTime;
      this.savePreferences();

      this.updateState({
        status: 'not-available',
        updateInfo: null,
        error: null,
        lastCheckedAt: lastCheckTime,
      });
      return this.getState();
    }

    try {
      this.updateState({ status: 'checking', error: null });
      await autoUpdater.checkForUpdates();
    } catch (err: any) {
      console.error('[UpdateService] Exception during checkForUpdates:', err);
      const isOffline = err.message?.includes('net::ERR_INTERNET_DISCONNECTED') || 
                        err.message?.includes('ENOTFOUND') || 
                        err.message?.includes('ETIMEDOUT');
      this.updateState({
        status: isOffline ? 'offline' : 'error',
        error: isOffline 
          ? "Unable to check for updates. You're offline or the update server is unavailable."
          : `Check failed: ${err.message}`,
      });
    }

    return this.getState();
  }

  public async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) {
      // Simulate download in dev mode for UI testing
      this.updateState({ status: 'downloading', progress: { percent: 0, bytesPerSecond: 1024 * 1024, transferred: 0, total: 100 * 1024 * 1024 } });
      let pct = 0;
      const timer = setInterval(() => {
        pct += 25;
        if (pct >= 100) {
          clearInterval(timer);
          this.updateState({ status: 'downloaded', progress: null });
        } else {
          this.updateState({
            status: 'downloading',
            progress: { percent: pct, bytesPerSecond: 2.5 * 1024 * 1024, transferred: (pct / 100) * 50 * 1024 * 1024, total: 50 * 1024 * 1024 },
          });
        }
      }, 500);
      return;
    }

    try {
      this.updateState({ status: 'downloading', error: null });
      await autoUpdater.downloadUpdate();
    } catch (err: any) {
      this.updateState({
        status: 'error',
        error: `Download failed: ${err.message}`,
      });
    }
  }

  public dismissUpdate(version: string) {
    this.preferences.dismissedVersion = version;
    this.savePreferences();
    this.updateState({ dismissedVersion: version });
  }

  public installUpdate() {
    if (!app.isPackaged) {
      console.log('[UpdateService] Dev mode: installUpdate requested.');
      return;
    }
    // Quit and install silently, launching new version
    autoUpdater.quitAndInstall(false, true);
  }
}
