export interface Project {
  id: number;
  project_id: string;
  name: string;
  customer_name: string;
  description: string;
  system: string;
  current_revision: string;
  status: string;
  created_at: string;
  updated_at: string;
  signal_count: number;
  allocated_count: number;
  validation_errors_count: number;
  open_tqs_count: number;
}

export interface Revision {
  id: number;
  project_id: number;
  revision_code: string;
  description: string;
  source_filename?: string;
  template_filename?: string;
  is_active: boolean;
  created_at: string;
}

export interface RuleConfig {
  enforce_logical_grouping: boolean;
  enforce_ab_redundancy_separation: boolean;
  enforce_cable_grouping: boolean;
  enforce_pair_order: boolean;
  spare_percentage: number;
  allow_cross_baseplate_cables: boolean;
  prioritize_cabinet_packing: boolean;
  preserve_previous_assignments: boolean;
}

export interface ProjectRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  kind: string;
  severity: 'hard' | 'soft';
  weight?: number;
  scope: string;
  is_custom?: boolean;
  target_column?: string;
  operator?: string;
  match_value?: string;
  target_charm?: string;
  target_charm_part?: string;
  target_terminal?: string;
  target_terminal_part?: string;
  target_terminals?: string;
  params?: Record<string, any>;
}

export interface HardwareConfig {
  cabinets_count: number;
  ciocs_per_cabinet: number;
  baseplates_per_cioc: number;
  charms_per_baseplate: number;
  spare_percentage: number;
  rules: RuleConfig;
  custom_rules?: ProjectRule[];
  rules_override?: Record<string, any>;
  compatibility_matrix: Record<string, { charm: string; terminal: string }>;
}

export interface SignalRecord {
  id?: number;
  tag: string;
  description?: string;
  signal_type: string;
  cable_id?: string;
  pair_number?: number;
  redundancy?: string;
  logical_group?: string;
  segregation?: string;
  service_id?: string;
  is_valid: boolean;
  validation_errors?: string[];
}

export interface Assignment {
  id: number;
  signal_id: number;
  tag: string;
  description: string;
  signal_type: string;
  cable_id: string;
  pair_number?: number;
  redundancy: string;
  logical_group: string;
  cabinet_id?: string;
  cioc_id?: string;
  baseplate_id?: string;
  charm_index?: number;
  terminal_block?: string;
  charm_type?: string;
  status: 'Allocated' | 'Pending' | 'Needs Review' | 'Blocked';
  reason?: string;
  is_manual_override: boolean;
}

export interface ValidationIssue {
  id?: number;
  issue_id: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  rule_name: string;
  affected_tags: string[];
  affected_hardware?: string;
  message: string;
  suggested_action: string;
  blocks_approval: boolean;
}

export interface ValidationSummary {
  total_signals: number;
  allocated_count: number;
  unallocated_count: number;
  error_count: number;
  warning_count: number;
  info_count: number;
  is_fully_validated: boolean;
  issues: ValidationIssue[];
}

export interface TechnicalQuery {
  id: number;
  tq_code: string;
  project_id: number;
  revision_id: number;
  category: string;
  description: string;
  root_cause: string;
  specific_clarification: string;
  suggested_action: string;
  status: 'Open' | 'In Review' | 'Resolved' | 'Closed';
  resolution_notes?: string;
  affected_tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CharmSlot {
  charm_index: number;
  is_allocated: boolean;
  is_spare: boolean;
  signal_tag?: string;
  signal_type?: string;
  charm_type?: string;
  terminal_block?: string;
}

export interface BaseplateUtilisation {
  baseplate_id: string;
  total_slots: number;
  used_slots: number;
  reserved_spare_slots: number;
  free_slots: number;
  slots: CharmSlot[];
}

export interface CIOCUtilisation {
  cioc_id: string;
  cabinet_id: string;
  total_baseplates: number;
  used_baseplates: number;
  total_slots: number;
  used_slots: number;
  reserved_spare_slots: number;
  free_slots: number;
  utilization_pct: number;
  baseplates: BaseplateUtilisation[];
}

export interface CabinetUtilisation {
  cabinet_id: string;
  total_ciocs: number;
  used_ciocs: number;
  total_slots: number;
  used_slots: number;
  reserved_spare_slots: number;
  free_slots: number;
  utilization_pct: number;
  ciocs: CIOCUtilisation[];
}

export interface UtilisationSummary {
  total_cabinets: number;
  used_cabinets: number;
  total_ciocs: number;
  used_ciocs: number;
  total_baseplates: number;
  used_baseplates: number;
  total_charm_positions: number;
  allocated_signals: number;
  unallocated_signals: number;
  reserved_spare_positions: number;
  free_unreserved_positions: number;
  overall_utilisation_pct: number;
  spare_capacity_achieved_pct: number;
  cabinets: CabinetUtilisation[];
}

export interface RevisionDiffItem {
  tag: string;
  change_type: 'ADDED' | 'DELETED' | 'MODIFIED' | 'UNCHANGED';
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  old_assignment?: string;
  new_assignment?: string;
  movement_status: 'PRESERVED' | 'MOVED' | 'UNALLOCATED' | 'NEW' | 'DELETED';
  movement_reason?: string;
}

export interface RevisionComparison {
  base_revision: string;
  target_revision: string;
  total_added: number;
  total_deleted: number;
  total_modified: number;
  total_unchanged: number;
  total_preserved_assignments: number;
  total_moved_assignments: number;
  diff_records: RevisionDiffItem[];
}

export interface AuditLog {
  id: number;
  project_id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: string;
  new_value?: string;
  user_name: string;
  created_at: string;
}


export interface RiskFactor {
  id: string;
  category: 'segregation' | 'electrical' | 'spares' | 'cables' | 'density';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  title: string;
  description: string;
  affected_items: string[];
}

export interface RuleSuggestion {
  id: string;
  title: string;
  category: string;
  risk_reduction_pts: number;
  description: string;
  rule_target: string;
  suggested_value: any;
  can_auto_apply: boolean;
  applied?: boolean;
}

export interface RiskAssessmentResponse {
  overall_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_color: 'emerald' | 'amber' | 'rose' | 'purple';
  summary: string;
  factors: RiskFactor[];
  suggestions: RuleSuggestion[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  project_id?: number;
  revision_id?: number;
  messages: ChatMessage[];
  context_page?: string;
  selected_tag?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  suggested_actions?: Array<{
    id: string;
    title: string;
    rule_target: string;
    suggested_value: any;
    risk_reduction_pts?: number;
  }>;
  model_used?: string;
}

export interface CounterfactualCheck {
  rule: string;
  passed: boolean;
  message: string;
  severity?: 'hard' | 'soft' | 'info';
}

export interface CounterfactualResponse {
  tag: string;
  target?: {
    cabinet: string;
    cioc: string;
    baseplate: string;
    channel: number;
  };
  is_allowed: boolean;
  blocking_reasons: string[];
  rule_checks: CounterfactualCheck[];
  verdict: string;
}

export interface BlastRadiusSignal {
  tag: string;
  loop_name: string;
  signal_type: string;
  redundancy: string;
  hardware_location: string;
  status: 'PROTECTED' | 'TRIPPED';
  resilience_detail: string;
}

export interface BlastRadiusResponse {
  failure_type: 'cioc' | 'cabinet' | 'power_bus';
  target_id: string;
  total_channels_lost: number;
  protected_channels_count: number;
  tripped_channels_count: number;
  resilience_score_pct: number;
  resilience_rating: string;
  impact_summary: string;
  affected_signals: BlastRadiusSignal[];
}

export interface PreflightCheck {
  id: string;
  title: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  severity: 'INFO' | 'HIGH' | 'CRITICAL';
  summary: string;
  guide_reference: string;
  remedy?: string;
  affected_items?: string[];
}

export interface PreflightLintResponse {
  health_score: number;
  overall_status: 'EXCELLENT' | 'NEEDS_ATTENTION' | 'NON_COMPLIANT';
  critical_fails_count: number;
  warnings_count: number;
  total_checks: number;
  checks: PreflightCheck[];
}

export interface ScorecardItem {
  category: string;
  expected: number;
  actual: number;
  matched: boolean;
  notes: string;
}

export interface ReferenceScorecardResponse {
  reference_file: string;
  parity_score_pct: number;
  overall_status: string;
  matched_categories: number;
  total_categories: number;
  scorecard_items: ScorecardItem[];
}
