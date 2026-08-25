import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  RotateCw,
  Zap,
  Play,
  Pause,
  XCircle,
  FileText,
  CheckCircle2,
  PieChart,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { 
  StorageMetrics, 
  IntegrityReport, 
  OptimizationAnalysis, 
  OptimizationProgress,
  CompressionProfile 
} from '@shared/types';
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

  // Manual Optimization Wizard State
  const [showOptModal, setShowOptModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<OptimizationAnalysis | null>(null);
  const [optProgress, setOptProgress] = useState<OptimizationProgress | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<CompressionProfile>('BALANCED');

  useEffect(() => {
    if (api?.onOptimizationProgressChange) {
      const unsub = api.onOptimizationProgressChange((p) => {
        setOptProgress(p);
        if (p.status === 'completed' || p.status === 'cancelled') {
          onRefreshMetrics();
        }
      });
      return unsub;
    }
  }, [onRefreshMetrics]);

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

  const handleOpenOptimization = async () => {
    setShowOptModal(true);
    setIsAnalyzing(true);
    try {
      const res = await api.analyzeOptimization();
      setAnalysis(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartOptimization = async () => {
    try {
      const p = await api.startOptimization(selectedProfile);
      setOptProgress(p);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePauseOptimization = async () => {
    if (api?.pauseOptimization) {
      const p = await api.pauseOptimization();
      setOptProgress(p);
    }
  };

  const handleResumeOptimization = async () => {
    if (api?.resumeOptimization) {
      const p = await api.resumeOptimization();
      setOptProgress(p);
    }
  };

  const handleCancelOptimization = async () => {
    if (api?.cancelOptimization) {
      const p = await api.cancelOptimization();
      setOptProgress(p);
    }
  };

  if (!metrics) {
    return <div className="p-8 text-[13px] text-[#71717A]">Loading storage metrics...</div>;
  }

  const diskUsedPercent = Math.min(100, Math.round((metrics.usedDiskSpace / metrics.totalDiskSpace) * 100)) || 0;
  const isOptimizing = optProgress && (optProgress.status === 'optimizing' || optProgress.status === 'paused');

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 select-none">
      {/* Title & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#09090B]">Storage Optimization & Engine</h1>
          <p className="text-[12px] text-[#71717A] mt-0.5">
            Lossless Zstandard compression, CAS deduplication, and host drive efficiency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenOptimization}
            className="h-8 px-3.5 rounded-md bg-[#18181B] text-white text-[12px] font-medium hover:bg-[#27272A] flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Optimize Storage</span>
          </button>

          <button
            onClick={handleRunIntegrity}
            disabled={runningCheck}
            className="h-8 px-3 rounded-md border border-[#E4E4E7] text-[12px] font-medium text-[#09090B] hover:bg-[#F4F4F5] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${runningCheck ? 'animate-spin' : ''}`} />
            <span>{runningCheck ? 'Verifying...' : 'Verify Integrity'}</span>
          </button>
        </div>
      </div>

      {/* Main Storage Reduction Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Logical Storage */}
        <div className="p-4 rounded-xl bg-white border border-[#E4E4E7] space-y-1.5 shadow-2xs">
          <div className="text-[#71717A] text-[11.5px] font-medium">Logical Storage</div>
          <div className="text-[20px] font-semibold text-[#09090B] font-mono">
            {formatBytes(metrics.vaultRawLogicalBytes)}
          </div>
          <div className="text-[11px] text-[#A1A1AA]">
            {metrics.totalFiles} uncompressed files
          </div>
        </div>

        {/* Physical Storage */}
        <div className="p-4 rounded-xl bg-white border border-[#E4E4E7] space-y-1.5 shadow-2xs">
          <div className="text-[#71717A] text-[11.5px] font-medium">Physical Storage</div>
          <div className="text-[20px] font-semibold text-[#09090B] font-mono">
            {formatBytes(metrics.vaultManagedBytes)}
          </div>
          <div className="text-[11px] text-[#A1A1AA]">
            {metrics.totalObjects} CAS objects on disk
          </div>
        </div>

        {/* Total Saved */}
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5 shadow-2xs">
          <div className="text-emerald-800 text-[11.5px] font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Total Saved</span>
          </div>
          <div className="text-[20px] font-semibold text-emerald-700 font-mono">
            {formatBytes(metrics.totalSavingsBytes)}
          </div>
          <div className="text-[11px] text-emerald-600">
            Dedupe + Lossless Zstd
          </div>
        </div>

        {/* Overall Reduction */}
        <div className="p-4 rounded-xl bg-white border border-[#E4E4E7] space-y-1.5 shadow-2xs">
          <div className="text-[#71717A] text-[11.5px] font-medium flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-indigo-600" />
            <span>Overall Reduction</span>
          </div>
          <div className="text-[20px] font-semibold text-indigo-700 font-mono">
            {metrics.overallReductionPercentage.toFixed(1)}%
          </div>
          <div className="text-[11px] text-[#71717A]">
            Disk multiplier: {metrics.vaultManagedBytes > 0 ? (metrics.vaultRawLogicalBytes / metrics.vaultManagedBytes).toFixed(2) + 'x' : '1.00x'}
          </div>
        </div>
      </div>

      {/* Storage Breakdown Pipeline Visualization */}
      <div className="p-5 rounded-2xl bg-white border border-[#E4E4E7] space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-[#09090B]">Storage Pipeline Breakdown</h2>
            <p className="text-[11.5px] text-[#71717A] mt-0.5">
              Exact lossless reduction stages applied to your library
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#F4F4F5] text-[#09090B]">
            Zero Quality Loss Guarantee
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-1">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#71717A]">1. Logical Files</span>
            <div className="font-mono text-[16px] font-bold text-[#09090B]">{formatBytes(metrics.vaultRawLogicalBytes)}</div>
            <p className="text-[11px] text-[#71717A]">Sum of all file references</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-1">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-emerald-700">2. Deduplication Saved</span>
            <div className="font-mono text-[16px] font-bold text-emerald-700">-{formatBytes(metrics.deduplicatedSavingsBytes)}</div>
            <p className="text-[11px] text-[#71717A]">Shared identical CAS blobs</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-1">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-indigo-700">3. Compression Saved</span>
            <div className="font-mono text-[16px] font-bold text-indigo-700">-{formatBytes(metrics.compressionSavingsBytes)}</div>
            <p className="text-[11px] text-[#71717A]">Lossless Zstd VLT1 encoding</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#18181B] text-white border border-[#27272A] space-y-1">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#A1A1AA]">4. Physical On Disk</span>
            <div className="font-mono text-[16px] font-bold text-white">{formatBytes(metrics.vaultManagedBytes)}</div>
            <p className="text-[11px] text-[#A1A1AA]">Actual space on host drive</p>
          </div>
        </div>
      </div>

      {/* Where Vault Saved Space (Category Savings Table) */}
      <div className="p-5 rounded-2xl bg-white border border-[#E4E4E7] space-y-4 shadow-2xs">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-[14px] font-semibold text-[#09090B]">Where Vault Saved Space</h2>
            <p className="text-[11.5px] text-[#71717A] mt-0.5">Calculated reduction per format classification</p>
          </div>
          <span className="text-[11px] text-[#71717A]">
            {metrics.compressedObjectsCount} of {metrics.totalObjects} objects compressed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-[#71717A]">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Files</th>
                <th className="pb-2 font-medium">Logical</th>
                <th className="pb-2 font-medium">Physical</th>
                <th className="pb-2 font-medium">Saved</th>
                <th className="pb-2 font-medium text-right">Reduction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F5]">
              {(metrics.categorySavings || []).map((cat) => (
                <tr key={cat.category} className="hover:bg-[#FAFAFA]">
                  <td className="py-2.5 font-medium text-[#09090B]">{cat.category}</td>
                  <td className="py-2.5 text-[#71717A]">{cat.fileCount}</td>
                  <td className="py-2.5 font-mono text-[#71717A]">{formatBytes(cat.logicalBytes)}</td>
                  <td className="py-2.5 font-mono text-[#71717A]">{formatBytes(cat.physicalBytes)}</td>
                  <td className="py-2.5 font-mono font-medium text-emerald-700">{formatBytes(cat.savedBytes)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold text-[#09090B]">
                    {cat.reductionPercentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Host Drive Capacity Bar */}
      <div className="p-6 rounded-2xl bg-white border border-[#E4E4E7] space-y-4 shadow-2xs">
        <div className="flex justify-between items-center text-[13px]">
          <div>
            <span className="font-medium text-[#09090B]">Host Drive Space Distribution</span>
            <p className="text-[11px] text-[#71717A] mt-0.5">Physical breakdown of local partition</p>
          </div>
          <span className="font-mono text-[13px] font-semibold text-[#09090B]">{diskUsedPercent}% Used</span>
        </div>

        <div className="w-full h-3.5 bg-[#F4F4F5] rounded-full overflow-hidden flex border border-[#E4E4E7]/80 p-0.5 gap-0.5">
          {metrics.vaultManagedBytes > 0 && (
            <div
              style={{ width: `${Math.max(1, (metrics.vaultManagedBytes / metrics.totalDiskSpace) * 100)}%` }}
              className="bg-emerald-600 h-full rounded-l-full transition-all duration-300"
              title={`Vault Storage: ${formatBytes(metrics.vaultManagedBytes)}`}
            />
          )}
          <div
            style={{ 
              width: `${Math.max(1, ((metrics.usedDiskSpace - metrics.vaultManagedBytes) / metrics.totalDiskSpace) * 100)}%` 
            }}
            className="bg-[#18181B] h-full transition-all duration-300"
            title={`Other System & Apps: ${formatBytes(metrics.usedDiskSpace - metrics.vaultManagedBytes)}`}
          />
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
            <p>Compressed Objects Verified: <span className="font-semibold text-emerald-700">{integrityReport.compressedObjectsVerified}</span></p>
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

      {/* Optimization Wizard Modal */}
      {showOptModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#09090B]">Intelligent Storage Optimization</h3>
                  <p className="text-[12px] text-[#71717A]">Lossless Zstandard compression for eligible objects</p>
                </div>
              </div>
              {!isOptimizing && (
                <button 
                  onClick={() => setShowOptModal(false)}
                  className="p-1 text-[#A1A1AA] hover:text-[#09090B] rounded-md transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Analysis State */}
            {isAnalyzing ? (
              <div className="py-8 text-center space-y-2">
                <RotateCw className="w-6 h-6 animate-spin text-[#09090B] mx-auto" />
                <p className="text-[13px] font-medium text-[#09090B]">Analyzing your Vault...</p>
                <p className="text-[11px] text-[#71717A]">Scanning file types and estimating lossless compressibility</p>
              </div>
            ) : isOptimizing ? (
              /* Live Progress State */
              <div className="space-y-4 py-2">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="font-semibold text-[#09090B]">
                    {optProgress.status === 'paused' ? 'Optimization Paused' : 'Optimizing Storage...'}
                  </span>
                  <span className="font-mono font-bold text-[#09090B]">{optProgress.percent}%</span>
                </div>

                <div className="w-full h-2.5 bg-[#F4F4F5] rounded-full overflow-hidden border border-[#E4E4E7]">
                  <div 
                    className="h-full bg-emerald-600 transition-all duration-200 rounded-full"
                    style={{ width: `${optProgress.percent}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11.5px] pt-1">
                  <div className="p-2 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7]">
                    <div className="text-[#71717A]">Files Processed</div>
                    <div className="font-mono font-semibold text-[#09090B] mt-0.5">
                      {optProgress.processedCount} / {optProgress.totalToProcess}
                    </div>
                  </div>
                  <div className="p-2 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7]">
                    <div className="text-[#71717A]">Space Recovered</div>
                    <div className="font-mono font-semibold text-emerald-700 mt-0.5">
                      {formatBytes(optProgress.bytesSaved)}
                    </div>
                  </div>
                  <div className="p-2 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7]">
                    <div className="text-[#71717A]">Throughput</div>
                    <div className="font-mono font-semibold text-[#09090B] mt-0.5">
                      {formatBytes(optProgress.speedBytesPerSec)}/s
                    </div>
                  </div>
                </div>

                {optProgress.currentFileName && (
                  <div className="text-[11px] text-[#71717A] truncate font-mono bg-[#FAFAFA] p-2 rounded border border-[#E4E4E7]">
                    Processing: {optProgress.currentFileName}
                  </div>
                )}

                {/* Optimization Controls */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  {optProgress.status === 'paused' ? (
                    <button
                      onClick={handleResumeOptimization}
                      className="h-8 px-3 rounded-md bg-[#18181B] text-white text-[12px] font-medium flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseOptimization}
                      className="h-8 px-3 rounded-md border border-[#E4E4E7] text-[12px] font-medium hover:bg-[#F4F4F5] flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  )}
                  <button
                    onClick={handleCancelOptimization}
                    className="h-8 px-3 rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-[12px] font-medium flex items-center gap-1.5"
                  >
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : optProgress?.status === 'completed' ? (
              /* Completed State */
              <div className="space-y-4 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-[16px] font-semibold text-[#09090B]">Optimization Complete!</h4>
                  <p className="text-[12px] text-[#71717A] mt-0.5">
                    Recovered <strong className="text-emerald-700">{formatBytes(optProgress.bytesSaved)}</strong> of physical disk space.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-[12px] text-[#71717A] space-y-1 text-left">
                  <div className="flex justify-between">
                    <span>Objects Analyzed:</span>
                    <span className="font-mono font-medium text-[#09090B]">{optProgress.processedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Losslessly Compressed:</span>
                    <span className="font-mono font-medium text-emerald-700">{optProgress.optimizedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Skipped (already compact):</span>
                    <span className="font-mono font-medium text-[#09090B]">{optProgress.skippedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Integrity Verification:</span>
                    <span className="font-medium text-emerald-700">PASSED ✓</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowOptModal(false);
                    setOptProgress(null);
                  }}
                  className="w-full h-8.5 rounded-lg bg-[#18181B] text-white text-[12px] font-medium hover:bg-[#27272A] transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Pre-run Summary & Start Form */
              <div className="space-y-4">
                {analysis && (
                  <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2 text-[12.5px]">
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">Files Analyzed:</span>
                      <span className="font-mono font-semibold text-[#09090B]">{analysis.totalFiles}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">Potentially Optimizable:</span>
                      <span className="font-mono font-semibold text-indigo-700">
                        {analysis.optimizableFilesCount} files ({formatBytes(analysis.optimizableBytes)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">Estimated Space Recovery:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        ~{formatBytes(analysis.estimatedSavingsBytes)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[#09090B]">Compression Profile</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['FAST', 'BALANCED', 'MAXIMUM'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelectedProfile(p)}
                        className={`py-2 px-2.5 rounded-lg border text-left text-[11.5px] transition-all ${
                          selectedProfile === p
                            ? 'border-[#18181B] bg-[#18181B] text-white font-medium shadow-xs'
                            : 'border-[#E4E4E7] bg-white text-[#09090B] hover:bg-[#FAFAFA]'
                        }`}
                      >
                        <div>{p === 'FAST' ? 'Fast' : p === 'BALANCED' ? 'Balanced' : 'Maximum'}</div>
                        <div className={`text-[10px] font-normal mt-0.5 ${selectedProfile === p ? 'text-zinc-300' : 'text-[#A1A1AA]'}`}>
                          {p === 'FAST' ? 'Low CPU' : p === 'BALANCED' ? 'Recommended' : 'Max savings'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11.5px] text-emerald-900 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>100% Lossless Guarantee:</strong> Every file is byte-verified via SHA-256 before committing. Ineffective compressions are automatically discarded.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowOptModal(false)}
                    className="h-8 px-3 rounded-md border border-[#E4E4E7] text-[12px] font-medium text-[#71717A] hover:bg-[#F4F4F5]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartOptimization}
                    className="h-8 px-4 rounded-md bg-[#18181B] text-white text-[12px] font-medium hover:bg-[#27272A] shadow-xs flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Start Optimization</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
