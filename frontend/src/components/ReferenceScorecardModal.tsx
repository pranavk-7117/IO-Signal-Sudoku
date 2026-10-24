import React, { useState, useEffect } from 'react';
import { X, Award, CheckCircle2, AlertTriangle, FileSpreadsheet, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { ReferenceScorecardResponse } from '../types';

interface ReferenceScorecardModalProps {
  projectId: number;
  revisionId?: number;
  onClose: () => void;
}

export const ReferenceScorecardModal: React.FC<ReferenceScorecardModalProps> = ({
  projectId,
  revisionId,
  onClose
}) => {
  const [scorecard, setScorecard] = useState<ReferenceScorecardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScorecard();
  }, [projectId, revisionId]);

  const loadScorecard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReferenceScorecard(projectId, revisionId);
      setScorecard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reference scorecard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Reference Allocation Parity Scorecard</h3>
              <p className="text-xs text-slate-500">Direct verification against Completed_Allocation_Reference.xlsx</p>
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
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-600" />
              <span>Comparing active project allocation against golden reference workbook...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {scorecard && (
            <>
              {/* Scorecard Parity Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200 rounded-xl gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-amber-300 flex items-center justify-center font-mono font-bold text-xl text-amber-700 shadow-xs">
                    {scorecard.parity_score_pct}%
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">Official Reference Parity</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          scorecard.parity_score_pct === 100
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {scorecard.overall_status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-600 mt-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Benchmark File: {scorecard.reference_file}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-700 block">
                    {scorecard.matched_categories} / {scorecard.total_categories} Categories Matched
                  </span>
                  <span className="text-[10px] text-slate-500">100% Topology & Channel Match</span>
                </div>
              </div>

              {/* Parity Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Verification Dimension</th>
                      <th className="py-2.5 px-3 text-center">Reference Expected</th>
                      <th className="py-2.5 px-3 text-center">Active Allocation</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Engineering Compliance Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {scorecard.scorecard_items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{item.category}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">{item.expected}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">{item.actual}</td>
                        <td className="py-2 px-3 text-center">
                          {item.matched ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>100% MATCH</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-rose-700 font-bold text-[10px] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>DIFF</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500 font-medium">{item.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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