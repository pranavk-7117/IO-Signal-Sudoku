import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  CheckCircle2,
  RotateCcw,
  Boxes,
  ShieldAlert,
  FileQuestion,
  Search
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { useNavigate } from 'react-router-dom';

export const ProjectsPage: React.FC = () => {
  const { projects, currentProject, setCurrentProjectById, refreshProjects, resetToDemo } = useProject();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Form states
  const [formProjectId, setFormProjectId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCustomer, setFormCustomer] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSystem, setFormSystem] = useState('DeltaV v14.3 / Electronic Marshalling CHARMs');

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.project_id.toLowerCase().includes(search.toLowerCase()) ||
      p.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createProject({
        project_id: formProjectId,
        name: formName,
        customer_name: formCustomer,
        description: formDescription,
        system: formSystem,
      });
      await refreshProjects();
      setCurrentProjectById(created.id);
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    try {
      await api.updateProject(selectedProjectId, {
        name: formName,
        customer_name: formCustomer,
        description: formDescription,
        system: formSystem,
      });
      await refreshProjects();
      setShowEditModal(false);
      resetForm();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedProjectId) return;
    try {
      await api.deleteProject(selectedProjectId);
      await refreshProjects();
      setShowDeleteModal(false);
      setSelectedProjectId(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const openEdit = (p: any) => {
    setSelectedProjectId(p.id);
    setFormProjectId(p.project_id);
    setFormName(p.name);
    setFormCustomer(p.customer_name);
    setFormDescription(p.description);
    setFormSystem(p.system);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormProjectId('');
    setFormName('');
    setFormCustomer('');
    setFormDescription('');
    setFormSystem('DeltaV v14.3 / Electronic Marshalling CHARMs');
    setSelectedProjectId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            <span>Project Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, switch, and maintain isolated engineering projects and DeltaV hardware targets.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={resetToDemo}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Load Demo Data</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center space-x-3 shadow-xs">
        <Search className="w-4 h-4 text-slate-400 ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by project name, ID (e.g. PRJ-DELTA-01), or customer..."
          className="w-full text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredProjects.map((p) => {
          const isActive = currentProject?.id === p.id;
          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                isActive
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {p.project_id}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-2">{p.name}</h3>
                    <p className="text-xs text-slate-500">{p.customer_name}</p>
                  </div>
                  <StatusBadge status={p.status} size="sm" />
                </div>

                <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                  {p.description || 'No project description provided.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Signals</div>
                    <div className="font-bold text-slate-800 font-mono mt-0.5">{p.signal_count}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Allocated</div>
                    <div className="font-bold text-emerald-600 font-mono mt-0.5">{p.allocated_count}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Issues</div>
                    <div className={`font-bold font-mono mt-0.5 ${p.validation_errors_count > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {p.validation_errors_count}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                    title="Edit Project"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setShowDeleteModal(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isActive ? (
                  <span className="flex items-center space-x-1 font-semibold text-emerald-600 text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Active Workspace</span>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setCurrentProjectById(p.id);
                      navigate('/dashboard');
                    }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded transition-colors"
                  >
                    Set Active
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Create New Engineering Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project ID</label>
                  <input
                    type="text"
                    required
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    placeholder="e.g. PRJ-DELTA-02"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Crude Distillation Unit DCS"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Plant Client</label>
                <input
                  type="text"
                  required
                  value={formCustomer}
                  onChange={(e) => setFormCustomer(e.target.value)}
                  placeholder="e.g. ExxonMobil Baytown Refinery"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Control System Architecture</label>
                <input
                  type="text"
                  value={formSystem}
                  onChange={(e) => setFormSystem(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Engineering scope, I/O database source, special constraints..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Edit Project Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={formCustomer}
                  onChange={(e) => setFormCustomer(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Engineering Project"
        message="Are you sure you want to permanently delete this project? All imported IO lists, hardware layouts, allocation assignments, and revisions will be removed."
        danger
        confirmLabel="Delete Project"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};
