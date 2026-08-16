import React, { useState } from 'react';
import { 
  HardDrive, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  Layers, 
  RotateCw,
  FolderTree
} from 'lucide-react';
import { StorageMetrics, IntegrityReport } from '@shared/types';
import { api } from '../services/api';
import { formatBytes } from '../utils/formatters';

interface StoragePageProps {
  metrics: StorageMetrics | null;
  onRefreshMetrics: () => void;
}

export const StoragePage: React.FC<StoragePageProps> = ({
  metrics,
  onRefreshMetrics,
}) => {
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [runningCheck, setRunningCheck] = useState(false);

  const handleRunIntegrity = async () => {
    setRunningCheck(true);
    try {
      const report = await api.runIntegrityCheck();
      setIntegrityReport(report);
      onRefreshMetrics();
    } catch (err) {
      console.error(err);
    } finally {
      setRunningCheck(false);
    }
  };

  if (!metrics) {
    return <div className="p-8 text-[13px] text-[#71717A]">Loading storage metrics...</div>;
  }

  const diskUsedPercent = Math.min(100, Math.round((metrics.usedDiskSpace / metrics.totalDiskSpace) * 100)) || 0;
  const vaultDiskPercent = Math.min(100, (metrics.vaultManagedBytes / metrics.totalDiskSpace) * 100).toFixed(2);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 select-none">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#09090B]">Vault Storage Engine</h1>
          <p className="text-[12px] text-[#71717A] mt-0.5">
            Physical Content-Addressed Storage & Local Disk Overview
          </p>
        </div>
        <button
          onClick={handleRunIntegrity}
          disabled={runningCheck}
          className="h-8 px-3 rounded-md border border-[#E4E4E7] text-[12px] font-medium text-[#09090B] hover:bg-[#F4F4F5] flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${runningCheck ? 'animate-spin' : ''}`} />
          <span>{runningCheck ? 'Verifying Integrity...' : 'Verify Integrity'}</span>
        </button>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Managed Storage */}
        <div className="p-4 rounded-lg bg-white border border-[#E4E4E7] space-y-2">
          <div className="flex items-center justify-between text-[#71717A] text-[12px]">
            <span>Vault Managed Storage</span>
            <Database className="w-4 h-4 text-[#09090B]" />
          </div>
          <div className="text-[22px] font-semibold text-[#09090B] font-mono">
            {formatBytes(metrics.vaultManagedBytes)}
          </div>
          <div className="text-[11px] text-[#71717A]">
            {metrics.totalObjects} unique CAS physical objects
          </div>
        </div>

        {/* Deduplication Savings */}
        <div className="p-4 rounded-lg bg-white border border-[#E4E4E7] space-y-2">
          <div className="flex items-center justify-between text-[#71717A] text-[12px]">
            <span>Deduplication Savings</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-[22px] font-semibold text-emerald-700 font-mono">
            {formatBytes(metrics.deduplicatedSavingsBytes)}
          </div>
          <div className="text-[11px] text-[#71717A]">
            Raw logical size: {formatBytes(metrics.vaultRawLogicalBytes)}
          </div>
        </div>

        {/* Local Disk Available */}
        <div className="p-4 rounded-lg bg-white border border-[#E4E4E7] space-y-2">
          <div className="flex items-center justify-between text-[#71717A] text-[12px]">
            <span>Available on Host Disk</span>
            <HardDrive className="w-4 h-4 text-[#09090B]" />
          </div>
          <div className="text-[22px] font-semibold text-[#09090B] font-mono">
            {formatBytes(metrics.availableDiskSpace)}
          </div>
          <div className="text-[11px] text-[#71717A]">
            Total drive: {formatBytes(metrics.totalDiskSpace)}
          </div>
        </div>
      </div>

      {/* Host Disk Capacity Bar */}
      <div className="p-6 rounded-2xl bg-white border border-[#E4E4E7] space-y-4 shadow-2xs">
        <div className="flex justify-between items-center text-[13px]">
          <div>
            <span className="font-medium text-[#09090B] font-sans">Host Drive Space Distribution</span>
            <p className="text-[11px] text-[#71717A] mt-0.5">Physical breakdown of your local drive</p>
          </div>
          <span className="font-mono text-[13px] font-semibold text-[#09090B]">{diskUsedPercent}% Used</span>
        </div>

        {/* 3-Segment Capacity Bar: Vault (Emerald/Highlight), System (Dark Slate), Free (Light Gray) */}
        <div className="w-full h-3.5 bg-[#F4F4F5] rounded-full overflow-hidden flex border border-[#E4E4E7]/80 p-0.5 gap-0.5">
          {/* Vault Managed Portion */}
          {metrics.vaultManagedBytes > 0 && (
            <div
              style={{ width: `${Math.max(1, (metrics.vaultManagedBytes / metrics.totalDiskSpace) * 100)}%` }}
              className="bg-emerald-600 h-full rounded-l-full transition-all duration-300"
              title={`Vault Storage: ${formatBytes(metrics.vaultManagedBytes)}`}
            />
          )}
          {/* Other System / App Usage */}
          <div
            style={{ 
              width: `${Math.max(1, ((metrics.usedDiskSpace - metrics.vaultManagedBytes) / metrics.totalDiskSpace) * 100)}%` 
            }}
            className={`bg-[#18181B] h-full ${metrics.vaultManagedBytes === 0 ? 'rounded-l-full' : ''} transition-all duration-300`}
            title={`Other System & Apps: ${formatBytes(metrics.usedDiskSpace - metrics.vaultManagedBytes)}`}
          />
          {/* Remaining Available */}
          <div
            style={{ 
              width: `${Math.max(0, (metrics.availableDiskSpace / metrics.totalDiskSpace) * 100)}%` 
            }}
            className="bg-[#E4E4E7] h-full rounded-r-full transition-all duration-300"
            title={`Available Disk Space: ${formatBytes(metrics.availableDiskSpace)}`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-[12px] text-[#71717A] pt-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-2xs" />
            <span className="font-medium text-[#09090B]">Vault ({formatBytes(metrics.vaultManagedBytes)})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#18181B]" />
            <span>System & Apps ({formatBytes(metrics.usedDiskSpace - metrics.vaultManagedBytes)})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4D4D8]" />
            <span>Available ({formatBytes(metrics.availableDiskSpace)})</span>
          </div>
        </div>
      </div>

      {/* Storage Location & Internals */}
      <div className="p-5 rounded-lg bg-white border border-[#E4E4E7] space-y-3">
        <h3 className="text-[13px] font-semibold text-[#09090B]">Managed Directory Internals</h3>
        <div className="p-3 bg-[#F4F4F5] rounded border border-[#E4E4E7] font-mono text-[11px] text-[#09090B] break-all select-all">
          {metrics.vaultPath}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px] pt-1">
          <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E4E4E7]">
            <span className="text-[#71717A] text-[11px]">Total Logical Files</span>
            <div className="text-[14px] font-semibold text-[#09090B] mt-0.5">{metrics.totalFiles}</div>
          </div>
          <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E4E4E7]">
            <span className="text-[#71717A] text-[11px]">Total Folders</span>
            <div className="text-[14px] font-semibold text-[#09090B] mt-0.5">{metrics.totalFolders}</div>
          </div>
          <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E4E4E7]">
            <span className="text-[#71717A] text-[11px]">Physical Objects</span>
            <div className="text-[14px] font-semibold text-[#09090B] mt-0.5">{metrics.totalObjects}</div>
          </div>
          <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E4E4E7]">
            <span className="text-[#71717A] text-[11px]">Deduplication Ratio</span>
            <div className="text-[14px] font-semibold text-[#09090B] mt-0.5">
              {metrics.vaultManagedBytes > 0 
                ? (metrics.vaultRawLogicalBytes / metrics.vaultManagedBytes).toFixed(2) + 'x'
                : '1.00x'}
            </div>
          </div>
        </div>
      </div>

      {/* Integrity Report Result */}
      {integrityReport && (
        <div className="p-5 rounded-lg bg-white border border-[#E4E4E7] space-y-3">
          <div className="flex items-center gap-2">
            {integrityReport.databaseValid && integrityReport.corruptedObjectsCount === 0 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <h3 className="text-[13px] font-semibold text-[#09090B]">Integrity Verification Report</h3>
            <span className="text-[10px] text-[#A1A1AA] font-mono ml-auto">{new Date(integrityReport.timestamp).toLocaleTimeString()}</span>
          </div>

          <div className="text-[12px] space-y-1 text-[#71717A]">
            <p>SQLite Schema & WAL Status: <span className="font-semibold text-emerald-700">{integrityReport.databaseValid ? 'Healthy (OK)' : 'Corrupted'}</span></p>
            <p>Orphaned Disk Objects: <span className="font-semibold text-[#09090B]">{integrityReport.orphanedObjectsCount}</span></p>
            <p>Missing Physical Objects: <span className="font-semibold text-[#09090B]">{integrityReport.missingObjectsCount}</span></p>
            <p>Corrupted Size Mismatches: <span className="font-semibold text-[#09090B]">{integrityReport.corruptedObjectsCount}</span></p>
          </div>

          {integrityReport.details.length > 0 && (
            <div className="p-3 bg-[#F4F4F5] rounded border border-[#E4E4E7] text-[11px] font-mono text-[#09090B] max-h-36 overflow-y-auto space-y-1">
              {integrityReport.details.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
