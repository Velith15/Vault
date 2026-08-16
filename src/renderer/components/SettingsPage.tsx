import React, { useState } from 'react';
import { 
  ShieldCheck, 
  RotateCw, 
  Trash2, 
  HardDrive, 
  Terminal, 
  FolderLock, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

interface SettingsPageProps {
  onRefresh: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onRefresh }) => {
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleEmptyTrash = async () => {
    if (!window.confirm('Empty trash and shred unreferenced physical CAS objects?')) return;
    try {
      await api.emptyTrash();
      setStatusMsg('Trash emptied successfully.');
      onRefresh();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  const handleIntegrityCheck = async () => {
    setRunning(true);
    setStatusMsg(null);
    try {
      const report = await api.runIntegrityCheck();
      setStatusMsg(`Integrity check complete: Database is ${report.databaseValid ? 'Valid' : 'Invalid'}. ${report.orphanedObjectsCount} orphans, ${report.missingObjectsCount} missing.`);
      onRefresh();
    } catch (err: any) {
      setStatusMsg(`Integrity error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 select-none text-[13px]">
      <div>
        <h1 className="text-[18px] font-semibold text-[#09090B]">Vault Settings & Maintenance</h1>
        <p className="text-[12px] text-[#71717A] mt-0.5">
          Virtual storage integrity, local privacy guarantees, and maintenance operations.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-[#E4E4E7] divide-y divide-[#E4E4E7]">
        {/* Integrity Verification */}
        <div className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#09090B] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Storage Integrity Scan</span>
            </div>
            <p className="text-[12px] text-[#71717A]">
              Validate SQLite indexes, purge stale upload temporary files, and check SHA-256 CAS object references.
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
              When files are imported into Vault, move them into Vault storage and delete the original copy from your desktop/source folder.
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
            Vault executes 100% locally on your machine. All content addressing, SHA-256 checksums, SQLite indexing, and previews run in-process without network egress or external cloud calls.
          </p>
        </div>
      </div>
    </div>
  );
};
