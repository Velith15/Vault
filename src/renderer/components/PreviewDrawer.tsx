import React, { useEffect, useState } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  Sparkles, 
  Edit2, 
  Copy, 
  Check, 
  HardDrive,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { VaultNode, FilePreviewData } from '@shared/types';
import { api } from '../services/api';
import { 
  formatBytes, 
  formatExactBytes, 
  formatDetailedDate, 
  getFileCategory, 
  getFileKindDescription, 
  getFileExtensionLabel 
} from '../utils/formatters';

interface PreviewDrawerProps {
  node: VaultNode | null;
  ancestors?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onExport: (node: VaultNode) => void;
  onOpenWithDefault: (node: VaultNode) => void;
  onRename: (node: VaultNode) => void;
}

export const PreviewDrawer: React.FC<PreviewDrawerProps> = ({
  node,
  ancestors = [],
  onClose,
  onExport,
  onOpenWithDefault,
  onRename,
}) => {
  const [previewData, setPreviewData] = useState<FilePreviewData | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (!node || node.type === 'folder') {
      setPreviewData(null);
      setDataUrl(null);
      return;
    }

    setLoading(true);
    api.getFilePreview(node.id)
      .then((data) => {
        setPreviewData(data);
        if (data.mimeType.startsWith('image/') || data.mimeType.startsWith('video/') || data.mimeType.startsWith('audio/')) {
          if (data.size <= 100 * 1024 * 1024) {
            return api.getObjectBlobUrl(data.hash).then((url) => {
              setDataUrl(url);
            });
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching preview data:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [node]);

  if (!node) return null;

  const cat = getFileCategory(node.name, node.mimeType);
  const extBadge = getFileExtensionLabel(node.name);
  const kindDesc = node.type === 'folder' ? 'Folder' : getFileKindDescription(node.name, node.mimeType);

  const pathParts = ['Vault', ...ancestors.map((a) => a.name)];
  const wherePath = pathParts.join(' › ');

  const handleCopyHash = () => {
    if (node.objectHash) {
      navigator.clipboard.writeText(node.objectHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-[#09090B]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-[430px] max-h-[85vh] bg-[#18181B] text-[#E4E4E7] border border-[#27272A] rounded-2xl flex flex-col justify-between select-none text-[13px] shadow-2xl z-50 font-sans animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="h-12 border-b border-[#27272A] px-4.5 flex items-center justify-between bg-[#141416]">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-wide uppercase text-[#A1A1AA]">File Information</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#27272A] text-[#A1A1AA] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Info Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[calc(85vh-110px)]">
        {/* Top File Card */}
        <div className="bg-[#262629] border border-[#333338] rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#38383E] border border-[#484850] flex items-center justify-center flex-shrink-0 shadow-inner">
              <span className="font-mono font-bold text-[12px] tracking-wider text-white">
                {extBadge}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-white text-[14px] leading-tight truncate" title={node.name}>
                {node.name}
              </h2>
              <div className="text-[12px] text-[#8E8E93] mt-0.5 font-sans">
                Modified: {formatDetailedDate(node.modifiedAt)}
              </div>
            </div>

            <div className="font-semibold text-white text-[15px] tabular-nums flex-shrink-0 pl-1">
              {node.type === 'folder' ? 'Folder' : formatBytes(node.size)}
            </div>
          </div>
        </div>

        {/* Inline Media/Code Preview */}
        {cat === 'image' && dataUrl ? (
          <div className="w-full bg-[#141416] border border-[#2E2E32] rounded-xl overflow-hidden flex items-center justify-center max-h-[190px]">
            <img src={dataUrl} alt={node.name} className="max-h-[190px] w-full object-contain" />
          </div>
        ) : cat === 'video' && dataUrl ? (
          <div className="w-full bg-[#141416] border border-[#2E2E32] rounded-xl overflow-hidden flex items-center justify-center max-h-[190px]">
            <video src={dataUrl} controls className="max-h-[190px] w-full" />
          </div>
        ) : cat === 'audio' && dataUrl ? (
          <div className="w-full bg-[#141416] border border-[#2E2E32] rounded-xl p-3">
            <audio src={dataUrl} controls className="w-full" />
          </div>
        ) : previewData?.textContent ? (
          <div className="w-full bg-[#141416] border border-[#2E2E32] rounded-xl p-3 font-mono text-[11px] text-[#D4D4D8] overflow-auto max-h-[160px] whitespace-pre">
            {previewData.textContent.slice(0, 2000)}
            {previewData.textContent.length > 2000 && '\n\n... (preview truncated)'}
          </div>
        ) : null}

        {/* Intelligent Storage & Compression Details */}
        {node.type !== 'folder' && previewData && (
          <div className="bg-[#262629]/90 border border-[#333338] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-[12px] font-semibold text-white">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                STORAGE OPTIMIZATION
              </span>
              {previewData.isCompressed ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Lossless Zstd
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#38383E] text-[#A1A1AA]">
                  Uncompressed
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="p-2 bg-[#1A1A1C] rounded-lg border border-[#2E2E32]">
                <div className="text-[#8E8E93] text-[10px]">Original Size</div>
                <div className="font-mono text-[#F4F4F5] font-medium">{formatBytes(previewData.size)}</div>
              </div>
              <div className="p-2 bg-[#1A1A1C] rounded-lg border border-[#2E2E32]">
                <div className="text-[#8E8E93] text-[10px]">Physical On Disk</div>
                <div className="font-mono text-[#F4F4F5] font-medium">{formatBytes(previewData.physicalSize)}</div>
              </div>
            </div>

            {previewData.isCompressed ? (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[11.5px] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white">Saved {formatBytes(previewData.savedBytes)}</span>
                  <div className="text-[10px] text-emerald-400">({previewData.reductionPercentage.toFixed(1)}% reduction)</div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Verified</span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-[#1F1F23] border border-[#333338] text-[11px] text-[#A1A1AA] leading-snug">
                Vault kept the original representation because this file is already compact or not beneficial to compress.
              </div>
            )}
          </div>
        )}

        {/* Detailed Spec Attributes Table */}
        <div className="bg-[#262629]/70 border border-[#333338] rounded-xl p-3.5 space-y-2.5 text-[12.5px]">
          <div className="flex items-start">
            <span className="w-20 text-[#8E8E93] flex-shrink-0 font-medium">Kind:</span>
            <span className="text-[#F4F4F5] font-normal leading-snug break-words flex-1">{kindDesc}</span>
          </div>

          {node.type !== 'folder' && (
            <div className="flex items-start">
              <span className="w-20 text-[#8E8E93] flex-shrink-0 font-medium">Size:</span>
              <span className="text-[#F4F4F5] font-mono leading-snug flex-1">
                {formatExactBytes(node.size)} bytes
              </span>
            </div>
          )}

          <div className="flex items-start">
            <span className="w-20 text-[#8E8E93] flex-shrink-0 font-medium">Where:</span>
            <span className="text-[#D4D4D8] font-sans text-[12px] leading-snug break-words flex-1">
              {wherePath}
            </span>
          </div>

          <div className="flex items-start">
            <span className="w-20 text-[#8E8E93] flex-shrink-0 font-medium">Created:</span>
            <span className="text-[#F4F4F5] leading-snug flex-1">{formatDetailedDate(node.createdAt)}</span>
          </div>

          <div className="flex items-start">
            <span className="w-20 text-[#8E8E93] flex-shrink-0 font-medium">Modified:</span>
            <span className="text-[#F4F4F5] leading-snug flex-1">{formatDetailedDate(node.modifiedAt)}</span>
          </div>
        </div>

        {/* Deduplication & CAS Efficiency Info */}
        {previewData && previewData.refCount > 1 && (
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/50 text-indigo-300 text-[11.5px] space-y-1">
            <div className="font-medium flex items-center gap-1.5 text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Deduplicated in CAS Engine</span>
            </div>
            <p className="text-[11px] text-indigo-300/90 leading-relaxed">
              Referenced by <strong className="text-white">{previewData.refCount} files</strong> across Vault, saving <strong className="text-white">{formatBytes((previewData.refCount - 1) * previewData.size)}</strong> of physical disk space.
            </p>
          </div>
        )}

        {/* Checksum Details */}
        {node.objectHash && (
          <div className="bg-[#262629]/50 border border-[#333338] rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#8E8E93]">
              <span className="font-medium">SHA-256 Checksum</span>
              <button 
                onClick={handleCopyHash}
                className="flex items-center gap-1 hover:text-white transition-colors text-[10.5px]"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHash ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="font-mono text-[10px] text-[#A1A1AA] break-all leading-tight bg-[#1A1A1C] p-2 rounded-lg border border-[#2E2E32] select-all">
              {node.objectHash}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="p-3 border-t border-[#27272A] flex items-center gap-2 bg-[#141416]">
        <button
          onClick={() => onRename(node)}
          className="h-8.5 px-3 rounded-lg border border-[#3E3E44] bg-[#27272A] text-[12px] font-medium text-white hover:bg-[#34343A] flex items-center justify-center gap-1.5 transition-colors"
          title="Rename file"
        >
          <Edit2 className="w-3.5 h-3.5 text-[#A1A1AA]" />
          <span>Rename</span>
        </button>

        <button
          onClick={() => onOpenWithDefault(node)}
          className="flex-1 h-8.5 rounded-lg border border-[#3E3E44] bg-[#27272A] text-[12px] font-medium text-white hover:bg-[#34343A] flex items-center justify-center gap-1.5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-[#A1A1AA]" />
          <span>Open</span>
        </button>

        <button
          onClick={() => onExport(node)}
          className="flex-1 h-8.5 rounded-lg bg-white text-[#09090B] text-[12px] font-semibold hover:bg-[#F4F4F5] flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </div>
  </div>
  );
};
