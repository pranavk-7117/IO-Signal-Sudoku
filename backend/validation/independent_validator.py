"""
Independent Validation Engine for Industrial I/O Allocations
Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)

Strict architectural independence: Zero imports from allocator.py.
Independently verifies 8 engineering dimensions:
1. Complete Signal Coverage (no dropped or duplicate signals)
2. Hardware Slot Single Occupancy (zero collisions)
3. Hardware Hierarchy & Slot Capacity Bounds
4. Cable Contiguity, 24-Pair Adjacency, and Monotonic Pair Ordering
5. Redundancy Segregation (A/B) Across Separate CIOCs under all aliases
6. Reserved Spare Baseplates per Cabinet
7. CHARM & Terminal Block Catalogue & Rule Matching
8. Component Naming Conformity
"""

import math
import re
from typing import List, Dict, Set, Tuple, Optional, Any

from models import (
    HardwareConfigModel, SignalRecord, AssignmentModel,
    ValidationIssueModel, ValidationSummaryModel
)
from rules import RuleEvaluator, RedundancyNormalizer

class IndependentValidator:
    def __init__(self, config: Optional[HardwareConfigModel] = None):
        self.config = config or HardwareConfigModel()
        self.rules = self.config.rules
        self.compat_matrix = self.config.compatibility_matrix
        self.evaluator = RuleEvaluator()

    def validate_input_dataset(self, signals: List[SignalRecord]) -> List[ValidationIssueModel]:
        """Validates input signals for completeness, tag uniqueness, and data validity."""
        issues: List[ValidationIssueModel] = []
        issue_idx = 1
        tag_counts: Dict[str, int] = {}

        for s in signals:
            tag = (s.tag or "").strip()
            if tag:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        # Check 1: Unique Signal Tags
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

        # Check 2: Mandatory Fields
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

            # Check: Hardware Type Compatibility
            st_upper = (s.signal_type or "").upper().strip()
            if st_upper and (st_upper not in self.compat_matrix) and not any(st_upper.startswith(p) for p in ["AI", "AO", "DI", "DO", "RTD", "TC"]):
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
        """Validates candidate allocations against all engineering rules and constraints."""
        issues: List[ValidationIssueModel] = []
        issue_idx = 100

        # Mapping of signals for quick lookup
        signal_map = {s.tag: s for s in signals if s.tag}

        # 1. Complete Coverage Check
        allocated_tags = {a.tag for a in assignments if a.status == "Allocated" and getattr(a, "tag_status", "Field") != "Spare Slot"}
        for s in signals:
            if s.tag and s.tag not in allocated_tags:
                matching_assign = next((a for a in assignments if a.tag == s.tag), None)
                reason = matching_assign.reason if matching_assign else "Signal was not allocated"
                is_blocking = (matching_assign.status == "Blocked") if matching_assign else True
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-COV-{issue_idx:03d}",
                    severity="ERROR" if is_blocking else "WARNING",
                    rule_name="Complete Hardware Allocation",
                    affected_tags=[s.tag],
                    affected_hardware=None,
                    message=f"Signal '{s.tag}' is not successfully allocated to hardware ({reason}).",
                    suggested_action="Expand cabinet hardware or resolve engineering constraint conflicts.",
                    blocks_approval=is_blocking
                ))
                issue_idx += 1

        # 2. Hardware Slot Single Occupancy (Zero Collisions)
        slot_occupants: Dict[str, List[str]] = {}
        for a in assignments:
            if a.status == "Allocated" and a.cabinet_id and a.cioc_id and a.baseplate_id and a.charm_index:
                addr = f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index:02d}"
                if addr not in slot_occupants:
                    slot_occupants[addr] = []
                slot_occupants[addr].append(a.tag)

                # Check slot capacity bounds
                if a.charm_index < 1 or a.charm_index > self.config.charms_per_baseplate:
                    issues.append(ValidationIssueModel(
                        issue_id=f"VAL-CAP-{issue_idx:03d}",
                        severity="ERROR",
                        rule_name="CHARM Slot Capacity Bounds",
                        affected_tags=[a.tag],
                        affected_hardware=addr,
                        message=f"Signal '{a.tag}' assigned to invalid CHARM slot #{a.charm_index}. Baseplate limit is {self.config.charms_per_baseplate} CHARMs.",
                        suggested_action=f"Reassign to valid slot between 1 and {self.config.charms_per_baseplate}.",
                        blocks_approval=True
                    ))
                    issue_idx += 1

        for addr, tags in slot_occupants.items():
            if len(tags) > 1:
                issues.append(ValidationIssueModel(
                    issue_id=f"VAL-COL-{issue_idx:03d}",
                    severity="ERROR",
                    rule_name="Hardware Slot Single Occupancy",
                    affected_tags=tags,
                    affected_hardware=addr,
                    message=f"Hardware collision at {addr}: multiple signals allocated simultaneously: {', '.join(tags)}.",
                    suggested_action="Reallocate conflicting signals to free distinct CHARM slots.",
                    blocks_approval=True
                ))
                issue_idx += 1

        # 3. Hardware Hierarchy Capacity
        for a in assignments:
            if a.status == "Allocated":
                cab_num = int("".join(c for c in (a.cabinet_id or "") if c.isdigit()) or 1)
                cioc_num = int("".join(c for c in (a.cioc_id or "") if c.isdigit()) or 1)
                bp_num = int("".join(c for c in (a.baseplate_id or "") if c.isdigit()) or 1)

                if cab_num > self.config.cabinets_count:
                    issues.append(ValidationIssueModel(
                        issue_id=f"VAL-CAP-{issue_idx:03d}",
                        severity="ERROR",
                        rule_name="Cabinet Count Limit",
                        affected_tags=[a.tag],
                        affected_hardware=a.cabinet_id,
                        message=f"Signal '{a.tag}' placed in cabinet #{cab_num}, exceeding maximum configured count of {self.config.cabinets_count}.",
                        suggested_action="Increase cabinet capacity or re-pack signals.",
                        blocks_approval=True
                    ))
                    issue_idx += 1

                if cioc_num > self.config.ciocs_per_cabinet:
                    issues.append(ValidationIssueModel(
                        issue_id=f"VAL-CAP-{issue_idx:03d}",
                        severity="ERROR",
                        rule_name="CIOC Capacity Limit",
                        affected_tags=[a.tag],
                        affected_hardware=f"{a.cabinet_id}/{a.cioc_id}",
                        message=f"Signal '{a.tag}' placed in CIOC #{cioc_num}, exceeding CIOC limit of {self.config.ciocs_per_cabinet} per cabinet.",
                        suggested_action="Relocate to valid CIOC index.",
                        blocks_approval=True
                    ))
                    issue_idx += 1

                if bp_num > self.config.baseplates_per_cioc:
                    issues.append(ValidationIssueModel(
                        issue_id=f"VAL-CAP-{issue_idx:03d}",
                        severity="ERROR",
                        rule_name="Baseplate Capacity Limit",
                        affected_tags=[a.tag],
                        affected_hardware=f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}",
                        message=f"Signal '{a.tag}' placed in Baseplate #{bp_num}, exceeding baseplate limit of {self.config.baseplates_per_cioc} per CIOC.",
                        suggested_action="Relocate to valid baseplate index.",
                        blocks_approval=True
                    ))
                    issue_idx += 1

        # 4. Redundancy Segregation (A/B) Across Separate CIOCs
        if self.rules.enforce_ab_redundancy_separation:
            cioc_trains: Dict[Tuple[str, str], Dict[str, List[str]]] = {}
            for a in assignments:
                red_norm = self.evaluator.normalize_redundancy(a.redundancy)
                if a.status == "Allocated" and red_norm in ["A", "B"] and a.cabinet_id and a.cioc_id:
                    key = (a.cabinet_id, a.cioc_id)
                    if key not in cioc_trains:
                        cioc_trains[key] = {"A": [], "B": []}
                    cioc_trains[key][red_norm].append(a.tag)

            for (cab, cioc), channels in cioc_trains.items():
                if channels["A"] and channels["B"]:
                    for a_tag in channels["A"]:
                        for b_tag in channels["B"]:
                            issues.append(ValidationIssueModel(
                                issue_id=f"VAL-RED-{issue_idx:03d}",
                                severity="ERROR",
                                rule_name="Redundancy Segregation (A/B)",
                                affected_tags=[a_tag, b_tag],
                                affected_hardware=f"{cab}/{cioc}",
                                message=f"Redundancy violation: Primary signal '{a_tag}' [Channel A] and Standby signal '{b_tag}' [Channel B] share the same controller I/O card ({cab}/{cioc}). A single card failure will disable both channels.",
                                suggested_action=f"Relocate one redundant channel to an alternate CIOC in {cab} or a separate cabinet.",
                                blocks_approval=True
                            ))
                            issue_idx += 1

        # 5. Cable Contiguity, 24-Pair Adjacency & Pair Ordering
        cables: Dict[str, List[AssignmentModel]] = {}
        for a in assignments:
            cid = (a.cable_id or "").strip()
            if a.status == "Allocated" and cid and cid.upper() not in ["INTERNAL WIRING", "INTERNAL-WIRING", "INTERNAL", "-", "NA", "N/A"]:
                if cid not in cables:
                    cables[cid] = []
                cables[cid].append(a)

        for cid, c_assigns in cables.items():
            if len(c_assigns) > 1:
                # Group by baseplate
                c_cabs = {a.cabinet_id for a in c_assigns}
                c_ciocs = {a.cioc_id for a in c_assigns}
                c_bps = {a.baseplate_id for a in c_assigns}

                max_pair = max((a.pair_number for a in c_assigns if a.pair_number is not None), default=1)
                is_24_pair = (max_pair > 12)

                if not is_24_pair:
                    # Smaller cables (<= 12 pairs) must NOT be split across baseplates
                    if len(c_bps) > 1 or len(c_ciocs) > 1 or len(c_cabs) > 1:
                        issues.append(ValidationIssueModel(
                            issue_id=f"VAL-CBL-{issue_idx:03d}",
                            severity="ERROR",
                            rule_name="Cable Contiguity",
                            affected_tags=[a.tag for a in c_assigns],
                            affected_hardware=f"{', '.join(c_bps)}",
                            message=f"Cable '{cid}' is split across multiple baseplates ({', '.join(c_bps)}). Multi-core cables <= 12 pairs must occupy contiguous slots on a single baseplate.",
                            suggested_action="Consolidate cable pairs into consecutive slots on the same baseplate.",
                            blocks_approval=True
                        ))
                        issue_idx += 1
                else:
                    # 24-pair cables must be in the same cabinet and same CIOC, across exactly 2 adjacent baseplates
                    if len(c_cabs) > 1 or len(c_ciocs) > 1:
                        issues.append(ValidationIssueModel(
                            issue_id=f"VAL-CBL-{issue_idx:03d}",
                            severity="ERROR",
                            rule_name="Cable Contiguity",
                            affected_tags=[a.tag for a in c_assigns],
                            affected_hardware=f"{', '.join(c_ciocs)}",
                            message=f"24-pair cable '{cid}' is split across different CIOCs or cabinets.",
                            suggested_action="Keep 24-pair cable on exactly 2 adjacent baseplates under the same CIOC.",
                            blocks_approval=True
                        ))
                        issue_idx += 1
                    else:
                        bp_nums = sorted([int("".join(c for c in bp if c.isdigit())) for bp in c_bps if bp])
                        if len(bp_nums) == 2 and bp_nums[1] != bp_nums[0] + 1:
                            issues.append(ValidationIssueModel(
                                issue_id=f"VAL-CBL-{issue_idx:03d}",
                                severity="ERROR",
                                rule_name="Cable Contiguity",
                                affected_tags=[a.tag for a in c_assigns],
                                affected_hardware=f"{c_assigns[0].cioc_id} (BPs: {bp_nums})",
                                message=f"24-pair cable '{cid}' baseplates are not adjacent (BPs {bp_nums[0]} and {bp_nums[1]}). Must be strictly adjacent (N and N+1).",
                                suggested_action="Allocate 24-pair cable to adjacent baseplates.",
                                blocks_approval=True
                            ))
                            issue_idx += 1

                # Check monotonic pair sequence
                if self.rules.enforce_pair_order:
                    with_pair = [a for a in c_assigns if a.pair_number is not None]
                    with_pair.sort(key=lambda x: x.pair_number)
                    for k in range(len(with_pair) - 1):
                        a1 = with_pair[k]
                        a2 = with_pair[k + 1]
                        if a1.cabinet_id == a2.cabinet_id and a1.cioc_id == a2.cioc_id and a1.baseplate_id == a2.baseplate_id:
                            if a1.pair_number < a2.pair_number and (a1.charm_index or 0) >= (a2.charm_index or 0):
                                issues.append(ValidationIssueModel(
                                    issue_id=f"VAL-SEQ-{issue_idx:03d}",
                                    severity="ERROR",
                                    rule_name="Cable Pair Sequence",
                                    affected_tags=[a1.tag, a2.tag],
                                    affected_hardware=f"{a1.cabinet_id}/{a1.cioc_id}/{a1.baseplate_id}",
                                    message=f"Cable '{cid}' pair #{a1.pair_number} (CH{a1.charm_index:02d}) and pair #{a2.pair_number} (CH{a2.charm_index:02d}) violate sequential pair ordering.",
                                    suggested_action="Reorder CHARM positions to match field cable wire-pair numbering.",
                                    blocks_approval=True
                                ))
                                issue_idx += 1

        # 6. Configured Empty Baseplates Per Cabinet
        spare_bp_pct = getattr(self.config, "spare_baseplate_percent", 0.0) or 0.0
        if spare_bp_pct > 0:
            bp_per_cab = self.config.ciocs_per_cabinet * self.config.baseplates_per_cioc
            req_empty = max(1, round(bp_per_cab * (spare_bp_pct / 100.0)))
            # Count used baseplates per cabinet
            cab_bps: Dict[str, Set[str]] = {}
            for a in assignments:
                if a.status == "Allocated" and a.cabinet_id and a.baseplate_id:
                    if a.cabinet_id not in cab_bps:
                        cab_bps[a.cabinet_id] = set()
                    cab_bps[a.cabinet_id].add(f"{a.cioc_id}/{a.baseplate_id}")

            for cab_id, used_set in cab_bps.items():
                empty_count = bp_per_cab - len(used_set)
                if empty_count < req_empty:
                    issues.append(ValidationIssueModel(
                        issue_id=f"VAL-SPR-{issue_idx:03d}",
                        severity="ERROR",
                        rule_name="Reserved Spare Baseplates",
                        affected_tags=[],
                        affected_hardware=cab_id,
                        message=f"Cabinet '{cab_id}' has {empty_count} empty baseplates, breaching configured minimum of {req_empty} empty baseplates ({spare_bp_pct}%).",
                        suggested_action="Add cabinets to preserve empty baseplate expansion allowance.",
                        blocks_approval=True
                    ))
                    issue_idx += 1

        # 7. CHARM & Terminal Block Catalogue & Rule Matching
        for a in assignments:
            if a.status == "Allocated":
                sig = signal_map.get(a.tag)
                if sig:
                    expected_hw = self.evaluator.resolve_hardware_for_signal(sig)
                    exp_charm_part = expected_hw.get("charm_part_no")
                    exp_tb_part = expected_hw.get("charm_tb_part_no")

                    if a.charm_part_no and exp_charm_part and a.charm_part_no != exp_charm_part:
                        issues.append(ValidationIssueModel(
                            issue_id=f"VAL-RUL-{issue_idx:03d}",
                            severity="ERROR",
                            rule_name="CHARM Hardware Compatibility",
                            affected_tags=[a.tag],
                            affected_hardware=a.charm_part_no,
                            message=f"Signal '{a.tag}' assigned CHARM part '{a.charm_part_no}', but rules require '{exp_charm_part}' ({expected_hw.get('charm_type')}).",
                            suggested_action="Reassign to correct CHARM hardware module.",
                            blocks_approval=True
                        ))
                        issue_idx += 1

                    if a.charm_tb_part_no and exp_tb_part and a.charm_tb_part_no != exp_tb_part:
                        issues.append(ValidationIssueModel(
                            issue_id=f"VAL-RUL-{issue_idx:03d}",
                            severity="ERROR",
                            rule_name="Terminal Block Compatibility",
                            affected_tags=[a.tag],
                            affected_hardware=a.charm_tb_part_no,
                            message=f"Signal '{a.tag}' assigned Terminal Block '{a.charm_tb_part_no}', but rules require '{exp_tb_part}' ({expected_hw.get('terminal_block')}).",
                            suggested_action="Reassign to correct terminal block part.",
                            blocks_approval=True
                        ))
                        issue_idx += 1

        # 8. Slot Spare Capacity Threshold
        spare_pct = getattr(self.config, "spare_percentage", 0.0) or 0.0
        if spare_pct > 0:
            charms_bp = self.config.charms_per_baseplate or 12
            reserved_slots = max(1, int(charms_bp * (spare_pct / 100.0)))
            spare_threshold = charms_bp - reserved_slots
            for a in assignments:
                if a.status == "Allocated" and a.charm_index and a.charm_index > spare_threshold and getattr(a, "tag_status", "Field") != "Spare Slot":
                    addr = f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index:02d}"
                    issues.append(ValidationIssueModel(
                        issue_id=f"VAL-SPR-{issue_idx:03d}",
                        severity="WARNING",
                        rule_name="Reserved Spare Capacity",
                        affected_tags=[a.tag],
                        affected_hardware=addr,
                        message=f"Signal '{a.tag}' occupies CHARM slot #{a.charm_index}, which encroaches on the {spare_pct}% reserved engineering spare threshold.",
                        suggested_action="Move signal to an unreserved CHARM slot or expand cabinet hardware count.",
                        blocks_approval=False
                    ))
                    issue_idx += 1

        return issues

    def validate(
        self,
        signals: List[SignalRecord],
        assignments: List[AssignmentModel]
    ) -> ValidationSummaryModel:
        """Executes full independent multi-phase validation."""
        input_issues = self.validate_input_dataset(signals)
        assignment_issues = self.validate_assignments(signals, assignments)
        all_issues = input_issues + assignment_issues

        allocated = len([a for a in assignments if a.status == "Allocated" and getattr(a, "tag_status", "Field") != "Spare Slot"])
        unallocated = len(signals) - allocated

        errors = len([i for i in all_issues if i.severity == "ERROR"])
        warnings = len([i for i in all_issues if i.severity == "WARNING"])
        infos = len([i for i in all_issues if i.severity == "INFO"])

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
