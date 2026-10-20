import React from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  FileQuestion,
  Layers,
  GitCompare,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';

export const ReportsPage: React.FC = () => {
  const { currentProject, currentRevision, revisions } = useProject();

  const reports = [
    {
      id: 'allocation',
      title: 'Completed Hardware Allocation Workbook',
      format: 'Microsoft Excel (.xlsx)',
      icon: FileSpreadsheet,
      color: 'blue',
      desc: 'Full IO allocation schedule matching customer template. Contains Cabinet, CIOC, Baseplate, CHARM channel, and Terminal Block assignments.',
      getUrl: () =>
        currentProject && currentRevision
          ? api.getExportUrl('allocation', currentProject.id, currentRevision.id)
          : '#',
    },
    {
      id: 'validation',
      title: 'Engineering Validation Audit Report',
      format: 'Microsoft Excel (.xlsx)',
      icon: ShieldCheck,
      color: 'emerald',
      desc: 'Independent rule-by-rule compliance register. Logs passed/failed checks, A/B redundancy separation, capacity limits, and recommended corrective actions.',
      getUrl: () =>
        currentProject && currentRevision
          ? api.getExportUrl('validation', currentProject.id, currentRevision.id)
          : '#',
    },
    {
      id: 'tqs',
      title: 'Technical Queries (TQ) Register',
      format: 'Microsoft Excel (.xlsx)',
      icon: FileQuestion,
      color: 'amber',
      desc: 'Formal engineering clarification log for unresolved issues, capacity deficits, and ambiguous customer specifications with root-cause tracking.',
      getUrl: () =>
        currentProject && currentRevision
          ? api.getExportUrl('tqs', currentProject.id, currentRevision.id)
          : '#',
    },
    {
      id: 'utilisation',
      title: 'Cabinet Utilisation & Spare Audit',
      format: 'Microsoft Excel (.xlsx)',
      icon: Layers,
      color: 'purple',
      desc: 'Comprehensive enclosure footprint, carrier density, and reserved spare capacity breakdown across all DeltaV cabinets.',
      getUrl: () =>
        currentProject && currentRevision
          ? api.getExportUrl('utilisation', currentProject.id, currentRevision.id)
          : '#',
    },
    {
      id: 'revision-diff',
      title: 'Revision Impact & Re-wire Differential Report',
      format: 'Microsoft Excel (.xlsx)',
      icon: GitCompare,
      color: 'slate',
      desc: 'Side-by-side comparison tracking Added, Deleted, and Modified signals. Highlights preserved assignments vs required hardware movements.',
      getUrl: () => {
        if (!currentProject || revisions.length < 2) return '#';
        return api.getRevisionDiffExportUrl(currentProject.id, revisions[0].id, revisions[1].id);
      },
      disabled: revisions.length < 2,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <span>Engineering Reports & Excel Exports</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Generate, validate, and download audit-ready Microsoft Excel workbooks for {currentProject?.name} ({currentRevision?.revision_code}).
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{r.title}</h3>
                      <span className="text-[10px] font-mono text-slate-400">{r.format}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-3 leading-relaxed">{r.desc}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentRevision?.revision_code} Snapshot
                </span>

                {r.disabled ? (
                  <span className="text-xs text-slate-400 italic">Requires 2+ revisions</span>
                ) : (
                  <a
                    href={r.getUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs shadow-blue-500/20 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quality Assurance Note */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-xs text-emerald-800">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-0.5">
          <span className="font-bold">Real Data Integrity Guarantee</span>
          <p>
            Exported workbooks are synthesized directly from stored database assignments and reconciled with independent constraint checks. Output files retain customer formulas, column hierarchies, and engineering formatting.
          </p>
        </div>
      </div>
    </div>
  );
};
