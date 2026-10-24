import React from 'react';
import {
  FolderKanban,
  GitBranch,
  RotateCcw,
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
    setCurrentRevisionById,
    resetToDemo
  } = useProject();

  const navigate = useNavigate();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs sticky top-0 z-30 select-none">
      {/* Left: Project & Revision Selectors */}
      <div className="flex items-center space-x-4">
        {/* Project Selector */}
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 transition-colors">
          <FolderKanban className="w-4 h-4 text-blue-600" />
          <select
            value={currentProject?.id || ''}
            onChange={(e) => setCurrentProjectById(Number(e.target.value))}
            className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_id} — {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Revision Selector */}
        {revisions.length > 0 && (
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 transition-colors">
            <GitBranch className="w-4 h-4 text-purple-600" />
            <select
              value={currentRevision?.id || ''}
              onChange={(e) => setCurrentRevisionById(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {revisions.map((r) => (
                <option key={r.id} value={r.id}>
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
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                <span>{currentProject.validation_errors_count} Blocking Issues • {currentProject.open_tqs_count} TQs</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: DCS Info, Demo Data, and User Profile */}
      <div className="flex items-center space-x-3">
        {/* DCS Architecture Badge */}
        {currentProject?.system && (
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-200">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>{currentProject.system}</span>
          </div>
        )}

        {/* Reset to Synthetic Demo Data */}
        <button
          onClick={resetToDemo}
          title="Reset database to synthetic Demo DeltaV project"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Load Demo Data</span>
        </button>

        {/* User Pill */}
        <div className="flex items-center space-x-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-tight">Lead DCS Engineer</div>
            <div className="text-[10px] text-slate-400">Systems Engineering</div>
          </div>
        </div>
      </div>
    </header>
  );
};
