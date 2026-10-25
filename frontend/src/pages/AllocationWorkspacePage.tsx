import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  Filter,
  Play,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Edit,
  ArrowUpDown,
  ExternalLink,
  Layers,
  Info,
  HelpCircle,
  Zap
} from 'lucide-react';
import { ExplainabilityDrawer } from '../components/ExplainabilityDrawer';
import { CounterfactualModal } from '../components/CounterfactualModal';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { Assignment, AllocationRunResult } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';

export const AllocationWorkspacePage: React.FC = () => {
  const { currentProject, currentRevision, refreshProjects, refreshRevisions } = useProject();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningSolver, setRunningSolver] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<AllocationRunResult | null>(null);
  const [showPresolveDetails, setShowPresolveDetails] = useState<boolean>(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortCol, setSortCol] = useState<string>('tag');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [explainingTag, setExplainingTag] = useState<string | null>(null);
  const [counterfactualTag, setCounterfactualTag] = useState<string | null>(null);

  // Manual Override State
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideCab, setOverrideCab] = useState('P30-DCS-32001-01');
  const [overrideCIOC, setOverrideCIOC] = useState('P30DCIOC3201001');
  const [overrideBP, setOverrideBP] = useState('001-CBP-1');
  const [overrideCharm, setOverrideCharm] = useState(1);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    if (currentProject && currentRevision) {
      loadAssignments();
    }
  }, [currentProject?.id, currentRevision?.id]);

  const loadAssignments = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      setLoading(true);
      const data = await api.getAssignments(currentProject.id, currentRevision.id);
      setAssignments(data);
    } catch (err) {
      console.error('Error fetching assignments', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAllocation = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      setRunningSolver(true);
      const res = await api.runAllocation(currentProject.id, currentRevision.id, true);
      setLastRunResult(res);
      await loadAssignments();
      await refreshProjects();
      await refreshRevisions();
    } catch (err: any) {
      alert(`Allocation Failed: ${err.message}`);
    } finally {
      setRunningSolver(false);
    }
  };

  const handleRevert = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      setLoading(true);
      await api.revertAllocation(currentProject.id, currentRevision.id);
      await loadAssignments();
      await refreshProjects();
    } catch (err: any) {
      alert(`Revert failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openOverride = (a: Assignment) => {
    setSelectedAssignment(a);
    setOverrideCab(a.cabinet_id || 'P30-DCS-32001-01');
    setOverrideCIOC(a.cioc_id || 'P30DCIOC3201001');
    setOverrideBP(a.baseplate_id || '001-CBP-1');
    setOverrideCharm(a.charm_index || 1);
    setOverrideError(null);
    setShowOverrideModal(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !currentRevision || !selectedAssignment) return;
    try {
      setOverrideError(null);
      await api.updateAssignment(currentProject.id, currentRevision.id, selectedAssignment.id, {
        cabinet_id: overrideCab,
        cioc_id: overrideCIOC,
        baseplate_id: overrideBP,
        charm_index: Number(overrideCharm),
      });
      setShowOverrideModal(false);
      await loadAssignments();
      await refreshProjects();
    } catch (err: any) {
      setOverrideError(err.message || 'Validation error prevented manual override');
    }
  };

  // Filter & Sort
  const filtered = assignments.filter((a) => {
    const s = search.toLowerCase();
    const matchSearch =
      !search ||
      a.tag.toLowerCase().includes(s) ||
      a.description.toLowerCase().includes(s) ||
      (a.cable_id || '').toLowerCase().includes(s);
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchType = !typeFilter || a.signal_type.toUpperCase() === typeFilter.toUpperCase();
    return matchSearch && matchStatus && matchType;
  });

  filtered.sort((a, b) => {
    let vA = (a as any)[sortCol] || '';
    let vB = (b as any)[sortCol] || '';
    if (typeof vA === 'string') vA = vA.toLowerCase();
    if (typeof vB === 'string') vB = vB.toLowerCase();
    if (vA < vB) return sortAsc ? -1 : 1;
    if (vA > vB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            <span>Allocation Workspace</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time constraint-based IO assignments into DeltaV CHARM carriers for {currentProject?.name} ({currentRevision?.revision_code}).
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={handleRevert}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            title="Revert to prior valid snapshot"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Revert Snapshot</span>
          </button>

          <a
            href={currentProject && currentRevision ? api.getExportUrl('allocation', currentProject.id, currentRevision.id) : '#'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Completed Schedule</span>
          </a>

          <button
            onClick={handleRunAllocation}
            disabled={runningSolver}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all"
          >
            {runningSolver ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Running CP-SAT...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Allocation Engine</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Two-Stage Presolve + CP-SAT Diagnostics Banner */}
      {lastRunResult && lastRunResult.diagnostics?.details?.staged_pipeline && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-white shadow-lg mb-2 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                    Two-Stage Presolver + Google OR-Tools CP-SAT
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {lastRunResult.diagnostics.solver_status} ({lastRunResult.diagnostics.solve_time_seconds}s)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Soft & deterministic rules pre-solved upfront; CP-SAT solved combinatorial constraints with{' '}
                  <strong className="text-teal-300">
                    {lastRunResult.diagnostics.details.staged_pipeline.stage_1_presolver.search_space_reduction_pct}%
                  </strong>{' '}
                  search space reduction.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPresolveDetails(!showPresolveDetails)}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center space-x-1"
            >
              <span>{showPresolveDetails ? 'Hide Stage Breakdown' : 'View Two-Stage Breakdown'}</span>
            </button>
          </div>

          {showPresolveDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-1 text-xs">
              {/* Stage 1: Deterministic Fast Presolver */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold text-teal-300">
                    <span>Stage 1: Fast Rule Presolver & Filter</span>
                  </div>
                  <span className="font-mono text-[10px] text-teal-400 font-bold">
                    {lastRunResult.diagnostics.details.staged_pipeline.stage_1_presolver.duration_ms} ms
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300">
                  {lastRunResult.diagnostics.details.staged_pipeline.stage_1_presolver.rules_presolved.map((r: string, idx: number) => (
                    <div key={idx} className="flex items-center space-x-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Pre-assigned Signals: <strong className="text-white">{lastRunResult.diagnostics.details.staged_pipeline.stage_1_presolver.signals_pre_assigned}</strong></span>
                  <span>Eliminated from CP-SAT: <strong className="text-teal-300">-{lastRunResult.diagnostics.details.staged_pipeline.stage_1_presolver.search_space_reduction_pct}%</strong></span>
                </div>
              </div>

              {/* Stage 2: Google OR-Tools CP-SAT */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold text-blue-300">
                    <span>Stage 2: Google OR-Tools CP-SAT</span>
                  </div>
                  <span className="font-mono text-[10px] text-blue-400 font-bold">
                    {lastRunResult.diagnostics.details.staged_pipeline.stage_2_cpsat.duration_ms} ms
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300">
                  {lastRunResult.diagnostics.details.staged_pipeline.stage_2_cpsat.hard_rules_enforced.map((r: string, idx: number) => (
                    <div key={idx} className="flex items-center space-x-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Macro Variables: <strong className="text-white">{lastRunResult.diagnostics.details.staged_pipeline.stage_2_cpsat.active_macro_variables}</strong></span>
                  <span>Constraints: <strong className="text-white">{lastRunResult.diagnostics.details.staged_pipeline.stage_2_cpsat.constraints_enforced}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Tag, description, or field cable..."
            className="w-full text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="Allocated">Allocated</option>
            <option value="Needs Review">Needs Review</option>
            <option value="Blocked">Blocked</option>
            <option value="Pending">Pending</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
          >
            <option value="">All Signal Types</option>
            <option value="AI">AI</option>
            <option value="AO">AO</option>
            <option value="DI">DI</option>
            <option value="DO">DO</option>
            <option value="DO-SOV">DO-SOV</option>
            <option value="RTD">RTD</option>
            <option value="TC">TC</option>
          </select>

          <span className="text-xs text-slate-500 font-mono font-medium pl-2">
            Showing {filtered.length} of {assignments.length} signals
          </span>
        </div>
      </div>

      {/* Main Engineering Allocation Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 select-none whitespace-nowrap">
              <tr>
                <th onClick={() => handleSort('tag')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center space-x-1">
                    <span>Signal Tag</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('signal_type')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center space-x-1">
                    <span>Type</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Description</th>
                <th onClick={() => handleSort('cable_id')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center space-x-1">
                    <span>Cable / Pair</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('redundancy')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center space-x-1">
                    <span>Red.</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('cabinet_id')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center space-x-1">
                    <span>Cabinet</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('cioc_id')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center space-x-1">
                    <span>CIOC</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('baseplate_id')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center space-x-1">
                    <span>Baseplate</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('charm_index')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center space-x-1">
                    <span>CHARM</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Terminal Block</th>
                <th className="py-2.5 px-3">Allocation Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 text-xs">
                    No signals matching filters. Run the allocation engine or import an IO list.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className={`hover:bg-blue-50/30 transition-colors ${
                      a.status === 'Blocked' ? 'bg-rose-50/30' : a.status === 'Needs Review' ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td onClick={() => setExplainingTag(a.tag)} className="py-2.5 px-3 font-mono font-bold text-blue-700 hover:underline cursor-pointer whitespace-nowrap" title="Click to see: Why is it here?">{a.tag}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {a.signal_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs" title={a.description}>
                      {a.description}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {a.cable_id ? `${a.cable_id} P${a.pair_number || 1}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {a.redundancy && a.redundancy !== '-' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {a.redundancy}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {a.cabinet_id || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800 whitespace-nowrap">
                      {a.cioc_id || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800 whitespace-nowrap">
                      {a.baseplate_id || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                      {a.charm_index ? `CH${String(a.charm_index).padStart(2, '0')}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate max-w-[140px] whitespace-nowrap" title={a.terminal_block}>
                      {a.terminal_block || '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge status={a.status} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setExplainingTag(a.tag)}
                          className="px-2 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                          title="Explain placement: Which rules & neighbors drove this assignment?"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Why here?</span>
                        </button>
                        <button
                          onClick={() => setCounterfactualTag(a.tag)}
                          className="px-2 py-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded border border-indigo-200 text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                          title="Counterfactual: Test why candidate slots are allowed or blocked for this signal"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Why not here?</span>
                        </button>
                        <button
                          onClick={() => openOverride(a)}
                          className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                          title="Manual Reassignment"
                        >
                          Reassign
                        </button>

                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explainability Drawer */}
      {explainingTag && currentProject && currentRevision && (
        <ExplainabilityDrawer
          projectId={currentProject.id}
          revisionId={currentRevision.id}
          tag={explainingTag}
          onClose={() => setExplainingTag(null)}
        />
      )}

      {/* Manual Override Dialog with Validation Guard */}
      {showOverrideModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Manual Hardware Reassignment</h3>
                <span className="font-mono text-xs text-blue-600">{selectedAssignment.tag} ({selectedAssignment.signal_type})</span>
              </div>
              <button onClick={() => setShowOverrideModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveOverride} className="p-5 space-y-4">
              {overrideError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p>
                  Manual assignments are evaluated against mandatory A/B redundancy separation and capacity constraints. Any rule violations will block approval.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target Cabinet</label>
                  <select
                    value={overrideCab}
                    onChange={(e) => setOverrideCab(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
                  >
                    {['P30-DCS-32001-01', 'P30-DCS-32001-02', 'P24-DCS-50002-01'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}

                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target CIOC</label>
                  <select
                    value={overrideCIOC}
                    onChange={(e) => setOverrideCIOC(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
                  >
                    {[
                      'P30DCIOC3201001', 'P30DCIOC3201002', 'P30DCIOC3201003', 'P30DCIOC3201004',
                      'P30DCIOC3201005', 'P30DCIOC3201006', 'P30DCIOC3201007', 'P30DCIOC3201008',
                      'P24DCIOC5002001', 'P24DCIOC5002002', 'P24DCIOC5002003', 'P24DCIOC5002004'
                    ].map((ci) => (
                      <option key={ci} value={ci}>{ci}</option>
                    ))}



                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target Baseplate</label>
                  <select
                    value={overrideBP}
                    onChange={(e) => setOverrideBP(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={`001-CBP-${n}`}>{`001-CBP-${n}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">CHARM Slot (1..12)</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={overrideCharm}
                    onChange={(e) => setOverrideCharm(Number(e.target.value))}
                    className="w-full text-xs font-mono font-bold px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
                >
                  Verify & Apply Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {counterfactualTag && currentProject && (
        <CounterfactualModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          initialTag={counterfactualTag}
          onClose={() => setCounterfactualTag(null)}
        />
      )}
    </div>
  );
};
