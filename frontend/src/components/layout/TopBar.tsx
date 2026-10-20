import React, { useState } from 'react';
import {
  FolderKanban,
  GitBranch,
  Play,
  RotateCcw,
  Download,
  AlertOctagon,
  User,
  CheckCircle2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export const TopBar: React.FC = () => {
  const {
    projects,
    currentProject,
    revisions,
    currentRevision,
    setCurrentProjectById,
    setCurrentRevisionById,
    resetToDemo,
    refreshProjects,
    refreshRevisions
  } = useProject();

  const navigate = useNavigate();
  const [runningAllocation, setRunningAllocation] = useState(false);
  const [allocationSuccess, setAllocationSuccess] = useState(false);

  const handleRunAllocation = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      setRunningAllocation(true);
      await api.runAllocation(currentProject.id, currentRevision.id, true);
      await refreshProjects();
      await refreshRevisions();
      setAllocationSuccess(true);
      setTimeout(() => setAllocationSuccess(false), 3000);
      navigate('/allocation');
    } catch (err: any) {
      alert(`Allocation Failed: ${err.message}`);
    } finally {
      setRunningAllocation(false);
    }
  };

  const handleQuickExport = () => {
    if (!currentProject || !currentRevision) return;
    const url = api.getExportUrl('allocation', currentProject.id, currentRevision.id);
    window.open(url, '_blank');
  };

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
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                <span>{currentProject.validation_errors_count} Blocking Issues • {currentProject.open_tqs_count} TQs</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center space-x-3">
        {/* Reset to Synthetic Demo Data */}
        <button
          onClick={resetToDemo}
          title="Reset database to synthetic Demo DeltaV project"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Load Demo Data</span>
        </button>

        {/* Quick Export Allocation */}
        <button
          onClick={handleQuickExport}
          title="Download completed allocation Excel"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Export Excel</span>
        </button>

        {/* Run Allocation Solver Button */}
        <button
          onClick={handleRunAllocation}
          disabled={runningAllocation}
          className={`flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold rounded-md text-white shadow-xs transition-all ${
            runningAllocation
              ? 'bg-blue-400 cursor-not-allowed'
              : allocationSuccess
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
          }`}
        >
          {runningAllocation ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Solving Constraints...</span>
            </>
          ) : allocationSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Allocated!</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Allocation</span>
            </>
          )}
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
