import {
  Project, Revision, HardwareConfig, ProjectRule, Assignment,
  ValidationSummary, TechnicalQuery, UtilisationSummary,
  RevisionComparison, AuditLog,
  RiskAssessmentResponse, ChatRequest, ChatResponse, ActionProposal,
  CounterfactualResponse, BlastRadiusResponse,
  PreflightLintResponse, ReferenceScorecardResponse,
  PreprocessingAnalysisResponse, ParetoResponse,
  WiredSpareTakeoverResponse, DeliverablesPackResponse, FieldQRLabel,
  AllocationRunResult
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

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

  // Project Rules Management (Default & Custom Rules CRUD)
  getProjectRules: async (projectId: number, revisionId?: number): Promise<ProjectRule[]> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/rules?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/rules`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch project rules');
    return res.json();
  },

  createCustomRule: async (projectId: number, rule: Partial<ProjectRule>, revisionId?: number): Promise<ProjectRule> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/rules?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/rules`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create custom rule');
    }
    return res.json();
  },

  updateCustomRule: async (projectId: number, ruleId: string, rule: Partial<ProjectRule>, revisionId?: number): Promise<ProjectRule> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/rules/${encodeURIComponent(ruleId)}?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/rules/${encodeURIComponent(ruleId)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update rule');
    }
    return res.json();
  },

  deleteCustomRule: async (projectId: number, ruleId: string, revisionId?: number): Promise<boolean> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/rules/${encodeURIComponent(ruleId)}?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/rules/${encodeURIComponent(ruleId)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete custom rule');
    }
    return true;
  },

  toggleProjectRule: async (projectId: number, ruleId: string, revisionId?: number): Promise<ProjectRule> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/rules/${encodeURIComponent(ruleId)}/toggle?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/rules/${encodeURIComponent(ruleId)}/toggle`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to toggle rule');
    }
    return res.json();
  },

  resetProjectRules: async (projectId: number, revisionId?: number): Promise<ProjectRule[]> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/rules/reset?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/rules/reset`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to reset rules');
    }
    return res.json();
  },

  // Allocation
  runAllocation: async (projectId: number, revisionId: number, preserveExisting = true): Promise<AllocationRunResult> => {
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

  // Explainability: "Why is it here?"
  explainSignal: async (projectId: number, tag: string, revisionId?: number): Promise<any> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/explain-signal?tag=${encodeURIComponent(tag)}&revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/explain-signal?tag=${encodeURIComponent(tag)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch signal explainability');
    return res.json();
  },

  approveAllocation: async (projectId: number, revisionId: number, reviewerName: string = 'Lead DCS Engineer', notes?: string) => {
    const res = await fetch(`${API_BASE}/allocation/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        revision_id: revisionId,
        reviewer_name: reviewerName,
        notes: notes || ''
      })
    });
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
  },

  // Risk Assessment & Rule Recommendations
  getRiskAssessment: async (projectId: number, revisionId?: number): Promise<RiskAssessmentResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/risk-assessment?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/risk-assessment`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch risk assessment');
    return res.json();
  },

  applyRuleSuggestion: async (projectId: number, data: { suggestion_id: string; rule_target: string; suggested_value: any }, revisionId?: number) => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/apply-rule-suggestion?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/apply-rule-suggestion`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to apply rule suggestion');
    }
    return res.json();
  },

  // DCS Engineering AI Chatbot
  sendChatMessage: async (req: ChatRequest): Promise<ChatResponse> => {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to communicate with AI Assistant');
    }
    return res.json();
  },

  applyChatAction: async (
    projectId: number,
    revisionId: number,
    actionProposal: ActionProposal,
    userName: string = 'Lead DCS Engineer'
  ): Promise<{ success: boolean; message: string; action_id?: string; val_summary?: any }> => {
    const res = await fetch(`${API_BASE}/chat/action/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        revision_id: revisionId,
        action_proposal: actionProposal,
        user_name: userName
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to apply action proposal');
    }
    return res.json();
  },

  // "Why Not Here?" Counterfactual Engine
  evaluateCounterfactual: async (
    projectId: number,
    payload: {
      tag: string;
      target_cabinet: string;
      target_cioc: string;
      target_baseplate: string;
      target_channel: number;
    },
    revisionId?: number
  ): Promise<CounterfactualResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/counterfactual?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/counterfactual`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to evaluate counterfactual');
    }
    return res.json();
  },

  // Failure Blast-Radius Simulator
  simulateBlastRadius: async (
    projectId: number,
    payload: { failure_type: string; target_id: string },
    revisionId?: number
  ): Promise<BlastRadiusResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/blast-radius?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/blast-radius`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to simulate blast radius');
    }
    return res.json();
  },

  // Pre-flight Doctor Lint
  getPreflightLint: async (projectId: number, revisionId?: number): Promise<PreflightLintResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/preflight-lint?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/preflight-lint`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch preflight lint');
    return res.json();
  },

  // Reference Scorecard Parity
  getReferenceScorecard: async (projectId: number, revisionId?: number): Promise<ReferenceScorecardResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/reference-scorecard?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/reference-scorecard`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch reference scorecard');
    return res.json();
  },

  // Industrial Preprocessing & Conflict Graph
  getPreprocessingAnalysis: async (projectId: number, revisionId?: number): Promise<PreprocessingAnalysisResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/preprocessing-analysis?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/preprocessing-analysis`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch preprocessing analysis');
    return res.json();
  },

  // Pareto Layout Alternatives
  getParetoAlternatives: async (projectId: number, revisionId?: number): Promise<ParetoResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/pareto-alternatives?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/pareto-alternatives`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch Pareto alternatives');
    return res.json();
  },

  // Wired-Spare Takeover ($0 Cost Revisions)
  getWiredSpareTakeover: async (projectId: number, payload?: any, revisionId?: number): Promise<WiredSpareTakeoverResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/wired-spare-takeover?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/wired-spare-takeover`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!res.ok) throw new Error('Failed to evaluate wired spare takeover');
    return res.json();
  },

  applyWiredSpareTakeover: async (projectId: number, matches: any[], revisionId?: number) => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/apply-wired-spare-takeover?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/apply-wired-spare-takeover`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takeover_matches: matches })
    });
    if (!res.ok) throw new Error('Failed to apply wired spare takeover');
    return res.json();
  },

  // Deliverables Pack (Cable Termination, Cable Schedule, Loop Check, FAT)
  getDeliverablesPack: async (projectId: number, revisionId?: number): Promise<DeliverablesPackResponse> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/deliverables-pack?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/deliverables-pack`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to generate deliverables pack');
    return res.json();
  },

  // Field QR Labels
  getQRLabels: async (projectId: number, revisionId?: number): Promise<FieldQRLabel[]> => {
    const url = revisionId
      ? `${API_BASE}/projects/${projectId}/qr-labels?revision_id=${revisionId}`
      : `${API_BASE}/projects/${projectId}/qr-labels`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch field QR labels');
    return res.json();
  }
};
