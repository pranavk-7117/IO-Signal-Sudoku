import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, DollarSign, Layers, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { WiredSpareTakeoverResponse } from '../types';

interface WiredSpareTakeoverModalProps {
  projectId: number;
  revisionId?: number;
  onTakeoverApplied?: () => void;
  onClose: () => void;
}

export const WiredSpareTakeoverModal: React.FC<WiredSpareTakeoverModalProps> = ({
  projectId,
  revisionId,
  onTakeoverApplied,
  onClose
}) => {
  const [data, setData] = useState<WiredSpareTakeoverResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [applying, setApplying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadTakeover();
  }, [projectId, revisionId]);

  const loadTakeover = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getWiredSpareTakeover(projectId, undefined, revisionId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to scan wired spares for takeover');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTakeover = async () => {
    if (!data || data.takeover_matches.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await api.applyWiredSpareTakeover(projectId, data.takeover_matches, revisionId);
      setSuccessMsg(`Successfully executed wired-spare takeover for ${data.takeover_matches.length} signals at $0.00 hardware cost!`);
      if (onTakeoverApplied) onTakeoverApplied();
    } catch (err: any) {
      setError(err.message || 'Failed to apply wired spare takeover');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Wired-Spare Takeover Engine</h3>
              <p className="text-xs text-slate-500">Official guideline rule: Revisions prefer matching controller wired spares ($0 Hardware Cost)</p>
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
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
              <span>Scanning active controllers for compatible installed wired spares...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {data && (
            <>
              {/* Financial & Operational Impact Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center space-x-2 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span>Hardware Cost Delta</span>
                  </div>
                  <span className="text-2xl font-extrabold font-mono text-emerald-700">$0.00</span>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    Saved ~${data.total_hardware_cost_saved_usd.toFixed(0)} in CHARM & TB hardware
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center space-x-2 text-blue-700 text-xs font-bold uppercase tracking-wider mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Spares Taken Over</span>
                  </div>
                  <span className="text-2xl font-extrabold font-mono text-blue-800">
                    {data.wired_spares_taken_over_count}
                  </span>
                  <p className="text-[11px] text-blue-600 mt-0.5">Existing installed 3201DSP channels converted</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center space-x-2 text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">
                    <Layers className="w-4 h-4" />
                    <span>New Channels Needed</span>
                  </div>
                  <span className="text-2xl font-extrabold font-mono text-slate-800">
                    {data.unmatched_signals_requiring_new_slots}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Require unpopulated spare baseplate slot</p>
                </div>
              </div>

              {/* Takeover Matches Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Wired-Spare Assignment Plan ({data.takeover_matches.length})
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Zero Rewiring · Same Controller IO Group
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">New Field Signal</th>
                        <th className="py-2.5 px-3">IO Type</th>
                        <th className="py-2.5 px-3">Reused Wired Spare</th>
                        <th className="py-2.5 px-3">Controller Location</th>
                        <th className="py-2.5 px-3 text-center">Cost Delta</th>
                        <th className="py-2.5 px-3">Engineering Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-mono text-[11px]">
                      {data.takeover_matches.map((m, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">{m.new_signal_tag}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 font-bold">
                              {m.signal_type}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-bold text-indigo-700">{m.target_wired_spare_tag}</td>
                          <td className="py-2 px-3 text-slate-600 text-[10px]">
                            {m.controller} / {m.cabinet_id} / {m.cioc_id} / {m.baseplate_id} : CH{m.channel_no}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              $0.00
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[10px] text-slate-500 font-sans">{m.engineering_rationale}</td>
                        </tr>
                      ))}
                      {data.takeover_matches.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-xs text-slate-400 font-sans">
                            No unallocated signals or matching wired spares detected in current revision.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Applying takeover renames existing installed wired spare positions to the new field tags.
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
            {data && data.takeover_matches.length > 0 && !successMsg && (
              <button
                onClick={handleApplyTakeover}
                disabled={applying}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{applying ? 'Applying Takeover...' : 'Apply Takeover ($0 Cost)'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};