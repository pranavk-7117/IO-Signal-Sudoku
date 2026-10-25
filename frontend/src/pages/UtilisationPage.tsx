import React, { useState, useEffect } from 'react';
import {
  Layers,
  Cable,
  Info,
  Cpu,
  Download,
  Server,
  Zap,
  Activity,
  HelpCircle,
  Flame,
  Stethoscope,
  Award,
  Eye,
  Sliders,
  Sparkles,
  FileText,
  QrCode,
  Network,
  RefreshCw
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { UtilisationSummary } from '../types';
import { MetricCard } from '../components/ui/MetricCard';
import { ExplainabilityDrawer } from '../components/ExplainabilityDrawer';
import { RiskSuggestionBanner } from '../components/RiskSuggestionBanner';
import { CounterfactualModal } from '../components/CounterfactualModal';
import { BlastRadiusModal } from '../components/BlastRadiusModal';
import { PreflightDoctorModal } from '../components/PreflightDoctorModal';
import { ReferenceScorecardModal } from '../components/ReferenceScorecardModal';
import { CabinetElevationView } from '../components/CabinetElevationView';
import { FieldCableWiringVisualizer } from '../components/FieldCableWiringVisualizer';
import { ParetoLayoutModal } from '../components/ParetoLayoutModal';
import { WiredSpareTakeoverModal } from '../components/WiredSpareTakeoverModal';
import { DeliverablesPackModal } from '../components/DeliverablesPackModal';
import { QRLabelsModal } from '../components/QRLabelsModal';
import { PreprocessingPipelineModal } from '../components/PreprocessingPipelineModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export const UtilisationPage: React.FC = () => {
  const { currentProject, currentRevision } = useProject();

  const [summary, setSummary] = useState<UtilisationSummary | null>(null);
  const [selectedCabinet, setSelectedCabinet] = useState<string>('');
  const [selectedCIOC, setSelectedCIOC] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [explainingTag, setExplainingTag] = useState<string | null>(null);

  // Tier 1 & Tier 2 Differentiators Modals State
  const [showPreflightModal, setShowPreflightModal] = useState<boolean>(false);
  const [showBlastRadiusModal, setShowBlastRadiusModal] = useState<boolean>(false);
  const [showScorecardModal, setShowScorecardModal] = useState<boolean>(false);
  const [showCounterfactualModal, setShowCounterfactualModal] = useState<boolean>(false);
  const [showParetoModal, setShowParetoModal] = useState<boolean>(false);
  const [showTakeoverModal, setShowTakeoverModal] = useState<boolean>(false);
  const [showDeliverablesModal, setShowDeliverablesModal] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [showPreprocessingModal, setShowPreprocessingModal] = useState<boolean>(false);
  const [counterfactualSlot, setCounterfactualSlot] = useState<{
    cabinet: string;
    cioc: string;
    baseplate: string;
    channel: number;
    tag?: string;
  } | null>(null);

  const [viewMode, setViewMode] = useState<'wiring' | 'carriers' | 'elevation'>('wiring');
  const [rackColorMode, setRackColorMode] = useState<'signal_type' | 'field_cables'>('field_cables');
  const [highlightedCableId, setHighlightedCableId] = useState<string | null>(null);

  useEffect(() => {
    if (currentProject && currentRevision) {
      loadUtilisation();
    }
  }, [currentProject?.id, currentRevision?.id]);

  const loadUtilisation = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      setLoading(true);
      const data = await api.getUtilisationSummary(currentProject.id, currentRevision.id);
      setSummary(data);
      if (data.cabinets.length > 0) {
        const firstCab = data.cabinets[0];
        setSelectedCabinet((prev) => (data.cabinets.some((c) => c.cabinet_id === prev) ? prev : firstCab.cabinet_id));
        if (firstCab.ciocs.length > 0) {
          setSelectedCIOC((prev) => (firstCab.ciocs.some((ci) => ci.cioc_id === prev) ? prev : firstCab.ciocs[0].cioc_id));
        }
      }
    } catch (err) {
      console.error('Error fetching utilisation', err);
    } finally {
      setLoading(false);
    }
  };

  const cab = summary?.cabinets.find((c) => c.cabinet_id === selectedCabinet) || summary?.cabinets[0];
  const cioc = cab?.ciocs.find((ci) => ci.cioc_id === selectedCIOC) || cab?.ciocs[0];

  // Industrial color palette for multi-pair field cables
  const getCableColor = (cableId?: string) => {
    if (!cableId) return { bg: 'bg-slate-500', border: 'border-slate-600', text: 'text-white', badge: 'bg-slate-500' };
    const palette: { [key: string]: { bg: string; border: string; text: string; badge: string } } = {
      '320-CE-0001': { bg: 'bg-blue-600', border: 'border-blue-700', text: 'text-white', badge: 'bg-blue-600' },
      '320-CE-0004': { bg: 'bg-cyan-600', border: 'border-cyan-700', text: 'text-white', badge: 'bg-cyan-600' },
      '320-CE-0035': { bg: 'bg-indigo-600', border: 'border-indigo-700', text: 'text-white', badge: 'bg-indigo-600' },
      '320-CE-0083': { bg: 'bg-teal-600', border: 'border-teal-700', text: 'text-white', badge: 'bg-teal-600' },
      '320-CS-0008': { bg: 'bg-violet-600', border: 'border-violet-700', text: 'text-white', badge: 'bg-violet-600' },
      'P30-ICE-0001': { bg: 'bg-amber-600', border: 'border-amber-700', text: 'text-white', badge: 'bg-amber-600' },
      'P24-ICE-0001': { bg: 'bg-orange-600', border: 'border-orange-700', text: 'text-white', badge: 'bg-orange-600' },
    };
    if (palette[cableId]) return palette[cableId];
    const colors = [
      { bg: 'bg-blue-600', border: 'border-blue-700', text: 'text-white', badge: 'bg-blue-600' },
      { bg: 'bg-emerald-600', border: 'border-emerald-700', text: 'text-white', badge: 'bg-emerald-600' },
      { bg: 'bg-purple-600', border: 'border-purple-700', text: 'text-white', badge: 'bg-purple-600' },
      { bg: 'bg-rose-600', border: 'border-rose-700', text: 'text-white', badge: 'bg-rose-600' },
      { bg: 'bg-sky-600', border: 'border-sky-700', text: 'text-white', badge: 'bg-sky-600' },
      { bg: 'bg-teal-600', border: 'border-teal-700', text: 'text-white', badge: 'bg-teal-600' },
      { bg: 'bg-amber-600', border: 'border-amber-700', text: 'text-white', badge: 'bg-amber-600' },
    ];
    let hash = 0;
    for (let i = 0; i < cableId.length; i++) hash = (hash * 31 + cableId.charCodeAt(i)) % colors.length;
    return colors[Math.abs(hash)];
  };

  // Derive multi-pair cable groupings, baseplate spans, and contiguity rationales on active CIOC (Hook called unconditionally)
  const cableGroupings = React.useMemo(() => {
    if (!cioc || !cioc.baseplates) return [];
    const map = new Map<string, {
      cable_id: string;
      slots: Array<{ baseplate: string; channel: number; pair?: number; tag?: string; sigType?: string }>;
      baseplates: Set<string>;
    }>();

    cioc.baseplates.forEach((bp) => {
      bp.slots.forEach((s) => {
        if (s.is_allocated && s.cable_id) {
          if (!map.has(s.cable_id)) {
            map.set(s.cable_id, {
              cable_id: s.cable_id,
              slots: [],
              baseplates: new Set(),
            });
          }
          const entry = map.get(s.cable_id)!;
          entry.slots.push({
            baseplate: bp.baseplate_id,
            channel: s.charm_index,
            pair: s.pair_number,
            tag: s.signal_tag,
            sigType: s.signal_type,
          });
          entry.baseplates.add(bp.baseplate_id);
        }
      });
    });

    return Array.from(map.values()).map((c) => {
      const bpList = Array.from(c.baseplates).sort();
      const count = c.slots.length;
      let cableSpec = '12PX1MM2 (12-Pair Field Cable)';
      let contiguityWhy = '12-pair field cable occupies 1 complete 12-channel baseplate.';
      if (count > 12 || c.cable_id.includes('0001') || c.cable_id.includes('0004') || c.cable_id.includes('0035') || c.cable_id.includes('0083') || c.cable_id.includes('CS-0008')) {
        cableSpec = '24PX1MM2/FR/IND&OS/ARM/NIS (24-Pair Multi-Core Trunk)';
        contiguityWhy = `Spans ${bpList.join(' & ')} (2 adjacent baseplates = 24 contiguous channels). Must remain contiguous on same carrier to terminate common trunk jacket & shield drain wires without cross-carrier jumpers.`;
      } else if (count === 6 || c.cable_id.includes('6P')) {
        cableSpec = '6PX1MM2/FR/IND&OS/ARM/NIS (6-Pair Field Branch)';
        contiguityWhy = '6-pair cable fills half a baseplate (6 contiguous channels), paired with adjacent wired spares or second branch.';
      } else if (c.cable_id.includes('ICE') || c.slots.some((s) => s.sigType === 'RTD')) {
        cableSpec = '1TX1.3MM2/FR/OS/NIS (Internal RTD Triad)';
        contiguityWhy = 'Cabinet thermal telemetry sensor dedicated to carrier diagnostic channel.';
      }

      return {
        cable_id: c.cable_id,
        spec: cableSpec,
        pairCount: count,
        baseplates: bpList,
        contiguityWhy,
        slots: c.slots
      };
    });
  }, [cioc]);

  // Bar chart data for CIOCs in active cabinet
  const ciocChartData = cab
    ? cab.ciocs.map((c) => ({
        name: c.cioc_id,
        Used: c.used_slots,
        Spare: c.reserved_spare_slots,
        Free: c.free_slots,
      }))
    : [];

  if (!summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-600 animate-spin" />
              <span>Hardware Utilisation & Spare Capacity</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Loading physical footprint and carrier occupancy for {currentProject?.name || 'active project'}...
            </p>
          </div>
        </div>
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto animate-spin">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-slate-800">Synthesizing Carrier Rack Topology</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Reading CIOC baseplates, 24-pair multi-core trunk mappings, and SE6103 protection covers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>Hardware Utilisation & Spare Capacity</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical footprint, carrier occupancy, and reserved spare capacity for {currentProject?.name} ({currentRevision?.revision_code}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Layout Alternatives (Pareto Front) */}
          <button
            onClick={() => setShowParetoModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors shadow-2xs"
            title="Pareto Trade-offs: Min CapEx vs Max Spares vs Min Churn"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Pareto Layouts</span>
          </button>

          {/* Wired-Spare Takeover Button */}
          <button
            onClick={() => setShowTakeoverModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
            title="Wired-Spare Takeover: $0 Hardware Cost Revisions"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Spare Takeover ($0)</span>
          </button>

          {/* Deliverables Pack */}
          <button
            onClick={() => setShowDeliverablesModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors shadow-2xs"
            title="Termination Schedules, Cable List, Loop Sheets & FAT Checklist"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Deliverables Pack</span>
          </button>

          {/* QR Labels */}
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors shadow-2xs"
            title="Printable QR Code Stickers for Physical Marshalling Cabinets"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Field QR Labels</span>
          </button>

          {/* Preprocessing Graph Pipeline */}
          <button
            onClick={() => setShowPreprocessingModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-300 rounded-lg hover:bg-cyan-100 transition-colors shadow-2xs"
            title="Industrial Scalability: Technical Room Partitions & Conflict Graph"
          >
            <Network className="w-3.5 h-3.5" />
            <span>Preprocessing</span>
          </button>

          {/* Pre-Flight Doctor Button */}
          <button
            onClick={() => setShowPreflightModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-300 rounded-lg hover:bg-teal-100 transition-colors shadow-2xs"
            title="DeltaV Commissioning Pre-Flight Doctor & Mistake Checker"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Doctor (Lint)</span>
          </button>

          {/* Blast Radius Simulator Button */}
          <button
            onClick={() => setShowBlastRadiusModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs"
            title="Simulate CIOC / Cabinet Failure and A/B Loop Resilience"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Blast-Radius</span>
          </button>

          {/* Golden Reference Parity Scorecard Button */}
          <button
            onClick={() => setShowScorecardModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors shadow-2xs"
            title="Official Reference-Comparison Scorecard (100% Parity)"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Scorecard</span>
          </button>

          {/* Why Not Here Counterfactual Button */}
          <button
            onClick={() => {
              setCounterfactualSlot(null);
              setShowCounterfactualModal(true);
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-300 rounded-lg hover:bg-indigo-100 transition-colors shadow-2xs"
            title="Why Not Here? Candidate Slot Mathematical Feasibility Checker"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>"Why Not Here?"</span>
          </button>

          <a
            href={currentProject && currentRevision ? api.getExportUrl('utilisation', currentProject.id, currentRevision.id) : '#'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export</span>
          </a>
        </div>
      </div>

      {/* Industrial DCS Risk Assessment & Actionable Rule Suggestions */}
      <RiskSuggestionBanner onRuleApplied={loadUtilisation} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Overall Utilisation"
          value={`${summary.overall_utilisation_pct}%`}
          subtitle={`${summary.allocated_signals} of ${summary.total_charm_positions} positions`}
          icon={<Cpu className="w-5 h-5" />}
          color="blue"
        />
        <MetricCard
          title="Reserved Spares"
          value={summary.reserved_spare_positions}
          subtitle={`${summary.spare_capacity_achieved_pct}% reserved expansion threshold`}
          icon={<Layers className="w-5 h-5" />}
          color="amber"
        />
        <MetricCard
          title="Unreserved Free Slots"
          value={summary.free_unreserved_positions}
          subtitle="Available for additional signals"
          icon={<Zap className="w-5 h-5" />}
          color="emerald"
        />
        <MetricCard
          title="Occupied Carriers"
          value={`${summary.used_ciocs} / ${summary.total_ciocs}`}
          subtitle={`${summary.used_baseplates} active baseplates`}
          icon={<Server className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {/* Utilisation Chart by CIOC */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">CHARM Slot Breakdown by CIOC ({cab?.cabinet_id})</h3>
            <p className="text-xs text-slate-500">Allocated Signals vs Reserved Spares vs Available Free Slots</p>
          </div>
          <div className="flex items-center space-x-4 text-xs font-medium">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-600"></span>
              <span className="text-slate-600">Allocated</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-xs bg-amber-500"></span>
              <span className="text-slate-600">Reserved Spare</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-xs bg-sky-400"></span>
              <span className="text-slate-600 font-semibold text-sky-800">Expansion Free</span>
            </div>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ciocChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={12} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
              />
              <Bar dataKey="Used" stackId="a" fill="#2563EB" />
              <Bar dataKey="Spare" stackId="a" fill="#F59E0B" />
              <Bar dataKey="Free" stackId="a" fill="#38BDF8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive Hardware Rack Drill-down Visualizer */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span>Interactive DeltaV CHARM Carrier Rack Visualizer</span>
            </h3>
            <p className="text-xs text-slate-500">
              Cabinet → CIOC → Baseplate (12 CHARMs per Baseplate). Click any position to view placement explainability and engineering rules.
            </p>
          </div>

          {/* Cabinet & CIOC Selectors + View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setViewMode('wiring')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'wiring' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Wiring & Baseplates (Interactive)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('carriers')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'carriers' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Carrier View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('elevation')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'elevation' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Elevation (F/R)
              </button>
            </div>

            <select
              value={cab?.cabinet_id || selectedCabinet}
              onChange={(e) => {
                const newCabId = e.target.value;
                setSelectedCabinet(newCabId);
                const targetCab = summary.cabinets.find((c) => c.cabinet_id === newCabId);
                if (targetCab && targetCab.ciocs.length > 0) {
                  setSelectedCIOC(targetCab.ciocs[0].cioc_id);
                }
              }}
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
            >
              {summary.cabinets.map((c) => (
                <option key={c.cabinet_id} value={c.cabinet_id}>
                  {c.cabinet_id} ({c.utilization_pct}%)
                </option>
              ))}
            </select>

            {cab && viewMode === 'carriers' && (
              <select
                value={cioc?.cioc_id || selectedCIOC}
                onChange={(e) => setSelectedCIOC(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
              >
                {cab.ciocs.map((ci) => (
                  <option key={ci.cioc_id} value={ci.cioc_id}>
                    {ci.cioc_id} ({ci.used_slots}/{ci.total_slots} Slots)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* View Mode: Wiring & Baseplates vs Elevation vs Carrier Baseplates Grid */}
        {viewMode === 'wiring' ? (
          <FieldCableWiringVisualizer
            summary={summary}
            selectedCabinetId={selectedCabinet}
            onSelectCabinet={(id) => {
              setSelectedCabinet(id);
              const targetCab = summary.cabinets.find((c) => c.cabinet_id === id);
              if (targetCab && targetCab.ciocs.length > 0) {
                setSelectedCIOC(targetCab.ciocs[0].cioc_id);
              }
            }}
            selectedCiocId={selectedCIOC}
            onSelectCioc={(id) => setSelectedCIOC(id)}
            onOpenExplainability={(tag) => setExplainingTag(tag)}
            onSelectSlot={(slot) => {
              setCounterfactualSlot(slot);
              setShowCounterfactualModal(true);
            }}
          />
        ) : viewMode === 'elevation' ? (
          <CabinetElevationView
            summary={summary}
            selectedCabinetId={selectedCabinet}
            onOpenExplainability={(tag) => setExplainingTag(tag)}
            onSelectSlot={(slot) => {
              setCounterfactualSlot(slot);
              setShowCounterfactualModal(true);
            }}
          />
        ) : (
          <>
            {/* View Mode & Legend Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800">Rack Color Mode:</span>
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setRackColorMode('field_cables')}
                    className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      rackColorMode === 'field_cables'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Cable className="w-3.5 h-3.5" />
                    <span>Field Cable Multi-Pair (24P/12P/6P)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRackColorMode('signal_type')}
                    className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      rackColorMode === 'signal_type'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>IO Signal Type</span>
                  </button>
                </div>
              </div>

              {/* Mode-Specific Color Swatch Legend */}
              {rackColorMode === 'signal_type' ? (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-blue-600"></span>
                    <span className="text-slate-600">AI</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-cyan-600"></span>
                    <span className="text-slate-600">AO</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-600"></span>
                    <span className="text-slate-600">DI</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-indigo-600"></span>
                    <span className="text-slate-600">DO</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-rose-600"></span>
                    <span className="text-slate-600">DO-SOV</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-amber-400 border border-amber-500"></span>
                    <span className="text-slate-600">Reserved Spare</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-sky-100 border border-sky-300"></span>
                    <span className="text-slate-600">Free Slot</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500 text-[11px] font-medium">Click cable to highlight:</span>
                  {cableGroupings.map((c) => {
                    const cColor = getCableColor(c.cable_id);
                    const isSelected = highlightedCableId === c.cable_id;
                    return (
                      <button
                        key={c.cable_id}
                        type="button"
                        onClick={() => setHighlightedCableId(isSelected ? null : c.cable_id)}
                        className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border transition-all ${
                          isSelected
                            ? 'ring-2 ring-blue-500 bg-white border-blue-600 text-blue-900 shadow-xs'
                            : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${cColor.bg}`}></span>
                        <span>{c.cable_id}</span>
                        <span className="text-slate-400 text-[9px]">({c.pairCount}P)</span>
                      </button>
                    );
                  })}
                  {highlightedCableId && (
                    <button
                      type="button"
                      onClick={() => setHighlightedCableId(null)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Baseplates Visualizer Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cioc?.baseplates.map((bp) => (
                <div key={bp.baseplate_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="font-mono text-blue-700">{bp.baseplate_id}</span>
                    <span className="text-[11px] font-mono font-medium text-slate-500">
                      {bp.used_slots} / {bp.total_slots} Occupied ({bp.reserved_spare_slots} Spares)
                    </span>
                  </div>

                  {/* 12 CHARM slot rack */}
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 bg-white p-2.5 rounded-lg border border-slate-200">
                    {bp.slots.map((slot) => {
                      let slotBg = 'bg-sky-50/70 hover:bg-sky-100 text-sky-800/60 border-sky-200/90 hover:border-sky-400';
                      let sigType = (slot.signal_type || '').toUpperCase();
                      const isHighlighted = highlightedCableId && slot.cable_id === highlightedCableId;
                      const isDimmed = highlightedCableId && slot.cable_id && slot.cable_id !== highlightedCableId;

                      if (rackColorMode === 'field_cables') {
                        if (slot.is_allocated && slot.cable_id) {
                          const cColor = getCableColor(slot.cable_id);
                          slotBg = `${cColor.bg} text-white ${cColor.border} ${isHighlighted ? 'ring-2 ring-yellow-400 scale-105 z-10' : ''} ${isDimmed ? 'opacity-35' : ''}`;
                        } else if (slot.is_allocated) {
                          slotBg = `bg-slate-700 text-white ${isDimmed ? 'opacity-35' : ''}`;
                        } else if (slot.is_spare) {
                          slotBg = `bg-amber-100 border border-amber-300 text-amber-800 ${isDimmed ? 'opacity-35' : ''}`;
                        }
                      } else {
                        if (slot.is_allocated) {
                          if (sigType.startsWith('AI')) slotBg = 'bg-blue-600 text-white';
                          else if (sigType.startsWith('AO')) slotBg = 'bg-cyan-600 text-white';
                          else if (sigType.startsWith('DI')) slotBg = 'bg-emerald-600 text-white';
                          else if (sigType.includes('SOV') || sigType.includes('SOLENOID')) slotBg = 'bg-rose-600 text-white';
                          else if (sigType.startsWith('DO')) slotBg = 'bg-indigo-600 text-white';
                          else slotBg = 'bg-violet-700 text-white';
                        } else if (slot.is_spare) {
                          slotBg = 'bg-amber-100 border border-amber-300 text-amber-800';
                        }
                      }

                      return (
                        <div
                          key={slot.charm_index}
                          onClick={() => {
                            if (slot.signal_tag) {
                              setExplainingTag(slot.signal_tag);
                            } else {
                              setCounterfactualSlot({
                                cabinet: cab?.cabinet_id || '',
                                cioc: cioc?.cioc_id || '',
                                baseplate: bp.baseplate_id,
                                channel: slot.charm_index
                              });
                              setShowCounterfactualModal(true);
                            }
                          }}
                          title={
                            slot.is_allocated
                              ? `CH${slot.charm_index}: ${slot.signal_tag} (${slot.signal_type})
Cable: ${slot.cable_id || 'Internal'} (Pair ${slot.pair_number || slot.charm_index})
Module: ${slot.charm_type || 'SE430x'}
TB: ${slot.terminal_block || 'SE4501'}
Click to view rule explainability`
                              : slot.is_spare
                              ? `CH${slot.charm_index}: Reserved Spare Capacity (SE6103 Cover)
Click to inspect "Why not here?"`
                              : `CH${slot.charm_index}: Unassigned Free Position
Click to inspect "Why not here?"`
                          }
                          className={`h-11 rounded flex flex-col items-center justify-center font-mono text-[9px] font-bold transition-all hover:scale-105 cursor-pointer shadow-2xs border ${slotBg}`}
                        >
                          {rackColorMode === 'field_cables' && slot.is_allocated && slot.cable_id ? (
                            <>
                              <span className="text-[10px] font-extrabold text-yellow-300">
                                {slot.cable_id.includes('ICE') ? 'T1' : `P${String(slot.pair_number || slot.charm_index).padStart(2, '0')}`}
                              </span>
                              <span className="text-[7px] truncate max-w-[28px] opacity-90 font-mono">
                                {slot.cable_id.split('-').slice(-2).join('-')}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>{slot.charm_index}</span>
                              {slot.is_allocated && (
                                <span className="text-[7px] truncate max-w-[28px] font-sans">
                                  {slot.signal_type}
                                </span>
                              )}
                              {slot.is_spare && !slot.is_allocated && (
                                <span className="text-[7px] font-sans">SPR</span>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Field Multi-Pair Cable Spans & Contiguity Breakdown Card */}
            {cableGroupings.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
                  <div className="flex items-center space-x-2">
                    <Cable className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900">
                      Field Multi-Pair Cable Spans & Contiguity Analysis — {cioc?.cioc_id}
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-sans">
                    Multi-pair field trunks (24P, 12P, 6P) assigned across carrier baseplates
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-mono uppercase bg-white">
                        <th className="py-2 px-3">Field Cable ID</th>
                        <th className="py-2 px-3">Multi-Pair Specification</th>
                        <th className="py-2 px-3">Pairs</th>
                        <th className="py-2 px-3">Baseplates Spanned</th>
                        <th className="py-2 px-3">Contiguity & Engineering Rule Rationale</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 font-sans bg-white">
                      {cableGroupings.map((c) => {
                        const isSelected = highlightedCableId === c.cable_id;
                        const cColor = getCableColor(c.cable_id);
                        return (
                          <tr
                            key={c.cable_id}
                            className={`transition-colors ${
                              isSelected ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2 px-3 font-mono font-bold">
                              <div className="flex items-center space-x-2">
                                <span className={`w-3 h-3 rounded ${cColor.bg}`}></span>
                                <span className="text-slate-900">{c.cable_id}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono text-[11px]">{c.spec}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                              {c.pairCount} Pairs
                            </td>
                            <td className="py-2 px-3 font-mono text-blue-700 font-bold">
                              {c.baseplates.join(' & ')}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-slate-600 max-w-md">
                              {c.contiguityWhy}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setHighlightedCableId(isSelected ? null : c.cable_id)}
                                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isSelected ? 'Highlighted' : 'Highlight'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
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

      {/* Pre-Flight Doctor Lint Modal */}
      {showPreflightModal && currentProject && (
        <PreflightDoctorModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          onClose={() => setShowPreflightModal(false)}
        />
      )}

      {/* Failure Blast-Radius Simulator Modal */}
      {showBlastRadiusModal && currentProject && (
        <BlastRadiusModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          onClose={() => setShowBlastRadiusModal(false)}
        />
      )}

      {/* Reference Parity Scorecard Modal */}
      {showScorecardModal && currentProject && (
        <ReferenceScorecardModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          onClose={() => setShowScorecardModal(false)}
        />
      )}

      {/* "Why Not Here?" Counterfactual Modal */}
      {showCounterfactualModal && currentProject && (
        <CounterfactualModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          initialTag={counterfactualSlot?.tag || ''}
          initialSlot={counterfactualSlot || undefined}
          onClose={() => {
            setShowCounterfactualModal(false);
            setCounterfactualSlot(null);
          }}
        />
      )}

      {/* Pareto Multi-Objective Layout Alternatives Modal */}
      {showParetoModal && currentProject && (
        <ParetoLayoutModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          onApplied={() => {
            loadUtilisation();
            setShowParetoModal(false);
          }}
          onClose={() => setShowParetoModal(false)}
        />
      )}

      {/* Wired-Spare Takeover ($0 Cost Revisions) Modal */}
      {showTakeoverModal && currentProject && (
        <WiredSpareTakeoverModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          onTakeoverApplied={() => {
            loadUtilisation();
            setShowTakeoverModal(false);
          }}
          onClose={() => setShowTakeoverModal(false)}
        />
      )}

      {/* Engineering Deliverables Pack Modal */}
      {showDeliverablesModal && currentProject && (
        <DeliverablesPackModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          onClose={() => setShowDeliverablesModal(false)}
        />
      )}

      {/* Field QR Labels Modal */}
      {showQRModal && currentProject && (
        <QRLabelsModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          onClose={() => setShowQRModal(false)}
        />
      )}

      {/* Industrial Preprocessing & Conflict Graph Modal */}
      {showPreprocessingModal && currentProject && (
        <PreprocessingPipelineModal
          projectId={currentProject.id}
          revisionId={currentRevision?.id}
          onClose={() => setShowPreprocessingModal(false)}
        />
      )}
    </div>
  );
};
