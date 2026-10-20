import {
  Project, Revision, HardwareConfig, Assignment,
  ValidationSummary, TechnicalQuery, UtilisationSummary,
  RevisionComparison, AuditLog
} from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

export const api = {
  // Health
  checkHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Projects
  getProjects: async (): Promise<Project[]> => {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  getProject: async (id: number): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    return res.json();
  },

  createProject: async (data: { project_id: string; name: string; customer_name: string; description?: string; system?: string }): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create project');
    }
    return res.json();
  },

  updateProject: async (id: number, data: Partial<Project>): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update project');
    return res.json();
  },

  deleteProject: async (id: number) => {
    const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete project');
    return res.json();
  },

  // Revisions
  getRevisions: async (projectId: number): Promise<Revision[]> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/revisions`);
    if (!res.ok) throw new Error('Failed to fetch revisions');
    return res.json();
  },

  createRevision: async (projectId: number, data: { revision_code: string; description?: string }): Promise<Revision> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create revision');
    return res.json();
  },

  switchRevision: async (projectId: number, revisionId: number) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/revisions/switch?revision_id=${revisionId}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to switch revision');
    return res.json();
  },

  compareRevisions: async (projectId: number, baseRevId: number, targetRevId: number): Promise<RevisionComparison> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/revisions/compare?base_revision_id=${baseRevId}&target_revision_id=${targetRevId}`);
    if (!res.ok) throw new Error('Failed to compare revisions');
    return res.json();
  },

  // Upload & Inspect
  inspectWorkbook: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/inspect`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to inspect workbook');
    }
    return res.json();
  },

  importMappedSignals: async (projectId: number, revisionId: number, filePath: string, sheetName: string, mapping: Record<string, string>) => {
    const res = await fetch(`${API_BASE}/upload/import?project_id=${projectId}&revision_id=${revisionId}&file_path=${encodeURIComponent(filePath)}&sheet_name=${encodeURIComponent(sheetName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to import mapped signals');
    }
    return res.json();
  },

  // Hardware Config
  getHardwareConfig: async (projectId: number, revisionId?: number): Promise<HardwareConfig> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/hardware-config?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/hardware-config`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch hardware configuration');
    return res.json();
  },

  saveHardwareConfig: async (projectId: number, config: HardwareConfig, revisionId?: number) => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/hardware-config?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/hardware-config`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save hardware configuration');
    return res.json();
  },

  // Allocation
  runAllocation: async (projectId: number, revisionId: number, preserveExisting = true) => {
    const res = await fetch(`${API_BASE}/allocation/run?project_id=${projectId}&revision_id=${revisionId}&preserve_existing=${preserveExisting}`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Allocation run failed');
    }
    return res.json();
  },

  getAssignments: async (projectId: number, revisionId: number, params?: { status?: string; signal_type?: string; cable_id?: string; search?: string }): Promise<Assignment[]> => {
    const query = new URLSearchParams({ project_id: String(projectId), revision_id: String(revisionId) });
    if (params?.status) query.append('status', params.status);
    if (params?.signal_type) query.append('signal_type', params.signal_type);
    if (params?.cable_id) query.append('cable_id', params.cable_id);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/allocation/assignments?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch assignments');
    return res.json();
  },

  updateAssignment: async (projectId: number, revisionId: number, assignmentId: number, data: { cabinet_id: string; cioc_id: string; baseplate_id: string; charm_index: number; terminal_block?: string }) => {
    const res = await fetch(`${API_BASE}/allocation/assignment/${assignmentId}?project_id=${projectId}&revision_id=${revisionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to update assignment');
    }
    return res.json();
  },

  revertAllocation: async (projectId: number, revisionId: number) => {
    const res = await fetch(`${API_BASE}/allocation/revert?project_id=${projectId}&revision_id=${revisionId}`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to revert allocation');
    }
    return res.json();
  },

  // Validation & TQs
  getValidationSummary: async (projectId: number, revisionId: number): Promise<ValidationSummary> => {
    const res = await fetch(`${API_BASE}/validation/summary?project_id=${projectId}&revision_id=${revisionId}`);
    if (!res.ok) throw new Error('Failed to fetch validation summary');
    return res.json();
  },

  getTQs: async (projectId: number, revisionId?: number): Promise<TechnicalQuery[]> => {
    const url = revisionId
      ? `${API_BASE}/tqs?project_id=${projectId}&revision_id=${revisionId}`
      : `${API_BASE}/tqs?project_id=${projectId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch technical queries');
    return res.json();
  },

  updateTQ: async (tqId: number, data: { status?: string; resolution_notes?: string }) => {
    const res = await fetch(`${API_BASE}/tqs/${tqId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update TQ');
    return res.json();
  },

  // Utilisation
  getUtilisationSummary: async (projectId: number, revisionId: number): Promise<UtilisationSummary> => {
    const res = await fetch(`${API_BASE}/utilisation?project_id=${projectId}&revision_id=${revisionId}`);
    if (!res.ok) throw new Error('Failed to fetch utilisation summary');
    return res.json();
  },

  // Export URLs
  getExportUrl: (type: 'allocation' | 'validation' | 'tqs' | 'utilisation', projectId: number, revisionId: number) => {
    return `${API_BASE}/reports/export/${type}?project_id=${projectId}&revision_id=${revisionId}`;
  },

  getRevisionDiffExportUrl: (projectId: number, baseId: number, targetId: number) => {
    return `${API_BASE}/reports/export/revision-diff?project_id=${projectId}&base_id=${baseId}&target_id=${targetId}`;
  },

  getSampleFileUrl: (fileName: string) => {
    return `${API_BASE}/sample-files/download/${fileName}`;
  },

  // Audit Logs & Demo
  getAuditLogs: async (projectId: number): Promise<AuditLog[]> => {
    const res = await fetch(`${API_BASE}/audit-logs/${projectId}`);
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  seedDemo: async () => {
    const res = await fetch(`${API_BASE}/demo/seed`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to seed demo');
    return res.json();
  }
};
