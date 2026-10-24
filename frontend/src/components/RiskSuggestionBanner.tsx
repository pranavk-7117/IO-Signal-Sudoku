import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { RiskAssessmentResponse, RuleSuggestion } from '../types';

interface RiskSuggestionBannerProps {
  onRuleApplied?: () => void;
}

export const RiskSuggestionBanner: React.FC<RiskSuggestionBannerProps> = ({ onRuleApplied }) => {
  const { currentProject, currentRevision, refreshProjects } = useProject();

  const [riskInfo, setRiskInfo] = useState<RiskAssessmentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (currentProject && currentRevision) {
      loadAssessment();
    }
  }, [currentProject?.id, currentRevision?.id]);

  const loadAssessment = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      setLoading(true);
      const data = await api.getRiskAssessment(currentProject.id, currentRevision.id);
      setRiskInfo(data);
    } catch (err) {
      console.error('Failed to fetch risk assessment', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = async (sug: RuleSuggestion) => {
    if (!currentProject) return;
    try {
      setApplyingId(sug.id);
      await api.applyRuleSuggestion(
        currentProject.id,
        {
          suggestion_id: sug.id,
          rule_target: sug.rule_target,
          suggested_value: sug.suggested_value
        },
        currentRevision?.id
      );

      setAppliedIds((prev) => new Set(prev).add(sug.id));
      setToast(`Rule applied: ${sug.title}`);
      setTimeout(() => setToast(null), 3500);

      await loadAssessment();
      await refreshProjects();
      if (onRuleApplied) onRuleApplied();
    } catch (err: any) {
      alert(`Error applying suggestion: ${err.message}`);
    } finally {
      setApplyingId(null);
    }
  };

  if (!riskInfo || riskInfo.factors.length === 0) {
    return null;
  }

  const isCritical = riskInfo.risk_level === 'CRITICAL';
  const isHigh = riskInfo.risk_level === 'HIGH';

  const badgeColor =
    isCritical ? 'bg-purple-100 text-purple-900 border-purple-300' :
    isHigh ? 'bg-rose-100 text-rose-900 border-rose-300' :
    riskInfo.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-900 border-amber-300' :
    'bg-emerald-100 text-emerald-900 border-emerald-300';

  return (
    <div className={`p-4 rounded-xl border shadow-xs transition-all ${
      isCritical ? 'bg-purple-50/70 border-purple-200' :
      isHigh ? 'bg-rose-50/70 border-rose-200' :
      'bg-amber-50/70 border-amber-200'
    }`}>
      {toast && (
        <div className="mb-3 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-md flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-black/5">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isCritical ? 'bg-purple-600 text-white' : isHigh ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-bold text-slate-900 text-sm">Industrial DCS Risk Assessment</h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                {riskInfo.risk_level} RISK • {riskInfo.overall_score}/100
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{riskInfo.summary}</p>
          </div>
        </div>

        <button
          onClick={loadAssessment}
          disabled={loading}
          className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Re-assess</span>
        </button>
      </div>

      {/* Actionable Rule Suggestions */}
      {riskInfo.suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Recommended Rule Modifications (Based on Project Guidelines):</span>
            </span>
            <span className="text-[11px] text-slate-500 font-normal">Click apply to immediately update allocation parameters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {riskInfo.suggestions.map((sug) => {
              const isApplied = appliedIds.has(sug.id);
              const isBusy = applyingId === sug.id;
              return (
                <div
                  key={sug.id}
                  className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-blue-400 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <h5 className="font-bold text-slate-900 text-xs leading-snug">{sug.title}</h5>
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded whitespace-nowrap border border-emerald-200">
                        -{sug.risk_reduction_pts} pts
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">{sug.description}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">{sug.rule_target}</span>
                    <button
                      onClick={() => handleApplySuggestion(sug)}
                      disabled={isApplied || isBusy}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 transition-colors ${
                        isApplied
                          ? 'bg-emerald-100 text-emerald-800 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Applied</span>
                        </>
                      ) : isBusy ? (
                        <span>Applying...</span>
                      ) : (
                        <>
                          <span>Apply Rule</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
