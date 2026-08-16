import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  FileText, 
  Image, 
  Film, 
  Music, 
  Archive, 
  Code, 
  File, 
  Star, 
  MoreVertical, 
  Download, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  RotateCcw, 
  Sparkles,
  Info,
  X
} from 'lucide-react';
import { VaultNode } from '@shared/types';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters';

interface ContextMenuState {
  x: number;
  y: number;
  node: VaultNode;
  isMulti?: boolean;
}

interface FileListProps {
  nodes: VaultNode[];
  viewMode: 'list' | 'grid';
  selectedNodeId: string | null;
  onSelectNode: (node: VaultNode) => void;
  onOpenNode: (node: VaultNode) => void;
  onToggleStar: (node: VaultNode, e: React.MouseEvent) => void;
  onRenameNode: (node: VaultNode) => void;
  onTrashNode: (node: VaultNode) => void;
  onRestoreNode: (node: VaultNode) => void;
  onDeletePermanent: (node: VaultNode) => void;
  onExportNode: (node: VaultNode) => void;
  onOpenWithDefault: (node: VaultNode) => void;
  onTrashMultiple?: (nodes: VaultNode[]) => void;
  onRestoreMultiple?: (nodes: VaultNode[]) => void;
  onDeletePermanentMultiple?: (nodes: VaultNode[]) => void;
  onExportMultiple?: (nodes: VaultNode[]) => void;
  onToggleStarMultiple?: (nodes: VaultNode[]) => void;
  isTrashView?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  nodes,
  viewMode,
  selectedNodeId,
  onSelectNode,
  onOpenNode,
  onToggleStar,
  onRenameNode,
  onTrashNode,
  onRestoreNode,
  onDeletePermanent,
  onExportNode,
  onOpenWithDefault,
  onTrashMultiple,
  onRestoreMultiple,
  onDeletePermanentMultiple,
  onExportMultiple,
  onToggleStarMultiple,
  isTrashView = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag-to-select marquee state
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Sync prop selectedNodeId if updated externally
  useEffect(() => {
    if (selectedNodeId && !selectedIds.has(selectedNodeId) && selectedIds.size <= 1) {
      setSelectedIds(new Set([selectedNodeId]));
    }
  }, [selectedNodeId]);

  // Keyboard listeners (Ctrl+A select all, Escape clear selection, Delete trash selection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setContextMenu(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        // Prevent default text selection if focus is in file list area
        const activeEl = document.activeElement;
        if (!activeEl || activeEl.tagName === 'BODY' || containerRef.current?.contains(activeEl)) {
          e.preventDefault();
          setSelectedIds(new Set(nodes.map(n => n.id)));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes]);

  // Close context menu on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const getSelectedNodes = (): VaultNode[] => {
    return nodes.filter(n => selectedIds.has(n.id));
  };

  const handleNodeClick = (e: React.MouseEvent, node: VaultNode, index: number) => {
    e.stopPropagation();

    if (e.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = nodes.slice(start, end + 1).map(n => n.id);
      setSelectedIds(prev => new Set([...Array.from(prev), ...rangeIds]));
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
      setLastSelectedIndex(index);
    } else {
      // Single selection
      setSelectedIds(new Set([node.id]));
      setLastSelectedIndex(index);
      onSelectNode(node);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: VaultNode) => {
    e.preventDefault();
    e.stopPropagation();

    let newSelectedIds = selectedIds;
    // If right clicking on a node that is NOT in current multi-selection, select only this node
    if (!selectedIds.has(node.id)) {
      newSelectedIds = new Set([node.id]);
      setSelectedIds(newSelectedIds);
    }

    const clickX = e.clientX;
    const clickY = e.clientY;
    const menuWidth = 220;
    const menuHeight = 260;

    const x = clickX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : clickX;
    const y = clickY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : clickY;

    setContextMenu({
      x,
      y,
      node,
      isMulti: newSelectedIds.size > 1,
    });
  };

  // Rubberband Selection Box (Drag-to-Select) Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger marquee select on left click on container background (not interactive buttons)
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) {
      return;
    }

    setIsDragSelecting(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });

    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setSelectedIds(new Set());
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragSelecting || !dragStart) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(dragStart.x, currentX);
    const top = Math.min(dragStart.y, currentY);
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);

    const selectionRect = { left, top, width, height };
    setDragRect(selectionRect);

    // Collision detection with item DOM elements
    if (containerRef.current) {
      const itemEls = containerRef.current.querySelectorAll('[data-node-id]');
      const newSelected = new Set(e.ctrlKey || e.metaKey ? selectedIds : []);

      itemEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const intersects = !(
          rect.right < selectionRect.left ||
          rect.left > selectionRect.left + selectionRect.width ||
          rect.bottom < selectionRect.top ||
          rect.top > selectionRect.top + selectionRect.height
        );
        const nodeId = el.getAttribute('data-node-id');
        if (nodeId && intersects) {
          newSelected.add(nodeId);
        }
      });

      setSelectedIds(newSelected);
    }
  };

  const handleMouseUp = () => {
    if (isDragSelecting) {
      setIsDragSelecting(false);
      setDragStart(null);
      setDragRect(null);
    }
  };

  const getFileIcon = (node: VaultNode) => {
    if (node.type === 'folder') {
      return <Folder className="w-4 h-4 text-[#18181B] fill-[#E4E4E7]" />;
    }
    const cat = getFileCategory(node.name, node.mimeType);
    switch (cat) {
      case 'image':
        return <Image className="w-4 h-4 text-emerald-600" />;
      case 'video':
        return <Film className="w-4 h-4 text-rose-600" />;
      case 'audio':
        return <Music className="w-4 h-4 text-amber-600" />;
      case 'document':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'code':
        return <Code className="w-4 h-4 text-indigo-600" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-amber-700" />;
      default:
        return <File className="w-4 h-4 text-[#71717A]" />;
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
        <div className="w-14 h-14 rounded-2xl bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center text-[#A1A1AA] mb-4 shadow-2xs">
          <Folder className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h3 className="font-serif text-[19px] italic font-normal text-[#09090B]">No files in this location</h3>
        <p className="font-sans text-[13px] text-[#71717A] max-w-sm mt-1 leading-relaxed">
          Drag and drop files from your desktop to securely ingest them into Vault.
        </p>
      </div>
    );
  }

  const selectedNodesList = getSelectedNodes();

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="w-full h-full relative select-none min-h-full"
    >
      {/* Marquee Selection Drag Box */}
      {dragRect && dragRect.width > 2 && dragRect.height > 2 && (
        <div
          className="fixed border border-blue-500 bg-blue-500/15 pointer-events-none z-40 rounded-xs shadow-2xs"
          style={{
            left: `${dragRect.left}px`,
            top: `${dragRect.top}px`,
            width: `${dragRect.width}px`,
            height: `${dragRect.height}px`,
          }}
        />
      )}

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {nodes.map((node, index) => {
            const isSelected = selectedIds.has(node.id) || contextMenu?.node.id === node.id;
            return (
              <div
                key={node.id}
                data-node-id={node.id}
                onClick={(e) => handleNodeClick(e, node, index)}
                onDoubleClick={() => onOpenNode(node)}
                onContextMenu={(e) => handleContextMenu(e, node)}
                className={`group relative p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between h-36 ${
                  isSelected
                    ? 'bg-[#F4F4F5] border-[#09090B] shadow-xs'
                    : 'bg-white border-[#E4E4E7]/80 hover:border-[#D4D4D8] hover:bg-[#FAFAFA] hover:shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7]/60 shadow-2xs">
                    {getFileIcon(node)}
                  </div>
                  {!isTrashView && (
                    <button
                      onClick={(e) => onToggleStar(node, e)}
                      className={`p-1 rounded-md hover:bg-[#E4E4E7] transition-colors ${
                        node.isStarred ? 'text-amber-500' : 'text-[#D4D4D8] opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                </div>

                <div>
                  <div className="font-sans text-[13px] font-medium text-[#09090B] truncate tracking-tight" title={node.name}>
                    {node.name}
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] flex items-center justify-between mt-1 font-mono">
                    <span>{node.type === 'folder' ? 'Folder' : formatBytes(node.size)}</span>
                    {node.refCount && node.refCount > 1 ? (
                      <span className="text-[10px] font-sans bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-200/50">
                        CAS {node.refCount}x
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="w-full text-[13px]">
          {/* Table Header */}
          <div className="sticky top-0 bg-[#FAFAFA]/95 backdrop-blur-xs border-b border-[#E4E4E7] grid grid-cols-12 px-5 py-2.5 font-sans font-medium text-[#71717A] text-[11px] uppercase tracking-wider z-10">
            <div className="col-span-6 flex items-center gap-2">Name</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-2 text-right">Modified</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#F1F1F4]">
            {nodes.map((node, index) => {
              const isSelected = selectedIds.has(node.id) || contextMenu?.node.id === node.id;

              return (
                <div
                  key={node.id}
                  data-node-id={node.id}
                  onClick={(e) => handleNodeClick(e, node, index)}
                  onDoubleClick={() => onOpenNode(node)}
                  onContextMenu={(e) => handleContextMenu(e, node)}
                  className={`group grid grid-cols-12 px-5 py-3 items-center transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#F4F4F5]' : 'hover:bg-[#FAFAFA]'
                  }`}
                >
                  {/* Name column */}
                  <div className="col-span-6 flex items-center gap-3 min-w-0 pr-3">
                    <div className="flex-shrink-0">{getFileIcon(node)}</div>
                    <span className="truncate font-sans font-medium text-[#09090B] text-[13px] tracking-tight" title={node.name}>
                      {node.name}
                    </span>

                    {node.refCount && node.refCount > 1 ? (
                      <span className="flex-shrink-0 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-mono">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{node.refCount}x</span>
                      </span>
                    ) : null}

                    {!isTrashView && (
                      <button
                        onClick={(e) => onToggleStar(node, e)}
                        className={`ml-1 flex-shrink-0 p-1 rounded-md transition-colors ${
                          node.isStarred ? 'text-amber-500' : 'text-[#D4D4D8] opacity-0 group-hover:opacity-100 hover:text-[#71717A]'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                  </div>

                  {/* Type column */}
                  <div className="col-span-2 font-sans text-[12px] text-[#71717A] capitalize truncate">
                    {node.type === 'folder' ? 'Folder' : (node.mimeType?.split('/')[1] || 'File')}
                  </div>

                  {/* Size column */}
                  <div className="col-span-2 font-mono text-[12px] text-[#71717A]">
                    {node.type === 'folder' ? '—' : formatBytes(node.size)}
                  </div>

                  {/* Date & Actions column */}
                  <div className="col-span-2 flex items-center justify-end gap-2 text-[#71717A]">
                    <span className="font-sans text-[12px] truncate">{formatDate(node.modifiedAt)}</span>

                    <button
                      onClick={(e) => handleContextMenu(e, node)}
                      className="p-1 rounded-md hover:bg-[#E4E4E7] text-[#71717A] group-hover:opacity-100 opacity-0 transition-opacity"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar when Multiple Files Selected */}
      {selectedIds.size > 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#18181B] text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200 text-[13px] font-sans">
          <div className="flex items-center gap-2 pr-3 border-r border-white/20">
            <span className="font-semibold text-white font-mono">{selectedIds.size}</span>
            <span className="text-[#A1A1AA]">items selected</span>
          </div>

          {!isTrashView ? (
            <>
              {onToggleStarMultiple && (
                <button
                  onClick={() => onToggleStarMultiple(selectedNodesList)}
                  className="hover:text-amber-400 flex items-center gap-1.5 transition-colors"
                >
                  <Star className="w-4 h-4" />
                  <span>Toggle Star</span>
                </button>
              )}

              {onExportMultiple && (
                <button
                  onClick={() => onExportMultiple(selectedNodesList)}
                  className="hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export ({selectedNodesList.filter(n => n.type === 'file').length})</span>
                </button>
              )}

              {onTrashMultiple && (
                <button
                  onClick={() => onTrashMultiple(selectedNodesList)}
                  className="hover:text-rose-400 flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Move to Trash</span>
                </button>
              )}
            </>
          ) : (
            <>
              {onRestoreMultiple && (
                <button
                  onClick={() => onRestoreMultiple(selectedNodesList)}
                  className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restore ({selectedIds.size})</span>
                </button>
              )}

              {onDeletePermanentMultiple && (
                <button
                  onClick={() => onDeletePermanentMultiple(selectedNodesList)}
                  className="hover:text-rose-400 flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Permanently</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-2 p-1 rounded-md hover:bg-white/10 text-[#A1A1AA] hover:text-white transition-colors"
            title="Clear selection (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
          className="fixed w-52 bg-white/95 backdrop-blur-md border border-[#E4E4E7] rounded-xl shadow-xl py-1.5 z-50 text-[13px] font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-[#E4E4E7]/70 mb-1">
            <div className="font-serif italic text-[14px] text-[#09090B] truncate">
              {contextMenu.isMulti ? `${selectedIds.size} Items Selected` : contextMenu.node.name}
            </div>
            <div className="text-[10px] text-[#A1A1AA] font-mono">
              {contextMenu.isMulti 
                ? formatBytes(selectedNodesList.reduce((acc, n) => acc + n.size, 0))
                : contextMenu.node.type === 'folder' ? 'Folder' : formatBytes(contextMenu.node.size)}
            </div>
          </div>

          {contextMenu.isMulti ? (
            /* Multi-item context actions */
            !isTrashView ? (
              <>
                {onToggleStarMultiple && (
                  <button
                    onClick={() => { onToggleStarMultiple(selectedNodesList); setContextMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2.5 text-[#09090B] transition-colors"
                  >
                    <Star className="w-4 h-4 text-amber-500" />
                    <span>Star / Unstar All</span>
                  </button>
                )}

                {onExportMultiple && (
                  <button
                    onClick={() => { onExportMultiple(selectedNodesList); setContextMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2.5 text-[#09090B] transition-colors"
                  >
                    <Archive className="w-4 h-4 text-[#71717A]" />
                    <span>Export {selectedIds.size} Items</span>
                  </button>
                )}

                <div className="h-px bg-[#E4E4E7]/70 my-1" />

                {onTrashMultiple && (
                  <button
                    onClick={() => { onTrashMultiple(selectedNodesList); setContextMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 transition-colors font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Trash {selectedIds.size} Items</span>
                  </button>
                )}
              </>
            ) : (
              <>
                {onRestoreMultiple && (
                  <button
                    onClick={() => { onRestoreMultiple(selectedNodesList); setContextMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2.5 text-[#09090B] transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-[#71717A]" />
                    <span>Restore {selectedIds.size} Items</span>
                  </button>
                )}

                <div className="h-px bg-[#E4E4E7]/70 my-1" />

                {onDeletePermanentMultiple && (
                  <button
                    onClick={() => { onDeletePermanentMultiple(selectedNodesList); setContextMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 transition-colors font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete {selectedIds.size} Permanently</span>
                  </button>
                )}
              </>
            )
          ) : (
            /* Single-item context actions */
            !isTrashView ? (
              <>
                <button
                  onClick={() => { onOpenNode(contextMenu.node); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2.5 text-[#09090B] transition-colors"
                >
                  <Info className="w-4 h-4 text-[#71717A]" />
                  <span>Get Info / Preview</span>
                </button>

                <button
                  onClick={() => { onRenameNode(contextMenu.node); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2.5 text-[#09090B] transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-[#71717A]" />
                  <span>Rename</span>
                </button>

                <button
                  onClick={() => { onExportNode(contextMenu.node); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2.5 text-[#09090B] transition-colors"
                >
                  <Archive className="w-4 h-4 text-[#71717A]" />
                  <span>Archive / Export</span>
                </button>

                {contextMenu.node.type === 'file' && (
                  <button
                    onClick={() => { onOpenWithDefault(contextMenu.node); setContextMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2.5 text-[#09090B] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-[#71717A]" />
                    <span>Open with Default App</span>
                  </button>
                )}

                <div className="h-px bg-[#E4E4E7]/70 my-1" />

                <button
                  onClick={() => { onTrashNode(contextMenu.node); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete (Move to Trash)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { onRestoreNode(contextMenu.node); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2.5 text-[#09090B] transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-[#71717A]" />
                  <span>Restore to Vault</span>
                </button>

                <div className="h-px bg-[#E4E4E7]/70 my-1" />

                <button
                  onClick={() => { onDeletePermanent(contextMenu.node); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Permanently</span>
                </button>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
};

