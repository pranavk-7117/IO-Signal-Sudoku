import React, { useEffect, useState } from 'react';
import {
  X,
  HelpCircle,
  Shield,
  Layers,
  Cpu,
  GitBranch,
  Cable,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Info,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';

interface ExplainabilityDrawerProps {
  projectId?: number;
  revisionId?: number;
  tag: string | null;
  onClose: () => void;
}

export const ExplainabilityDrawer: React.FC<ExplainabilityDrawerProps> = ({
  projectId,
  revisionId,
  tag,
  onClose,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && tag) {
      loadExplanation();
    }
  }, [projectId, revisionId, tag]);

  const loadExplanation = async () => {
    if (!projectId || !tag) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.explainSignal(projectId, tag, revisionId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch signal explanation');
    } finally {
      setLoading(false);
    }
  };

  if (!tag) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 border border-blue-400/30 text-blue-400 rounded-lg">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-bold text-white tracking-wide">{tag}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  EXPLAINABILITY ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic solver rule attribution, contiguity, and redundancy justification.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500">Tracing constraint solver attribution graph...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Failed to load explanation:</span>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          ) : data ? (
            <>
              {/* Executive Summary Card */}
              <div className="p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>“Why is it here?” Solver Rationale</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {data.summary_narrative}
                </p>
              </div>

              {/* Physical Location Breadcrumb Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Current Physical Terminal Address</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Cabinet</span>
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {data.allocation.cabinet_id || '—'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">CIOC Interface</span>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {data.allocation.cioc_id || '—'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Baseplate</span>
                    <span className="font-mono text-xs font-bold text-purple-700">
                      {data.allocation.baseplate_id || '—'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">CHARM Slot</span>
                    <span className="font-mono text-xs font-bold text-emerald-700">
                      Slot {data.allocation.charm_index || '—'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span>Wiring Terminals: <strong className="text-slate-900">{data.allocation.charm_tb_terminals || '1, 2'}</strong></span>
                  <span>Terminal Block: <strong className="text-slate-900">{data.allocation.terminal_block || 'Standard CHARM TB'}</strong></span>
                </div>
              </div>

              {/* Attribution 1: Hardware Selection Rule */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Hardware Selection Rule</h4>
                      <span className="text-[10px] font-mono text-blue-600">
                        {data.hardware_attribution?.rule_id} — {data.hardware_attribution?.rule_name}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {data.hardware_attribution?.severity || 'HARD'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {data.hardware_attribution?.explanation}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                  <span>CHARM Part: <strong className="text-slate-800">{data.allocation.charm_part_no}</strong></span>
                  <span>TB Part: <strong className="text-slate-800">{data.allocation.charm_tb_part_no}</strong></span>
                </div>
              </div>

              {/* Attribution 2: Redundancy & CIOC Separation */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
                      <GitBranch className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">A/B Redundancy CIOC Separation (R-002)</h4>
                      <span className="text-[10px] font-mono text-purple-600">
                        Designation: {data.redundancy_attribution?.designated_train}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${data.redundancy_attribution?.enforced ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                    {data.redundancy_attribution?.enforced ? 'ISOLATED' : 'SIMPLEX'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {data.redundancy_attribution?.explanation}
                </p>
                {data.redundancy_attribution?.partner_signals?.length > 0 && (
                  <div className="text-[11px] text-slate-500 font-mono pt-1">
                    Partner Redundant Instruments: <span className="text-purple-700 font-semibold">{data.redundancy_attribution.partner_signals.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Attribution 3: Multi-Pair Cable Contiguity & Neighbors */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
                      <Cable className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Cable Contiguity & Monotonic Pair Order (R-001)</h4>
                      <span className="text-[10px] font-mono text-emerald-600">
                        Cable: {data.contiguity_attribution?.cable_id || 'Internal'} • Wire Pair: #{data.contiguity_attribution?.pair_number || '—'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    CONTIGUOUS
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {data.contiguity_attribution?.explanation}
                </p>

                {/* Neighbor Slot Visualizer */}
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Adjacent Baseplate Neighbors</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Slot {(data.allocation.charm_index || 1) - 1} (Left)</span>
                      <span className="font-bold text-slate-700 truncate block">
                        {data.contiguity_attribution?.left_neighbor?.tag || '— Empty / Boundary —'}
                      </span>
                      {data.contiguity_attribution?.left_neighbor?.pair && (
                        <span className="text-[10px] text-emerald-600 font-semibold">Pair #{data.contiguity_attribution.left_neighbor.pair}</span>
                      )}
                    </div>

                    <div className="p-2 rounded bg-blue-50 border-2 border-blue-400 ring-2 ring-blue-400/20">
                      <span className="text-[10px] text-blue-600 font-bold block">Slot {data.allocation.charm_index} (THIS SIGNAL)</span>
                      <span className="font-bold text-blue-900 truncate block">{tag}</span>
                      <span className="text-[10px] text-blue-700 font-semibold">Pair #{data.pair_number || 1}</span>
                    </div>

                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Slot {(data.allocation.charm_index || 1) + 1} (Right)</span>
                      <span className="font-bold text-slate-700 truncate block">
                        {data.contiguity_attribution?.right_neighbor?.tag || '— Empty / Boundary —'}
                      </span>
                      {data.contiguity_attribution?.right_neighbor?.pair && (
                        <span className="text-[10px] text-emerald-600 font-semibold">Pair #{data.contiguity_attribution.right_neighbor.pair}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attribution 4: Revision Preservation */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-md ${data.preservation_attribution?.is_preserved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Revision Preservation Policy</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {data.preservation_attribution?.explanation}
                </p>
              </div>

              {/* Attribution 5: Technical Queries / Issues */}
              {data.diagnostic_or_tq && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-rose-700 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Active Technical Query ({data.diagnostic_or_tq.tq_id})</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    {data.diagnostic_or_tq.description}
                  </p>
                  <div className="text-xs font-semibold text-rose-900 bg-white/80 p-2 rounded border border-rose-200">
                    Recommended Action: {data.diagnostic_or_tq.suggested_action}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            DeltaV CHARMs Constraint Attribution Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
