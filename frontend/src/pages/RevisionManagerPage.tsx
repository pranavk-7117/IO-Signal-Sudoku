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
  Info,
  LayoutGrid,
  Table as TableIcon,
  HelpCircle,
  Sparkles,
  Maximize2,
  SplitSquareVertical,
  Columns
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { RevisionComparison, RevisionDiffItem, Assignment } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MetricCard } from '../components/ui/MetricCard';
import { ExplainabilityDrawer } from '../components/ExplainabilityDrawer';

export const RevisionManagerPage: React.FC = () => {
  const { currentProject, revisions, currentRevision, refreshRevisions, refreshProjects, setCurrentRevisionById } = useProject();

  const [baseRevId, setBaseRevId] = useState<number | null>(null);
  const [targetRevId, setTargetRevId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<RevisionComparison | null>(null);
  const [loading, setLoading] = useState(false);

  // Assignments for Visual Carrier Map
  const [baseAssignments, setBaseAssignments] = useState<Assignment[]>([]);
  const [targetAssignments, setTargetAssignments] = useState<Assignment[]>([]);
  const [mapCabinet, setMapCabinet] = useState<string>('CAB-01');
  const [mapCIOC, setMapCIOC] = useState<string>('CIOC-01');
  const [mapLayoutMode, setMapLayoutMode] = useState<'unified' | 'sideBySide'>('unified');
  const [activeViewTab, setActiveViewTab] = useState<'map' | 'table'>('map');

  // Explainability Drawer
  const [explainingTag, setExplainingTag] = useState<string | null>(null);

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
      const [diffData, baseAllocs, targetAllocs] = await Promise.all([
        api.compareRevisions(currentProject.id, baseRevId, targetRevId),
        api.getAssignments(currentProject.id, baseRevId),
        api.getAssignments(currentProject.id, targetRevId)
      ]);
      setComparison(diffData);
      setBaseAssignments(baseAllocs);
      setTargetAssignments(targetAllocs);

      // Auto-pick available cabinet and CIOC
      const allCabs = Array.from(new Set([
        ...baseAllocs.map((a) => a.cabinet_id).filter(Boolean),
        ...targetAllocs.map((a) => a.cabinet_id).filter(Boolean)
      ])) as string[];
      if (allCabs.length > 0 && !allCabs.includes(mapCabinet)) {
        setMapCabinet(allCabs[0]);
      }
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

  // Group diff items by tag
  const diffByTag = new Map<string, RevisionDiffItem>();
  if (comparison) {
    for (const d of comparison.diff_records) {
      diffByTag.set(d.tag.trim().toUpperCase(), d);
    }
  }

  // Carrier slots builder
  const baseSlotsMap = new Map<string, Assignment>();
  for (const a of baseAssignments) {
    if (a.cabinet_id && a.cioc_id && a.baseplate_id && a.charm_index) {
      const key = `${a.cabinet_id}|${a.cioc_id}|${a.baseplate_id}|${a.charm_index}`;
      baseSlotsMap.set(key, a);
    }
  }

  const targetSlotsMap = new Map<string, Assignment>();
  for (const a of targetAssignments) {
    if (a.cabinet_id && a.cioc_id && a.baseplate_id && a.charm_index) {
      const key = `${a.cabinet_id}|${a.cioc_id}|${a.baseplate_id}|${a.charm_index}`;
      targetSlotsMap.set(key, a);
    }
  }

  // Available cabinets and CIOCs
  const availableCabinets = Array.from(new Set([
    'CAB-01', 'CAB-02', '320-DCM-01', '320-DCM-02',
    ...baseAssignments.map((a) => a.cabinet_id).filter(Boolean),
    ...targetAssignments.map((a) => a.cabinet_id).filter(Boolean)
  ])) as string[];

  const availableCIOCs = ['CIOC-01', 'CIOC-02', 'CIOC-03', 'CIOC-04'];
  const baseplateNums = [1, 2, 3, 4, 5, 6, 7, 8];

  const getSlotDiffState = (cab: string, cioc: string, bpId: string, slotIdx: number) => {
    const key = `${cab}|${cioc}|${bpId}|${slotIdx}`;
    const baseA = baseSlotsMap.get(key);
    const targetA = targetSlotsMap.get(key);

    if (!baseA && !targetA) {
      return { status: 'SPARE', tag: null, label: 'Spare Slot', color: 'bg-slate-50 border-slate-200 border-dashed text-slate-400' };
    }

    if (!baseA && targetA) {
      const diffItem = diffByTag.get(targetA.tag.trim().toUpperCase());
      const isMoved = diffItem?.movement_status === 'MOVED';
      return {
        status: isMoved ? 'MOVED' : 'ADDED',
        tag: targetA.tag,
        signal: targetA,
        label: isMoved ? '⇄ Moved Here' : '+ Added in Rev B',
        color: isMoved ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-400/20' : 'bg-emerald-100 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
      };
    }

    if (baseA && !targetA) {
      const diffItem = diffByTag.get(baseA.tag.trim().toUpperCase());
      const isMoved = diffItem?.movement_status === 'MOVED';
      return {
        status: isMoved ? 'RELOCATED' : 'DELETED',
        tag: baseA.tag,
        signal: baseA,
        label: isMoved ? '⇄ Vacated (Moved)' : '− Deleted / Vacated',
        color: 'bg-rose-50 border-rose-300 border-dashed text-rose-800'
      };
    }

    if (baseA && targetA) {
      if (baseA.tag === targetA.tag) {
        return {
          status: 'UNCHANGED',
          tag: targetA.tag,
          signal: targetA,
          label: '✓ Preserved Baseline',
          color: 'bg-blue-50/70 border-blue-300 text-slate-900'
        };
      } else {
        return {
          status: 'REPLACED',
          tag: targetA.tag,
          signal: targetA,
          label: `⇄ Replaced (${baseA.tag} → ${targetA.tag})`,
          color: 'bg-amber-100 border-amber-400 text-amber-950 ring-2 ring-amber-400/30'
        };
      }
    }

    return { status: 'SPARE', tag: null, label: 'Spare', color: 'bg-slate-50 border-slate-200 border-dashed text-slate-400' };
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <GitCompare className="w-5 h-5 text-blue-600" />
            <span>Revision Management & Differential Analysis</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit lifecycle revisions, visualize carrier layout diffs matching slide graphics, and prevent re-wiring disruption.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {comparison && currentProject && baseRevId && targetRevId && (
            <a
              href={api.getRevisionDiffExportUrl(currentProject.id, baseRevId, targetRevId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
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
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
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
                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
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
              <span className="text-xs font-bold text-slate-700">Baseline (Rev A):</span>
              <select
                value={baseRevId || ''}
                onChange={(e) => setBaseRevId(Number(e.target.value))}
                className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden cursor-pointer"
              >
                {revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.revision_code}
                  </option>
                ))}
              </select>

              <ArrowRight className="w-4 h-4 text-slate-400" />

              <span className="text-xs font-bold text-slate-700">Target (Rev B):</span>
              <select
                value={targetRevId || ''}
                onChange={(e) => setTargetRevId(Number(e.target.value))}
                className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden cursor-pointer"
              >
                {revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.revision_code}
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveViewTab('map')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeViewTab === 'map'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Visual Carrier Map Diff</span>
              </button>

              <button
                onClick={() => setActiveViewTab('table')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeViewTab === 'table'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Audit Table Grid</span>
              </button>
            </div>
          </div>

          {/* Comparison KPI Grid */}
          {comparison && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Added Signals</span>
                <span className="text-xl font-bold font-mono text-emerald-600 block mt-0.5">
                  +{comparison.total_added}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Deleted Signals</span>
                <span className="text-xl font-bold font-mono text-rose-600 block mt-0.5">
                  -{comparison.total_deleted}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Modified Signals</span>
                <span className="text-xl font-bold font-mono text-amber-600 block mt-0.5">
                  {comparison.total_modified}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Unchanged Preserved</span>
                <span className="text-xl font-bold font-mono text-slate-700 block mt-0.5">
                  {comparison.total_unchanged}
                </span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-700 font-bold uppercase">Preserved HW Terminations</span>
                <span className="text-xl font-bold font-mono text-emerald-800 block mt-0.5">
                  {comparison.total_preserved_assignments}
                </span>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                <span className="text-[10px] text-amber-700 font-bold uppercase">Re-wired / Moved Slots</span>
                <span className="text-xl font-bold font-mono text-amber-800 block mt-0.5">
                  {comparison.total_moved_assignments}
                </span>
              </div>
            </div>
          )}

          {/* --- TAB 1: VISUAL CARRIER MAP DIFF (Slide Graphic Style) --- */}
          {activeViewTab === 'map' && comparison && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <LayoutGrid className="w-4 h-4 text-blue-600" />
                    <span>Rev A → Rev B Carrier Map Visual Differential</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Physical carrier slot layout showing exactly where signals were added, moved, vacated, or preserved.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Cabinet Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-600">Cabinet:</span>
                    <select
                      value={mapCabinet}
                      onChange={(e) => setMapCabinet(e.target.value)}
                      className="text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden cursor-pointer"
                    >
                      {availableCabinets.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* CIOC Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-600">CIOC:</span>
                    <select
                      value={mapCIOC}
                      onChange={(e) => setMapCIOC(e.target.value)}
                      className="text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden cursor-pointer"
                    >
                      {availableCIOCs.map((ci) => (
                        <option key={ci} value={ci}>{ci}</option>
                      ))}
                    </select>
                  </div>

                  {/* Layout Style Toggle */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                    <button
                      onClick={() => setMapLayoutMode('unified')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                        mapLayoutMode === 'unified' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600'
                      }`}
                    >
                      Unified Overlay
                    </button>
                    <button
                      onClick={() => setMapLayoutMode('sideBySide')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                        mapLayoutMode === 'sideBySide' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600'
                      }`}
                    >
                      Side-by-Side (Rev A | Rev B)
                    </button>
                  </div>
                </div>
              </div>

              {/* Graphic Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700">Diff Map Legend:</span>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600"></span>
                  <span className="text-slate-800 font-semibold">+ Added in Rev B</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500"></span>
                  <span className="text-slate-800 font-semibold">⇄ Moved / Relocated</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-rose-200 border border-rose-400 border-dashed"></span>
                  <span className="text-slate-800 font-semibold">− Deleted / Vacated Slot</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-300"></span>
                  <span className="text-slate-800 font-semibold">✓ Preserved Baseline (0 Rewiring)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300 border-dashed"></span>
                  <span className="text-slate-500">Empty / Reserved Spare</span>
                </div>
              </div>

              {/* Unified Overlay Layout */}
              {mapLayoutMode === 'unified' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {baseplateNums.map((bpNum) => {
                    const ciocNumStr = mapCIOC.replace(/[^0-9]/g, '').padStart(3, '0') || '001';
                    const bpId = `${ciocNumStr}-CBP-${bpNum}`;

                    return (
                      <div key={bpId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span className="font-mono text-blue-700">Baseplate {bpNum} ({bpId})</span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">12 CHARMs</span>
                        </div>

                        {/* 12 CHARM Slots Rack */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((slotIdx) => {
                            const state = getSlotDiffState(mapCabinet, mapCIOC, bpId, slotIdx);

                            return (
                              <div
                                key={slotIdx}
                                onClick={() => state.tag && setExplainingTag(state.tag)}
                                className={`p-2 rounded-lg border text-center transition-all min-h-[68px] flex flex-col justify-between ${state.color} ${state.tag ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}
                                title={state.tag ? `Click to see: Why is ${state.tag} here?` : 'Spare slot'}
                              >
                                <div className="flex items-center justify-between text-[9px] font-mono font-bold">
                                  <span>#{slotIdx}</span>
                                  {state.status === 'ADDED' && <span className="text-emerald-700 font-bold">+ADD</span>}
                                  {state.status === 'MOVED' && <span className="text-amber-700 font-bold">⇄MOVE</span>}
                                  {state.status === 'DELETED' && <span className="text-rose-700 font-bold">−DEL</span>}
                                  {state.status === 'UNCHANGED' && <span className="text-blue-700 font-bold">✓OK</span>}
                                </div>

                                <div className="my-1">
                                  {state.tag ? (
                                    <span className="font-mono text-[10px] font-bold block truncate" title={state.tag}>
                                      {state.tag}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic block">Spare</span>
                                  )}
                                </div>

                                {state.signal && (
                                  <div className="text-[9px] font-mono text-slate-600 truncate">
                                    {state.signal.signal_type} {state.signal.pair_number ? `P${state.signal.pair_number}` : ''}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Side-by-Side (Rev A on Left vs Rev B on Right) */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Rev A Baseline */}
                  <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="font-bold text-xs text-slate-800 uppercase flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                        <span>{comparison.base_revision} Baseline Carrier Grid</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">{mapCabinet} / {mapCIOC}</span>
                    </div>

                    <div className="space-y-3">
                      {baseplateNums.map((bpNum) => {
                        const ciocNumStr = mapCIOC.replace(/[^0-9]/g, '').padStart(3, '0') || '001';
                        const bpId = `${ciocNumStr}-CBP-${bpNum}`;

                        return (
                          <div key={`base-${bpId}`} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                            <span className="text-[11px] font-mono font-bold text-slate-700 block">CBP-{bpNum}</span>
                            <div className="grid grid-cols-6 gap-1">
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((slotIdx) => {
                                const key = `${mapCabinet}|${mapCIOC}|${bpId}|${slotIdx}`;
                                const alloc = baseSlotsMap.get(key);

                                return (
                                  <div
                                    key={`base-${slotIdx}`}
                                    onClick={() => alloc && setExplainingTag(alloc.tag)}
                                    className={`p-1.5 rounded text-center border text-[10px] font-mono min-h-[50px] flex flex-col justify-between ${
                                      alloc
                                        ? 'bg-slate-100 border-slate-300 text-slate-800 cursor-pointer hover:bg-slate-200'
                                        : 'bg-slate-50 border-slate-200 border-dashed text-slate-400'
                                    }`}
                                  >
                                    <span className="text-[8px] text-slate-400 block">#{slotIdx}</span>
                                    <span className="font-bold truncate block">{alloc ? alloc.tag : 'Spare'}</span>
                                    <span className="text-[8px] text-slate-500">{alloc ? alloc.signal_type : ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Rev B Revised */}
                  <div className="space-y-4 p-4 bg-blue-50/40 border border-blue-200 rounded-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                      <span className="font-bold text-xs text-blue-900 uppercase flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                        <span>{comparison.target_revision} Revised Carrier Grid</span>
                      </span>
                      <span className="text-[11px] font-mono text-blue-700">{mapCabinet} / {mapCIOC}</span>
                    </div>

                    <div className="space-y-3">
                      {baseplateNums.map((bpNum) => {
                        const ciocNumStr = mapCIOC.replace(/[^0-9]/g, '').padStart(3, '0') || '001';
                        const bpId = `${ciocNumStr}-CBP-${bpNum}`;

                        return (
                          <div key={`target-${bpId}`} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                            <span className="text-[11px] font-mono font-bold text-blue-800 block">CBP-{bpNum}</span>
                            <div className="grid grid-cols-6 gap-1">
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((slotIdx) => {
                                const key = `${mapCabinet}|${mapCIOC}|${bpId}|${slotIdx}`;
                                const alloc = targetSlotsMap.get(key);
                                const state = getSlotDiffState(mapCabinet, mapCIOC, bpId, slotIdx);

                                return (
                                  <div
                                    key={`target-${slotIdx}`}
                                    onClick={() => alloc && setExplainingTag(alloc.tag)}
                                    className={`p-1.5 rounded text-center border text-[10px] font-mono min-h-[50px] flex flex-col justify-between ${state.color} ${
                                      alloc ? 'cursor-pointer hover:shadow-xs' : ''
                                    }`}
                                  >
                                    <span className="text-[8px] block">#{slotIdx}</span>
                                    <span className="font-bold truncate block">{alloc ? alloc.tag : 'Spare'}</span>
                                    <span className="text-[8px]">{alloc ? alloc.signal_type : ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- TAB 2: AUDIT TABLE GRID --- */}
          {activeViewTab === 'table' && comparison && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Signal Delta & Hardware Movement Register
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparing {comparison.base_revision} against {comparison.target_revision}. Verified minimal disruption policy. Click any tag to see why it was placed there.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={changeFilter}
                    onChange={(e) => setChangeFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden cursor-pointer"
                  >
                    <option value="">All Signal Statuses</option>
                    <option value="ADDED">Added</option>
                    <option value="DELETED">Deleted</option>
                    <option value="MODIFIED">Modified</option>
                    <option value="UNCHANGED">Unchanged</option>
                  </select>
                  <span className="text-xs font-mono font-medium text-slate-400">
                    {filteredDiff.length} Records
                  </span>
                </div>
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
                      <th className="py-2.5 px-3 text-right">Explainability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDiff.map((item) => (
                      <tr key={item.tag} className="hover:bg-slate-50 transition-colors">
                        <td
                          onClick={() => setExplainingTag(item.tag)}
                          className="py-2.5 px-3 font-mono font-bold text-blue-700 hover:underline cursor-pointer"
                        >
                          {item.tag}
                        </td>
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
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setExplainingTag(item.tag)}
                            className="inline-flex items-center space-x-1 px-2 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Why here?</span>
                          </button>
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
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs cursor-pointer"
                >
                  Create & Activate Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Explainability Drawer */}
      {explainingTag && currentProject && (
        <ExplainabilityDrawer
          projectId={currentProject.id}
          revisionId={targetRevId || currentRevision?.id}
          tag={explainingTag}
          onClose={() => setExplainingTag(null)}
        />
      )}
    </div>
  );
};
