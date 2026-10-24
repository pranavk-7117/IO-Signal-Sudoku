import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import { api } from '../services/api';
import { CounterfactualResponse } from '../types';

interface CounterfactualModalProps {
  projectId: number;
  revisionId?: number;
  initialTag?: string;
  initialSlot?: {
    cabinet: string;
    cioc: string;
    baseplate: string;
    channel: number;
  };
  onClose: () => void;
}

export const CounterfactualModal: React.FC<CounterfactualModalProps> = ({
  projectId,
  revisionId,
  initialTag = '',
  initialSlot,
  onClose
}) => {
  const [tag, setTag] = useState<string>(initialTag);
  const [cabinet, setCabinet] = useState<string>(initialSlot?.cabinet || 'P30-DCS-32001-01');
  const [cioc, setCioc] = useState<string>(initialSlot?.cioc || 'P30DCIOC3201001');
  const [baseplate, setBaseplate] = useState<string>(initialSlot?.baseplate || '001-CBP-1');
  const [channel, setChannel] = useState<number>(initialSlot?.channel || 1);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CounterfactualResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Available cabinets and CIOCs for DeltaV layout
  const cabinetOptions = ['P30-DCS-32001-01', 'P30-DCS-32001-02', 'P24-DCS-50002-01'];
  const ciocOptions = [
    'P30DCIOC3201001', 'P30DCIOC3201002', 'P30DCIOC3201003', 'P30DCIOC3201004',
    'P30DCIOC3201005', 'P30DCIOC3201006', 'P30DCIOC3201007', 'P30DCIOC3201008',
    'P24DCIOC5002001', 'P24DCIOC5002002', 'P24DCIOC5002003', 'P24DCIOC5002004'
  ];
  const bpOptions = ['001-CBP-1', '001-CBP-2', '001-CBP-3', '001-CBP-4', '001-CBP-5', '001-CBP-6', '001-CBP-7', '001-CBP-8'];

  useEffect(() => {
    if (tag) {
      handleEvaluate();
    }
  }, []);

  const handleEvaluate = async () => {
    if (!tag.trim()) {
      setError('Please provide a signal tag to evaluate.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await api.evaluateCounterfactual(
        projectId,
        {
          tag: tag.trim(),
          target_cabinet: cabinet,
          target_cioc: cioc,
          target_baseplate: baseplate,
          target_channel: Number(channel)
        },
        revisionId
      );
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Counterfactual evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">"Why Not Here?" Counterfactual Inspector</h3>
              <p className="text-xs text-slate-500">Mathematical solver proof explaining why a candidate slot is allowed or blocked</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Query Controls */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Signal Instrument Tag</label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. 320-FT -80001"
                className="w-full text-xs font-mono font-medium px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Cabinet</label>
              <select
                value={cabinet}
                onChange={(e) => setCabinet(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {cabinetOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target CIOC</label>
              <select
                value={cioc}
                onChange={(e) => setCioc(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {ciocOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Baseplate</label>
              <select
                value={baseplate}
                onChange={(e) => setBaseplate(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {bpOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Channel (1-12)</label>
              <input
                type="number"
                min={1}
                max={12}
                value={channel}
                onChange={(e) => setChannel(Number(e.target.value))}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleEvaluate}
              disabled={loading}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{loading ? 'Evaluating Rules...' : 'Evaluate Counterfactual'}</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {/* Verdict Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start space-x-3 ${
                  result.is_allowed
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {result.is_allowed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm tracking-tight">{result.verdict}</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                        result.is_allowed
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-rose-200 text-rose-800'
                      }`}
                    >
                      {result.is_allowed ? 'ALLOWED' : 'BLOCKED'}
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-slate-700">
                    Candidate Location: <span className="font-mono font-semibold">{cabinet} / {cioc} / {baseplate} / CH{channel}</span>
                  </p>
                </div>
              </div>

              {/* Blocking Reasons (if any) */}
              {result.blocking_reasons && result.blocking_reasons.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  <span className="text-xs font-bold text-amber-900 block">Identified Physical Violations:</span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 font-medium">
                    {result.blocking_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detailed Rule Checks */}
              {result.rule_checks && result.rule_checks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Independent Rule Verifications</span>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {result.rule_checks.map((rc, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-xs flex items-start space-x-2.5 ${
                          rc.passed ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/60 border-rose-200'
                        }`}
                      >
                        {rc.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{rc.rule}</span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                                rc.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {rc.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">{rc.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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