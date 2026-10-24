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
  ExternalLink,
  Flame,
  Clock,
  Sparkles,
  Zap,
  ArrowUpDown
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { ValidationSummary, TechnicalQuery, ValidationIssue } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';

export const ValidationTQsPage: React.FC = () => {
  const { currentProject, currentRevision, refreshProjects } = useProject();

  const [activeTab, setActiveTab] = useState<'validation' | 'tqs'>('validation');
  const [valSummary, setValSummary] = useState<ValidationSummary | null>(null);
  const [tqs, setTqs] = useState<TechnicalQuery[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [tqStatusFilter, setTqStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'impact' | 'default'>('impact');
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

  // Helper to resolve priority if backend didn't supply it
  const resolveIssuePriority = (i: ValidationIssue) => {
    if (i.priority) return i.priority;
    const r = i.rule_name.toLowerCase();
    const m = i.message.toLowerCase();
    if (r.includes('redundancy') || r.includes('occupancy') || r.includes('collision') || m.includes('solenoid') || r.includes('cabinet count')) {
      return 'P1_CRITICAL';
    }
    if (r.includes('cable') || r.includes('spare') || r.includes('capacity') || r.includes('compatibility')) {
      return 'P2_HIGH';
    }
    return 'P3_ADVISORY';
  };

  const resolveTqPriority = (t: TechnicalQuery) => {
    if (t.priority) return t.priority;
    const c = t.category.toLowerCase();
    const d = t.description.toLowerCase();
    if (c.includes('redundancy') || d.includes('redundancy') || d.includes('collision') || d.includes('solenoid')) {
      return 'P1_CRITICAL';
    }
    if (c.includes('cable') || c.includes('capacity') || c.includes('unresolved') || c.includes('spare')) {
      return 'P2_HIGH';
    }
    return 'P3_ADVISORY';
  };

  // Counts for current tab
  const issuesList = valSummary?.issues || [];
  const p1IssuesCount = issuesList.filter((i) => resolveIssuePriority(i) === 'P1_CRITICAL').length;
  const p2IssuesCount = issuesList.filter((i) => resolveIssuePriority(i) === 'P2_HIGH').length;
  const p3IssuesCount = issuesList.filter((i) => resolveIssuePriority(i) === 'P3_ADVISORY').length;

  const openTqsList = tqs.filter((t) => t.status !== 'Closed');
  const p1TqsCount = openTqsList.filter((t) => resolveTqPriority(t) === 'P1_CRITICAL').length;
  const p2TqsCount = openTqsList.filter((t) => resolveTqPriority(t) === 'P2_HIGH').length;
  const p3TqsCount = openTqsList.filter((t) => resolveTqPriority(t) === 'P3_ADVISORY').length;

  const activeP1Count = activeTab === 'validation' ? p1IssuesCount : p1TqsCount;
  const activeP2Count = activeTab === 'validation' ? p2IssuesCount : p2TqsCount;
  const activeP3Count = activeTab === 'validation' ? p3IssuesCount : p3TqsCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Industrial Priority Triage: Validation & Technical Queries</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked by Plant Commissioning Impact (P1 Commissioning Blockers, P2 Spares & Headroom, P3 Advisories) for {currentProject?.name} ({currentRevision?.revision_code}).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'validation' ? (
            <a
              href={currentProject && currentRevision ? api.getExportUrl('validation', currentProject.id, currentRevision.id) : '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Validation Report</span>
            </a>
          ) : (
            <a
              href={currentProject && currentRevision ? api.getExportUrl('tqs', currentProject.id, currentRevision.id) : '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export TQs Register</span>
            </a>
          )}
        </div>
      </div>

      {/* 3-TIER INDUSTRIAL PRIORITY TRIAGE BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* P1 Card */}
        <div
          onClick={() => setPriorityFilter(priorityFilter === 'P1_CRITICAL' ? 'ALL' : 'P1_CRITICAL')}
          className={`cursor-pointer rounded-2xl p-4 border-2 transition-all relative overflow-hidden shadow-2xs ${
            priorityFilter === 'P1_CRITICAL'
              ? 'bg-rose-50/90 border-rose-600 ring-2 ring-rose-500/30'
              : 'bg-rose-50/40 border-rose-300 hover:bg-rose-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-600 animate-pulse"></span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-950">
                P1: Commissioning Blockers
              </span>
            </div>
            <span className="font-mono text-xl font-black text-rose-700 bg-rose-100/80 px-2.5 py-0.5 rounded-lg border border-rose-300">
              {activeP1Count}
            </span>
          </div>
          <p className="text-[11px] font-bold text-rose-900 mt-2">
            Safety & Hardware Integrity (FAT Blocker)
          </p>
          <p className="text-[10px] text-rose-700 mt-0.5 leading-snug">
            Train A/B segregation breaches, unisolated inductive solenoids, physical terminal collisions, duplicate tags.
          </p>
          <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-rose-800 pt-2 border-t border-rose-200">
            <span>Impact Score: 90 - 100</span>
            <span className="underline">{priorityFilter === 'P1_CRITICAL' ? 'Showing P1 (Clear Filter)' : 'Filter P1 Blockers'}</span>
          </div>
        </div>

        {/* P2 Card */}
        <div
          onClick={() => setPriorityFilter(priorityFilter === 'P2_HIGH' ? 'ALL' : 'P2_HIGH')}
          className={`cursor-pointer rounded-2xl p-4 border-2 transition-all relative overflow-hidden shadow-2xs ${
            priorityFilter === 'P2_HIGH'
              ? 'bg-amber-50/90 border-amber-600 ring-2 ring-amber-500/30'
              : 'bg-amber-50/40 border-amber-300 hover:bg-amber-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                P2: Commercial & Spares Risk
              </span>
            </div>
            <span className="font-mono text-xl font-black text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-300">
              {activeP2Count}
            </span>
          </div>
          <p className="text-[11px] font-bold text-amber-900 mt-2">
            Hardware Headroom & Cable Contiguity
          </p>
          <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
            10% wired spare quota deficit, multi-core cable splits across carriers, reserved empty baseplate shortfall.
          </p>
          <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-amber-800 pt-2 border-t border-amber-200">
            <span>Impact Score: 60 - 89</span>
            <span className="underline">{priorityFilter === 'P2_HIGH' ? 'Showing P2 (Clear Filter)' : 'Filter P2 Risks'}</span>
          </div>
        </div>

        {/* P3 Card */}
        <div
          onClick={() => setPriorityFilter(priorityFilter === 'P3_ADVISORY' ? 'ALL' : 'P3_ADVISORY')}
          className={`cursor-pointer rounded-2xl p-4 border-2 transition-all relative overflow-hidden shadow-2xs ${
            priorityFilter === 'P3_ADVISORY'
              ? 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/30'
              : 'bg-teal-50/40 border-teal-300 hover:bg-teal-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-teal-500"></span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-teal-950">
                P3: Engineering Advisories
              </span>
            </div>
            <span className="font-mono text-xl font-black text-teal-700 bg-teal-100/80 px-2.5 py-0.5 rounded-lg border border-teal-300">
              {activeP3Count}
            </span>
          </div>
          <p className="text-[11px] font-bold text-teal-900 mt-2">
            Maintenance & Documentation Hygiene
          </p>
          <p className="text-[10px] text-teal-700 mt-0.5 leading-snug">
            Inferred cable sizes, missing P&ID loop service descriptions, wire color sequences, drawing syntax notes.
          </p>
          <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-teal-800 pt-2 border-t border-teal-200">
            <span>Impact Score: 10 - 59</span>
            <span className="underline">{priorityFilter === 'P3_ADVISORY' ? 'Showing P3 (Clear Filter)' : 'Filter P3 Advisories'}</span>
          </div>
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
            {openTqsList.length} Open
          </span>
        </button>
      </div>

      {/* Filter Bar with Priority & Sort dropdowns */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rule, signal tag, category, or hardware location..."
            className="w-full text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Priority Filter Pill Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setPriorityFilter('ALL')}
              className={`px-2 py-1 rounded-md transition-all ${
                priorityFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Priorities
            </button>
            <button
              onClick={() => setPriorityFilter('P1_CRITICAL')}
              className={`px-2 py-1 rounded-md transition-all flex items-center space-x-1 ${
                priorityFilter === 'P1_CRITICAL' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              <span>🔴 P1 Blockers</span>
            </button>
            <button
              onClick={() => setPriorityFilter('P2_HIGH')}
              className={`px-2 py-1 rounded-md transition-all flex items-center space-x-1 ${
                priorityFilter === 'P2_HIGH' ? 'bg-amber-500 text-white shadow-2xs font-bold' : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              <span>🟡 P2 Spares</span>
            </button>
            <button
              onClick={() => setPriorityFilter('P3_ADVISORY')}
              className={`px-2 py-1 rounded-md transition-all flex items-center space-x-1 ${
                priorityFilter === 'P3_ADVISORY' ? 'bg-teal-600 text-white shadow-2xs font-bold' : 'text-teal-700 hover:text-teal-900'
              }`}
            >
              <span>🟢 P3 Advisories</span>
            </button>
          </div>

          {activeTab === 'validation' ? (
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden font-medium"
            >
              <option value="">All Severities</option>
              <option value="ERROR">Blocking Errors</option>
              <option value="WARNING">Warnings</option>
              <option value="INFO">Informational</option>
            </select>
          ) : (
            <select
              value={tqStatusFilter}
              onChange={(e) => setTqStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden font-medium"
            >
              <option value="">All TQ Statuses</option>
              <option value="Open">Open</option>
              <option value="In Review">In Review</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          )}

          <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:outline-hidden"
            >
              <option value="impact">Sort: Impact Score (Highest First)</option>
              <option value="default">Sort: Default Order</option>
            </select>
          </div>
        </div>
      </div>

      {/* TAB 1: VALIDATION REPORT */}
      {activeTab === 'validation' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {issuesList
              .filter((i) => {
                const prio = resolveIssuePriority(i);
                if (priorityFilter !== 'ALL' && prio !== priorityFilter) return false;
                if (severityFilter && i.severity !== severityFilter) return false;
                if (search) {
                  const s = search.toLowerCase();
                  const matchesRule = i.rule_name.toLowerCase().includes(s);
                  const matchesTags = i.affected_tags.join(' ').toLowerCase().includes(s);
                  const matchesHw = (i.affected_hardware || '').toLowerCase().includes(s);
                  const matchesMsg = i.message.toLowerCase().includes(s);
                  if (!matchesRule && !matchesTags && !matchesHw && !matchesMsg) return false;
                }
                return true;
              })
              .sort((a, b) => {
                if (sortBy === 'impact') {
                  return (b.impact_score || 0) - (a.impact_score || 0);
                }
                return 0;
              })
              .map((issue) => {
                const prio = resolveIssuePriority(issue);
                const score = issue.impact_score || (prio === 'P1_CRITICAL' ? 95 : prio === 'P2_HIGH' ? 75 : 45);

                return (
                  <div
                    key={issue.issue_id}
                    className={`p-4 rounded-xl border shadow-xs transition-all ${
                      prio === 'P1_CRITICAL'
                        ? 'bg-rose-50/20 border-rose-300'
                        : prio === 'P2_HIGH'
                        ? 'bg-amber-50/20 border-amber-300'
                        : 'bg-teal-50/20 border-teal-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {issue.issue_id}
                        </span>

                        {/* Priority Badge with Impact Score */}
                        {prio === 'P1_CRITICAL' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-600 text-white flex items-center space-x-1 shadow-2xs">
                            <Flame className="w-3 h-3" />
                            <span>P1 Blocker (Impact: {score}/100)</span>
                          </span>
                        )}
                        {prio === 'P2_HIGH' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white flex items-center space-x-1 shadow-2xs">
                            <Clock className="w-3 h-3" />
                            <span>P2 Spares/Raceway (Impact: {score}/100)</span>
                          </span>
                        )}
                        {prio === 'P3_ADVISORY' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-600 text-white flex items-center space-x-1 shadow-2xs">
                            <Sparkles className="w-3 h-3" />
                            <span>P3 Advisory (Impact: {score}/100)</span>
                          </span>
                        )}

                        <h4 className="font-bold text-slate-900 text-xs ml-1">{issue.rule_name}</h4>
                        {issue.blocks_approval && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            BLOCKS APPROVAL
                          </span>
                        )}
                      </div>
                      <StatusBadge status={issue.severity} size="sm" />
                    </div>

                    <p className="text-xs text-slate-800 mt-2 leading-relaxed font-medium">
                      {issue.message}
                    </p>

                    {/* Plant Impact Box */}
                    {issue.impact_description && (
                      <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs flex items-start space-x-2">
                        <span className="font-bold text-slate-900 shrink-0">🏭 Plant Risk:</span>
                        <span className="text-slate-700 leading-tight">{issue.impact_description}</span>
                      </div>
                    )}

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

                      <div className="text-[11px] text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                        <span className="font-bold text-blue-700">Recommended Remedy: </span>
                        {issue.recommended_remedy || issue.suggested_action}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 2: TECHNICAL QUERIES */}
      {activeTab === 'tqs' && (
        <div className="space-y-4">
          <div className="space-y-4">
            {tqs
              .filter((t) => {
                const prio = resolveTqPriority(t);
                if (priorityFilter !== 'ALL' && prio !== priorityFilter) return false;
                if (tqStatusFilter && t.status !== tqStatusFilter) return false;
                if (search) {
                  const s = search.toLowerCase();
                  const matchesCode = t.tq_code.toLowerCase().includes(s);
                  const matchesCat = t.category.toLowerCase().includes(s);
                  const matchesDesc = t.description.toLowerCase().includes(s);
                  const matchesTags = t.affected_tags.join(' ').toLowerCase().includes(s);
                  if (!matchesCode && !matchesCat && !matchesDesc && !matchesTags) return false;
                }
                return true;
              })
              .sort((a, b) => {
                if (sortBy === 'impact') {
                  return (b.impact_score || 0) - (a.impact_score || 0);
                }
                return 0;
              })
              .map((tq) => {
                const prio = resolveTqPriority(tq);
                const score = tq.impact_score || (prio === 'P1_CRITICAL' ? 95 : prio === 'P2_HIGH' ? 75 : 45);

                return (
                  <div
                    key={tq.id}
                    className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 transition-all ${
                      prio === 'P1_CRITICAL'
                        ? 'border-rose-300 bg-rose-50/10'
                        : prio === 'P2_HIGH'
                        ? 'border-amber-300 bg-amber-50/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {tq.tq_code}
                          </span>

                          {/* Priority Badge */}
                          {prio === 'P1_CRITICAL' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-600 text-white flex items-center space-x-1 shadow-2xs">
                              <Flame className="w-3 h-3" />
                              <span>P1 Blocker (Impact: {score}/100)</span>
                            </span>
                          )}
                          {prio === 'P2_HIGH' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white flex items-center space-x-1 shadow-2xs">
                              <Clock className="w-3 h-3" />
                              <span>P2 Headroom (Impact: {score}/100)</span>
                            </span>
                          )}
                          {prio === 'P3_ADVISORY' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-600 text-white flex items-center space-x-1 shadow-2xs">
                              <Sparkles className="w-3 h-3" />
                              <span>P3 Advisory (Impact: {score}/100)</span>
                            </span>
                          )}

                          <span className="font-semibold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Category: {tq.category}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-1.5">{tq.description}</h4>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
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

                    {/* Plant Risk & Remedy Box */}
                    {tq.impact_description && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-start space-x-2">
                          <span className="font-bold text-slate-900 shrink-0">🏭 Plant Risk:</span>
                          <span className="text-slate-700">{tq.impact_description}</span>
                        </div>
                        {tq.recommended_remedy && (
                          <div className="flex items-start space-x-2 pt-1 border-t border-slate-200/60">
                            <span className="font-bold text-blue-700 shrink-0">⚡ Recommended Remedy:</span>
                            <span className="text-slate-800 font-medium">{tq.recommended_remedy}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-lg border border-slate-200">
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
                );
              })}
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
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden font-medium"
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
