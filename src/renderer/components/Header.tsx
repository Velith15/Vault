import React, { useState } from 'react';
import { 
  Search, 
  UploadCloud, 
  FolderPlus, 
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  ChevronRight, 
  Home,
  RotateCw
} from 'lucide-react';
import { VaultNode } from '@shared/types';

interface HeaderProps {
  currentFolderId: string | null;
  ancestors: Array<{ id: string; name: string }>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  sortBy: 'name' | 'size' | 'modifiedAt';
  setSortBy: (sort: 'name' | 'size' | 'modifiedAt') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  onNavigateFolder: (folderId: string | null) => void;
  onImportClick: () => void;
  onCreateFolderClick: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentFolderId,
  ancestors,
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onNavigateFolder,
  onImportClick,
  onCreateFolderClick,
  onRefresh,
}) => {
  const [showSortMenu, setShowSortMenu] = useState(false);

  return (
    <header className="h-14 border-b border-[#E4E4E7] bg-[#FFFFFF] px-4 flex items-center justify-between gap-4 select-none">
      {/* Breadcrumbs & Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-[13px] text-[#71717A] max-w-md">
        <button
          onClick={() => onNavigateFolder(null)}
          className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors ${
            !currentFolderId ? 'font-medium text-[#09090B]' : ''
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Vault</span>
        </button>

        {ancestors.map((anc, idx) => {
          const isLast = idx === ancestors.length - 1;
          return (
            <React.Fragment key={anc.id}>
              <ChevronRight className="w-3.5 h-3.5 text-[#D4D4D8] flex-shrink-0" />
              <button
                onClick={() => onNavigateFolder(anc.id)}
                className={`px-1.5 py-1 rounded hover:bg-[#F4F4F5] hover:text-[#09090B] truncate max-w-[120px] transition-colors ${
                  isLast ? 'font-medium text-[#09090B]' : ''
                }`}
              >
                {anc.name}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-sm relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search files and metadata... (⌘K)"
          className="w-full h-8 pl-8 pr-3 bg-[#F4F4F5] border border-transparent focus:border-[#D4D4D8] focus:bg-white rounded-md text-[12px] text-[#09090B] placeholder-[#A1A1AA] outline-none transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#A1A1AA] hover:text-[#09090B]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Actions Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          title="Refresh view"
          className="w-8 h-8 flex items-center justify-center rounded-md border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* View Toggle */}
        <div className="flex items-center border border-[#E4E4E7] rounded-md p-0.5 bg-[#FAFAFA]">
          <button
            onClick={() => setViewMode('list')}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              viewMode === 'list' ? 'bg-white shadow-xs text-[#09090B]' : 'text-[#A1A1AA] hover:text-[#71717A]'
            }`}
            title="List view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              viewMode === 'grid' ? 'bg-white shadow-xs text-[#09090B]' : 'text-[#A1A1AA] hover:text-[#71717A]'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sort Popover */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-[#E4E4E7] text-[12px] font-medium text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort</span>
          </button>

          {showSortMenu && (
            <div className="absolute right-0 top-10 w-44 bg-white border border-[#E4E4E7] rounded-lg shadow-lg p-1 z-30 text-[12px]">
              <div className="px-2 py-1 text-[10px] uppercase font-semibold text-[#A1A1AA]">Sort by</div>
              {(['name', 'size', 'modifiedAt'] as const).map((field) => (
                <button
                  key={field}
                  onClick={() => {
                    if (sortBy === field) {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy(field);
                    }
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                    sortBy === field ? 'bg-[#F4F4F5] font-medium text-[#09090B]' : 'text-[#71717A] hover:bg-[#FAFAFA]'
                  }`}
                >
                  <span className="capitalize">{field === 'modifiedAt' ? 'Date Modified' : field}</span>
                  {sortBy === field && (
                    <span className="text-[10px] text-[#A1A1AA] uppercase">{sortOrder}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <button
          onClick={onCreateFolderClick}
          className="h-8 px-3 flex items-center gap-1.5 rounded-md border border-[#E4E4E7] text-[12px] font-medium text-[#09090B] hover:bg-[#F4F4F5] transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>New Folder</span>
        </button>

        <button
          onClick={onImportClick}
          className="h-8 px-3.5 flex items-center gap-1.5 rounded-md bg-[#18181B] text-white text-[12px] font-medium hover:bg-[#27272A] shadow-xs transition-colors"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Import Files</span>
        </button>
      </div>
    </header>
  );
};
