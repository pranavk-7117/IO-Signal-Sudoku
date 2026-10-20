import math
from typing import List, Dict, Set, Tuple, Optional
from models import HardwareConfigModel, SignalRecord, AssignmentModel, ValidationIssueModel, ValidationSummaryModel

class ValidationEngine:
    def __init__(self, config: HardwareConfigModel):
        self.config = config
        self.rules = config.rules
        self.compat_matrix = config.compatibility_matrix

    def validate(
        self,
        signals: List[SignalRecord],
        assignments: List[AssignmentModel]
    ) -> ValidationSummaryModel:
        issues: List[ValidationIssueModel] = []
        issue_counter = 1

        def add_issue(severity: str, rule_name: str, tags: List[str], hw: Optional[str], message: str, action: str, blocks: bool):
            nonlocal issue_counter
            prefix = "ERR" if severity == "ERROR" else ("WRN" if severity == "WARNING" else "INF")
            issue_id = f"VAL-{prefix}-{issue_counter:03d}"
            issue_counter += 1
            issues.append(ValidationIssueModel(
                issue_id=issue_id,
                severity=severity,
                rule_name=rule_name,
                affected_tags=tags,
                affected_hardware=hw,
                message=message,
                suggested_action=action,
                blocks_approval=blocks
            ))

        # Build quick lookups
        signal_by_tag: Dict[str, SignalRecord] = {s.tag: s for s in signals if s.tag}
        tag_counts: Dict[str, int] = {}
        for s in signals:
            tag_counts[s.tag] = tag_counts.get(s.tag, 0) + 1

        # Check 1: Duplicate signal tags in imported dataset
        for tag, count in tag_counts.items():
            if count > 1:
                add_issue(
                    severity="ERROR",
                    rule_name="Unique Signal Tagging",
                    tags=[tag],
                    hw=None,
                    message=f"Signal Tag '{tag}' appears {count} times in the imported IO database. Industrial DCS requires globally unique signal tags.",
                    action="Deduplicate signal tags in customer IO list or add suffix (_A, _B, _1, _2).",
                    blocks=True
                )

        # Check 2: Missing mandatory fields
        for s in signals:
            if not s.tag or not s.tag.strip():
                add_issue(
                    severity="ERROR",
                    rule_name="Mandatory Field Completeness",
                    tags=["UNKNOWN"],
                    hw=None,
                    message="Signal record has missing or empty Tag name.",
                    action="Provide a valid instrument or DCS tag name.",
                    blocks=True
                )
            if not s.signal_type or not s.signal_type.strip():
                add_issue(
                    severity="ERROR",
                    rule_name="Mandatory Field Completeness",
                    tags=[s.tag],
                    hw=None,
                    message=f"Signal '{s.tag}' has no signal type specified (e.g. AI, AO, DI, DO).",
                    action="Assign valid signal type in the IO list mapping.",
                    blocks=True
                )

        # Check 3: Unsupported signal types against catalogue
        for s in signals:
            sig_type = (s.signal_type or "").upper().strip()
            if sig_type and sig_type not in self.compat_matrix:
                add_issue(
                    severity="ERROR",
                    rule_name="Hardware Type Compatibility",
                    tags=[s.tag],
                    hw=None,
                    message=f"Signal '{s.tag}' type '{s.signal_type}' is not supported by DeltaV hardware catalogue.",
                    action="Update hardware catalogue compatibility matrix in Rules & Hardware page or correct IO type in source list.",
                    blocks=True
                )

        # Check 4: Unallocated signals
        unallocated = [a for a in assignments if a.status != "Allocated"]
        for ua in unallocated:
            add_issue(
                severity="ERROR" if ua.status == "Blocked" else "WARNING",
                rule_name="Complete Hardware Allocation",
                tags=[ua.tag],
                hw=None,
                message=f"Signal '{ua.tag}' is currently unallocated (Status: {ua.status}). Reason: {ua.reason or 'Unassigned'}",
                action="Increase cabinet/baseplate capacity or resolve conflicting engineering constraints.",
                blocks=(ua.status == "Blocked")
            )

        # Check 5: Slot Capacity & Double Occupancy
        slot_occupancy: Dict[str, List[str]] = {}
        for a in assignments:
            if a.status == "Allocated" and a.cabinet_id and a.cioc_id and a.baseplate_id and a.charm_index:
                addr = f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index:02d}"
                if addr not in slot_occupancy:
                    slot_occupancy[addr] = []
                slot_occupancy[addr].append(a.tag)

                # Check if charm index exceeds baseplate limit
                if a.charm_index > self.config.charms_per_baseplate or a.charm_index < 1:
                    add_issue(
                        severity="ERROR",
                        rule_name="CHARM Slot Capacity Bounds",
                        tags=[a.tag],
                        hw=addr,
                        message=f"Signal '{a.tag}' assigned to invalid CHARM slot #{a.charm_index}. Baseplate limit is {self.config.charms_per_baseplate} CHARMs.",
                        action=f"Reassign to valid slot between 1 and {self.config.charms_per_baseplate}.",
                        blocks=True
                    )

        for addr, tags in slot_occupancy.items():
            if len(tags) > 1:
                add_issue(
                    severity="ERROR",
                    rule_name="Hardware Slot Single Occupancy",
                    tags=tags,
                    hw=addr,
                    message=f"Hardware position {addr} has multiple signals allocated simultaneously: {', '.join(tags)}. Each CHARM accepts only 1 signal.",
                    action="Reallocate conflicting signals to free distinct CHARM slots.",
                    blocks=True
                )

        # Check 6: Reserved Spare Capacity Encroachment
        spare_slots_per_bp = max(1, int(math.ceil(self.config.charms_per_baseplate * (self.config.spare_percentage / 100.0)))) if self.config.spare_percentage > 0 else 0
        spare_threshold = self.config.charms_per_baseplate - spare_slots_per_bp
        for a in assignments:
            if a.status == "Allocated" and a.charm_index and a.charm_index > spare_threshold and spare_slots_per_bp > 0:
                addr = f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index:02d}"
                add_issue(
                    severity="WARNING",
                    rule_name="Reserved Spare Capacity",
                    tags=[a.tag],
                    hw=addr,
                    message=f"Signal '{a.tag}' occupies CHARM position #{a.charm_index}, which falls within the {self.config.spare_percentage}% reserved engineering spare threshold.",
                    action="Move signal to an unreserved CHARM slot or expand cabinet hardware count.",
                    blocks=False
                )

        # Check 7: A/B Redundancy CIOC Separation
        # Group allocated signals by redundancy key
        redundancy_groups: Dict[str, Dict[str, List[AssignmentModel]]] = {}
        for a in assignments:
            if a.status == "Allocated" and a.redundancy in ["A", "B"] and a.cioc_id:
                r_key = a.logical_group or (a.tag.split("-")[0] if "-" in a.tag else "GLOBAL")
                if r_key not in redundancy_groups:
                    redundancy_groups[r_key] = {"A": [], "B": []}
                redundancy_groups[r_key][a.redundancy].append(a)

        if self.rules.enforce_ab_redundancy_separation:
            for r_key, pair in redundancy_groups.items():
                a_list = pair["A"]
                b_list = pair["B"]
                for sig_a in a_list:
                    for sig_b in b_list:
                        if sig_a.cabinet_id == sig_b.cabinet_id and sig_a.cioc_id == sig_b.cioc_id:
                            add_issue(
                                severity="ERROR",
                                rule_name="A/B Redundancy CIOC Separation",
                                tags=[sig_a.tag, sig_b.tag],
                                hw=f"{sig_a.cabinet_id}/{sig_a.cioc_id}",
                                message=f"Redundant pair '{sig_a.tag}' (A) and '{sig_b.tag}' (B) in group '{r_key}' are assigned to the same CIOC ({sig_a.cioc_id}). This violates single-point-of-failure segregation.",
                                action=f"Separate redundant channel '{sig_b.tag}' to an alternate CIOC.",
                                blocks=True
                            )

        # Check 8: Cable Continuity and Pair Ordering
        # Group by cable_id
        cables_map: Dict[str, List[AssignmentModel]] = {}
        for a in assignments:
            if a.status == "Allocated" and a.cable_id and a.cable_id.strip():
                if a.cable_id not in cables_map:
                    cables_map[a.cable_id] = []
                cables_map[a.cable_id].append(a)

        for cable_id, cable_sigs in cables_map.items():
            # Check if pairs span multiple cabinets
            cabs = set(cs.cabinet_id for cs in cable_sigs if cs.cabinet_id)
            if len(cabs) > 1 and not self.rules.allow_cross_baseplate_cables:
                add_issue(
                    severity="WARNING",
                    rule_name="Cable Group Continuity",
                    tags=[cs.tag for cs in cable_sigs],
                    hw=", ".join(cabs),
                    message=f"Cable '{cable_id}' pairs are split across multiple cabinets ({', '.join(cabs)}). Multi-core field cables should land in a single enclosure.",
                    action=f"Consolidate all pairs of cable {cable_id} into the same cabinet.",
                    blocks=False
                )

            # Check pair order if multiple pairs have valid pair_number
            sorted_by_pair = sorted([cs for cs in cable_sigs if cs.pair_number is not None], key=lambda x: x.pair_number)
            if len(sorted_by_pair) > 1 and self.rules.enforce_pair_order:
                # check if charm indices on same baseplate are ascending
                for i in range(len(sorted_by_pair) - 1):
                    s1 = sorted_by_pair[i]
                    s2 = sorted_by_pair[i+1]
                    if s1.cabinet_id == s2.cabinet_id and s1.cioc_id == s2.cioc_id and s1.baseplate_id == s2.baseplate_id:
                        if s1.charm_index and s2.charm_index and s1.charm_index > s2.charm_index:
                            add_issue(
                                severity="WARNING",
                                rule_name="Cable Pair Ascending Order",
                                tags=[s1.tag, s2.tag],
                                hw=f"{s1.cabinet_id}/{s1.cioc_id}/{s1.baseplate_id}",
                                message=f"Cable '{cable_id}' Pair {s1.pair_number} (CH{s1.charm_index}) is placed after Pair {s2.pair_number} (CH{s2.charm_index}). Field wiring standards require monotonic pair progression.",
                                action="Swap CHARM slots to preserve field cable pair sequence.",
                                blocks=False
                            )

        # Check 9: CHARM & Terminal Block Electrical Compatibility
        for a in assignments:
            if a.status == "Allocated" and a.signal_type:
                sig_type = a.signal_type.upper().strip()
                if sig_type in self.compat_matrix:
                    req_charm = self.compat_matrix[sig_type].get("charm")
                    req_term = self.compat_matrix[sig_type].get("terminal")
                    if req_charm and a.charm_type and req_charm.lower() not in a.charm_type.lower():
                        add_issue(
                            severity="ERROR",
                            rule_name="CHARM Hardware Compatibility",
                            tags=[a.tag],
                            hw=f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index}",
                            message=f"Signal '{a.tag}' ({sig_type}) assigned to mismatched CHARM type '{a.charm_type}'. Required: '{req_charm}'.",
                            action="Install required CHARM type in hardware configuration.",
                            blocks=True
                        )
                    if req_term and a.terminal_block and req_term.lower() not in a.terminal_block.lower():
                        add_issue(
                            severity="WARNING",
                            rule_name="Terminal Block Compatibility",
                            tags=[a.tag],
                            hw=f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index}",
                            message=f"Signal '{a.tag}' ({sig_type}) requires '{req_term}' but assigned '{a.terminal_block}'.",
                            action="Verify field termination requirements for injected power or isolation.",
                            blocks=False
                        )

        # Summarize
        err_count = len([i for i in issues if i.severity == "ERROR"])
        wrn_count = len([i for i in issues if i.severity == "WARNING"])
        inf_count = len([i for i in issues if i.severity == "INFO"])
        alloc_count = len([a for a in assignments if a.status == "Allocated"])
        unalloc_count = len(assignments) - alloc_count

        return ValidationSummaryModel(
            total_signals=len(signals),
            allocated_count=alloc_count,
            unallocated_count=unalloc_count,
            error_count=err_count,
            warning_count=wrn_count,
            info_count=inf_count,
            is_fully_validated=(err_count == 0 and unalloc_count == 0),
            issues=issues
        )
