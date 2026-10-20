import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Cpu,
  AlertTriangle,
  FileQuestion,
  Layers,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Play
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { MetricCard } from '../components/ui/MetricCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { api } from '../services/api';
import { UtilisationSummary, ValidationSummary } from '../types';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { currentProject, currentRevision, projects, refreshProjects } = useProject();
  const navigate = useNavigate();

  const [utilSummary, setUtilSummary] = useState<UtilisationSummary | null>(null);
  const [valSummary, setValSummary] = useState<ValidationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentProject && currentRevision) {
      loadStats();
    }
  }, [currentProject?.id, currentRevision?.id]);

  const loadStats = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      setLoading(true);
      const [u, v] = await Promise.all([
        api.getUtilisationSummary(currentProject.id, currentRevision.id),
        api.getValidationSummary(currentProject.id, currentRevision.id)
      ]);
      setUtilSummary(u);
      setValSummary(v);
    } catch (err) {
      console.error('Error fetching dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Allocated', value: currentProject?.allocated_count || 0, color: '#10B981' },
    { name: 'Awaiting Allocation', value: Math.max(0, (currentProject?.signal_count || 0) - (currentProject?.allocated_count || 0)), color: '#F59E0B' },
  ];

  const typeData = [
    { type: 'AI', count: 28 },
    { type: 'DI', count: 22 },
    { type: 'AO', count: 12 },
    { type: 'DO', count: 8 },
    { type: 'DO-SOV', count: 4 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-industrial-900 via-industrial-800 to-slate-900 rounded-xl p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-blue-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
            <span>SYSTEM ACTIVE // INDUSTRIAL IO OPTIMIZATION</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {currentProject ? currentProject.name : 'No Active Project'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {currentProject?.description || 'Automate DeltaV CHARMs electronic marshalling allocation, enforce hard redundancy & cable grouping rules, and resolve conflicts.'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/import')}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
            <span>Import IO List</span>
          </button>
          <button
            onClick={() => navigate('/allocation')}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-500/30 transition-colors"
          >
            <span>Open Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Imported Signals"
          value={currentProject?.signal_count || 0}
          subtitle={`Active in ${currentProject?.current_revision || 'Rev A'}`}
          icon={<Boxes className="w-5 h-5" />}
          color="blue"
          onClick={() => navigate('/allocation')}
        />
        <MetricCard
          title="Allocated Signals"
          value={currentProject?.allocated_count || 0}
          subtitle={`${currentProject?.signal_count ? Math.round(((currentProject.allocated_count || 0) / currentProject.signal_count) * 100) : 0}% automated placement`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          onClick={() => navigate('/allocation')}
        />
        <MetricCard
          title="Blocking Errors"
          value={valSummary?.error_count || currentProject?.validation_errors_count || 0}
          subtitle="Violates mandatory hard constraints"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="rose"
          onClick={() => navigate('/validation-tqs')}
        />
        <MetricCard
          title="Open TQs"
          value={currentProject?.open_tqs_count || 0}
          subtitle="Pending engineering clarifications"
          icon={<FileQuestion className="w-5 h-5" />}
          color="amber"
          onClick={() => navigate('/validation-tqs')}
        />
      </div>

      {/* Second Row KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Configured Cabinets"
          value={utilSummary?.total_cabinets || 2}
          subtitle={`${utilSummary?.used_cabinets || 1} currently occupied`}
          icon={<Cpu className="w-5 h-5" />}
          color="slate"
          onClick={() => navigate('/utilisation')}
        />
        <MetricCard
          title="Average Utilisation"
          value={`${utilSummary?.overall_utilisation_pct || 0}%`}
          subtitle={`${utilSummary?.allocated_signals || 0} of ${utilSummary?.total_charm_positions || 0} CHARMs`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
          onClick={() => navigate('/utilisation')}
        />
        <MetricCard
          title="Reserved Spare Capacity"
          value={`${utilSummary?.spare_capacity_achieved_pct || 10}%`}
          subtitle={`${utilSummary?.reserved_spare_positions || 0} positions reserved for expansion`}
          icon={<Layers className="w-5 h-5" />}
          color="amber"
          onClick={() => navigate('/utilisation')}
        />
      </div>

      {/* Charts & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation Status Donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Allocation Status Breakdown</h3>
              <p className="text-xs text-slate-500">Distribution of IO signal assignments</p>
            </div>
            <span className="text-xs font-mono font-medium text-slate-400">Total: {currentProject?.signal_count || 0}</span>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value} Signals`, 'Count']}
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-around pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-slate-600">Allocated ({currentProject?.allocated_count || 0})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-slate-600">Pending ({Math.max(0, (currentProject?.signal_count || 0) - (currentProject?.allocated_count || 0))})</span>
            </div>
          </div>
        </div>

        {/* Signal Type Distribution Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Signal Distribution by Type</h3>
              <p className="text-xs text-slate-500">Industrial IO mix mapped to CHARM modules</p>
            </div>
            <button
              onClick={() => navigate('/rules-hardware')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
            >
              <span>View Hardware Rules</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="type" stroke="#64748B" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={12} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity & Next Engineering Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Recommended Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-semibold text-slate-900 text-sm mb-3 flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-blue-600" />
            <span>Recommended Engineering Actions</span>
          </h3>
          <div className="space-y-3">
            {valSummary && valSummary.error_count > 0 ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-rose-900">Resolve {valSummary.error_count} Blocking Validation Errors</div>
                  <p className="text-rose-700 mt-0.5">Mandatory engineering rules are currently violated. Approval is blocked.</p>
                  <button
                    onClick={() => navigate('/validation-tqs')}
                    className="mt-2 text-rose-800 font-bold hover:underline"
                  >
                    Review Issues in Validation Tab →
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-emerald-900">All Hard Constraints Satisfied</div>
                  <p className="text-emerald-700 mt-0.5">Current allocation meets all DeltaV hardware and redundancy requirements.</p>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between">
              <div>
                <div className="font-medium text-slate-900 text-xs">Export Customer Allocation Schedule</div>
                <div className="text-[11px] text-slate-500">Download formatted Excel output workbook matching customer template.</div>
              </div>
              <button
                onClick={() => navigate('/reports')}
                className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700"
              >
                Exports
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between">
              <div>
                <div className="font-medium text-slate-900 text-xs">Manage Revisions (Rev A → Rev B)</div>
                <div className="text-[11px] text-slate-500">Track added/deleted signals and preserve valid assignments across revisions.</div>
              </div>
              <button
                onClick={() => navigate('/revisions')}
                className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700"
              >
                Revisions
              </button>
            </div>
          </div>
        </div>

        {/* Recent Projects List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">Industrial Projects Overview</h3>
            <button
              onClick={() => navigate('/projects')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Manage All
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {projects.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-md transition-colors">
                <div>
                  <div className="text-xs font-semibold text-slate-900 flex items-center space-x-2">
                    <span>{p.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">({p.project_id})</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{p.customer_name} • {p.current_revision}</div>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="font-mono text-slate-700 font-medium">{p.signal_count} IO</span>
                  <StatusBadge status={p.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
