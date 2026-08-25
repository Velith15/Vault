import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  RotateCw, 
  Trash2, 
  HardDrive, 
  FolderLock, 
  Sparkles,
  CheckCircle2,
  Download,
  AlertCircle,
  RefreshCw,
  Zap,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import { UpdateState, CompressionSettings, CompressionMode, CompressionProfile } from '@shared/types';
import logoImg from '../assets/logo.jpg';
import { ConfirmModal, ConfirmModalConfig } from './ConfirmModal';

interface SettingsPageProps {
  onRefresh: () => void;
  updateState?: UpdateState | null;
  onCheckForUpdates?: () => void;
  onOpenUpdateModal?: () => void;
  onStartDownload?: () => void;
  onRestartInstall?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ 
  onRefresh,
  updateState,
  onCheckForUpdates,
  onOpenUpdateModal,
  onStartDownload,
  onRestartInstall
}) => {
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('0.2.511');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmModalConfig | null>(null);

  // Compression Settings State
  const [compSettings, setCompSettings] = useState<CompressionSettings>({
    autoCompression: true,
    mode: 'automatic',
    profile: 'BALANCED',
    minSavingsThresholdPercent: 5,
    minFileSizeToCompress: 1024,
    backgroundCpuLimitPercent: 50,
  });

  useEffect(() => {
    if (api?.getAppVersion) {
      api.getAppVersion().then((v) => setAppVersion(v)).catch(() => {});
    }
    if (api?.getCompressionSettings) {
      api.getCompressionSettings().then((s) => setCompSettings(s)).catch(() => {});
    }
  }, []);

  const handleUpdateSetting = async (key: keyof CompressionSettings, value: any) => {
    const updated = { ...compSettings, [key]: value };
    setCompSettings(updated);
    if (api?.setCompressionSettings) {
      await api.setCompressionSettings({ [key]: value });
    }
  };

  const handleEmptyTrash = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Empty Trash & Shred Storage?',
      message: 'This will permanently shred all unreferenced physical CAS objects from disk. This cannot be undone.',
      confirmText: 'Empty Trash & Shred',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.emptyTrash();
          setStatusMsg('Trash emptied and storage reclaimed successfully.');
          onRefresh();
        } catch (err: any) {
          setStatusMsg(`Error: ${err?.message || err}`);
        }
      },
    });
  };

  const handleIntegrityCheck = async () => {
    setRunning(true);
    setStatusMsg(null);
    try {
      const report = await api.runIntegrityCheck();
      setStatusMsg(`Integrity check complete: Database is ${report.databaseValid ? 'healthy' : 'corrupted'}. ${report.compressedObjectsVerified} compressed objects verified, ${report.orphanedObjectsCount} orphans, ${report.missingObjectsCount} missing.`);
      onRefresh();
    } catch (err: any) {
      setStatusMsg(`Integrity error: ${err?.message || err}`);
    } finally {
      setRunning(false);
    }
  };

  const handleManualCheck = async () => {
    setCheckingUpdate(true);
    try {
      if (onCheckForUpdates) {
        await onCheckForUpdates();
      } else if (api?.checkForUpdates) {
        await api.checkForUpdates(true);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const isChecking = checkingUpdate || updateState?.status === 'checking';
  const status = updateState?.status || 'idle';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 select-none text-[13px]">
      <div>
        <h1 className="text-[18px] font-semibold text-[#09090B]">Vault Settings & Maintenance</h1>
        <p className="text-[12px] text-[#71717A] mt-0.5">
          Intelligent storage optimization, virtual integrity, and local privacy guarantees.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Intelligent Compression Settings Card */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 space-y-4 shadow-2xs">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h2 className="text-[15px] font-semibold text-[#09090B] flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Intelligent Lossless Compression</span>
            </h2>
            <p className="text-[12px] text-[#71717A]">
              Automatically optimize files with Zstandard without loss of fidelity.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={compSettings.autoCompression} 
              onChange={(e) => handleUpdateSetting('autoCompression', e.target.checked)} 
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[#E4E4E7] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D4D4D8] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#18181B]"></div>
          </label>
        </div>

        <div className="pt-3 border-t border-[#F4F4F5] grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Optimization Mode */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-[#09090B]">Compression Mode</label>
            <select
              value={compSettings.mode}
              onChange={(e) => handleUpdateSetting('mode', e.target.value as CompressionMode)}
              className="w-full h-8 px-2.5 bg-[#FAFAFA] border border-[#E4E4E7] rounded-md text-[12px] text-[#09090B] focus:border-[#18181B] outline-none"
            >
              <option value="automatic">Automatic (Intelligent Detection)</option>
              <option value="maximum_savings">Maximum Savings (Prioritize Size)</option>
              <option value="performance">Performance (Fast & Low Resource)</option>
              <option value="off">Off (Disable Compression)</option>
            </select>
          </div>

          {/* Compression Level Profile */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-[#09090B]">Compression Profile</label>
            <select
              value={compSettings.profile}
              onChange={(e) => handleUpdateSetting('profile', e.target.value as CompressionProfile)}
              className="w-full h-8 px-2.5 bg-[#FAFAFA] border border-[#E4E4E7] rounded-md text-[12px] text-[#09090B] focus:border-[#18181B] outline-none"
            >
              <option value="BALANCED">Balanced (Zstd Level 3 - Default)</option>
              <option value="FAST">Fast (Zstd Level 1 - Speed)</option>
              <option value="MAXIMUM">Maximum (Zstd Level 9 - Highest Ratio)</option>
            </select>
          </div>

          {/* Minimum Savings Threshold */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[12px]">
              <span className="font-medium text-[#09090B]">Minimum Savings Threshold</span>
              <span className="font-mono text-[#71717A]">{compSettings.minSavingsThresholdPercent}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={compSettings.minSavingsThresholdPercent}
              onChange={(e) => handleUpdateSetting('minSavingsThresholdPercent', Number(e.target.value))}
              className="w-full accent-[#18181B]"
            />
            <p className="text-[11px] text-[#71717A]">
              Discard compression if file does not shrink by at least {compSettings.minSavingsThresholdPercent}%.
            </p>
          </div>

          {/* Background CPU Throttle */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[12px]">
              <span className="font-medium text-[#09090B]">Background CPU Limit</span>
              <span className="font-mono text-[#71717A]">{compSettings.backgroundCpuLimitPercent}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={10}
              value={compSettings.backgroundCpuLimitPercent}
              onChange={(e) => handleUpdateSetting('backgroundCpuLimitPercent', Number(e.target.value))}
              className="w-full accent-[#18181B]"
            />
            <p className="text-[11px] text-[#71717A]">
              Controls resource consumption during background library optimizations.
            </p>
          </div>
        </div>
      </div>

      {/* About Vault & Updates Section */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 space-y-4 shadow-2xs">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="font-serif text-[17px] font-medium text-[#09090B] flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-white overflow-hidden border border-[#E4E4E7] flex items-center justify-center shadow-xs flex-shrink-0">
                <img src={logoImg} alt="Vault Logo" className="w-full h-full object-cover" />
              </div>
              <span>About Vault</span>
            </h2>
            <div className="text-[13px] text-[#3F3F46]">
              Version <span className="font-semibold text-[#09090B]">{appVersion}</span>
            </div>
          </div>
          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            className="h-8 px-3 rounded-md border border-[#E4E4E7] text-[12px] font-medium text-[#09090B] hover:bg-[#F4F4F5] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Check for Updates'}</span>
          </button>
        </div>

        <div className="pt-3 border-t border-[#F4F4F5]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] block mb-2">Updates</span>
          
          {status === 'available' && updateState?.updateInfo ? (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900 text-[13px]">
                  Vault {updateState.updateInfo.version} is available.
                </span>
                <span className="text-[11px] text-amber-700">New Version Ready</span>
              </div>
              <div className="flex items-center gap-2">
                {onOpenUpdateModal && (
                  <button
                    onClick={onOpenUpdateModal}
                    className="h-7 px-3 rounded-md border border-amber-300 text-amber-900 text-[12px] font-medium hover:bg-amber-100 transition-colors"
                  >
                    View Release Notes
                  </button>
                )}
                <button
                  onClick={onStartDownload || onOpenUpdateModal}
                  className="h-7 px-3 rounded-md bg-[#18181B] text-white text-[12px] font-medium hover:bg-[#27272A] transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Update Now</span>
                </button>
              </div>
            </div>
          ) : status === 'downloading' ? (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2 text-[12px] text-blue-900">
              <div className="flex items-center justify-between font-medium">
                <span>Downloading Vault {updateState?.updateInfo?.version || 'update'}...</span>
                <span>{updateState?.progress?.percent || 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ width: `${updateState?.progress?.percent || 0}%` }}
                />
              </div>
            </div>
          ) : status === 'downloaded' ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <span className="font-medium text-emerald-900 text-[12px]">
                Update ready — Restart Vault to install.
              </span>
              <button
                onClick={onRestartInstall}
                className="h-7 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restart Vault</span>
              </button>
            </div>
          ) : status === 'offline' ? (
            <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-[12px] text-[#71717A] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>Unable to check for updates. You're offline or the update server is unavailable.</span>
            </div>
          ) : status === 'error' ? (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12px] text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{updateState?.error || 'Failed to check for updates.'}</span>
            </div>
          ) : (
            <div className="text-[12px] text-[#71717A] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>You're using the latest version.</span>
              {updateState?.lastCheckedAt && (
                <span className="text-[11px] text-[#A1A1AA] ml-auto">
                  Last checked: {new Date(updateState.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E4E7] divide-y divide-[#E4E4E7] shadow-2xs">
        {/* Integrity Verification */}
        <div className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#09090B] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Storage Integrity Scan</span>
            </div>
            <p className="text-[12px] text-[#71717A]">
              Validate SQLite indexes, verify SHA-256 CAS object payloads, and ensure container health.
            </p>
          </div>
          <button
            onClick={handleIntegrityCheck}
            disabled={running}
            className="h-8 px-3 rounded-md border border-[#E4E4E7] text-[12px] font-medium text-[#09090B] hover:bg-[#F4F4F5] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Checking...' : 'Run Scan'}</span>
          </button>
        </div>

        {/* Empty Trash */}
        <div className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#09090B] flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Empty Trash & Reclaim Space</span>
            </div>
            <p className="text-[12px] text-[#71717A]">
              Permanently shreds deleted records and removes physical CAS files with 0 remaining logical references.
            </p>
          </div>
          <button
            onClick={handleEmptyTrash}
            className="h-8 px-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium hover:bg-rose-100 transition-colors"
          >
            Empty Trash
          </button>
        </div>

        {/* Ingestion Behavior */}
        <div className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#09090B] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#09090B]" />
              <span>Import Behavior (Move from Desktop)</span>
            </div>
            <p className="text-[12px] text-[#71717A]">
              When files are imported into Vault, move them into Vault storage and delete the original copy from source folder.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
            Move into Vault (Active)
          </span>
        </div>

        {/* Local-First Architecture Badge */}
        <div className="p-4 space-y-2">
          <div className="font-semibold text-[#09090B] flex items-center gap-2">
            <FolderLock className="w-4 h-4 text-[#09090B]" />
            <span>Local-First & Zero Telemetry</span>
          </div>
          <p className="text-[12px] text-[#71717A] leading-relaxed">
            Vault executes 100% locally on your machine. All Zstandard compression, deduplication, SHA-256 checksums, SQLite indexing, and previews run in-process without network egress or cloud telemetry.
          </p>
        </div>
      </div>

      <ConfirmModal
        config={confirmConfig}
        onClose={() => setConfirmConfig(null)}
      />
    </div>
  );
};
