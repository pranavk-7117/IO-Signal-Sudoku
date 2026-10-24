import React, { useState, useEffect } from 'react';
import { X, Sliders, DollarSign, Layers, ShieldCheck, CheckCircle2, TrendingDown, RefreshCw, Cpu, Award } from 'lucide-react';
import { api } from '../services/api';
import { ParetoResponse, ParetoAlternative } from '../types';

interface ParetoLayoutModalProps {
  projectId: number;
  revisionId?: number;
  onClose: () => void;
}

export const ParetoLayoutModal: React.FC<ParetoLayoutModalProps> = ({
  projectId,
  revisionId,
  onClose
}) => {
  const [data, setData] = useState<ParetoResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAltId, setSelectedAltId] = useState<string>('ALT_MAX_SPARE');

  useEffect(() => {
    loadPareto();
  }, [projectId, revisionId]);

  const loadPareto = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getParetoAlternatives(projectId, revisionId);
      setData(res);
      if (res.alternatives.length > 0) {
        setSelectedAltId(res.alternatives[1]?.id || res.alternatives[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate Pareto layout alternatives');
    } finally {
      setLoading(false);
    }
  };

  const selectedAlt = data?.alternatives.find((a) => a.id === selectedAltId) || data?.alternatives[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Layout Alternatives (Pareto Optimization)</h3>
              <p className="text-xs text-slate-500">Side-by-side trade-off analysis: CapEx Cost vs Spare Headroom vs Revision Churn</p>
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
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
              <span>Synthesizing multi-objective Pareto layout options...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Strategy Selector Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {data.alternatives.map((alt) => {
                  const isSelected = alt.id === selectedAltId;
                  const isMinHw = alt.id === 'ALT_MIN_HARDWARE';
                  const isGolden = alt.id === 'ALT_MAX_SPARE';

                  return (
                    <div
                      key={alt.id}
                      onClick={() => setSelectedAltId(alt.id)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            isMinHw
                              ? 'bg-emerald-100 text-emerald-800'
                              : isGolden
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {alt.badge}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">{alt.name}</h4>
                      <div className="flex items-baseline space-x-1.5 pt-1">
                        <span className="text-base font-extrabold font-mono text-slate-900">
                          ${(alt.metrics.estimated_hardware_cost_usd / 1000).toFixed(1)}k
                        </span>
                        <span className="text-[10px] text-slate-500 font-sans">Est. Hardware</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-600 pt-1 border-t border-slate-200/80 font-mono">
                        <div>
                          <span className="text-slate-400">Cabinets: </span>
                          <span className="font-bold text-slate-800">{alt.boq.system_cabinets}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">CIOCs: </span>
                          <span className="font-bold text-slate-800">{alt.boq.cioc_carriers}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Spares: </span>
                          <span className="font-bold text-slate-800">{alt.metrics.spare_capacity_pct}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Resilience: </span>
                          <span className="font-bold text-slate-800">{alt.metrics.resilience_score}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Strategy Deep Dive */}
              {selectedAlt && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{selectedAlt.name}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">{selectedAlt.summary}</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-white px-2.5 py-1 rounded border border-slate-300 text-slate-800">
                      Best For: {selectedAlt.metrics.recommended_for}
                    </span>
                  </div>

                  {/* Bill of Quantities (BOQ) Breakdown Table */}
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                      Complete Bill of Quantities (BOQ)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">System Cabinets</span>
                        <span className="text-base font-bold font-mono text-slate-900">{selectedAlt.boq.system_cabinets} Cabs</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">CIOC Carriers</span>
                        <span className="text-base font-bold font-mono text-slate-900">{selectedAlt.boq.cioc_carriers} CIOCs</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">Total Channels</span>
                        <span className="text-base font-bold font-mono text-slate-900">{selectedAlt.boq.total_channels} Slots</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">Wired Spares (10%)</span>
                        <span className="text-base font-bold font-mono text-indigo-700">{selectedAlt.boq.wired_spares} Wired</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">SE6103 Covers</span>
                        <span className="text-base font-bold font-mono text-slate-700">{selectedAlt.boq.spare_slots_covers} Covers</span>
                      </div>
                    </div>
                  </div>

                  {/* Pros & Cons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1">
                      <span className="text-xs font-bold text-emerald-900 block">Engineering Advantages</span>
                      <ul className="list-disc list-inside text-xs text-emerald-800 space-y-0.5">
                        {selectedAlt.pros.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1">
                      <span className="text-xs font-bold text-amber-900 block">Trade-offs & Constraints</span>
                      <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                        {selectedAlt.cons.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
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