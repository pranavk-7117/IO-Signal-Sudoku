import React, { useState, useEffect } from 'react';
import { X, Stethoscope, CheckCircle2, AlertTriangle, ShieldAlert, BookOpen, RefreshCw, Wrench } from 'lucide-react';
import { api } from '../services/api';
import { PreflightLintResponse } from '../types';

interface PreflightDoctorModalProps {
  projectId: number;
  revisionId?: number;
  onClose: () => void;
}

export const PreflightDoctorModal: React.FC<PreflightDoctorModalProps> = ({
  projectId,
  revisionId,
  onClose
}) => {
  const [lintData, setLintData] = useState<PreflightLintResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLint();
  }, [projectId, revisionId]);

  const loadLint = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPreflightLint(projectId, revisionId);
      setLintData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute preflight lint checks');
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
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Pre-Flight Allocation Doctor (Linter)</h3>
              <p className="text-xs text-slate-500">Official DeltaV commissioning pre-flight checklist and common mistake detector</p>
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
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
              <span>Diagnosing project allocation rules and physical constraints...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {lintData && (
            <>
              {/* Scorecard Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-4">
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-bold text-xl border shadow-xs ${
                      lintData.health_score >= 90
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : lintData.health_score >= 70
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    {lintData.health_score}%
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">System Compliance Health Score</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          lintData.overall_status === 'EXCELLENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : lintData.overall_status === 'NEEDS_ATTENTION'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {lintData.overall_status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lintData.critical_fails_count === 0 && lintData.warnings_count === 0
                        ? 'All 4 critical DeltaV commissioning rules are satisfied without violations.'
                        : `${lintData.critical_fails_count} critical violations and ${lintData.warnings_count} warnings detected.`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={loadLint}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-run Checks</span>
                </button>
              </div>

              {/* Checklist Cards */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  DeltaV Engineering Rule Audit Checklist ({lintData.checks.length})
                </span>

                {lintData.checks.map((check) => {
                  const isPass = check.status === 'PASS';
                  const isWarn = check.status === 'WARN';

                  return (
                    <div
                      key={check.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isPass
                          ? 'bg-slate-50/80 border-slate-200'
                          : isWarn
                          ? 'bg-amber-50/60 border-amber-300'
                          : 'bg-rose-50/60 border-rose-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {isPass ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : isWarn ? (
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          ) : (
                            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-slate-900">{check.title}</span>
                              <span className="font-mono text-[10px] text-slate-400">[{check.id}]</span>
                            </div>
                            <p className="text-xs text-slate-700 mt-1 font-medium">{check.summary}</p>

                            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 mt-1.5">
                              <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="italic">{check.guide_reference}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                            isPass
                              ? 'bg-emerald-100 text-emerald-800'
                              : isWarn
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {check.status}
                        </span>
                      </div>

                      {/* Affected Items List */}
                      {check.affected_items && check.affected_items.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-700 block mb-1">
                            Flagged Instances ({check.affected_items.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {check.affected_items.map((item, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-300 text-slate-800 font-semibold"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Remedy */}
                      {check.remedy && !isPass && (
                        <div className="mt-2 text-xs flex items-center space-x-1.5 text-indigo-700 font-semibold">
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Recommended Action: {check.remedy}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
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