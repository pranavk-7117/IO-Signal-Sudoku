import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileQuestion,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Download,
  Filter,
  Search,
  MessageSquare,
  Edit3,
  ExternalLink
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { ValidationSummary, TechnicalQuery } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';

export const ValidationTQsPage: React.FC = () => {
  const { currentProject, currentRevision, refreshProjects } = useProject();

  const [activeTab, setActiveTab] = useState<'validation' | 'tqs'>('validation');
  const [valSummary, setValSummary] = useState<ValidationSummary | null>(null);
  const [tqs, setTqs] = useState<TechnicalQuery[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [tqStatusFilter, setTqStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // TQ Edit State
  const [editingTq, setEditingTq] = useState<TechnicalQuery | null>(null);
  const [tqStatus, setTqStatus] = useState<string>('Open');
  const [tqNotes, setTqNotes] = useState<string>('');

  useEffect(() => {
    if (currentProject && currentRevision) {
      loadData();
    }
  }, [currentProject?.id, currentRevision?.id]);

  const loadData = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      setLoading(true);
      const [v, t] = await Promise.all([
        api.getValidationSummary(currentProject.id, currentRevision.id),
        api.getTQs(currentProject.id, currentRevision.id),
      ]);
      setValSummary(v);
      setTqs(t);
    } catch (err) {
      console.error('Error fetching validation / TQ data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTq) return;
    try {
      await api.updateTQ(editingTq.id, {
        status: tqStatus,
        resolution_notes: tqNotes,
      });
      setEditingTq(null);
      await loadData();
      await refreshProjects();
    } catch (err: any) {
      alert(`Failed to update TQ: ${err.message}`);
    }
  };

  const openTQEditor = (t: TechnicalQuery) => {
    setEditingTq(t);
    setTqStatus(t.status);
    setTqNotes(t.resolution_notes || '');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Independent Validation & Technical Queries</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated compliance verification and engineering issue resolution for {currentProject?.name} ({currentRevision?.revision_code}).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'validation' ? (
            <a
              href={currentProject && currentRevision ? api.getExportUrl('validation', currentProject.id, currentRevision.id) : '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Validation Report</span>
            </a>
          ) : (
            <a
              href={currentProject && currentRevision ? api.getExportUrl('tqs', currentProject.id, currentRevision.id) : '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export TQs Register</span>
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('validation')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors ${
            activeTab === 'validation'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Independent Validation Audit</span>
          {valSummary && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${valSummary.error_count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {valSummary.issues.length} Issues
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('tqs')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors ${
            activeTab === 'tqs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileQuestion className="w-4 h-4" />
          <span>Technical Queries (TQs) Register</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            {tqs.filter((t) => t.status !== 'Closed').length} Open
          </span>
        </button>
      </div>

      {/* TAB 1: VALIDATION REPORT */}
      {activeTab === 'validation' && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border flex items-center justify-between ${valSummary?.is_fully_validated ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'}`}>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block">Approval Status</span>
                <span className="text-sm font-bold mt-1 block">
                  {valSummary?.is_fully_validated ? 'Fully Validated (Approved)' : 'Approval Blocked'}
                </span>
              </div>
              {valSummary?.is_fully_validated ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              ) : (
                <AlertOctagon className="w-8 h-8 text-rose-600" />
              )}
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Blocking Errors</span>
              <span className="text-2xl font-bold font-mono text-rose-600 mt-1 block">
                {valSummary?.error_count || 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Warnings</span>
              <span className="text-2xl font-bold font-mono text-amber-600 mt-1 block">
                {valSummary?.warning_count || 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Advisory / Info</span>
              <span className="text-2xl font-bold font-mono text-blue-600 mt-1 block">
                {valSummary?.info_count || 0}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rule, signal tag, or hardware location..."
                className="w-full text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
              />
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
            >
              <option value="">All Severities</option>
              <option value="ERROR">Blocking Errors</option>
              <option value="WARNING">Warnings</option>
              <option value="INFO">Informational</option>
            </select>
          </div>

          {/* Issue Cards */}
          <div className="space-y-3">
            {valSummary?.issues
              .filter(
                (i) =>
                  (!severityFilter || i.severity === severityFilter) &&
                  (!search ||
                    i.rule_name.toLowerCase().includes(search.toLowerCase()) ||
                    i.affected_tags.join(' ').toLowerCase().includes(search.toLowerCase()) ||
                    (i.affected_hardware || '').toLowerCase().includes(search.toLowerCase()))
              )
              .map((issue) => (
                <div
                  key={issue.issue_id}
                  className={`p-4 rounded-xl border shadow-xs transition-all ${
                    issue.severity === 'ERROR'
                      ? 'bg-rose-50/20 border-rose-200'
                      : issue.severity === 'WARNING'
                      ? 'bg-amber-50/20 border-amber-200'
                      : 'bg-blue-50/20 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {issue.issue_id}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs">{issue.rule_name}</h4>
                      {issue.blocks_approval && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                          BLOCKS APPROVAL
                        </span>
                      )}
                    </div>
                    <StatusBadge status={issue.severity} size="sm" />
                  </div>

                  <p className="text-xs text-slate-700 mt-2 leading-relaxed">{issue.message}</p>

                  <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 font-semibold">Affected Tags:</span>
                      <div className="flex flex-wrap gap-1">
                        {issue.affected_tags.map((t) => (
                          <span key={t} className="font-mono font-bold text-blue-600 bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[11px]">
                            {t}
                          </span>
                        ))}
                      </div>
                      {issue.affected_hardware && (
                        <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                          @ {issue.affected_hardware}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600">
                      <span className="font-bold text-slate-800">Action: </span>
                      {issue.suggested_action}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 2: TECHNICAL QUERIES */}
      {activeTab === 'tqs' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search TQ code, category, or affected tag..."
                className="w-full text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
              />
            </div>

            <select
              value={tqStatusFilter}
              onChange={(e) => setTqStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
            >
              <option value="">All TQ Statuses</option>
              <option value="Open">Open</option>
              <option value="In Review">In Review</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="space-y-4">
            {tqs
              .filter(
                (t) =>
                  (!tqStatusFilter || t.status === tqStatusFilter) &&
                  (!search ||
                    t.tq_code.toLowerCase().includes(search.toLowerCase()) ||
                    t.category.toLowerCase().includes(search.toLowerCase()) ||
                    t.affected_tags.join(' ').toLowerCase().includes(search.toLowerCase()))
              )
              .map((tq) => (
                <div key={tq.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {tq.tq_code}
                        </span>
                        <span className="font-semibold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          Category: {tq.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{tq.description}</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={tq.status} />
                      <button
                        onClick={() => openTQEditor(tq)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded transition-colors flex items-center space-x-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Update TQ</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">Root Cause Analysis:</span>
                      <p className="text-slate-600 leading-relaxed">{tq.root_cause}</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">Required Clarification:</span>
                      <p className="text-slate-600 leading-relaxed">{tq.specific_clarification}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 font-semibold">Signals:</span>
                      {tq.affected_tags.map((tag) => (
                        <span key={tag} className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {tq.resolution_notes && (
                      <div className="text-[11px] text-emerald-700 font-medium italic">
                        Note: {tq.resolution_notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TQ Edit Modal */}
      {editingTq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Update Technical Query</h3>
                <span className="font-mono text-xs text-blue-600">{editingTq.tq_code}</span>
              </div>
              <button onClick={() => setEditingTq(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleUpdateTQ} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                <select
                  value={tqStatus}
                  onChange={(e) => setTqStatus(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
                >
                  <option value="Open">Open</option>
                  <option value="In Review">In Review</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Engineer Resolution Notes</label>
                <textarea
                  rows={4}
                  value={tqNotes}
                  onChange={(e) => setTqNotes(e.target.value)}
                  placeholder="Record client approval, clarification memo reference, or hardware modification rationale..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTq(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
                >
                  Save TQ Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
