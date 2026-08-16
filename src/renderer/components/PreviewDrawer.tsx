import React, { useEffect, useState } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  Calendar, 
  HardDrive, 
  Hash, 
  Sparkles, 
  FileText,
  FileCode,
  Edit2
} from 'lucide-react';
import { VaultNode, FilePreviewData } from '@shared/types';
import { api } from '../services/api';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters';

interface PreviewDrawerProps {
  node: VaultNode | null;
  onClose: () => void;
  onExport: (node: VaultNode) => void;
  onOpenWithDefault: (node: VaultNode) => void;
  onRename: (node: VaultNode) => void;
}

export const PreviewDrawer: React.FC<PreviewDrawerProps> = ({
  node,
  onClose,
  onExport,
  onOpenWithDefault,
  onRename,
}) => {
  const [previewData, setPreviewData] = useState<FilePreviewData | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="w-96 h-screen bg-white border-l border-[#E4E4E7] flex flex-col justify-between select-none text-[13px] shadow-sm z-20">
      {/* Header */}
      <div className="h-14 border-b border-[#E4E4E7] px-4 flex items-center justify-between">
        <span className="font-semibold text-[#09090B] text-[13px]">File Details</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#09090B] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content / Preview Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Preview Frame */}
        <div className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg overflow-hidden flex items-center justify-center min-h-[160px] max-h-[240px]">
          {loading ? (
            <div className="text-[12px] text-[#A1A1AA]">Loading preview...</div>
          ) : cat === 'image' && dataUrl ? (
            <img src={dataUrl} alt={node.name} className="max-h-[240px] w-full object-contain" />
          ) : cat === 'video' && dataUrl ? (
            <video src={dataUrl} controls className="max-h-[240px] w-full" />
          ) : cat === 'audio' && dataUrl ? (
            <audio src={dataUrl} controls className="w-full px-4" />
          ) : previewData?.textContent ? (
            <div className="w-full h-full p-3 font-mono text-[11px] text-[#09090B] bg-white overflow-auto max-h-[240px] whitespace-pre">
              {previewData.textContent.slice(0, 4000)}
              {previewData.textContent.length > 4000 && '\n\n... (preview truncated)'}
            </div>
          ) : node.size > 100 * 1024 * 1024 ? (
            <div className="p-6 text-center">
              <FileText className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
              <div className="text-[12px] text-[#71717A]">File exceeds 100MB (inline preview disabled)</div>
              <button
                onClick={() => onOpenWithDefault(node)}
                className="mt-2 text-[11px] text-[#09090B] font-medium underline"
              >
                Open with default app
              </button>
            </div>
          ) : (
            <div className="p-6 text-center">
              <FileText className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
              <div className="text-[12px] text-[#71717A]">No native inline preview</div>
              <button
                onClick={() => onOpenWithDefault(node)}
                className="mt-2 text-[11px] text-[#09090B] font-medium underline"
              >
                Open with default app
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-[#09090B] text-[14px] break-words">{node.name}</h2>
            <div className="text-[11px] text-[#71717A] font-mono mt-0.5">
              {node.type === 'folder' ? 'Folder' : formatBytes(node.size)}
            </div>
          </div>
          <button
            onClick={() => onRename(node)}
            title="Rename file"
            className="p-1.5 rounded-md border border-[#E4E4E7] text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F5] transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CAS & Deduplication Badge */}
        {previewData && previewData.refCount > 1 && (
          <div className="p-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] space-y-1">
            <div className="font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Deduplicated in CAS Engine</span>
            </div>
            <p className="text-[10px] text-emerald-700">
              This physical object is referenced by <strong>{previewData.refCount} files</strong> across Vault, saving {formatBytes((previewData.refCount - 1) * previewData.size)} on disk.
            </p>
          </div>
        )}

        {/* Metadata Details */}
        <div className="border-t border-[#E4E4E7] pt-3 space-y-2.5 text-[12px]">
          <div className="flex justify-between items-center text-[#71717A]">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Created</span>
            <span className="font-mono text-[#09090B]">{formatDate(node.createdAt)}</span>
          </div>

          <div className="flex justify-between items-center text-[#71717A]">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Modified</span>
            <span className="font-mono text-[#09090B]">{formatDate(node.modifiedAt)}</span>
          </div>

          <div className="flex justify-between items-center text-[#71717A]">
            <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> MIME Type</span>
            <span className="font-mono text-[#09090B] truncate max-w-[150px]">{node.mimeType || 'None'}</span>
          </div>

          {node.objectHash && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 text-[#71717A] text-[11px] mb-1">
                <Hash className="w-3.5 h-3.5" />
                <span>SHA-256 Checksum</span>
              </div>
              <div className="p-2 bg-[#F4F4F5] rounded border border-[#E4E4E7] font-mono text-[10px] text-[#09090B] break-all select-all">
                {node.objectHash}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-[#E4E4E7] flex items-center gap-2">
        <button
          onClick={() => onOpenWithDefault(node)}
          className="flex-1 h-8 rounded-md border border-[#E4E4E7] text-[12px] font-medium text-[#09090B] hover:bg-[#F4F4F5] flex items-center justify-center gap-1.5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open</span>
        </button>

        <button
          onClick={() => onExport(node)}
          className="flex-1 h-8 rounded-md bg-[#18181B] text-white text-[12px] font-medium hover:bg-[#27272A] flex items-center justify-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};
