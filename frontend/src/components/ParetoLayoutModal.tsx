import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Layers,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Server,
  Box,
  Ruler,
  Plus,
  Minus,
  Play,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { ParetoResponse, ParetoAlternative } from '../types';

interface ParetoLayoutModalProps {
  projectId: number;
  revisionId?: number;
  onClose: () => void;
  onApplied?: () => void;
}

export const ParetoLayoutModal: React.FC<ParetoLayoutModalProps> = ({
  projectId,
  revisionId,
  onClose,
  onApplied
}) => {
  const [data, setData] = useState<ParetoResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAltId, setSelectedAltId] = useState<string>('ALT_MAX_SPARE');
  const [customCiocs, setCustomCiocs] = useState<number>(12);
  const [applying, setApplying] = useState<boolean>(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

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
        const defaultAlt = res.alternatives[1] || res.alternatives[0];
        setSelectedAltId(defaultAlt.id);
        setCustomCiocs(defaultAlt.boq?.cioc_carriers || 12);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate Pareto layout alternatives');
    } finally {
      setLoading(false);
    }
  };

  const selectedAlt = data?.alternatives.find((a) => a.id === selectedAltId) || data?.alternatives[0];

  // Real-time calculated hardware metrics based on customCiocs
  const totalSlots = customCiocs * 96;
  const numOperating = data?.dataset_signals_count || 177;
  const numAlarms = 12;
  const requiredChannels = numOperating + numAlarms;
  const isFeasible = totalSlots >= requiredChannels;
  const calculatedCabinets = Math.ceil(customCiocs / 4);
  const calculatedBayWidth = calculatedCabinets * 800;
  const calculatedDensity = Math.min(100, Math.round((requiredChannels / totalSlots) * 1000) / 10);
  const calculatedHeadroom = Math.max(0, Math.round((100 - calculatedDensity) * 10) / 10);
  const freeSpares = Math.max(0, totalSlots - requiredChannels);

  // Apply Hardware Topology & Reallocate
  const handleApplyTopology = async () => {
    if (!revisionId || !isFeasible) return;
    setApplying(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      // 1. Fetch current hardware config
      const hwConfig = await api.getHardwareConfig(projectId, revisionId);
      hwConfig.cabinets_count = calculatedCabinets;
      hwConfig.ciocs_per_cabinet = 4;

      // 2. Save hardware config with new CIOC & cabinet count
      await api.saveHardwareConfig(projectId, hwConfig, revisionId);

      // 3. Re-run allocation solver with new hardware capacity
      await api.runAllocation(projectId, revisionId, true, true);

      setApplySuccess(
        `Successfully sized hardware to ${customCiocs} CIOCs (${calculatedCabinets} Cabinets, ${totalSlots} Slots) and reallocated!`
      );

      // Notify parent to refresh Utilisation rack visualizer
      setTimeout(() => {
        onApplied?.();
        onClose();
      }, 1200);
    } catch (err: any) {
      setApplyError(err.message || 'Failed to apply hardware topology');
    } finally {
      setApplying(false);
    }
  };

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
              <h3 className="text-base font-bold text-slate-900">Physical Architecture & CIOC Carrier Sizing</h3>
              <p className="text-xs text-slate-500">
                Change the number of CIOC carriers, evaluate bay width & headroom trade-offs, and 1-click reallocate
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
              {/* Interactive CIOC Carrier Stepper & Architecture Sizing Bar */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-xl p-5 text-white shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-blue-300 block mb-0.5">
                      Interactive Hardware Topology Sizer
                    </span>
                    <h4 className="text-base font-bold tracking-tight">
                      Adjust CIOC Carriers & Enclosure Footprint
                    </h4>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md p-1.5 rounded-xl border border-white/20">
                    <button
                      type="button"
                      disabled={customCiocs <= 4 || applying}
                      onClick={() => setCustomCiocs((prev) => Math.max(4, prev - 2))}
                      className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Decrease by 2 CIOCs"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="px-3 text-center min-w-[110px]">
                      <span className="text-xl font-extrabold font-mono text-yellow-300 block leading-tight">
                        {customCiocs} CIOCs
                      </span>
                      <span className="text-[10px] text-blue-200 font-sans block">
                        {calculatedCabinets} Cabinet Bays
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={customCiocs >= 24 || applying}
                      onClick={() => setCustomCiocs((prev) => Math.min(24, prev + 2))}
                      className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Increase by 2 CIOCs"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10 text-xs">
                  <span className="text-blue-200 text-[11px] font-medium mr-1">Quick Presets:</span>
                  {[
                    { label: '8 CIOCs (Compact 2-Bay)', count: 8, altId: 'ALT_MIN_HARDWARE' },
                    { label: '12 CIOCs (Golden 3-Bay Spec)', count: 12, altId: 'ALT_MAX_SPARE' },
                    { label: '16 CIOCs (Expansion 4-Bay)', count: 16, altId: 'ALT_MIN_MOVEMENT' },
                    { label: '20 CIOCs (Mega Project 5-Bay)', count: 20, altId: 'ALT_MIN_MOVEMENT' },
                  ].map((preset) => (
                    <button
                      key={preset.count}
                      type="button"
                      onClick={() => {
                        setCustomCiocs(preset.count);
                        setSelectedAltId(preset.altId);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border transition-all ${
                        customCiocs === preset.count
                          ? 'bg-yellow-400 text-slate-900 border-yellow-300 shadow-xs font-bold'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Real-time Hardware Metrics Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-white/10 border border-white/10">
                    <span className="text-[10px] text-blue-200 block">Total Channels</span>
                    <span className="text-sm font-bold text-white">{totalSlots} Slots</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 border border-white/10">
                    <span className="text-[10px] text-blue-200 block">Bay Width Footprint</span>
                    <span className="text-sm font-bold text-white">{calculatedBayWidth} mm</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 border border-white/10">
                    <span className="text-[10px] text-blue-200 block">Packing Density</span>
                    <span className="text-sm font-bold text-white">{calculatedDensity}%</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 border border-white/10">
                    <span className="text-[10px] text-blue-200 block">Spare Headroom</span>
                    <span className="text-sm font-bold text-emerald-300">{calculatedHeadroom}% ({freeSpares} Free)</span>
                  </div>
                </div>

                {/* Mathematical Feasibility Pre-Check Alert */}
                {!isFeasible ? (
                  <div className="p-3 bg-rose-950/80 border border-rose-500 rounded-lg flex items-center space-x-2.5 text-xs text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      <strong>Capacity Infeasible:</strong> {requiredChannels} required channels ({numOperating} signals + {numAlarms} alarms) exceed {totalSlots} available positions. Increase to at least {Math.ceil(requiredChannels / 96)} CIOCs.
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/80 rounded-lg flex items-center space-x-2 text-xs text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Verified Feasible:</strong> Accommodates all {numOperating} field loops with {freeSpares} spare positions ({calculatedHeadroom}% Headroom) across {calculatedCabinets} standard cabinet bays.
                    </span>
                  </div>
                )}
              </div>

              {/* Status / Error Toast */}
              {applySuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{applySuccess}</span>
                </div>
              )}

              {applyError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-xl flex items-center space-x-2 shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{applyError}</span>
                </div>
              )}

              {/* Strategy Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {data.alternatives.map((alt) => {
                  const isSelected = alt.id === selectedAltId;
                  const isCompact = alt.id.includes('COMPACT') || alt.id.includes('MIN_HARDWARE');
                  const isGolden = alt.id.includes('MAX_SPARE');
                  const bayWidth = alt.metrics.bay_width_mm || alt.boq.system_cabinets * 800;

                  return (
                    <div
                      key={alt.id}
                      onClick={() => {
                        setSelectedAltId(alt.id);
                        setCustomCiocs(alt.boq.cioc_carriers);
                      }}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-2.5 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500'
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

                      {/* Prominent Architecture Card */}
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
                        <span className="text-base font-bold font-mono text-slate-900">{calculatedCabinets} Bays</span>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                          {calculatedBayWidth}mm Width
                        </span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">CIOC Carriers (96-Ch)</span>
                        <span className="text-base font-bold font-mono text-slate-900">{customCiocs} CIOCs</span>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                          {customCiocs * 8} Baseplates
                        </span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">Redundant PK Pairs</span>
                        <span className="text-base font-bold font-mono text-slate-900">{calculatedCabinets} Pairs</span>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">Dedicated Controller</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">Total Channel Capacity</span>
                        <span className="text-base font-bold font-mono text-slate-900">{totalSlots} Slots</span>
                        <span className="text-[9px] text-emerald-600 font-mono font-bold block mt-0.5">
                          {numOperating} Active
                        </span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">Pre-Wired Spares</span>
                        <span className="text-base font-bold font-mono text-indigo-700">{selectedAlt.boq.wired_spares} Wired</span>
                        <span className="text-[9px] text-indigo-500 font-mono block mt-0.5">Instant Takeover</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block">SE6103 Covers</span>
                        <span className="text-base font-bold font-mono text-slate-700">{freeSpares} Positions</span>
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
                      <span>Technical Room Bay Width: {calculatedBayWidth}mm</span>
                      <span>({(calculatedCabinets * 1.2).toFixed(1)} m²)</span>
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

        {/* Footer with 1-Click Reallocate Button */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-mono">
            <span>Target Topology: </span>
            <span className="font-bold text-slate-900">
              {customCiocs} CIOCs ({calculatedCabinets} Cabinets · {calculatedBayWidth}mm Bay)
            </span>
            <span className="text-slate-400 ml-2">| {totalSlots} Channels</span>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={applying}
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isFeasible || applying}
              onClick={handleApplyTopology}
              className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer ${
                !isFeasible
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : applying
                  ? 'bg-indigo-700 text-white cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
              }`}
            >
              {applying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sizing & Reallocating via CP-SAT...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Apply {customCiocs} CIOCs & Reallocate</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
