import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  FileSpreadsheet,
  Cpu,
  Boxes,
  ShieldCheck,
  FileText,
  GitCompare,
  Settings,
  Activity,
  Layers
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const Sidebar: React.FC = () => {
  const { currentProject } = useProject();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: FolderGit2, badge: currentProject?.project_id },
    { name: 'IO Data Import', path: '/import', icon: FileSpreadsheet },
    { name: 'Rules & Hardware', path: '/rules-hardware', icon: Cpu },
    { name: 'Allocation Workspace', path: '/allocation', icon: Boxes, badge: currentProject?.signal_count ? `${currentProject.allocated_count}/${currentProject.signal_count}` : undefined },
    { name: 'Hardware Utilisation', path: '/utilisation', icon: Layers },
    { name: 'Validation & TQs', path: '/validation-tqs', icon: ShieldCheck, badgeCount: (currentProject?.validation_errors_count || 0) + (currentProject?.open_tqs_count || 0) },
    { name: 'Reports & Exports', path: '/reports', icon: FileText },
    { name: 'Revision Manager', path: '/revisions', icon: GitCompare, badge: currentProject?.current_revision },
    { name: 'Settings & Audit', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-industrial-900 border-r border-slate-800 text-slate-300 flex flex-col flex-shrink-0 h-screen select-none">
      {/* Brand & Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/80 bg-industrial-900">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-700 to-electric-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white uppercase flex items-center gap-1.5">
              IO SUDOKU
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DCS</span>
            </h1>
            <p className="text-[11px] text-slate-400 tracking-tight">DeltaV™ Allocation Engine</p>
          </div>
        </div>
      </div>

      {/* Current Project Snapshot Pill */}
      {currentProject && (
        <div className="px-4 py-3 bg-industrial-800/60 border-b border-slate-800/60">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Active Project</div>
          <div className="text-xs font-medium text-white truncate">{currentProject.name}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span className="font-mono text-blue-400">{currentProject.project_id}</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-200 font-mono text-[10px]">
              {currentProject.current_revision}
            </span>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-industrial-800 hover:text-white'
                }`
              }
            >
              <div className="flex items-center space-x-3">
                <Icon className="w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110" />
                <span className="truncate">{item.name}</span>
              </div>
              {item.badgeCount !== undefined && item.badgeCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                  {item.badgeCount}
                </span>
              )}
              {item.badge && item.badgeCount === undefined && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 bg-industrial-900/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-300 font-medium">Solver Online</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">CP-SAT v9.15</span>
        </div>
      </div>
    </aside>
  );
};
