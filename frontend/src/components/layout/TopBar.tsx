import React from 'react';
import {
  FolderKanban,
  GitBranch,
  AlertOctagon,
  User,
  Cpu
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useNavigate } from 'react-router-dom';

export const TopBar: React.FC = () => {
  const {
    projects,
    currentProject,
    revisions,
    currentRevision,
    setCurrentProjectById,
    setCurrentRevisionById
  } = useProject();

  const navigate = useNavigate();

  return (
    <header className="h-16 shrink-0 bg-industrial-900 border-b border-slate-800 px-6 flex items-center justify-between shadow-sm z-30 select-none">
      {/* Left: Project & Revision Selectors */}
      <div className="flex items-center space-x-4">
        {/* Project Selector */}
        <div className="flex items-center space-x-2 bg-industrial-800/90 border border-slate-700/80 rounded-lg px-3 py-1.5 hover:border-slate-600 hover:bg-industrial-800 transition-colors shadow-2xs">
          <FolderKanban className="w-4 h-4 text-blue-400" />
          <select
            value={currentProject?.id || ''}
            onChange={(e) => setCurrentProjectById(Number(e.target.value))}
            className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-hidden cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-industrial-900 text-slate-100">
                {p.project_id} — {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Revision Selector */}
        {revisions.length > 0 && (
          <div className="flex items-center space-x-2 bg-industrial-800/90 border border-slate-700/80 rounded-lg px-3 py-1.5 hover:border-slate-600 hover:bg-industrial-800 transition-colors shadow-2xs">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <select
              value={currentRevision?.id || ''}
              onChange={(e) => setCurrentRevisionById(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-hidden cursor-pointer"
            >
              {revisions.map((r) => (
                <option key={r.id} value={r.id} className="bg-industrial-900 text-slate-100">
                  {r.revision_code} {r.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Pills */}
        {currentProject && (
          <div className="hidden lg:flex items-center space-x-2">
            {(currentProject.validation_errors_count > 0 || currentProject.open_tqs_count > 0) && (
              <button
                onClick={() => navigate('/validation-tqs')}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-950/70 text-rose-300 border border-rose-800 hover:bg-rose-900/80 transition-colors cursor-pointer shadow-2xs"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                <span>{currentProject.validation_errors_count} Blocking Issues • {currentProject.open_tqs_count} TQs</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: DCS Architecture Info & User Profile */}
      <div className="flex items-center space-x-3">
        {/* DCS Architecture Badge */}
        {currentProject?.system && (
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono text-slate-300 bg-industrial-800/90 border border-slate-700/80 shadow-2xs">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentProject.system}</span>
          </div>
        )}

        {/* User Pill */}
        <div className="flex items-center space-x-2 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-industrial-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-semibold text-slate-200 leading-tight">Lead DCS Engineer</div>
            <div className="text-[10px] text-slate-400">Systems Engineering</div>
          </div>
        </div>
      </div>
    </header>
  );
};
