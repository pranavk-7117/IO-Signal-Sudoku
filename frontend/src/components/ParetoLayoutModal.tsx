import React, { useState, useEffect } from 'react';
import { X, Sliders, Layers, ShieldCheck, CheckCircle2, RefreshCw, Cpu, Server, Box, Ruler } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Physical Architecture & Hardware Layout Trade-offs</h3>
              <p className="text-xs text-slate-500">
                Comparing CIOC carrier quantities, cabinet bay widths, channel packing densities, and wired spare headrooms
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
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
              <span>Synthesizing physical CIOC & cabinet bay layout options...</span>
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
                  const isCompact = alt.id.includes('COMPACT') || alt.id.includes('MIN_HARDWARE');
                  const isGolden = alt.id.includes('MAX_SPARE');
                  const bayWidth = alt.metrics.bay_width_mm || alt.boq.system_cabinets * 800;

                  return (
                    <div
                      key={alt.id}
                      onClick={() => setSelectedAltId(alt.id)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-2.5 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            isCompact
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

                      {/* Prominent Physical Architecture Badges */}
                      <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                            <Server className="w-3.5 h-3.5 text-blue-600" />
                            <span>{alt.boq.cioc_carriers} CIOC Carriers</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold text-indigo-700">
                            {alt.boq.system_cabinets} Bays ({bayWidth}mm)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>{alt.boq.total_channels} Total Slots</span>
                          <span className="text-emerald-700 font-bold">{alt.metrics.spare_capacity_pct}% Headroom</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-600 pt-1 border-t border-slate-200/80 font-mono">
                        <div>
                          <span className="text-slate-400">Density: </span>
                          <span className="font-bold text-slate-800">
                            {alt.metrics.active_density_pct || Math.round((alt.boq.operating_signals / alt.boq.total_channels) * 100)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Wired Spares: </span>
                          <span className="font-bold text-slate-800">{alt.boq.wired_spares}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Footprint: </span>
                          <span className="font-bold text-slate-800">{alt.metrics.overall_footprint_sqm} m²</span>
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <Box className="w-4 h-4 text-blue-600" />
                        <span>{selectedAlt.name}</span>
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">{selectedAlt.summary}</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-lg border border-slate-300 text-slate-800 self-start sm:self-auto">
                      Best For: {selectedAlt.metrics.recommended_for}
                    </span>
                  </div>

                  {/* Physical Hardware Breakdown Table */}
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                      Physical DCS Hardware & Cabinet Enclosure Bill
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">System Cabinets (DCS)</span>
                        <span className="text-base font-bold font-mono text-slate-900">{selectedAlt.boq.system_cabinets} Bays</span>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                          {selectedAlt.metrics.bay_width_mm || selectedAlt.boq.system_cabinets * 800}mm Width
                        </span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">CIOC Carriers (96-Ch)</span>
                        <span className="text-base font-bold font-mono text-slate-900">{selectedAlt.boq.cioc_carriers} CIOCs</span>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                          {selectedAlt.boq.cioc_carriers * 8} Baseplates
                        </span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">Redundant PK Pairs</span>
                        <span className="text-base font-bold font-mono text-slate-900">{selectedAlt.boq.controllers} Pairs</span>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">Dedicated Controller</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">Total Channel Capacity</span>
                        <span className="text-base font-bold font-mono text-slate-900">{selectedAlt.boq.total_channels} Slots</span>
                        <span className="text-[9px] text-emerald-600 font-mono font-bold block mt-0.5">
                          {selectedAlt.boq.operating_signals} Active
                        </span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">Pre-Wired Spares</span>
                        <span className="text-base font-bold font-mono text-indigo-700">{selectedAlt.boq.wired_spares} Wired</span>
                        <span className="text-[9px] text-indigo-500 font-mono block mt-0.5">Instant Takeover</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">SE6103 Covers</span>
                        <span className="text-base font-bold font-mono text-slate-700">{selectedAlt.boq.spare_slots_covers} Positions</span>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">Protected Growth</span>
                      </div>
                    </div>
                  </div>

                  {/* Physical Segregation & Architecture Banner */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span className="text-slate-700 font-semibold">Physical Segregation Architecture:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {selectedAlt.metrics.segregation_level || 'Train A / Train B Dedicated Carriers'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-500 font-mono text-[11px]">
                      <Ruler className="w-3.5 h-3.5 text-slate-400" />
                      <span>Technical Room Bay Width: {selectedAlt.metrics.bay_width_mm || selectedAlt.boq.system_cabinets * 800}mm</span>
                      <span>({selectedAlt.metrics.overall_footprint_sqm} m²)</span>
                    </div>
                  </div>

                  {/* Engineering Pros & Cons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
