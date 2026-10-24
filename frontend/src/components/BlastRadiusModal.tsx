import React, { useState, useEffect } from 'react';
import { X, Flame, ShieldCheck, ShieldAlert, Cpu, AlertTriangle, Layers, Activity } from 'lucide-react';
import { api } from '../services/api';
import { BlastRadiusResponse } from '../types';

interface BlastRadiusModalProps {
  projectId: number;
  revisionId?: number;
  onClose: () => void;
}

export const BlastRadiusModal: React.FC<BlastRadiusModalProps> = ({
  projectId,
  revisionId,
  onClose
}) => {
  const [failureType, setFailureType] = useState<'cioc' | 'cabinet' | 'power_bus'>('cioc');
  const [targetId, setTargetId] = useState<string>('P30DCIOC3201001');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BlastRadiusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PROTECTED' | 'TRIPPED'>('ALL');

  const ciocOptions = [
    'P30DCIOC3201001', 'P30DCIOC3201002', 'P30DCIOC3201003', 'P30DCIOC3201004',
    'P30DCIOC3201005', 'P30DCIOC3201006', 'P30DCIOC3201007', 'P30DCIOC3201008',
    'P24DCIOC5002001', 'P24DCIOC5002002', 'P24DCIOC5002003', 'P24DCIOC5002004'
  ];
  const cabinetOptions = ['P30-DCS-32001-01', 'P30-DCS-32001-02', 'P24-DCS-50002-01'];
  const busOptions = ['BUS-A', 'BUS-B'];

  // Update targetId when failureType changes
  useEffect(() => {
    if (failureType === 'cioc') setTargetId(ciocOptions[0]);
    else if (failureType === 'cabinet') setTargetId(cabinetOptions[0]);
    else if (failureType === 'power_bus') setTargetId(busOptions[0]);
  }, [failureType]);

  useEffect(() => {
    handleSimulate();
  }, [failureType, targetId]);

  const handleSimulate = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.simulateBlastRadius(
        projectId,
        { failure_type: failureType, target_id: targetId },
        revisionId
      );
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredSignals = result?.affected_signals.filter((s) => {
    if (filterStatus === 'ALL') return true;
    return s.status === filterStatus;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Failure Blast-Radius Simulator</h3>
              <p className="text-xs text-slate-500">Real-time simulation of physical carrier loss and A/B redundancy resilience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Failure Domain</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFailureType('cioc')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    failureType === 'cioc'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  CIOC Carrier
                </button>
                <button
                  type="button"
                  onClick={() => setFailureType('cabinet')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    failureType === 'cabinet'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Cabinet
                </button>
                <button
                  type="button"
                  onClick={() => setFailureType('power_bus')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    failureType === 'power_bus'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Power Bus
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Hardware Unit</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full text-xs font-mono font-semibold px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white"
              >
                {failureType === 'cioc' &&
                  ciocOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                {failureType === 'cabinet' &&
                  cabinetOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                {failureType === 'power_bus' &&
                  busOptions.map((b) => (
                    <option key={b} value={b}>
                      {b} (Train {b.endsWith('A') ? 'A Even CIOCs' : 'B Odd CIOCs'})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Metrics Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Channels Lost</span>
                  <span className="text-xl font-bold font-mono text-slate-900">{result.total_channels_lost}</span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Protected Loops</span>
                  <span className="text-xl font-bold font-mono text-emerald-700">{result.protected_channels_count}</span>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Tripped Loops</span>
                  <span className="text-xl font-bold font-mono text-rose-700">{result.tripped_channels_count}</span>
                </div>

                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Resilience Score</span>
                  <span className="text-xl font-bold font-mono text-indigo-700">{result.resilience_score_pct}%</span>
                </div>
              </div>

              {/* Progress Bar & Rating */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <span>Fault Containment Rating:</span>
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                      result.resilience_score_pct >= 80
                        ? 'bg-emerald-100 text-emerald-800'
                        : result.resilience_score_pct >= 50
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {result.resilience_rating}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      result.resilience_score_pct >= 80
                        ? 'bg-emerald-600'
                        : result.resilience_score_pct >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-600'
                    }`}
                    style={{ width: `${Math.min(100, result.resilience_score_pct)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 font-medium pt-1">{result.impact_summary}</p>
              </div>

              {/* Filter and Signal Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Simulated Affected Channels ({filteredSignals.length})
                  </span>
                  <div className="flex space-x-1">
                    {(['ALL', 'PROTECTED', 'TRIPPED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${
                          filterStatus === st
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Tag</th>
                        <th className="py-2 px-3">Loop</th>
                        <th className="py-2 px-3">Redundancy</th>
                        <th className="py-2 px-3">Location</th>
                        <th className="py-2 px-3">Resilience Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-mono">
                      {filteredSignals.map((sig, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-bold text-slate-900">{sig.tag}</td>
                          <td className="py-1.5 px-3 text-slate-600 font-sans">{sig.loop_name || '-'}</td>
                          <td className="py-1.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 font-bold">
                              {sig.redundancy}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-500 text-[10px]">{sig.hardware_location}</td>
                          <td className="py-1.5 px-3 font-sans">
                            <span
                              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                sig.status === 'PROTECTED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {sig.status === 'PROTECTED' ? (
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                              )}
                              <span>{sig.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredSignals.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-xs text-slate-400 font-sans">
                            No channels match selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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