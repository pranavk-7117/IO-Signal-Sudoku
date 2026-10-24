from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

# --- Project Models ---
class ProjectBase(BaseModel):
    project_id: str = Field(..., description="Unique industrial project identifier, e.g. PRJ-DELTA-01")
    name: str = Field(..., description="Project name")
    customer_name: str = Field(..., description="Customer / Plant client")
    description: Optional[str] = ""
    system: str = Field(default="DeltaV v14.3 / CHARMs IO", description="Target DCS System")

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    customer_name: Optional[str] = None
    description: Optional[str] = None
    system: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    current_revision: str
    status: str
    created_at: str
    updated_at: str
    signal_count: int = 0
    allocated_count: int = 0
    validation_errors_count: int = 0
    open_tqs_count: int = 0

# --- Revision Models ---
class RevisionCreate(BaseModel):
    revision_code: str = Field(..., description="Rev identifier, e.g. Rev A, Rev B")
    description: Optional[str] = ""

class RevisionResponse(BaseModel):
    id: int
    project_id: int
    revision_code: str
    description: str
    source_filename: Optional[str] = None
    template_filename: Optional[str] = None
    created_at: str
    is_active: bool = False

# --- Hardware & Rule Configuration Models ---
class ProjectRuleModel(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    enabled: bool = True
    kind: str = "charm_terminal_map"
    severity: str = "hard"
    weight: int = 100
    scope: str = "signal"
    is_custom: bool = False
    target_column: Optional[str] = "signal_type"
    operator: Optional[str] = "equals"
    match_value: Optional[str] = ""
    target_charm: Optional[str] = ""
    target_charm_part: Optional[str] = ""
    target_terminal: Optional[str] = ""
    target_terminal_part: Optional[str] = ""
    target_terminals: Optional[str] = ""
    params: Dict[str, Any] = Field(default_factory=dict)

class RuleConfigModel(BaseModel):
    enforce_logical_grouping: bool = True
    enforce_ab_redundancy_separation: bool = True
    enforce_cable_grouping: bool = True
    enforce_pair_order: bool = True
    spare_percentage: float = 10.0
    spare_baseplate_percent: float = 0.0  # percentage of reserved CHARMs
    allow_cross_baseplate_cables: bool = False
    prioritize_cabinet_packing: bool = True
    preserve_previous_assignments: bool = True
    reserve_first_baseplate_for_cabinet_alarms: bool = True
    custom_rules: List[Dict[str, Any]] = Field(default_factory=list)

class HardwareConfigModel(BaseModel):
    cabinets_count: int = 3
    ciocs_per_cabinet: int = 4
    baseplates_per_cioc: int = 8
    charms_per_baseplate: int = 12
    spare_percentage: float = 10.0
    spare_baseplate_percent: float = 0.0
    rules: RuleConfigModel = Field(default_factory=RuleConfigModel)
    custom_rules: List[Dict[str, Any]] = Field(default_factory=list)
    rules_override: Optional[Dict[str, Any]] = None
    compatibility_matrix: Dict[str, Dict[str, str]] = Field(default_factory=lambda: {
        "AI": {"charm": "AI 4-20 MA HART CHARM", "charm_part": "SE4303T01", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "AIR": {"charm": "AI 4-20 MA HART CHARM", "charm_part": "SE4303T01", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "AIR-RTD": {"charm": "RTD Input Charm", "charm_part": "SE4303T03", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2, 4"},
        "AIR-4WIRE": {"charm": "AI 4-20 MA HART CHARM", "charm_part": "SE4303T01", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "-, 2, 4"},
        "AO": {"charm": "AO 4-20 MA HART CHARM", "charm_part": "SE4304T01", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "AOR": {"charm": "AO 4-20 MA HART CHARM", "charm_part": "SE4304T01", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "DI": {"charm": "DISCRETE INPUT CHARM; 24 VDC DRY CONTACT: LOW SIDE SENSE", "charm_part": "SE4301T02", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "DIR": {"charm": "DISCRETE INPUT CHARM; 24 VDC DRY CONTACT: LOW SIDE SENSE", "charm_part": "SE4301T02", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "DO": {"charm": "DISCRETE OUTPUT CHARM; 24 VDC; HIGH SIDE", "charm_part": "SE4302T01", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "DOR": {"charm": "DISCRETE OUTPUT CHARM; 24 VDC; HIGH SIDE", "charm_part": "SE4302T01", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "DO-SOV": {"charm": "DO 24V DC Isolated", "charm_part": "SE4302T02", "terminal": "Fused-Injected-Power Terminal Block", "terminal_part": "SE4502", "terminals": "-, 2, 4"},
        "DOR-SOV": {"charm": "DO 24V DC Isolated", "charm_part": "SE4302T02", "terminal": "Fused-Injected-Power Terminal Block", "terminal_part": "SE4502", "terminals": "-, 2, 4"},
        "RTD": {"charm": "RTD Input Charm", "charm_part": "SE4303T03", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2, 4"},
        "TC": {"charm": "Thermocouple / mV CHARM", "charm_part": "SE4303T02", "terminal": "TC Cold-Junction Terminal Block", "terminal_part": "SE4501", "terminals": "1, 2"},
        "SPARE": {"charm": "CHARM PROTECTION COVER", "charm_part": "SE6103", "terminal": "Standard CHARM Terminal Block", "terminal_part": "SE4501", "terminals": "-"}
    })

# --- Signal Import & Mapping Models ---
class ColumnMappingRequest(BaseModel):
    sheet_name: str
    mappings: Dict[str, str]  # target_field -> source_column_name

class SheetInspectResponse(BaseModel):
    filename: str
    file_size_kb: float
    sheets: List[str]
    sheet_data_preview: Dict[str, List[Dict[str, Any]]]
    sheet_headers: Dict[str, List[str]]
    suggested_mappings: Dict[str, str]

class SignalRecord(BaseModel):
    id: Optional[int] = None
    tag: str
    description: Optional[str] = ""
    signal_type: str
    signal_level: Optional[str] = ""
    electrical_spec: Optional[str] = ""
    instrument_type: Optional[str] = ""
    external_power: Optional[str] = ""
    cable_id: Optional[str] = ""
    pair_number: Optional[int] = None
    redundancy: Optional[str] = ""  # 'A', 'B', 'A-CONTROL', etc.
    logical_group: Optional[str] = ""
    segregation: Optional[str] = ""
    service_id: Optional[str] = ""
    operating_area: Optional[str] = ""
    technical_room: Optional[str] = ""
    loop_name: Optional[str] = ""
    tag_status: Optional[str] = "Field"
    existing_cabinet: Optional[str] = None
    existing_cioc: Optional[str] = None
    existing_baseplate: Optional[str] = None
    existing_channel: Optional[int] = None
    existing_charm: Optional[int] = None
    existing_terminal: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    is_valid: bool = True
    validation_errors: Optional[List[str]] = None

# --- Allocation Models ---
class AllocationRunRequest(BaseModel):
    project_id: int
    revision_id: int
    preserve_existing: bool = True
    timeout_seconds: int = 15

class AssignmentModel(BaseModel):
    id: Optional[int] = None
    signal_id: Optional[int] = None
    tag: str
    description: str = ""
    signal_type: str
    cable_id: str = ""
    pair_number: Optional[int] = None
    redundancy: str = ""
    logical_group: str = ""

    # Industrial 76-column fields:
    sr_no: Optional[int] = None
    revision_no: Optional[str] = "00"
    technical_room: Optional[str] = None
    operating_area: Optional[str] = None
    risk_area: Optional[str] = None
    unit: Optional[str] = None
    segregation: Optional[str] = None
    dst_name: Optional[str] = None
    service_description: Optional[str] = None
    location: Optional[str] = None
    signal_level: Optional[str] = None
    non_is_is: Optional[str] = None
    equipment_name: Optional[str] = None
    external_power: Optional[str] = None
    system_cabinet: Optional[str] = None
    controller: Optional[str] = None
    electronic_marshalling_cabinet: Optional[str] = None
    cioc_id: Optional[str] = None
    baseplate_id: Optional[str] = None
    channel_no: Optional[int] = None
    charm_index: Optional[int] = None  # 1..12
    charm_no: Optional[int] = None      # 1..96 per CIOC
    charm_part_no: Optional[str] = None
    charm_type: Optional[str] = None
    charm_description: Optional[str] = None
    charm_tb_part_no: Optional[str] = None
    charm_tb_description: Optional[str] = None
    terminal_block: Optional[str] = None
    charm_tb_terminals: Optional[str] = None
    charm_tb1: Optional[str] = None
    charm_tb2: Optional[str] = None
    charm_tb3: Optional[str] = None
    charm_baseplate_adapter: Optional[str] = None
    m_fta: Optional[str] = None
    m_fta_part_no: Optional[str] = None
    m_fta_tb: Optional[str] = None
    m_fta_tb1: Optional[str] = None
    m_fta_tb2: Optional[str] = None
    m_fta_tb3: Optional[str] = None
    m_tb: Optional[str] = None
    m_tb1: Optional[str] = None
    m_tb2: Optional[str] = None
    m_tb3: Optional[str] = None
    irc_aux_cabinet: Optional[str] = None
    irc_tb: Optional[str] = None
    irc_tb1: Optional[str] = None
    irc_tb2: Optional[str] = None
    relay_splitter: Optional[str] = None
    relay_coil_a1: Optional[str] = None
    relay_coil_a2: Optional[str] = None
    relay_contact_pos: Optional[str] = None
    relay_contact_neg: Optional[str] = None
    field_cable_no: Optional[str] = None
    field_cable_size: Optional[str] = None
    field_cable_pair: Optional[str] = None
    irc_ftb: Optional[str] = None
    irc_ftb1: Optional[str] = None
    irc_ftb2: Optional[str] = None
    elec_cable_no: Optional[str] = None
    elec_cable_size: Optional[str] = None
    elec_cable_pair: Optional[str] = None
    tag_status: str = "Field"  # Field, Cabinet Alarm, Wired Spare, Spare Slot, Deleted
    remarks: Optional[str] = None
    batch: Optional[str] = None
    hw_loop_typical: Optional[str] = None
    system_2: Optional[str] = None
    old_tag: Optional[str] = None
    instrument_type: Optional[str] = None
    fta_cable_name: Optional[str] = None
    fta_cable_ferrule_name: Optional[str] = None
    cabinet_side: Optional[str] = "F"
    change_type: Optional[str] = "-"
    cabinet_name_viz: Optional[str] = None
    splitter_relay_pwr_tb_pos: Optional[str] = None
    splitter_relay_pwr_tb_neg: Optional[str] = None
    loop_name: Optional[str] = None
    section_sub_unit: Optional[str] = None
    custom_attributes: Dict[str, Any] = Field(default_factory=dict)

    cabinet_id: Optional[str] = None
    status: str = "Pending"  # Allocated, Pending, Needs Review, Blocked, Spare, Deleted
    reason: Optional[str] = None
    is_manual_override: bool = False

class AssignmentUpdateModel(BaseModel):
    cabinet_id: str
    cioc_id: str
    baseplate_id: str
    charm_index: int
    terminal_block: Optional[str] = None
    notes: Optional[str] = None

# --- Validation Models ---
class ValidationIssueModel(BaseModel):
    id: Optional[int] = None
    issue_id: str
    severity: str  # ERROR, WARNING, INFO
    rule_name: str
    affected_tags: List[str]
    affected_hardware: Optional[str] = None
    message: str
    suggested_action: str
    blocks_approval: bool
    priority: str = "P2_HIGH"  # P1_CRITICAL, P2_HIGH, P3_ADVISORY
    priority_label: str = "P2 - Commercial and Spares Risk"
    impact_score: int = 75
    impact_description: Optional[str] = None
    recommended_remedy: Optional[str] = None

class ValidationSummaryModel(BaseModel):
    total_signals: int
    allocated_count: int
    unallocated_count: int
    error_count: int
    warning_count: int
    info_count: int
    is_fully_validated: bool
    issues: List[ValidationIssueModel]
    p1_count: int = 0
    p2_count: int = 0
    p3_count: int = 0

# --- Technical Query Models ---
class TQCreateModel(BaseModel):
    project_id: int
    revision_id: int
    category: str  # Capacity, Redundancy, Signal Compatibility, Missing Information, Cable Continuity
    description: str
    root_cause: str
    specific_clarification: str
    suggested_action: str
    affected_tags: List[str]
    status: str = "Open"  # Open, In Review, Resolved, Closed
    priority: str = "P2_HIGH"
    priority_label: str = "P2 - Commercial and Spares Risk"
    impact_score: int = 75
    impact_description: Optional[str] = None
    recommended_remedy: Optional[str] = None

class TQUpdateModel(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None

class TQResponseModel(BaseModel):
    id: int
    tq_code: str
    project_id: int
    revision_id: int
    category: str
    description: str
    root_cause: str
    specific_clarification: str
    suggested_action: str
    status: str
    resolution_notes: Optional[str] = ""
    affected_tags: List[str]
    created_at: str
    updated_at: str
    priority: str = "P2_HIGH"
    priority_label: str = "P2 - Commercial and Spares Risk"
    impact_score: int = 75
    impact_description: Optional[str] = None
    recommended_remedy: Optional[str] = None

# --- Revision Diff Models ---
class RevisionDiffItem(BaseModel):
    tag: str
    change_type: str  # ADDED, DELETED, MODIFIED, UNCHANGED
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    old_assignment: Optional[str] = None
    new_assignment: Optional[str] = None
    movement_status: str  # PRESERVED, MOVED, UNALLOCATED, NEW
    movement_reason: Optional[str] = None

class RevisionComparisonResponse(BaseModel):
    base_revision: str
    target_revision: str
    total_added: int
    total_deleted: int
    total_modified: int
    total_unchanged: int
    total_preserved_assignments: int
    total_moved_assignments: int
    diff_records: List[RevisionDiffItem]

# --- Utilisation Models ---
class CharmSlotModel(BaseModel):
    charm_index: int
    is_allocated: bool
    is_spare: bool
    signal_tag: Optional[str] = None
    signal_type: Optional[str] = None
    charm_type: Optional[str] = None
    terminal_block: Optional[str] = None

class BaseplateUtilisationModel(BaseModel):
    baseplate_id: str
    total_slots: int
    used_slots: int
    reserved_spare_slots: int
    free_slots: int
    slots: List[CharmSlotModel]

class CIOCUtilisationModel(BaseModel):
    cioc_id: str
    cabinet_id: str
    total_baseplates: int
    used_baseplates: int
    total_slots: int
    used_slots: int
    reserved_spare_slots: int
    free_slots: int
    utilization_pct: float
    baseplates: List[BaseplateUtilisationModel]

class CabinetUtilisationModel(BaseModel):
    cabinet_id: str
    total_ciocs: int
    used_ciocs: int
    total_slots: int
    used_slots: int
    reserved_spare_slots: int
    free_slots: int
    utilization_pct: float
    ciocs: List[CIOCUtilisationModel]

class UtilisationSummaryModel(BaseModel):
    total_cabinets: int
    used_cabinets: int
    total_ciocs: int
    used_ciocs: int
    total_baseplates: int
    used_baseplates: int
    total_charm_positions: int
    allocated_signals: int
    unallocated_signals: int
    reserved_spare_positions: int
    free_unreserved_positions: int
    overall_utilisation_pct: float
    spare_capacity_achieved_pct: float
    cabinets: List[CabinetUtilisationModel]

# --- Audit Log Model ---
class AuditLogModel(BaseModel):
    id: int
    project_id: int
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    user_name: str
    created_at: str


# --- Solver & Approval Gate Models ---
class SolverDiagnostics(BaseModel):
    solver_name: str = "Google OR-Tools CP-SAT"
    solver_status: str  # OPTIMAL, FEASIBLE, INFEASIBLE, MODEL_INVALID, UNKNOWN
    is_optimal: bool = False
    solve_time_seconds: float = 0.0
    objective_value: Optional[float] = None
    num_decision_variables: int = 0
    num_constraints: int = 0
    details: Dict[str, Any] = Field(default_factory=dict)

class AllocationRunResult(BaseModel):
    message: str
    total_signals: int
    allocated_count: int
    unallocated_count: int
    validation_errors: int
    validation_warnings: int
    is_fully_validated: bool
    approval_eligible: bool
    diagnostics: SolverDiagnostics

class ApprovalRequest(BaseModel):
    project_id: int
    revision_id: int
    reviewer_name: str = "Lead DCS Engineer"
    notes: Optional[str] = ""

class ApprovalResponse(BaseModel):
    project_id: int
    revision_id: int
    is_approved: bool
    approval_status: str  # Approved, Rejected, Pending Validation
    approval_timestamp: Optional[str] = None
    blocking_issues_count: int = 0
    blocking_reasons: List[str] = Field(default_factory=list)
    validator_summary: Optional[Dict[str, Any]] = None


# --- Risk Assessment & Rule Recommendation Models ---
class RiskFactorModel(BaseModel):
    id: str
    category: str  # segregation, electrical, spares, cables, density
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    score: int
    title: str
    description: str
    affected_items: List[str] = Field(default_factory=list)

class RuleSuggestionModel(BaseModel):
    id: str
    title: str
    category: str
    risk_reduction_pts: int
    description: str
    rule_target: str
    suggested_value: Any
    can_auto_apply: bool = True
    applied: bool = False

class RiskAssessmentResponse(BaseModel):
    overall_score: int  # 0 to 100
    risk_level: str     # LOW, MEDIUM, HIGH, CRITICAL
    risk_color: str     # emerald, amber, rose, purple
    summary: str
    factors: List[RiskFactorModel] = Field(default_factory=list)
    suggestions: List[RuleSuggestionModel] = Field(default_factory=list)

class ApplySuggestionRequest(BaseModel):
    suggestion_id: str
    rule_target: str
    suggested_value: Any

# --- Chatbot / LLM Assistant Models ---
class ChatMessage(BaseModel):
    role: str  # user, assistant, system
    content: str
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    project_id: Optional[int] = None
    revision_id: Optional[int] = None
    messages: List[ChatMessage]
    context_page: Optional[str] = "general"
    selected_tag: Optional[str] = None

class ChatResponse(BaseModel):
    message: ChatMessage
    suggested_actions: Optional[List[Dict[str, Any]]] = None
    model_used: Optional[str] = "groq-qwen-27b"
    action_proposal: Optional[Dict[str, Any]] = None

class ChatActionApplyRequest(BaseModel):
    project_id: int
    revision_id: int
    action_proposal: Dict[str, Any]
    user_name: Optional[str] = "Lead DCS Engineer"
