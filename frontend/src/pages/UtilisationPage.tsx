import React, { useState, useEffect } from 'react';
import {
  Layers,
  Cpu,
  Download,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
  Activity,
  Maximize2
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { UtilisationSummary, CabinetUtilisation, CIOCUtilisation, BaseplateUtilisation } from '../types';
import { MetricCard } from '../components/ui/MetricCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export const UtilisationPage: React.FC = () => {
  const { currentProject, currentRevision } = useProject();

  const [summary, setSummary] = useState<UtilisationSummary | null>(null);
  const [selectedCabinet, setSelectedCabinet] = useState<string>('CAB-01');
  const [selectedCIOC, setSelectedCIOC] = useState<string>('CIOC-01');
  const [loading, setLoading] = useState<boolean>(false);

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
        setSelectedCabinet(data.cabinets[0].cabinet_id);
        if (data.cabinets[0].ciocs.length > 0) {
          setSelectedCIOC(data.cabinets[0].ciocs[0].cioc_id);
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

        <a
          href={currentProject && currentRevision ? api.getExportUrl('utilisation', currentProject.id, currentRevision.id) : '#'}
          target="_blank"
          rel="noreferrer"
          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-blue-600" />
          <span>Export Utilisation Report</span>
        </a>
      </div>

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
          color="slate"
        />
      </div>

      {/* Utilisation Chart by CIOC */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">CHARM Slot Breakdown by CIOC ({selectedCabinet})</h3>
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
              <span className="w-3 h-3 rounded-xs bg-slate-200"></span>
              <span className="text-slate-600">Free</span>
            </div>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ciocChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={12} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
              />
              <Bar dataKey="Used" stackId="a" fill="#2563EB" />
              <Bar dataKey="Spare" stackId="a" fill="#F59E0B" />
              <Bar dataKey="Free" stackId="a" fill="#CBD5E1" />
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
              Cabinet → CIOC → Baseplate (12 CHARMs per Baseplate). Hover over any position to inspect allocated instrument tag.
            </p>
          </div>

          {/* Cabinet & CIOC Selectors */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedCabinet}
              onChange={(e) => setSelectedCabinet(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
            >
              {summary.cabinets.map((c) => (
                <option key={c.cabinet_id} value={c.cabinet_id}>
                  {c.cabinet_id} ({c.utilization_pct}%)
                </option>
              ))}
            </select>

            {cab && (
              <select
                value={selectedCIOC}
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
            <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300"></span>
            <span className="text-slate-600">Empty / Free</span>
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
                  let slotBg = 'bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-200';
                  let sigType = slot.signal_type || '';

                  if (slot.is_allocated) {
                    if (sigType === 'AI') slotBg = 'bg-blue-600 text-white';
                    else if (sigType === 'AO') slotBg = 'bg-cyan-600 text-white';
                    else if (sigType === 'DI') slotBg = 'bg-emerald-600 text-white';
                    else if (sigType === 'DO') slotBg = 'bg-indigo-600 text-white';
                    else if (sigType === 'DO-SOV') slotBg = 'bg-rose-600 text-white';
                    else slotBg = 'bg-slate-800 text-white';
                  } else if (slot.is_spare) {
                    slotBg = 'bg-amber-100 border border-amber-300 text-amber-800';
                  }

                  return (
                    <div
                      key={slot.charm_index}
                      title={
                        slot.is_allocated
                          ? `CH${slot.charm_index}: ${slot.signal_tag} (${slot.signal_type})\n${slot.charm_type || ''}\n${slot.terminal_block || ''}`
                          : slot.is_spare
                          ? `CH${slot.charm_index}: Reserved Spare Capacity`
                          : `CH${slot.charm_index}: Unassigned Free Position`
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
      </div>
    </div>
  );
};
