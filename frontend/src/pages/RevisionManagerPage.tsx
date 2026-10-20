import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  GitBranch,
  Plus,
  Download,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  History,
  Info
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { RevisionComparison, RevisionDiffItem } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MetricCard } from '../components/ui/MetricCard';

export const RevisionManagerPage: React.FC = () => {
  const { currentProject, revisions, currentRevision, refreshRevisions, refreshProjects, setCurrentRevisionById } = useProject();

  const [baseRevId, setBaseRevId] = useState<number | null>(null);
  const [targetRevId, setTargetRevId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<RevisionComparison | null>(null);
  const [loading, setLoading] = useState(false);

  // New Revision Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [revCode, setRevCode] = useState('');
  const [revDesc, setRevDesc] = useState('');

  // Filter
  const [changeFilter, setChangeFilter] = useState('');

  useEffect(() => {
    if (revisions.length >= 2) {
      setBaseRevId(revisions[0].id);
      setTargetRevId(revisions[1].id);
    } else if (revisions.length === 1) {
      setBaseRevId(revisions[0].id);
    }
  }, [revisions]);

  useEffect(() => {
    if (currentProject && baseRevId && targetRevId && baseRevId !== targetRevId) {
      runComparison();
    }
  }, [currentProject?.id, baseRevId, targetRevId]);

  const runComparison = async () => {
    if (!currentProject || !baseRevId || !targetRevId) return;
    try {
      setLoading(true);
      const data = await api.compareRevisions(currentProject.id, baseRevId, targetRevId);
      setComparison(data);
    } catch (err) {
      console.error('Failed to compare revisions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    try {
      await api.createRevision(currentProject.id, {
        revision_code: revCode,
        description: revDesc,
      });
      await refreshRevisions();
      await refreshProjects();
      setShowCreateModal(false);
      setRevCode('');
      setRevDesc('');
    } catch (err: any) {
      alert(`Failed to create revision: ${err.message}`);
    }
  };

  const filteredDiff = comparison
    ? comparison.diff_records.filter((d) => !changeFilter || d.change_type === changeFilter)
    : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <GitCompare className="w-5 h-5 text-blue-600" />
            <span>Revision Management & Differential Analysis</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit lifecycle revisions, prevent unnecessary hardware re-wiring, and track delta changes across customer IO updates.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {comparison && currentProject && baseRevId && targetRevId && (
            <a
              href={api.getRevisionDiffExportUrl(currentProject.id, baseRevId, targetRevId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Impact Report</span>
            </a>
          )}

          <button
            onClick={() => {
              const nextLetter = String.fromCharCode(65 + revisions.length);
              setRevCode(`Rev ${nextLetter}`);
              setRevDesc(`Engineering Update ${nextLetter}`);
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Revision</span>
          </button>
        </div>
      </div>

      {/* Revision Timeline Cards */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center space-x-2">
          <History className="w-4 h-4 text-blue-600" />
          <span>Project Revisions Timeline</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {revisions.map((r) => {
            const isActive = r.is_active;
            return (
              <div
                key={r.id}
                className={`p-4 rounded-lg border transition-all ${
                  isActive
                    ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/10'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                    {r.revision_code}
                  </span>
                  {isActive ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => setCurrentRevisionById(r.id)}
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      Make Active
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-700 mt-2 font-medium">{r.description || 'Baseline engineering release'}</p>
                <span className="text-[10px] text-slate-400 mt-2 block font-mono">
                  Created {r.created_at.slice(0, 10)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revision Comparison Controls */}
      {revisions.length >= 2 ? (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-700">Compare Baseline:</span>
              <select
                value={baseRevId || ''}
                onChange={(e) => setBaseRevId(Number(e.target.value))}
                className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
              >
                {revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.revision_code}
                  </option>
                ))}
              </select>

              <ArrowRight className="w-4 h-4 text-slate-400" />

              <span className="text-xs font-bold text-slate-700">With Revised:</span>
              <select
                value={targetRevId || ''}
                onChange={(e) => setTargetRevId(Number(e.target.value))}
                className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
              >
                {revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.revision_code}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={changeFilter}
                onChange={(e) => setChangeFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
              >
                <option value="">All Signal Statuses</option>
                <option value="ADDED">Added</option>
                <option value="DELETED">Deleted</option>
                <option value="MODIFIED">Modified</option>
                <option value="UNCHANGED">Unchanged</option>
              </select>
            </div>
          </div>

          {/* Comparison KPI Grid */}
          {comparison && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Added</span>
                <span className="text-xl font-bold font-mono text-emerald-600 block mt-0.5">
                  +{comparison.total_added}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Deleted</span>
                <span className="text-xl font-bold font-mono text-rose-600 block mt-0.5">
                  -{comparison.total_deleted}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Modified</span>
                <span className="text-xl font-bold font-mono text-amber-600 block mt-0.5">
                  {comparison.total_modified}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Unchanged</span>
                <span className="text-xl font-bold font-mono text-slate-700 block mt-0.5">
                  {comparison.total_unchanged}
                </span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-700 font-bold uppercase">Preserved HW</span>
                <span className="text-xl font-bold font-mono text-emerald-800 block mt-0.5">
                  {comparison.total_preserved_assignments}
                </span>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                <span className="text-[10px] text-amber-700 font-bold uppercase">Re-wired / Moved</span>
                <span className="text-xl font-bold font-mono text-amber-800 block mt-0.5">
                  {comparison.total_moved_assignments}
                </span>
              </div>
            </div>
          )}

          {/* Diff Table */}
          {comparison && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Signal Delta & Hardware Movement Register
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparing {comparison.base_revision} against {comparison.target_revision}. Verified minimal disruption policy.
                  </p>
                </div>
                <span className="text-xs font-mono font-medium text-slate-400">
                  {filteredDiff.length} Records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Signal Tag</th>
                      <th className="py-2.5 px-3">Revision Change</th>
                      <th className="py-2.5 px-3">Base HW ({comparison.base_revision})</th>
                      <th className="py-2.5 px-3">Revised HW ({comparison.target_revision})</th>
                      <th className="py-2.5 px-3">Wiring Impact</th>
                      <th className="py-2.5 px-3">Movement Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDiff.map((item) => (
                      <tr key={item.tag} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.tag}</td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={item.change_type} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {item.old_assignment || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">
                          {item.new_assignment || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={item.movement_status} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px] leading-relaxed">
                          {item.movement_reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 bg-white border border-slate-200 rounded-xl text-center space-y-3">
          <Info className="w-8 h-8 text-blue-600 mx-auto" />
          <h3 className="font-bold text-slate-900 text-sm">Need at least 2 revisions to run differential comparison</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create a second revision (e.g. Rev B) and import an updated IO list to track delta additions, deletions, and preserved assignments.
          </p>
        </div>
      )}

      {/* Create Revision Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Create New Project Revision</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateRevision} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Revision Code</label>
                <input
                  type="text"
                  required
                  value={revCode}
                  onChange={(e) => setRevCode(e.target.value)}
                  placeholder="e.g. Rev B, Rev C"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Revision Scope / Notes</label>
                <textarea
                  rows={3}
                  value={revDesc}
                  onChange={(e) => setRevDesc(e.target.value)}
                  placeholder="e.g. Client added 4 new transmitters, deleted redundant valve..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
                >
                  Create & Activate Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
