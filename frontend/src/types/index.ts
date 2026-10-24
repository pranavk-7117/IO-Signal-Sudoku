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
  charm_part_no?: string;
  charm_tb_part_no?: string;
  charm_tb_terminals?: string;
  loop_name?: string;
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
  priority?: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_ADVISORY';
  priority_label?: string;
  impact_score?: number;
  impact_description?: string;
  recommended_remedy?: string;
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
  p1_count?: number;
  p2_count?: number;
  p3_count?: number;
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
  priority?: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_ADVISORY';
  priority_label?: string;
  impact_score?: number;
  impact_description?: string;
  recommended_remedy?: string;
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

export interface PreprocessingAnalysisResponse {
  total_signals_received: number;
  deleted_signals_vacated: number;
  internal_alarms_preassigned: number;
  pinned_revision_signals_frozen: number;
  active_signals_fed_to_solver: number;
  solver_search_space_reduction_pct: number;
  technical_room_partitions: Record<string, number>;
  conflict_graph: {
    node_count: number;
    edge_count: number;
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      redundancy: string;
      technical_room: string;
      signal_count: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
      weight: number;
    }>;
  };
}

export interface ParetoAlternative {
  id: string;
  name: string;
  badge: string;
  badge_color: 'emerald' | 'blue' | 'purple' | 'amber';
  summary: string;
  boq: {
    system_cabinets: number;
    marshalling_cabinets: number;
    controllers: number;
    cioc_carriers: number;
    baseplates: number;
    total_channels: number;
    operating_signals: number;
    cabinet_alarms: number;
    wired_spares: number;
    spare_slots_covers: number;
  };
  metrics: {
    estimated_hardware_cost_usd: number;
    overall_footprint_sqm: number;
    spare_capacity_pct: number;
    resilience_score: number;
    expansion_flexibility: string;
    recommended_for: string;
  };
  pros: string[];
  cons: string[];
}

export interface ParetoResponse {
  dataset_signals_count: number;
  alternatives: ParetoAlternative[];
}

export interface WiredSpareTakeoverMatch {
  new_signal_tag: string;
  signal_type: string;
  description: string;
  target_wired_spare_tag: string;
  controller: string;
  cabinet_id: string;
  cioc_id: string;
  baseplate_id: string;
  channel_no: number;
  charm_type: string;
  terminal_block: string;
  hardware_cost_delta_usd: number;
  status: string;
  engineering_rationale: string;
}

export interface WiredSpareTakeoverResponse {
  total_new_signals_evaluated: number;
  wired_spares_taken_over_count: number;
  unmatched_signals_requiring_new_slots: number;
  total_hardware_cost_saved_usd: number;
  takeover_matches: WiredSpareTakeoverMatch[];
  takeover_summary: string;
}

export interface TerminationRow {
  pair_number: number;
  wire_color_pos: string;
  wire_color_neg: string;
  signal_tag: string;
  description: string;
  signal_type: string;
  terminal_block: string;
  terminals: string;
  hardware_address: string;
  loop_name: string;
}

export interface TerminationSchedule {
  cable_id: string;
  total_pairs: number;
  technical_room: string;
  termination_rows: TerminationRow[];
}

export interface CableScheduleItem {
  cable_id: string;
  technical_room: string;
  destination_cabinet: string;
  cable_size_pairs: number;
  pairs_used: number;
  pairs_spare: number;
  utilisation_pct: number;
  cable_type: string;
  status: string;
}

export interface LoopCheckSheetItem {
  sheet_id: string;
  loop_name: string;
  tag: string;
  description: string;
  signal_type: string;
  calibrated_range: string;
  hardware_location: string;
  charm_module: string;
  terminal_block: string;
  loop_check_status: string;
  checked_by: string;
  date: string;
}

export interface DeliverablesPackResponse {
  project_name: string;
  revision_code: string;
  generated_timestamp: string;
  termination_schedules: TerminationSchedule[];
  master_cable_schedule: CableScheduleItem[];
  loop_check_sheets: LoopCheckSheetItem[];
  total_loops_count: number;
  fat_checklist: Array<{
    section: string;
    item: string;
    requirement: string;
    status: string;
    verified_by: string;
  }>;
}

export interface FieldQRLabel {
  label_id: string;
  cabinet: string;
  cioc: string;
  baseplate: string;
  technical_room: string;
  assigned_signals_count: number;
  qr_payload: string;
  channels: Array<{
    channel: number;
    tag: string;
    signal_type: string;
    cable_id: string;
    pair: number;
    is_spare: boolean;
  }>;
}
