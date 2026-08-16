import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ConfirmModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  variant?: 'danger' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<{
  config: ConfirmModalConfig | null;
  onClose: () => void;
}> = ({ config, onClose }) => {
  if (!config || !config.isOpen) return null;

  const handleConfirm = () => {
    config.onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (config.onCancel) config.onCancel();
    onClose();
  };

  const isDanger = config.variant === 'danger' || config.variant === undefined;

  return (
    <div className="fixed inset-0 z-50 bg-[#09090B]/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100 select-none">
      <div className="bg-white border border-[#E4E4E7] rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 animate-in zoom-in-95 duration-150 font-sans">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
            isDanger ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-blue-50 border-blue-200 text-blue-600'
          }`}>
            {isDanger ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-serif text-[18px] text-[#09090B] font-medium leading-snug break-words">
              {config.title}
            </h3>
            <p className="text-[13px] text-[#71717A] leading-relaxed">
              {config.message}
            </p>
          </div>

          <button
            onClick={handleCancel}
            className="p-1 rounded-md text-[#A1A1AA] hover:text-[#09090B] hover:bg-[#F4F4F5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 text-[13px]">
          {config.cancelText !== null && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 h-8.5 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors font-medium"
            >
              {config.cancelText || 'Cancel'}
            </button>
          )}

          <button
            type="button"
            autoFocus
            onClick={handleConfirm}
            className={`px-4 h-8.5 rounded-lg font-medium text-white transition-all shadow-xs ${
              isDanger 
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800' 
                : 'bg-[#18181B] hover:bg-[#27272A] active:bg-[#09090B]'
            }`}
          >
            {config.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
