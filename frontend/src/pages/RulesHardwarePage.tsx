import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Shield,
  Sliders,
  CheckCircle2,
  Save,
  Layers,
  AlertCircle,
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { HardwareConfig } from '../types';

export const RulesHardwarePage: React.FC = () => {
  const { currentProject, currentRevision } = useProject();

  const [config, setConfig] = useState<HardwareConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (currentProject) {
      loadConfig();
    }
  }, [currentProject?.id, currentRevision?.id]);

  const loadConfig = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const data = await api.getHardwareConfig(currentProject.id, currentRevision?.id);
      setConfig(data);
    } catch (err) {
      console.error('Error fetching hardware config', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject || !config) return;
    try {
      setLoading(true);
      await api.saveHardwareConfig(currentProject.id, config, currentRevision?.id);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading hardware configuration...</div>;
  }

  // Calculate total positions
  const totalSlots =
    config.cabinets_count *
    config.ciocs_per_cabinet *
    config.baseplates_per_cioc *
    config.charms_per_baseplate;
  const spareSlots = Math.round(totalSlots * (config.spare_percentage / 100.0));
  const usableSlots = totalSlots - spareSlots;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <span>Rules & Hardware Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure DeltaV hardware capacities, hard engineering constraints, and module compatibility matrices.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <span className="flex items-center space-x-1 text-xs font-semibold text-emerald-600 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Configuration Saved!</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* Hardware Hierarchy Capacities */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>DeltaV Hardware Hierarchy & Capacity Limits</span>
            </h3>
            <p className="text-xs text-slate-500">
              Cabinet → CIOC (Controller IO Carrier) → Baseplate → CHARM Channel
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded text-slate-700">
            Total Hardware Capacity: {totalSlots} CHARMs
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="text-xs font-bold text-slate-700 block mb-1">Total Cabinets</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.cabinets_count}
              onChange={(e) => setConfig({ ...config, cabinets_count: Number(e.target.value) })}
              className="w-full text-sm font-bold font-mono px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Marshalling enclosures</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="text-xs font-bold text-slate-700 block mb-1">CIOCs per Cabinet</label>
            <input
              type="number"
              min={1}
              max={8}
              value={config.ciocs_per_cabinet}
              onChange={(e) => setConfig({ ...config, ciocs_per_cabinet: Number(e.target.value) })}
              className="w-full text-sm font-bold font-mono px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Default: 4 CIOCs / Cabinet</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="text-xs font-bold text-slate-700 block mb-1">Baseplates per CIOC</label>
            <input
              type="number"
              min={1}
              max={12}
              value={config.baseplates_per_cioc}
              onChange={(e) => setConfig({ ...config, baseplates_per_cioc: Number(e.target.value) })}
              className="w-full text-sm font-bold font-mono px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Default: 8 Baseplates / CIOC</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="text-xs font-bold text-slate-700 block mb-1">CHARMs per Baseplate</label>
            <input
              type="number"
              min={1}
              max={12}
              value={config.charms_per_baseplate}
              onChange={(e) => setConfig({ ...config, charms_per_baseplate: Number(e.target.value) })}
              className="w-full text-sm font-bold font-mono px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Default: 12 CHARMs / Baseplate</span>
          </div>
        </div>

        {/* Spare Capacity Slider */}
        <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold text-amber-900">Reserved Spare Capacity Percentage</span>
              <p className="text-[11px] text-amber-700">Dedicated reserved slots per baseplate to accommodate future expansion.</p>
            </div>
            <span className="font-mono font-bold text-sm text-amber-900 bg-amber-100 px-2.5 py-1 rounded border border-amber-300">
              {config.spare_percentage}% ({spareSlots} Reserved Slots)
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={config.spare_percentage}
            onChange={(e) => setConfig({ ...config, spare_percentage: Number(e.target.value) })}
            className="w-full accent-amber-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
            <span>0% (Tight Packing)</span>
            <span>10% (Industrial Standard)</span>
            <span>20% (High Margin)</span>
            <span>30% (Spares Priority)</span>
          </div>
        </div>
      </div>

      {/* Engineering Constraint Rules */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Constraint Solver Policies & Rule Enforcement</span>
          </h3>
          <p className="text-xs text-slate-500">Configure hard constraints versus optimization preferences.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              key: 'enforce_ab_redundancy_separation',
              title: 'A/B Redundancy CIOC Separation [HARD CONSTRAINT]',
              desc: 'Signals designated redundant A and B must never land on the same CIOC to prevent single point of hardware failure.',
              danger: true,
            },
            {
              key: 'enforce_cable_grouping',
              title: 'Multi-Pair Cable Continuity [HARD CONSTRAINT]',
              desc: 'Keep all wire pairs from the same field cable contiguous within the same Baseplate and Cabinet.',
              danger: false,
            },
            {
              key: 'enforce_pair_order',
              title: 'Cable Wire Pair Ascending Order',
              desc: 'Preserve monotonic wire pair index progression (Pair 1, Pair 2, Pair 3) across successive CHARM positions.',
              danger: false,
            },
            {
              key: 'enforce_logical_grouping',
              title: 'Process Logical Group Co-location',
              desc: 'Cluster instruments belonging to the same process unit (e.g. Boiler, Turbine) into adjacent baseplates.',
              danger: false,
            },
            {
              key: 'preserve_previous_assignments',
              title: 'Revision Assignment Preservation',
              desc: 'Preserve existing valid allocations when ingesting Rev B/C to minimize wiring rework in marshalling cabinets.',
              danger: false,
            },
            {
              key: 'allow_cross_baseplate_cables',
              title: 'Allow Cross-Baseplate Cable Split',
              desc: 'Permit large multi-pair cables (e.g. 24-pair) to overflow into contiguous subsequent baseplates when needed.',
              danger: false,
            },
          ].map((rule) => {
            const isChecked = (config.rules as any)[rule.key];
            return (
              <div
                key={rule.key}
                onClick={() =>
                  setConfig({
                    ...config,
                    rules: { ...config.rules, [rule.key]: !isChecked },
                  })
                }
                className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start space-x-3 ${
                  isChecked
                    ? 'bg-blue-50/50 border-blue-400'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded accent-blue-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <span>{rule.title}</span>
                    {rule.danger && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{rule.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Signal Compatibility Catalogue Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Signal & Hardware Compatibility Matrix</span>
          </h3>
          <p className="text-xs text-slate-500">
            Defines compatible CHARM module types and Terminal Block requirements for each IO signal class.
          </p>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">IO Signal Type</th>
                <th className="py-2.5 px-4">Compatible DeltaV™ CHARM Module</th>
                <th className="py-2.5 px-4">Required Terminal Block Type</th>
                <th className="py-2.5 px-4">Wiring Characteristics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(config.compatibility_matrix).map(([type, spec]) => (
                <tr key={type} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-bold text-blue-700">{type}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{spec.charm}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-700">{spec.terminal}</td>
                  <td className="py-2.5 px-4 text-slate-500">
                    {type.startsWith('AI') || type.startsWith('AO')
                      ? '4-20mA HART Loop Powered'
                      : type === 'DO-SOV'
                      ? 'Fused Injected Power / Isolated Solenoid'
                      : type === 'RTD' || type === 'TC'
                      ? 'Direct Sensor mV / CJC Compensation'
                      : '24VDC Dry Contact Discrete'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
