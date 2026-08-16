import React from 'react';
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  ArrowRight
} from 'lucide-react';
import { UpdateState } from '@shared/types';

import logoImg from '../assets/logo.jpg';

interface UpdateModalProps {
  updateState: UpdateState;
  onClose: () => void;
  onUpdateNow: () => void;
  onRestartInstall: () => void;
  onDismiss: (version: string) => void;
}

function formatSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond) return '';
  if (bytesPerSecond > 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
}

function formatNotes(notes?: string | Array<{ version: string; note: string }>): string[] {
  if (!notes) return ['• General stability and performance improvements.'];
  if (Array.isArray(notes)) {
    return notes.map(n => typeof n === 'string' ? n : n.note);
  }
  return notes
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`);
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  updateState,
  onClose,
  onUpdateNow,
  onRestartInstall,
  onDismiss,
}) => {
  const { status, currentVersion, updateInfo, progress, error, dismissedVersion } = updateState;

  // Don't render modal if idle, not available, or if this version was dismissed (unless user manually triggered)
  if (status === 'idle' || status === 'not-available' || status === 'offline') {
    return null;
  }

  // If user dismissed this version and we are not downloading/downloaded/erroring
  if (
    status === 'available' &&
    updateInfo?.version &&
    dismissedVersion === updateInfo.version &&
    !updateState.isManualCheck
  ) {
    return null;
  }

  const newVersion = updateInfo?.version || 'Latest';
  const notesList = formatNotes(updateInfo?.releaseNotes);

  const handleLater = () => {
    if (updateInfo?.version) {
      onDismiss(updateInfo.version);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#09090B]/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-[#E4E4E7] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#F4F4F5] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white overflow-hidden border border-[#E4E4E7] flex items-center justify-center shadow-xs flex-shrink-0">
              <img src={logoImg} alt="Vault Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-serif text-[18px] font-medium text-[#09090B]">
                {status === 'downloaded' ? 'Update Ready to Install' : 'Update Available'}
              </h3>
              <p className="text-[12px] text-[#71717A] font-sans mt-0.5">
                Vault <span className="font-semibold text-[#09090B]">{newVersion}</span> is now available.
              </p>
            </div>
          </div>
          <button
            onClick={handleLater}
            className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#09090B] hover:bg-[#F4F4F5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 font-sans text-[13px]">
          {/* Version comparison badge */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F4F4F5] text-[#3F3F46]">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#71717A] block font-medium">Installed</span>
              <span className="font-medium text-[#09090B]">v{currentVersion}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A1A1AA]" />
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-[#71717A] block font-medium">New Release</span>
              <span className="font-semibold text-emerald-700">v{newVersion}</span>
            </div>
          </div>

          {/* Release Notes */}
          {status !== 'downloaded' && status !== 'downloading' && (
            <div className="space-y-2">
              <span className="text-[12px] font-medium text-[#09090B] block">What's new</span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 bg-[#FAFAFA] rounded-xl border border-[#E4E4E7] text-[12.5px] text-[#3F3F46]">
                {notesList.map((note, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Downloading state */}
          {status === 'downloading' && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-[#09090B] flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                  <span>Downloading update...</span>
                </span>
                <span className="font-semibold text-[#09090B]">{progress?.percent || 0}%</span>
              </div>
              <div className="w-full h-2 bg-[#E4E4E7] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#18181B] transition-all duration-300 rounded-full"
                  style={{ width: `${progress?.percent || 0}%` }}
                />
              </div>
              {progress?.bytesPerSecond ? (
                <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-1">
                  <span>Speed: {formatSpeed(progress.bytesPerSecond)}</span>
                  <span>
                    {(progress.transferred / (1024 * 1024)).toFixed(1)} MB / {(progress.total / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* Downloaded state */}
          {status === 'downloaded' && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-medium text-[13px]">Update ready — Restart Vault to install.</span>
                <p className="text-[11.5px] text-emerald-700">
                  The update package has been downloaded and verified. Restarting will apply the update cleanly.
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-medium text-[13px]">Update process error</span>
                <p className="text-[11.5px] text-rose-700">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#FAFAFA] border-t border-[#E4E4E7] flex items-center justify-end gap-2.5">
          {status === 'downloaded' ? (
            <>
              <button
                type="button"
                onClick={handleLater}
                className="px-4 h-9 rounded-lg border border-[#E4E4E7] text-[#71717A] font-medium hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
              >
                Later
              </button>
              <button
                type="button"
                onClick={onRestartInstall}
                className="px-4 h-9 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restart & Install</span>
              </button>
            </>
          ) : status === 'downloading' ? (
            <button
              type="button"
              disabled
              className="w-full h-9 rounded-lg bg-[#18181B]/50 text-white font-medium flex items-center justify-center gap-2 cursor-wait"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Downloading...</span>
            </button>
          ) : status === 'error' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-9 rounded-lg border border-[#E4E4E7] text-[#71717A] font-medium hover:bg-[#F4F4F5] transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={onUpdateNow}
                className="px-4 h-9 rounded-lg bg-[#18181B] text-white font-medium hover:bg-[#27272A] transition-colors"
              >
                Retry Download
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleLater}
                className="px-4 h-9 rounded-lg border border-[#E4E4E7] text-[#71717A] font-medium hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
              >
                Later
              </button>
              <button
                type="button"
                onClick={onUpdateNow}
                className="px-4 h-9 rounded-lg bg-[#18181B] text-white font-medium hover:bg-[#27272A] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Update Now</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
