import React from 'react';
import { 
  Folder, 
  Clock, 
  Star, 
  Trash2, 
  HardDrive, 
  Settings, 
  ShieldCheck,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Layers
} from 'lucide-react';
import { StorageMetrics } from '@shared/types';
import { formatBytes } from '../utils/formatters';

import logoImg from '../assets/logo.jpg';

export type ActiveTab = 'files' | 'recent' | 'starred' | 'trash' | 'storage' | 'settings' | 'images' | 'documents' | 'videos' | 'archives';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  metrics: StorageMetrics | null;
  onSelectRoot: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  metrics,
  onSelectRoot,
}) => {
  const navItems = [
    { id: 'files', label: 'All Files', icon: Folder, onClick: onSelectRoot },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  const categoryItems = [
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'images', label: 'Images', icon: Image },
    { id: 'videos', label: 'Videos', icon: Film },
    { id: 'archives', label: 'Archives', icon: Archive },
  ];

  return (
    <aside className="w-60 h-screen bg-[#F4F4F5] border-r border-[#E4E4E7] flex flex-col justify-between select-none text-[13px]">
      {/* Brand & Window Drag Header */}
      <div>
        <div className="h-14 flex items-center px-4 border-b border-[#E4E4E7] gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-white overflow-hidden border border-[#E4E4E7] flex items-center justify-center shadow-xs flex-shrink-0">
            <img src={logoImg} alt="Vault Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold tracking-wider text-[13px] text-[#09090B] font-sans">VAULT</span>
          <span className="ml-auto text-[10px] uppercase font-mono px-1.5 py-0.5 bg-[#E4E4E7] text-[#71717A] rounded">Local</span>
        </div>

        {/* Main Navigation */}
        <div className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setActiveTab(item.id as ActiveTab);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  isActive
                    ? 'bg-[#E4E4E7] text-[#09090B]'
                    : 'text-[#71717A] hover:bg-[#ECECED] hover:text-[#09090B]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#09090B]' : 'text-[#71717A]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Categories */}
        <div className="mt-4 px-3 py-1">
          <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider">Categories</span>
        </div>
        <div className="p-2 pt-0 space-y-1">
          {categoryItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  isActive
                    ? 'bg-[#E4E4E7] text-[#09090B]'
                    : 'text-[#71717A] hover:bg-[#ECECED] hover:text-[#09090B]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#09090B]' : 'text-[#71717A]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Infrastructure section */}
      <div className="p-2 border-t border-[#E4E4E7] space-y-1">
        <button
          onClick={() => setActiveTab('storage')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
            activeTab === 'storage'
              ? 'bg-[#E4E4E7] text-[#09090B]'
              : 'text-[#71717A] hover:bg-[#ECECED] hover:text-[#09090B]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4" />
            <span className="font-medium">Storage</span>
          </div>
          {metrics && (
            <span className="text-[11px] font-mono text-[#71717A]">
              {formatBytes(metrics.vaultManagedBytes)}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-[#E4E4E7] text-[#09090B]'
              : 'text-[#71717A] hover:bg-[#ECECED] hover:text-[#09090B]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings & Integrity</span>
        </button>

        <div className="pt-2 px-2 pb-1 flex items-center justify-between text-[11px] text-[#A1A1AA]">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Encrypted / Local</span>
          </div>
          <span className="font-mono text-[10px] tracking-tight">V.0.2.511</span>
        </div>
      </div>
    </aside>
  );
};
