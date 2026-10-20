import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Database,
  History,
  RotateCcw,
  CheckCircle2,
  Server,
  Terminal,
  Cpu
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { AuditLog } from '../types';

export const SettingsPage: React.FC = () => {
  const { currentProject, resetToDemo } = useProject();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    loadHealth();
    if (currentProject) {
      loadLogs();
    }
  }, [currentProject?.id]);

  const loadHealth = async () => {
    try {
      const h = await api.checkHealth();
      setHealth(h);
    } catch (e) {
      console.error(e);
    }
  };

  const loadLogs = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const data = await api.getAuditLogs(currentProject.id);
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <span>System Settings & Engineering Audit Trail</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Verify runtime environment, local storage integrity, and immutable engineering change logs for {currentProject?.name}.
        </p>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Backend API Engine</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-sm font-bold text-slate-900">FastAPI + Uvicorn</div>
          <div className="text-[11px] text-slate-500 font-mono">
            Status: {health?.status || 'Active'} • v{health?.version || '1.0.0'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Optimization Engine</span>
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm font-bold text-slate-900">Google OR-Tools CP-SAT</div>
          <div className="text-[11px] text-slate-500 font-mono">
            Deterministic Constraint Satisfaction
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Database & Storage</span>
            <Database className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-sm font-bold text-slate-900">Local Engine (SQLite / Supabase Ready)</div>
          <div className="text-[11px] text-slate-500 font-mono">
            Schema: Zero-credential persistent local DB
          </div>
        </div>
      </div>

      {/* Quick Action: Reset to Synthetic Demo Project */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Reload Synthetic Demo DeltaV Allocation</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            Resets database with the synthetic Emerson DeltaV demonstration dataset (74+ instruments, multi-pair cables CB-01 to CB-08, A/B redundancy, deliberate test error with TQ resolution, and pre-configured Rev B).
          </p>
        </div>
        <button
          onClick={resetToDemo}
          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-all"
        >
          <RotateCcw className="w-4 h-4 text-slate-300" />
          <span>Reset Demo Data</span>
        </button>
      </div>

      {/* Engineering Audit Trail Log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <History className="w-4 h-4 text-blue-600" />
              <span>Immutable Engineering Change Log</span>
            </h3>
            <p className="text-xs text-slate-500">
              Traceability records of manual reassignments, allocation solver runs, and schema imports.
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-slate-400">
            {logs.length} Audit Entries
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Entity Type</th>
                <th className="py-2.5 px-4">Details / Prior State</th>
                <th className="py-2.5 px-4">New State / Outcome</th>
                <th className="py-2.5 px-4">Engineer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors font-mono">
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                      {log.created_at.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 font-sans">{log.entity_type}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-sans truncate max-w-xs">
                      {log.old_value || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 font-sans font-medium truncate max-w-xs">
                      {log.new_value || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 font-sans text-[11px]">{log.user_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
