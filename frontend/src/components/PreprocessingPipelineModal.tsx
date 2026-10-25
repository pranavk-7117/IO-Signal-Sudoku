import React, { useState, useEffect } from 'react';
import { X, Network, Cpu, ShieldAlert, Layers, GitFork, RefreshCw, Zap, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { PreprocessingAnalysisResponse } from '../types';

interface PreprocessingPipelineModalProps {
  projectId: number;
  revisionId?: number;
  onClose: () => void;
}

export const PreprocessingPipelineModal: React.FC<PreprocessingPipelineModalProps> = ({
  projectId,
  revisionId,
  onClose
}) => {
  const [data, setData] = useState<PreprocessingAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysis();
  }, [projectId, revisionId]);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPreprocessingAnalysis(projectId, revisionId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to execute preprocessing pipeline analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Industrial Preprocessing & Conflict Graph Pipeline</h3>
              <p className="text-xs text-slate-500">
                Divide & Conquer: Technical room decoupling, macro-cable aggregation & bipartite conflict graph
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {loading && (
            <div className="py-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
              <span>Analyzing graph topologies and technical room partitions...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Scalability Impact Banner */}
              <div className="p-4 bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-teal-300 flex items-center justify-center font-mono font-bold text-lg text-teal-700 shadow-2xs">
                    {data.solver_search_space_reduction_pct}%
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">CP-SAT Search Space Reduction</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Deterministic filters & macro-cable clustering shrink variables fed to Google OR-Tools.
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <span className="font-bold text-slate-800">{data.active_signals_fed_to_solver} Active Blocks</span>
                  <span className="text-[10px] text-slate-500 block">From {data.total_signals_received} Total Signals</span>
                </div>
              </div>

              {/* Pipeline Stage Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Deleted Vacated</span>
                  <span className="text-xl font-bold font-mono text-slate-800">{data.deleted_signals_vacated}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Zero solver overhead</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Alarms Pre-Placed</span>
                  <span className="text-xl font-bold font-mono text-amber-700">{data.internal_alarms_preassigned}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Static Baseplate 1 slots</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pinned Revision Signals</span>
                  <span className="text-xl font-bold font-mono text-blue-700">{data.pinned_revision_signals_frozen}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">100% frozen addresses</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Solver Target Blocks</span>
                  <span className="text-xl font-bold font-mono text-emerald-700">{data.active_signals_fed_to_solver}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Sub-second CP-SAT solve</span>
                </div>
              </div>

              {/* Two-Stage Architecture Execution Flow */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-white space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                      Two-Stage Decomposition & Presolve Pipeline
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Industrial Scalability Standard
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Stage 1 Box */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-teal-300">Stage 1: Fast Rule Presolver & Filter</span>
                      <span className="text-[10px] text-teal-400 font-mono font-bold">&lt; 3 ms</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Filters soft rules, deterministic hardware typing, and static intervals before integer programming:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300">
                      <li className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span><strong>Tech Room Partitions:</strong> Decouple sub-models by physical room</span>
                      </li>
                      <li className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span><strong>Hardware Typing:</strong> SOV to Isolated DO SE4302T02 + Fused TB</span>
                      </li>
                      <li className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span><strong>Alarms & Pinning:</strong> Hard-code Baseplate 1 diagnostics & Rev A</span>
                      </li>
                      <li className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span><strong>Macro-Cable Fusion:</strong> 12x-24x variable reduction into blocks</span>
                      </li>
                    </ul>
                  </div>

                  {/* Stage 2 Box */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-300">Stage 2: Google OR-Tools CP-SAT</span>
                      <span className="text-[10px] text-blue-400 font-mono font-bold">Sub-Second Solve</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Receives only the reduced, filtered macro decision blocks to solve hard combinatorial rules:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300">
                      <li className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span><strong>Cable Contiguity:</strong> 12p/24p multi-pairs across adjacent baseplates</span>
                      </li>
                      <li className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span><strong>Train A/B Parity:</strong> Strict odd/even CIOC carrier segregation</span>
                      </li>
                      <li className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span><strong>Wired Spares:</strong> Enforce 10% spare threshold by IO type per controller</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Technical Room Decoupling */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Technical Room Decoupling (Divide & Conquer)
                </span>
                <p className="text-xs text-slate-600">
                  Signals are strictly partitioned by physical technical rooms. Sub-models solve independently, preventing $O(N^2)$ cross-room complexity explosions.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {Object.entries(data.technical_room_partitions).map(([room, count]) => (
                    <div key={room} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-slate-800">{room}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">{count} signals</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conflict & Affinity Graph Structure */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Conflict & Affinity Graph Structure
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-700">
                    {data.conflict_graph.node_count} Nodes · {data.conflict_graph.edge_count} Edges
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                    <span className="font-bold text-slate-800 block">🔴 Redundancy Conflict Edges (A/B)</span>
                    <p className="text-[11px] text-slate-500">
                      Bipartite coloring constraints: Train A and Train B signals sharing the same process loop must never share the same carrier.
                    </p>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                    <span className="font-bold text-slate-800 block">🟢 Process Loop Affinity Edges</span>
                    <p className="text-[11px] text-slate-500">
                      Attraction constraints: Non-conflicting instruments in the same functional loop are clustered onto adjacent baseplates.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};