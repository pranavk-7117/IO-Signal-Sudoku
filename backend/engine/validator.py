import math
from typing import List, Dict, Set, Tuple, Optional, Any
from models import (
    HardwareConfigModel, SignalRecord, AssignmentModel,
    ValidationIssueModel, ValidationSummaryModel
)

class ValidationEngine:
    def __init__(self, config: HardwareConfigModel):
        self.config = config
        self.rules = config.rules
        self.compat_matrix = config.compatibility_matrix

    def validate_input_dataset(self, signals: List[SignalRecord]) -> List[ValidationIssueModel]:
        """
        Independently checks input dataset for completeness, tag uniqueness, valid signal types, and cable properties.
        """
        issues: List[ValidationIssueModel] = []
        issue_idx = 1

        tag_counts: Dict[str, int] = {}
        for s in signals:
            tag = (s.tag or "").strip()
            if tag:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        # Check 1: Unique signal tags
        for tag, count in tag_counts.items():
            if count > 1:
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-INP-{issue_idx:03d}",
                    severity="ERROR",
                    rule_name="Unique Signal Tagging",
                    affected_tags=[tag],
                    affected_hardware=None,
                    message=f"Signal Tag '{tag}' appears {count} times in the imported IO database. Industrial DCS requires globally unique signal tags.",
                    suggested_action="Deduplicate signal tags in customer IO list or add unique channel suffixes.",
                    blocks_approval=True
                ))
                issue_idx += 1

        # Check 2: Mandatory fields
        for s in signals:
            if not s.tag or not s.tag.strip():
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-INP-{issue_idx:03d}",
                    severity="ERROR",
                    rule_name="Mandatory Field Completeness",
                    affected_tags=["MISSING_TAG"],
                    affected_hardware=None,
                    message="Signal record has missing or empty Tag name.",
                    suggested_action="Provide a valid instrument or DCS tag name.",
                    blocks_approval=True
                ))
                issue_idx += 1

            if not s.signal_type or not s.signal_type.strip():
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-INP-{issue_idx:03d}",
                    severity="ERROR",
                    rule_name="Mandatory Field Completeness",
                    affected_tags=[s.tag or "UNKNOWN"],
                    affected_hardware=None,
                    message=f"Signal '{s.tag}' has no signal type specified (e.g. AI, AO, DI, DO).",
                    suggested_action="Assign valid signal type in the IO list mapping.",
                    blocks_approval=True
                ))
                issue_idx += 1

            # Cable pair number bounds
            if s.pair_number is not None and s.pair_number < 1:
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-INP-{issue_idx:03d}",
                    severity="ERROR",
                    rule_name="Cable Pair Bounds",
                    affected_tags=[s.tag or "UNKNOWN"],
                    affected_hardware=None,
                    message=f"Signal '{s.tag}' specifies an invalid pair number #{s.pair_number}. Pair numbers must be positive integers.",
                    suggested_action="Correct pair number in customer IO schedule.",
                    blocks_approval=True
                ))
                issue_idx += 1

            # Hardware compatibility check
            sig_type = (s.signal_type or "").upper().strip()
            if sig_type and sig_type not in self.compat_matrix:
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-INP-{issue_idx:03d}",
                    severity="ERROR",
                    rule_name="Hardware Type Compatibility",
                    affected_tags=[s.tag or "UNKNOWN"],
                    affected_hardware=None,
                    message=f"Signal '{s.tag}' type '{s.signal_type}' is not supported by DeltaV hardware catalogue.",
                    suggested_action="Update hardware catalogue compatibility matrix in Rules & Hardware page or correct IO type in source list.",
                    blocks_approval=True
                ))
                issue_idx += 1

        return issues

    def validate_assignments(
        self,
        signals: List[SignalRecord],
        assignments: List[AssignmentModel]
    ) -> List[ValidationIssueModel]:
        """
        Independently validates candidate allocations against hardware capacities, single occupancy,
        A/B redundancy CIOC segregation, cable continuity, and spare thresholds.
        """
        issues: List[ValidationIssueModel] = []
        issue_idx = 100

        # Build independent hardware slot occupancy lists
        # Address format: CAB-01/CIOC-01/BP-01/CH01
        slot_occupants: Dict[str, List[str]] = {}
        allocated_tags: Set[str] = set()

        for a in assignments:
            if a.status == "Allocated" and a.cabinet_id and a.cioc_id and a.baseplate_id and a.charm_index:
                addr = f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index:02d}"
                if addr not in slot_occupants:
                    slot_occupants[addr] = []
                slot_occupants[addr].append(a.tag)
                allocated_tags.add(a.tag)

                # Check slot capacity bounds
                if a.charm_index < 1 or a.charm_index > self.config.charms_per_baseplate:
                    issues.append(ValidationIssueModel(
                        issue_id=f"VAL-ASN-{issue_idx:03d}",
                        severity="ERROR",
                        rule_name="CHARM Slot Capacity Bounds",
                        affected_tags=[a.tag],
                        affected_hardware=addr,
                        message=f"Signal '{a.tag}' assigned to invalid CHARM slot #{a.charm_index}. Baseplate limit is {self.config.charms_per_baseplate} CHARMs.",
                        suggested_action=f"Reassign to valid slot between 1 and {self.config.charms_per_baseplate}.",
                        blocks_approval=True
                    ))
                    issue_idx += 1

        # Check: Single slot occupancy (collision detection)
        for addr, tags in slot_occupants.items():
            if len(tags) > 1:
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-ASN-{issue_idx:03d}",
                    severity="ERROR",
                    rule_name="Hardware Slot Single Occupancy",
                    affected_tags=tags,
                    affected_hardware=addr,
                    message=f"Hardware collision at {addr}: multiple signals allocated simultaneously: {', '.join(tags)}. Each CHARM accepts exactly 1 signal.",
                    suggested_action="Reallocate conflicting signals to free distinct CHARM slots.",
                    blocks_approval=True
                ))
                issue_idx += 1

        # Check: Unallocated signals
        for a in assignments:
            if a.status != "Allocated":
                is_blocking = (a.status == "Blocked")
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-ASN-{issue_idx:03d}",
                    severity="ERROR" if is_blocking else "WARNING",
                    rule_name="Complete Hardware Allocation",
                    affected_tags=[a.tag],
                    affected_hardware=None,
                    message=f"Signal '{a.tag}' is unallocated (Status: {a.status}). Reason: {a.reason or 'Unassigned'}",
                    suggested_action="Increase cabinet/baseplate capacity or resolve conflicting engineering constraints.",
                    blocks_approval=is_blocking
                ))
                issue_idx += 1

        # Check: Reserved spare capacity encroachment
        spare_slots_per_bp = max(1, int(math.ceil(self.config.charms_per_baseplate * (self.config.spare_percentage / 100.0)))) if self.config.spare_percentage > 0 else 0
        spare_threshold = self.config.charms_per_baseplate - spare_slots_per_bp

        for a in assignments:
            if a.status == "Allocated" and a.charm_index and a.charm_index > spare_threshold and spare_slots_per_bp > 0:
                addr = f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index:02d}"
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-ASN-{issue_idx:03d}",
                    severity="WARNING",
                    rule_name="Reserved Spare Capacity",
                    affected_tags=[a.tag],
                    affected_hardware=addr,
                    message=f"Signal '{a.tag}' occupies CHARM position #{a.charm_index}, which falls within the {self.config.spare_percentage}% reserved engineering spare threshold.",
                    suggested_action="Move signal to an unreserved CHARM slot or expand cabinet hardware count.",
                    blocks_approval=False
                ))
                issue_idx += 1

        # Check: A/B Redundancy CIOC Separation
        # CRITICAL RULE: Redundant A and B signals in same unit/equipment must NOT be on same CIOC
        if self.rules.enforce_ab_redundancy_separation:
            # Map: group_key -> {'A': [(tag, cab, cioc)], 'B': [(tag, cab, cioc)]}
            red_placements: Dict[str, Dict[str, List[Tuple[str, str, str]]]] = {}
            for a in assignments:
                if a.status == "Allocated" and a.redundancy in ["A", "B"] and a.cabinet_id and a.cioc_id:
                    r_key = a.logical_group or (a.tag.split("-")[0] if "-" in a.tag else "GLOBAL")
                    if r_key not in red_placements:
                        red_placements[r_key] = {"A": [], "B": []}
                    red_placements[r_key][a.redundancy].append((a.tag, a.cabinet_id, a.cioc_id))

            for r_key, channels in red_placements.items():
                a_list = channels["A"]
                b_list = channels["B"]
                for a_tag, a_cab, a_cioc in a_list:
                    for b_tag, b_cab, b_cioc in b_list:
                        # Violation if same cabinet AND same CIOC
                        if a_cab == b_cab and a_cioc == b_cioc:
                            issues.append(ValidationIssueModel(
                                issue_id=f"VAL-ASN-{issue_idx:03d}",
                                severity="ERROR",
                                rule_name="Redundancy Segregation (A/B)",
                                affected_tags=[a_tag, b_tag],
                                affected_hardware=f"{a_cab}/{a_cioc}",
                                message=f"Redundancy violation: Primary signal '{a_tag}' [Channel A] and Standby signal '{b_tag}' [Channel B] share the same controller I/O card ({a_cab}/{a_cioc}). A single card failure will disable both channels.",
                                suggested_action=f"Relocate one redundant channel to an alternate CIOC in {a_cab} or a separate cabinet.",
                                blocks_approval=True
                            ))
                            issue_idx += 1

        # Check: Multi-pair Cable Grouping & Pair Order
        cables: Dict[str, List[AssignmentModel]] = {}
        for a in assignments:
            if a.status == "Allocated" and a.cable_id and a.cable_id.strip():
                c_id = a.cable_id.strip()
                if c_id not in cables:
                    cables[c_id] = []
                cables[c_id].append(a)

        if self.rules.enforce_pair_order:
            for c_id, cable_assignments in cables.items():
                if len(cable_assignments) > 1:
                    # Sort by pair number
                    with_pair = [a for a in cable_assignments if a.pair_number is not None]
                    with_pair.sort(key=lambda x: x.pair_number)
                    for k in range(len(with_pair) - 1):
                        a1 = with_pair[k]
                        a2 = with_pair[k + 1]
                        # If on same baseplate, pair order should match charm order
                        if a1.cabinet_id == a2.cabinet_id and a1.cioc_id == a2.cioc_id and a1.baseplate_id == a2.baseplate_id:
                            if a1.pair_number < a2.pair_number and a1.charm_index >= a2.charm_index:
                                issues.append(ValidationIssueModel(
                                    issue_id=f"VAL-ASN-{issue_idx:03d}",
                                    severity="WARNING",
                                    rule_name="Cable Pair Sequence",
                                    affected_tags=[a1.tag, a2.tag],
                                    affected_hardware=f"{a1.cabinet_id}/{a1.cioc_id}/{a1.baseplate_id}",
                                    message=f"Cable '{c_id}' pair #{a1.pair_number} (CH{a1.charm_index:02d}) and pair #{a2.pair_number} (CH{a2.charm_index:02d}) violate sequential pair ordering on baseplate {a1.baseplate_id}.",
                                    suggested_action="Reorder CHARM positions to match field cable wire-pair numbering.",
                                    blocks_approval=False
                                ))
                                issue_idx += 1

        return issues

    def validate(
        self,
        signals: List[SignalRecord],
        assignments: List[AssignmentModel]
    ) -> ValidationSummaryModel:
        """
        Runs comprehensive, multi-phase independent validation.
        """
        input_issues = self.validate_input_dataset(signals)
        assignment_issues = self.validate_assignments(signals, assignments)

        all_issues = input_issues + assignment_issues

        allocated = len([a for a in assignments if a.status == "Allocated"])
        unallocated = len(assignments) - allocated

        errors = len([i for i in all_issues if i.severity == "ERROR"])
        warnings = len([i for i in all_issues if i.severity == "WARNING"])
        infos = len([i for i in all_issues if i.severity == "INFO"])

        # Fully validated iff no blocking errors
        is_fully_validated = (errors == 0 and unallocated == 0)

        return ValidationSummaryModel(
            total_signals=len(signals),
            allocated_count=allocated,
            unallocated_count=unallocated,
            error_count=errors,
            warning_count=warnings,
            info_count=infos,
            is_fully_validated=is_fully_validated,
            issues=all_issues
        )
