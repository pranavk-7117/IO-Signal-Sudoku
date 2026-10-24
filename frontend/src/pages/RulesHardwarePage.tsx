import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Shield,
  Sliders,
  CheckCircle2,
  Save,
  Layers,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Search,
  Filter,
  Check,
  X,
  Sparkles,
  Info
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { HardwareConfig, ProjectRule } from '../types';

const CHARM_PRESETS = [
  { name: 'AI 4-20 MA HART CHARM', part: 'SE4303T01', defaultTB: 'Standard CHARM Terminal Block', tbPart: 'SE4501', pins: '1, 2' },
  { name: 'AO 4-20 MA HART CHARM', part: 'SE4304T01', defaultTB: 'Standard CHARM Terminal Block', tbPart: 'SE4501', pins: '1, 2' },
  { name: 'DISCRETE INPUT CHARM; 24 VDC DRY CONTACT: LOW SIDE SENSE', part: 'SE4301T02', defaultTB: 'Standard CHARM Terminal Block', tbPart: 'SE4501', pins: '1, 2' },
  { name: 'DISCRETE OUTPUT CHARM; 24 VDC; HIGH SIDE', part: 'SE4302T01', defaultTB: 'Standard CHARM Terminal Block', tbPart: 'SE4501', pins: '1, 2' },
  { name: 'DO 24V DC Isolated', part: 'SE4302T02', defaultTB: 'Fused-Injected-Power Terminal Block', tbPart: 'SE4502', pins: '-, 2, 4' },
  { name: 'RTD Input Charm', part: 'SE4303T03', defaultTB: 'Standard CHARM Terminal Block', tbPart: 'SE4501', pins: '1, 2, 4' },
  { name: 'Thermocouple / mV CHARM', part: 'SE4303T02', defaultTB: 'TC Cold-Junction Terminal Block', tbPart: 'SE4501', pins: '1, 2' },
  { name: 'CHARM PROTECTION COVER', part: 'SE6103', defaultTB: 'Standard CHARM Terminal Block', tbPart: 'SE4501', pins: '-' }
];

const TB_PRESETS = [
  { name: 'Standard CHARM Terminal Block', part: 'SE4501', pins: '1, 2' },
  { name: 'Fused-Injected-Power Terminal Block', part: 'SE4502', pins: '-, 2, 4' },
  { name: 'Relay Output Terminal Block', part: 'SE4503', pins: '1, 2' },
  { name: 'TC Cold-Junction Terminal Block', part: 'SE4501', pins: '1, 2' }
];

export const RulesHardwarePage: React.FC = () => {
  const { currentProject, currentRevision } = useProject();

  const [config, setConfig] = useState<HardwareConfig | null>(null);
  const [rules, setRules] = useState<ProjectRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<ProjectRule | null>(null);

  // Form State
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formKind, setFormKind] = useState('charm_terminal_map');
  const [formSeverity, setFormSeverity] = useState<'hard' | 'soft'>('hard');
  const [formColumn, setFormColumn] = useState('signal_type');
  const [formOperator, setFormOperator] = useState('equals');
  const [formMatchVal, setFormMatchVal] = useState('');
  const [formCharm, setFormCharm] = useState(CHARM_PRESETS[0].name);
  const [formCharmPart, setFormCharmPart] = useState(CHARM_PRESETS[0].part);
  const [formTB, setFormTB] = useState(CHARM_PRESETS[0].defaultTB);
  const [formTBPart, setFormTBPart] = useState(CHARM_PRESETS[0].tbPart);
  const [formPins, setFormPins] = useState(CHARM_PRESETS[0].pins);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (currentProject) {
      loadData();
    }
  }, [currentProject?.id, currentRevision?.id]);

  const loadData = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const [cfg, rls] = await Promise.all([
        api.getHardwareConfig(currentProject.id, currentRevision?.id),
        api.getProjectRules(currentProject.id, currentRevision?.id)
      ]);
      setConfig(cfg);
      setRules(rls);
    } catch (err) {
      console.error('Error fetching hardware & rules data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
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

  const handleToggleRule = async (rule: ProjectRule) => {
    if (!currentProject) return;
    try {
      const updated = await api.toggleProjectRule(currentProject.id, rule.id, currentRevision?.id);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err: any) {
      alert(`Toggle failed: ${err.message}`);
    }
  };

  const handleResetRules = async () => {
    if (!currentProject) return;
    if (!window.confirm('Reset all rules to factory defaults? Custom rules will be removed and default settings restored.')) {
      return;
    }
    try {
      setLoading(true);
      const restored = await api.resetProjectRules(currentProject.id, currentRevision?.id);
      setRules(restored);
      alert('Rules successfully reset to factory defaults.');
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setFormError(null);
    const customCount = rules.filter((r) => r.is_custom).length;
    setFormId(`CUST-${String(customCount + 1).padStart(3, '0')}`);
    setFormName('');
    setFormDesc('');
    setFormKind('charm_terminal_map');
    setFormSeverity('hard');
    setFormColumn('signal_type');
    setFormOperator('equals');
    setFormMatchVal('');
    setFormCharm(CHARM_PRESETS[0].name);
    setFormCharmPart(CHARM_PRESETS[0].part);
    setFormTB(CHARM_PRESETS[0].defaultTB);
    setFormTBPart(CHARM_PRESETS[0].tbPart);
    setFormPins(CHARM_PRESETS[0].pins);
    setShowModal(true);
  };

  const openEditModal = (r: ProjectRule) => {
    setIsEditing(true);
    setFormError(null);
    setFormId(r.id);
    setFormName(r.name);
    setFormDesc(r.description || '');
    setFormKind(r.kind);
    setFormSeverity(r.severity);
    setFormColumn(r.target_column || 'signal_type');
    setFormOperator(r.operator || 'equals');
    setFormMatchVal(r.match_value || '');
    setFormCharm(r.target_charm || CHARM_PRESETS[0].name);
    setFormCharmPart(r.target_charm_part || CHARM_PRESETS[0].part);
    setFormTB(r.target_terminal || CHARM_PRESETS[0].defaultTB);
    setFormTBPart(r.target_terminal_part || CHARM_PRESETS[0].tbPart);
    setFormPins(r.target_terminals || CHARM_PRESETS[0].pins);
    setShowModal(true);
  };

  const handleCharmChange = (charmName: string) => {
    setFormCharm(charmName);
    const found = CHARM_PRESETS.find((p) => p.name === charmName);
    if (found) {
      setFormCharmPart(found.part);
      setFormTB(found.defaultTB);
      setFormTBPart(found.tbPart);
      setFormPins(found.pins);
    }
  };

  const handleTBChange = (tbName: string) => {
    setFormTB(tbName);
    const found = TB_PRESETS.find((p) => p.name === tbName);
    if (found) {
      setFormTBPart(found.part);
      setFormPins(found.pins);
    }
  };

  const handleSaveModalRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    if (!formName.trim()) {
      setFormError('Rule name is required.');
      return;
    }
    if (formKind === 'charm_terminal_map' && !formMatchVal.trim()) {
      setFormError('Match value is required for hardware mapping rule.');
      return;
    }

    try {
      setFormSaving(true);
      setFormError(null);

      const payload: Partial<ProjectRule> = {
        id: formId,
        name: formName.trim(),
        description: formDesc.trim(),
        kind: formKind,
        severity: formSeverity,
        target_column: formColumn,
        operator: formOperator,
        match_value: formMatchVal.trim(),
        target_charm: formCharm,
        target_charm_part: formCharmPart,
        target_terminal: formTB,
        target_terminal_part: formTBPart,
        target_terminals: formPins,
      };

      if (isEditing) {
        const updated = await api.updateCustomRule(currentProject.id, formId, payload, currentRevision?.id);
        setRules((prev) => prev.map((r) => (r.id === formId ? updated : r)));
      } else {
        const created = await api.createCustomRule(currentProject.id, payload, currentRevision?.id);
        setRules((prev) => [created, ...prev]);
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save rule');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!currentProject || !ruleToDelete) return;
    try {
      await api.deleteCustomRule(currentProject.id, ruleToDelete.id, currentRevision?.id);
      setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id));
      setRuleToDelete(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  if (!config) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Loading hardware & rules configuration...</span>
      </div>
    );
  }

  // Calculate total positions
  const totalSlots =
    config.cabinets_count *
    config.ciocs_per_cabinet *
    config.baseplates_per_cioc *
    config.charms_per_baseplate;
  const spareSlots = Math.round(totalSlots * (config.spare_percentage / 100.0));

  // Filter Rules
  const filteredRules = rules.filter((r) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      r.id.toLowerCase().includes(s) ||
      r.name.toLowerCase().includes(s) ||
      (r.description || '').toLowerCase().includes(s) ||
      (r.target_column || '').toLowerCase().includes(s) ||
      (r.match_value || '').toLowerCase().includes(s) ||
      (r.target_charm || '').toLowerCase().includes(s);

    let matchCategory = true;
    if (categoryFilter === 'custom') {
      matchCategory = !!r.is_custom;
    } else if (categoryFilter === 'mapping') {
      matchCategory = r.kind === 'charm_terminal_map';
    } else if (categoryFilter === 'contiguity') {
      matchCategory = r.kind === 'cable_contiguous';
    } else if (categoryFilter === 'separation') {
      matchCategory = r.kind === 'separate_on';
    } else if (categoryFilter === 'spares') {
      matchCategory = ['reserve', 'spare_per_cabinet', 'capacity'].includes(r.kind);
    }

    const matchSeverity =
      severityFilter === 'all' || r.severity.toLowerCase() === severityFilter.toLowerCase();

    return matchSearch && matchCategory && matchSeverity;
  });

  const totalCount = rules.length;
  const activeCount = rules.filter((r) => r.enabled).length;
  const customCount = rules.filter((r) => r.is_custom).length;
  const hardCount = rules.filter((r) => r.severity.toLowerCase() === 'hard').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <span>Rules & Hardware Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure DeltaV hardware hierarchy, live constraint solver rules, and dynamic custom engineering policies.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <span className="flex items-center space-x-1 text-xs font-semibold text-emerald-600 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Hardware Configuration Saved!</span>
            </span>
          )}
          <button
            onClick={handleSaveConfig}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Capacities</span>
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
            Total Capacity: {totalSlots} CHARMs
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
              <p className="text-[11px] text-amber-700">Dedicated reserved slots per baseplate for future plant expansion.</p>
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

      {/* --- CUSTOM RULES & CONSTRAINT POLICIES SECTION --- */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Project Rules & Custom Constraints Management</span>
            </h3>
            <p className="text-xs text-slate-500">
              Add, edit, delete, or toggle hard constraints and module mapping rules evaluated during allocation and independent verification.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleResetRules}
              title="Reset all rules to factory defaults"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Defaults</span>
            </button>

            <button
              onClick={openAddModal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add Custom Rule</span>
            </button>
          </div>
        </div>

        {/* Rule Summary Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Rules</span>
            <span className="font-mono font-bold text-sm text-slate-900">{totalCount}</span>
          </div>
          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800">Active Enabled</span>
            <span className="font-mono font-bold text-sm text-emerald-700">{activeCount}</span>
          </div>
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-medium text-blue-800">Custom Rules</span>
            <span className="font-mono font-bold text-sm text-blue-700">{customCount}</span>
          </div>
          <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800">Hard Constraints</span>
            <span className="font-mono font-bold text-sm text-rose-700">{hardCount}</span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center space-x-2 flex-1 min-w-[220px] max-w-md bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search rule ID, description, condition, or charm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden w-full"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium cursor-pointer focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              <option value="custom">Custom Rules Only</option>
              <option value="mapping">Hardware Mapping</option>
              <option value="contiguity">Cable Contiguity</option>
              <option value="separation">A/B Redundancy</option>
              <option value="spares">Spares & Capacity</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium cursor-pointer focus:outline-hidden"
            >
              <option value="all">All Severities</option>
              <option value="hard">Hard Constraints</option>
              <option value="soft">Soft Preferences</option>
            </select>
          </div>
        </div>

        {/* Rules Table / Cards */}
        {filteredRules.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
            No rules match the current filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRules.map((rule) => {
              const isHard = rule.severity.toLowerCase() === 'hard';
              const isCustom = !!rule.is_custom;

              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border transition-all ${
                    !rule.enabled
                      ? 'bg-slate-50/60 border-slate-200 opacity-60'
                      : isCustom
                      ? 'bg-emerald-50/20 border-emerald-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {rule.id}
                        </span>

                        {isCustom ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>CUSTOM RULE</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            STANDARD
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isHard
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isHard ? 'HARD CONSTRAINT' : 'SOFT PREFERENCE'}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400 capitalize">
                          Scope: {rule.scope}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-900">{rule.name}</div>
                      {rule.description && (
                        <p className="text-[11px] text-slate-500 leading-relaxed">{rule.description}</p>
                      )}

                      {/* Rule Logic Details */}
                      {rule.kind === 'charm_terminal_map' ? (
                        <div className="mt-2 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-md p-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700">
                          <div>
                            <span className="text-blue-600 font-bold">MATCH:</span>{' '}
                            <span className="text-slate-900">{rule.target_column || 'signal_type'}</span>{' '}
                            <span className="text-amber-600">[{rule.operator || 'equals'}]</span>{' '}
                            <span className="font-bold text-slate-900">"{rule.match_value}"</span>
                          </div>
                          <div>
                            <span className="text-emerald-600 font-bold">CHARM:</span>{' '}
                            <span>{rule.target_charm}</span>{' '}
                            <span className="text-slate-400">({rule.target_charm_part})</span>
                          </div>
                          <div>
                            <span className="text-purple-600 font-bold">TB:</span>{' '}
                            <span>{rule.target_terminal}</span>{' '}
                            <span className="text-slate-400">({rule.target_terminal_part})</span>{' '}
                            <span className="text-slate-500 font-bold">[Pins: {rule.target_terminals}]</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-600">
                          <span className="font-bold text-slate-700">ENFORCEMENT:</span>{' '}
                          {rule.kind === 'cable_contiguous' && 'Contiguous adjacent CHARM allocation for multi-pair cables'}
                          {rule.kind === 'separate_on' && 'Strict physical CIOC hardware segregation across redundant Train A & B'}
                          {rule.kind === 'reserve' && 'Dedicated Baseplate 1 diagnostic channel assignment'}
                          {rule.kind === 'spare_per_cabinet' && 'Minimum empty baseplate reservation per marshalling cabinet'}
                          {rule.kind === 'capacity' && 'Hard limit of 1 signal per CHARM, 12 CHARMs per Baseplate'}
                        </div>
                      )}
                    </div>

                    {/* Right Controls: Enable Toggle & Actions */}
                    <div className="flex items-center space-x-3 self-end md:self-center pt-2 md:pt-0">
                      {/* Toggle Button */}
                      <button
                        onClick={() => handleToggleRule(rule)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          rule.enabled
                            ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title={rule.enabled ? 'Click to Disable rule' : 'Click to Enable rule'}
                      >
                        {rule.enabled ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>ACTIVE</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5" />
                            <span>DISABLED</span>
                          </>
                        )}
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => openEditModal(rule)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        title="Edit Rule"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Button (Only for custom rules) */}
                      {isCustom && (
                        <button
                          onClick={() => setRuleToDelete(rule)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Delete Custom Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Signal Compatibility Catalogue Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Default Hardware Compatibility Matrix Reference</span>
          </h3>
          <p className="text-xs text-slate-500">
            Fallback standard CHARM modules and terminal block mappings for industrial IO types.
          </p>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">IO Class</th>
                <th className="py-2.5 px-4">DeltaV™ CHARM Module</th>
                <th className="py-2.5 px-4">Terminal Block Type</th>
                <th className="py-2.5 px-4">Wiring Characteristics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(config.compatibility_matrix).map(([type, spec]) => (
                <tr key={type} className="hover:bg-slate-50">
                  <td className="py-2 px-4 font-mono font-bold text-blue-700">{type}</td>
                  <td className="py-2 px-4 font-medium text-slate-900">{spec.charm}</td>
                  <td className="py-2 px-4 font-mono text-slate-700">{spec.terminal}</td>
                  <td className="py-2 px-4 text-slate-500">
                    {type.startsWith('AI') || type.startsWith('AO')
                      ? '4-20mA HART Loop Powered'
                      : type === 'DO-SOV' || type === 'DOR-SOV'
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

      {/* --- ADD / EDIT CUSTOM RULE MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {isEditing ? 'Edit Rule' : 'Create Custom Project Rule'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define custom mapping criteria, hardware selection, and constraint enforcement.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveModalRule} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rule ID</label>
                  <input
                    type="text"
                    value={formId}
                    disabled={isEditing}
                    onChange={(e) => setFormId(e.target.value)}
                    className="w-full font-mono font-semibold px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 disabled:opacity-75 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Enforcement Severity</label>
                  <select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as 'hard' | 'soft')}
                    className="w-full font-semibold px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-hidden"
                  >
                    <option value="hard">Hard Constraint (Mandatory)</option>
                    <option value="soft">Soft Preference (Optimizer weight)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Rule Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Coriolis Flow Meter 4-Wire AI Mapping"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Engineering Rationale</label>
                <textarea
                  rows={2}
                  placeholder="Explain why this engineering policy is required..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Rule Category</label>
                <select
                  value={formKind}
                  onChange={(e) => setFormKind(e.target.value)}
                  className="w-full font-semibold px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-hidden"
                >
                  <option value="charm_terminal_map">CHARM & Terminal Block Mapping (Most Common)</option>
                  <option value="cable_contiguous">Multi-Pair Cable Contiguity</option>
                  <option value="separate_on">A/B Redundancy CIOC Separation</option>
                  <option value="reserve">Cabinet Alarm / Diagnostic Reservation</option>
                </select>
              </div>

              {/* Conditional Form Fields for charm_terminal_map */}
              {formKind === 'charm_terminal_map' && (
                <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>Signal Condition Match Criteria</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Field Column</label>
                      <select
                        value={formColumn}
                        onChange={(e) => setFormColumn(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white font-mono text-xs focus:outline-hidden"
                      >
                        <option value="signal_type">signal_type</option>
                        <option value="instrument_type">instrument_type</option>
                        <option value="electrical_spec">electrical_spec</option>
                        <option value="signal_level">signal_level</option>
                        <option value="tag">tag</option>
                        <option value="description">description</option>
                        <option value="external_power">external_power</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Operator</label>
                      <select
                        value={formOperator}
                        onChange={(e) => setFormOperator(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white font-mono text-xs focus:outline-hidden"
                      >
                        <option value="equals">equals</option>
                        <option value="contains">contains</option>
                        <option value="in">in (comma separated)</option>
                        <option value="startswith">startswith</option>
                        <option value="regex">regex</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Match Value *</label>
                      <input
                        type="text"
                        placeholder="e.g. 4-Wire, SOV, FT"
                        value={formMatchVal}
                        onChange={(e) => setFormMatchVal(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white font-mono text-xs focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="font-bold text-slate-900 pt-2 border-t border-slate-200 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Target Hardware Assignment</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">CHARM Module</label>
                      <select
                        value={formCharm}
                        onChange={(e) => handleCharmChange(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white text-xs focus:outline-hidden mb-1.5"
                      >
                        {CHARM_PRESETS.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={formCharmPart}
                        onChange={(e) => setFormCharmPart(e.target.value)}
                        placeholder="CHARM Part No (e.g. SE4303T01)"
                        className="w-full font-mono text-[11px] px-2 py-1 border border-slate-200 rounded bg-white text-slate-600"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Terminal Block</label>
                      <select
                        value={formTB}
                        onChange={(e) => handleTBChange(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white text-xs focus:outline-hidden mb-1.5"
                      >
                        {TB_PRESETS.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={formTBPart}
                          onChange={(e) => setFormTBPart(e.target.value)}
                          placeholder="TB Part (e.g. SE4501)"
                          className="w-full font-mono text-[11px] px-2 py-1 border border-slate-200 rounded bg-white text-slate-600"
                        />
                        <input
                          type="text"
                          value={formPins}
                          onChange={(e) => setFormPins(e.target.value)}
                          placeholder="Pins (e.g. 1, 2)"
                          className="w-full font-mono text-[11px] px-2 py-1 border border-slate-200 rounded bg-white text-slate-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm shadow-blue-500/20 transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  {formSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Rule...</span>
                    </>
                  ) : (
                    <span>{isEditing ? 'Save Changes' : 'Create Rule'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      {ruleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Delete Custom Rule</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete rule <strong className="font-mono text-slate-900">{ruleToDelete.id}</strong> ({ruleToDelete.name})?
              This rule will no longer be enforced by the CP-SAT solver or independent validator.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setRuleToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRule}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
