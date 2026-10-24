import React, { useState, useEffect } from 'react';
import {
  Layers,
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
  Network
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

  const [viewMode, setViewMode] = useState<'carriers' | 'elevation'>('carriers');

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

  if (!summary) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading hardware utilisation metrics...</div>;
  }

  const cab = summary.cabinets.find((c) => c.cabinet_id === selectedCabinet) || summary.cabinets[0];
  const cioc = cab?.ciocs.find((ci) => ci.cioc_id === selectedCIOC) || cab?.ciocs[0];

  // Bar chart data for CIOCs in active cabinet
  const ciocChartData = cab
    ? cab.ciocs.map((c) => ({
        name: c.cioc_id,
        Used: c.used_slots,
        Spare: c.reserved_spare_slots,
        Free: c.free_slots,
      }))
    : [];

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
                onClick={() => setViewMode('carriers')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  viewMode === 'carriers' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Carrier View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('elevation')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  viewMode === 'elevation' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
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

        {/* View Mode: Cabinet Walkthrough Elevation vs Carrier Baseplates Grid */}
        {viewMode === 'elevation' ? (
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
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-700">Slot Status:</span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-blue-600"></span>
                <span className="text-slate-600">AI (Analog In)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-cyan-600"></span>
                <span className="text-slate-600">AO (Analog Out)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600"></span>
                <span className="text-slate-600">DI (Discrete In)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-indigo-600"></span>
                <span className="text-slate-600">DO (Discrete Out)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-rose-600"></span>
                <span className="text-slate-600">DO-SOV (Isolated Solenoid)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500"></span>
                <span className="text-slate-600">Reserved Spare</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-sky-100 border border-sky-300"></span>
                <span className="text-slate-600">Available Free Slot</span>
              </div>
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

                      return (
                        <div
                          key={slot.charm_index}
                          onClick={() => {
                            if (slot.signal_tag) {
                              setExplainingTag(slot.signal_tag);
                            } else {
                              setCounterfactualSlot({
                                cabinet: cab.cabinet_id,
                                cioc: cioc.cioc_id,
                                baseplate: bp.baseplate_id,
                                channel: slot.charm_index
                              });
                              setShowCounterfactualModal(true);
                            }
                          }}
                          title={
                            slot.is_allocated
                              ? `CH${slot.charm_index}: ${slot.signal_tag} (${slot.signal_type})\n${slot.charm_type || ''}\n${slot.terminal_block || ''}\nClick to view rule explainability`
                              : slot.is_spare
                              ? `CH${slot.charm_index}: Reserved Spare Capacity\nClick to inspect "Why not here?"`
                              : `CH${slot.charm_index}: Unassigned Free Position\nClick to inspect "Why not here?"`
                          }
                          className={`h-11 rounded flex flex-col items-center justify-center font-mono text-[9px] font-bold transition-transform hover:scale-105 cursor-pointer shadow-2xs border ${slotBg}`}
                        >
                          <span>{slot.charm_index}</span>
                          {slot.is_allocated && (
                            <span className="text-[7px] truncate max-w-[28px] font-sans">
                              {slot.signal_type}
                            </span>
                          )}
                          {slot.is_spare && !slot.is_allocated && (
                            <span className="text-[7px] font-sans">SPR</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
