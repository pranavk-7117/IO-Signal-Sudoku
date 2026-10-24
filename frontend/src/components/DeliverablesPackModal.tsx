import React, { useState, useEffect } from 'react';
import { X, FileText, Printer, Download, Cable, CheckSquare, ClipboardCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { DeliverablesPackResponse } from '../types';

interface DeliverablesPackModalProps {
  projectId: number;
  revisionId?: number;
  onClose: () => void;
}

export const DeliverablesPackModal: React.FC<DeliverablesPackModalProps> = ({
  projectId,
  revisionId,
  onClose
}) => {
  const [data, setData] = useState<DeliverablesPackResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'term' | 'cables' | 'loops' | 'fat'>('term');
  const [selectedCableId, setSelectedCableId] = useState<string>('');

  useEffect(() => {
    loadDeliverables();
  }, [projectId, revisionId]);

  const loadDeliverables = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDeliverablesPack(projectId, revisionId);
      setData(res);
      if (res.termination_schedules.length > 0) {
        setSelectedCableId(res.termination_schedules[0].cable_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate deliverables pack');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const activeTermSchedule = data?.termination_schedules.find((c) => c.cable_id === selectedCableId) || data?.termination_schedules[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Engineering Deliverables Pack</h3>
              <p className="text-xs text-slate-500">
                Official plant commissioning documentation: Cable Terminations, Cable List, Loop Sheets & FAT Checklist
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print Schedule</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('term')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'term'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cable className="w-4 h-4" />
            <span>Cable Termination Schedule</span>
          </button>
          <button
            onClick={() => setActiveTab('cables')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'cables'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Master Cable List</span>
          </button>
          <button
            onClick={() => setActiveTab('loops')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'loops'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Loop-Check Commissioning Sheets</span>
          </button>
          <button
            onClick={() => setActiveTab('fat')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'fat'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>FAT System Checklist</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="py-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
              <span>Generating formal DeltaV plant engineering deliverables...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Tab 1: Cable Termination Schedule */}
              {activeTab === 'term' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-700">Select Field Cable:</span>
                      <select
                        value={selectedCableId}
                        onChange={(e) => setSelectedCableId(e.target.value)}
                        className="text-xs font-mono font-bold px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                      >
                        {data.termination_schedules.map((c) => (
                          <option key={c.cable_id} value={c.cable_id}>
                            {c.cable_id} ({c.total_pairs} Pairs · {c.technical_room})
                          </option>
                        ))}
                      </select>
                    </div>
                    {activeTermSchedule && (
                      <span className="text-xs font-mono font-semibold text-slate-600">
                        {activeTermSchedule.total_pairs} Active Wire Pairs Assigned
                      </span>
                    )}
                  </div>

                  {activeTermSchedule && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Pair #</th>
                            <th className="py-2.5 px-3">Wire Color (+ / -)</th>
                            <th className="py-2.5 px-3">Instrument Tag</th>
                            <th className="py-2.5 px-3">Service Description</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Marshalling Address</th>
                            <th className="py-2.5 px-3">Terminal Block</th>
                            <th className="py-2.5 px-3">Terminals</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white font-mono text-[11px]">
                          {activeTermSchedule.termination_rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-blue-700">P{String(row.pair_number).padStart(2, '0')}</td>
                              <td className="py-2 px-3 font-sans">
                                <span className="inline-flex items-center space-x-1">
                                  <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-400"></span>
                                  <span>{row.wire_color_pos} / {row.wire_color_neg}</span>
                                </span>
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900">{row.signal_tag}</td>
                              <td className="py-2 px-3 font-sans text-slate-600 text-[11px] truncate max-w-[150px]">
                                {row.description}
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 font-bold">
                                  {row.signal_type}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-700 text-[10px]">{row.hardware_address}</td>
                              <td className="py-2 px-3 font-sans text-slate-500 text-[10px]">{row.terminal_block}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{row.terminals}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Master Cable List */}
              {activeTab === 'cables' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Cable Tag</th>
                        <th className="py-2.5 px-3">Tech Room</th>
                        <th className="py-2.5 px-3">Destination Cabinet</th>
                        <th className="py-2.5 px-3 text-center">Size (Pairs)</th>
                        <th className="py-2.5 px-3 text-center">Used</th>
                        <th className="py-2.5 px-3 text-center">Spare</th>
                        <th className="py-2.5 px-3 text-center">Utilisation</th>
                        <th className="py-2.5 px-3">Cable Specification</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-mono text-[11px]">
                      {data.master_cable_schedule.map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">{c.cable_id}</td>
                          <td className="py-2 px-3 text-slate-600">{c.technical_room}</td>
                          <td className="py-2 px-3 text-blue-700 font-bold">{c.destination_cabinet}</td>
                          <td className="py-2 px-3 text-center font-bold text-slate-800">{c.cable_size_pairs}</td>
                          <td className="py-2 px-3 text-center text-emerald-700 font-bold">{c.pairs_used}</td>
                          <td className="py-2 px-3 text-center text-amber-700 font-bold">{c.pairs_spare}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="font-bold text-slate-800">{c.utilisation_pct}%</span>
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-500 text-[10px]">{c.cable_type}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: Loop-Check Commissioning Sheets */}
              {activeTab === 'loops' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Generated Loop Calibration & SAT Sign-off Sheets ({data.total_loops_count} loops)</span>
                    <span className="font-mono">Standard DeltaV Commissioning Format</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Sheet #</th>
                          <th className="py-2 px-3">Loop Name</th>
                          <th className="py-2 px-3">Tag</th>
                          <th className="py-2 px-3">Calibration Range</th>
                          <th className="py-2 px-3">Marshalling Location</th>
                          <th className="py-2 px-3">Hardware Module</th>
                          <th className="py-2 px-3">Commissioning Sign-off</th>
                          <th className="py-2 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white font-mono text-[11px]">
                        {data.loop_check_sheets.map((l, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-500 text-[10px]">{l.sheet_id}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{l.loop_name}</td>
                            <td className="py-2 px-3 text-blue-700 font-bold">{l.tag}</td>
                            <td className="py-2 px-3 font-sans text-slate-600 text-[10px]">{l.calibrated_range}</td>
                            <td className="py-2 px-3 text-slate-700 text-[10px]">{l.hardware_location}</td>
                            <td className="py-2 px-3 text-slate-500 text-[10px]">{l.charm_module}</td>
                            <td className="py-2 px-3 font-sans text-slate-400">☐ {l.checked_by}</td>
                            <td className="py-2 px-3 font-sans text-slate-400">{l.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: FAT System Checklist */}
              {activeTab === 'fat' && (
                <div className="space-y-3">
                  {data.fat_checklist.map((item, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.section}</span>
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckSquare className="w-3 h-3 text-emerald-600" />
                          <span>FAT VERIFIED: {item.status}</span>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{item.item}</h4>
                      <p className="text-xs text-slate-600 font-medium">{item.requirement}</p>
                      <div className="pt-1 text-[10px] text-slate-500 flex items-center space-x-2">
                        <span>Inspector: <strong className="text-slate-800 font-sans">{item.verified_by}</strong></span>
                      </div>
                    </div>
                  ))}
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