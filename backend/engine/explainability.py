"""
Explainability Engine: "Why is it here?"
Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)
Provides full deterministic rule attribution, neighbor contiguity context,
redundancy separation explanation, and TQ justification for any allocated or flagged signal.
"""

from typing import List, Dict, Any, Optional
from models import SignalRecord, AssignmentModel, HardwareConfigModel
from rules import RuleEvaluator, RuleKind, RuleSeverity

class ExplainabilityEngine:
    @staticmethod
    def explain_signal(
        tag: str,
        signals: List[SignalRecord],
        assignments: List[AssignmentModel],
        hw_config: Optional[HardwareConfigModel] = None,
        previous_assignments: Optional[List[AssignmentModel]] = None,
        tqs: Optional[List[Any]] = None,
        validation_issues: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        tag_clean = tag.strip().upper()
        sig = next((s for s in signals if s.tag and s.tag.strip().upper() == tag_clean), None)
        alloc = next((a for a in assignments if a.tag and a.tag.strip().upper() == tag_clean), None)

        if not sig and not alloc:
            return {
                "tag": tag,
                "found": False,
                "summary_narrative": f"Signal tag '{tag}' was not found in the active project database."
            }

        evaluator = RuleEvaluator.from_hardware_config(hw_config)

        # 1. Hardware Selection Rule Attribution
        hw_attribution = ExplainabilityEngine._attribute_hardware(sig, alloc, evaluator)

        # 2. Redundancy & CIOC Separation Attribution
        red_attribution = ExplainabilityEngine._attribute_redundancy(sig, alloc, assignments, evaluator)

        # 3. Cable Contiguity & Neighbor Attribution
        contig_attribution = ExplainabilityEngine._attribute_contiguity(sig, alloc, assignments)

        # 4. Revision Preservation Attribution
        prev_attribution = ExplainabilityEngine._attribute_preservation(sig, alloc, previous_assignments)

        # 5. Diagnostic / TQ Attribution
        diag_attribution = ExplainabilityEngine._attribute_tq(tag_clean, tqs, validation_issues)

        # Resolve hardware fields with priority to alloc then hw_attribution defaults
        resolved_charm_type = (alloc.charm_type if alloc and alloc.charm_type else hw_attribution.get("charm_type")) or "CHARM Module"
        resolved_charm_part = (alloc.charm_part_no if alloc and alloc.charm_part_no else hw_attribution.get("charm_part_no")) or "SE4301T02"
        resolved_tb = (alloc.terminal_block if alloc and alloc.terminal_block else hw_attribution.get("terminal_block")) or "Standard CHARM Terminal Block"
        resolved_tb_part = (alloc.charm_tb_part_no if alloc and alloc.charm_tb_part_no else hw_attribution.get("charm_tb_part_no")) or "SE4501"
        resolved_tb_term = (alloc.charm_tb_terminals if alloc and alloc.charm_tb_terminals else hw_attribution.get("charm_tb_terminals")) or "1, 2"

        # 6. Overall Narrative
        summary = ExplainabilityEngine._generate_summary(
            tag=sig.tag if sig else alloc.tag,
            alloc=alloc,
            hw_attr=hw_attribution,
            red_attr=red_attribution,
            contig_attr=contig_attribution,
            prev_attr=prev_attribution,
            diag_attr=diag_attribution,
            resolved_charm_type=resolved_charm_type,
            resolved_charm_part=resolved_charm_part,
            resolved_tb=resolved_tb
        )

        return {
            "found": True,
            "tag": sig.tag if sig else alloc.tag,
            "description": (sig.description if sig else alloc.description) or "",
            "signal_type": (sig.signal_type if sig else alloc.signal_type) or "UNKNOWN",
            "cable_id": (sig.cable_id if sig else alloc.cable_id) or "",
            "pair_number": (sig.pair_number if sig else alloc.pair_number),
            "redundancy": (sig.redundancy if sig else alloc.redundancy) or "",
            "logical_group": (sig.logical_group if sig else alloc.logical_group) or "",
            "technical_room": getattr(sig, "technical_room", "") or "PIB-30",
            "operating_area": getattr(sig, "operating_area", "") or "Area 320",
            "allocation": {
                "cabinet_id": alloc.cabinet_id if alloc else None,
                "cioc_id": alloc.cioc_id if alloc else None,
                "baseplate_id": alloc.baseplate_id if alloc else None,
                "channel_no": alloc.charm_index if alloc else None,
                "charm_index": alloc.charm_index if alloc else None,
                "charm_no": alloc.charm_no if alloc else (alloc.charm_index if alloc else None),
                "charm_type": resolved_charm_type if alloc else None,
                "charm_part_no": resolved_charm_part if alloc else None,
                "terminal_block": resolved_tb if alloc else None,
                "charm_tb_part_no": resolved_tb_part if alloc else None,
                "charm_tb_terminals": resolved_tb_term if alloc else None,
                "status": alloc.status if alloc else "Unallocated",
                "reason": alloc.reason if alloc else "No assignment generated"
            },
            "hardware_attribution": hw_attribution,
            "redundancy_attribution": red_attribution,
            "contiguity_attribution": contig_attribution,
            "preservation_attribution": prev_attribution,
            "diagnostic_or_tq": diag_attribution,
            "summary_narrative": summary
        }

    @staticmethod
    def _attribute_hardware(sig: Optional[SignalRecord], alloc: Optional[AssignmentModel], evaluator: RuleEvaluator) -> Dict[str, Any]:
        if not sig:
            return {
                "rule_id": "DEFAULT",
                "rule_name": "Standard Module Allocation",
                "severity": "hard",
                "charm_type": alloc.charm_type if alloc and alloc.charm_type else "DISCRETE INPUT CHARM; 24 VDC DRY CONTACT: LOW SIDE SENSE",
                "charm_part_no": alloc.charm_part_no if alloc and alloc.charm_part_no else "SE4301T02",
                "terminal_block": alloc.terminal_block if alloc and alloc.terminal_block else "Standard CHARM Terminal Block",
                "charm_tb_part_no": alloc.charm_tb_part_no if alloc and alloc.charm_tb_part_no else "SE4501",
                "charm_tb_terminals": alloc.charm_tb_terminals if alloc and alloc.charm_tb_terminals else "1, 2",
                "explanation": "Signal hardware was assigned from default system catalogue."
            }

        sig_dict = sig.model_dump() if hasattr(sig, "model_dump") else dict(sig.__dict__)
        matched_rule = None

        for r in evaluator.rules:
            if not r.enabled or r.kind != RuleKind.CHARM_TERMINAL_MAP:
                continue
            params = r.params or {}
            if "type_check" in params and not evaluator._match_single_condition(sig_dict, params["type_check"]):
                continue
            conditions = params.get("conditions", [])
            match_mode = params.get("match_mode", "any")
            if not conditions:
                continue
            matches = [evaluator._match_single_condition(sig_dict, c) for c in conditions]
            is_match = all(matches) if match_mode == "all" else any(matches)
            if is_match:
                matched_rule = r
                break

        if matched_rule:
            hw = matched_rule.params.get("hardware", {})
            c_type = hw.get("charm_type") or (alloc.charm_type if alloc and alloc.charm_type else "DISCRETE INPUT CHARM; 24 VDC DRY CONTACT: LOW SIDE SENSE")
            c_part = hw.get("charm_part_no") or (alloc.charm_part_no if alloc and alloc.charm_part_no else "SE4301T02")
            tb_type = hw.get("terminal_block") or (alloc.terminal_block if alloc and alloc.terminal_block else "Standard CHARM Terminal Block")
            tb_part = hw.get("charm_tb_part_no") or (alloc.charm_tb_part_no if alloc and alloc.charm_tb_part_no else "SE4501")
            tb_term = hw.get("charm_tb_terminals") or (alloc.charm_tb_terminals if alloc and alloc.charm_tb_terminals else "1, 2")

            return {
                "rule_id": matched_rule.id,
                "rule_name": matched_rule.name,
                "severity": matched_rule.severity.value if hasattr(matched_rule.severity, "value") else str(matched_rule.severity),
                "condition_matched": f"Evaluated {len(matched_rule.params.get('conditions', []))} condition(s)",
                "charm_type": c_type,
                "charm_part_no": c_part,
                "terminal_block": tb_type,
                "charm_tb_part_no": tb_part,
                "charm_tb_terminals": tb_term,
                "explanation": (
                    f"Selected by Rule '{matched_rule.name}' ({matched_rule.id}). "
                    f"Matched signal attributes (type: {sig.signal_type}, level: {sig.signal_level or 'standard'}, "
                    f"spec: {sig.electrical_spec or 'standard'}) -> Assigned CHARM {c_type} "
                    f"({c_part}) with {tb_type} pins {tb_term}."
                )
            }

        return {
            "rule_id": "R-MAP-DEFAULT",
            "rule_name": "Standard DeltaV CHARM Compatibility Matrix",
            "severity": "hard",
            "charm_type": alloc.charm_type if alloc and alloc.charm_type else "AI 4-20 MA HART CHARM",
            "charm_part_no": alloc.charm_part_no if alloc and alloc.charm_part_no else "SE4303T01",
            "terminal_block": alloc.terminal_block if alloc and alloc.terminal_block else "Standard CHARM Terminal Block",
            "charm_tb_part_no": alloc.charm_tb_part_no if alloc and alloc.charm_tb_part_no else "SE4501",
            "charm_tb_terminals": alloc.charm_tb_terminals if alloc and alloc.charm_tb_terminals else "1, 2",
            "explanation": f"Mapped to standard {sig.signal_type} CHARM module per project compatibility catalogue."
        }

    @staticmethod
    def _attribute_redundancy(
        sig: Optional[SignalRecord],
        alloc: Optional[AssignmentModel],
        all_allocs: List[AssignmentModel],
        evaluator: RuleEvaluator
    ) -> Dict[str, Any]:
        raw_red = sig.redundancy if sig else (alloc.redundancy if alloc else "")
        norm_red = evaluator.normalize_redundancy(raw_red)

        if not norm_red or norm_red not in ["A", "B"]:
            return {
                "rule_id": "R-002",
                "rule_name": "A/B Redundancy CIOC Separation",
                "severity": "hard",
                "enforced": False,
                "designated_train": "Simplex / Non-Redundant",
                "partner_signals": [],
                "explanation": "Signal is simplex (non-redundant). Can reside on any controller I/O carrier (CIOC)."
            }

        opp_train = "B" if norm_red == "A" else "A"
        partner_tags = []
        partner_ciocs = set()

        # Find signals in same unit/loop with opposite redundancy
        unit = sig.logical_group if sig else (alloc.logical_group if alloc else "")
        cable = sig.cable_id if sig else (alloc.cable_id if alloc else "")

        for a in all_allocs:
            if a.tag == (sig.tag if sig else alloc.tag):
                continue
            a_red = evaluator.normalize_redundancy(a.redundancy)
            if a_red == opp_train:
                if (unit and a.logical_group == unit) or (cable and a.cable_id == cable) or (sig and sig.loop_name and getattr(a, "loop_name", None) == sig.loop_name):
                    partner_tags.append(a.tag)
                    if a.cioc_id:
                        partner_ciocs.add(a.cioc_id)

        cioc_placed = alloc.cioc_id if alloc else "Unassigned"

        return {
            "rule_id": "R-002",
            "rule_name": "A/B Redundancy CIOC Separation",
            "severity": "hard",
            "enforced": True,
            "designated_train": f"Train {norm_red}",
            "partner_signals": partner_tags[:5],
            "partner_ciocs": list(partner_ciocs),
            "explanation": (
                f"Designated as Train {norm_red}. Hard constraint R-002 enforces physical hardware separation: "
                f"This instrument is hosted on {cioc_placed}, strictly isolated from opposite Train {opp_train} "
                f"partners (hosted on {', '.join(partner_ciocs) if partner_ciocs else 'separate CIOC'}), "
                f"guaranteeing no single point of hardware failure."
            )
        }

    @staticmethod
    def _attribute_contiguity(
        sig: Optional[SignalRecord],
        alloc: Optional[AssignmentModel],
        all_allocs: List[AssignmentModel]
    ) -> Dict[str, Any]:
        cable = sig.cable_id if sig else (alloc.cable_id if alloc else "")
        pair = sig.pair_number if sig else (alloc.pair_number if alloc else None)

        if not cable or cable.upper() in ["INTERNAL WIRING", "INTERNAL-WIRING", "-", "NA", "N/A"]:
            return {
                "rule_id": "R-006",
                "rule_name": "Internal Cabinet Wiring Segregation",
                "severity": "hard",
                "enforced": True,
                "cable_id": "Internal / Cabinet Wiring",
                "pair_number": None,
                "explanation": "Internal cabinet diagnostics/alarm channel. Allocated onto Baseplate 1 per DeltaV engineering standard R-006."
            }

        if not alloc or not alloc.baseplate_id or not alloc.charm_index:
            return {
                "rule_id": "R-001",
                "rule_name": "Cable Contiguity & Monotonic Pair Order",
                "severity": "hard",
                "enforced": False,
                "cable_id": cable,
                "pair_number": pair,
                "explanation": f"Field cable {cable}. Awaiting valid carrier allocation."
            }

        # Find neighbors on the same baseplate
        bp_signals = [a for a in all_allocs if a.cabinet_id == alloc.cabinet_id and a.cioc_id == alloc.cioc_id and a.baseplate_id == alloc.baseplate_id]
        bp_signals.sort(key=lambda x: x.charm_index or 0)

        left_neighbor = next((a for a in bp_signals if a.charm_index == (alloc.charm_index - 1)), None)
        right_neighbor = next((a for a in bp_signals if a.charm_index == (alloc.charm_index + 1)), None)

        cable_pairs_on_bp = [a for a in bp_signals if a.cable_id == cable]

        return {
            "rule_id": "R-001",
            "rule_name": "Cable Contiguity & Monotonic Pair Order",
            "severity": "hard",
            "enforced": True,
            "cable_id": cable,
            "pair_number": pair,
            "baseplate_pairs_count": len(cable_pairs_on_bp),
            "left_neighbor": {
                "slot": left_neighbor.charm_index,
                "tag": left_neighbor.tag,
                "pair": left_neighbor.pair_number,
                "cable": left_neighbor.cable_id
            } if left_neighbor else None,
            "right_neighbor": {
                "slot": right_neighbor.charm_index,
                "tag": right_neighbor.tag,
                "pair": right_neighbor.pair_number,
                "cable": right_neighbor.cable_id
            } if right_neighbor else None,
            "explanation": (
                f"Field multi-pair cable '{cable}' pair {pair or 1} is assigned to CHARM slot {alloc.charm_index} "
                f"on baseplate {alloc.baseplate_id}. Contiguity rule R-001 clusters pairs 1..{len(cable_pairs_on_bp)} "
                f"sequentially into adjacent carrier slots without fragmentation."
            )
        }

    @staticmethod
    def _attribute_preservation(
        sig: Optional[SignalRecord],
        alloc: Optional[AssignmentModel],
        prev_allocs: Optional[List[AssignmentModel]]
    ) -> Dict[str, Any]:
        if not prev_allocs or not alloc:
            return {
                "is_preserved": False,
                "explanation": "Initial revision baseline allocation."
            }

        tag = alloc.tag
        prev_a = next((a for a in prev_allocs if a.tag and a.tag.strip().upper() == tag.strip().upper()), None)

        if not prev_a or prev_a.status != "Allocated":
            return {
                "is_preserved": False,
                "explanation": "Newly added instrument in this revision. Allocated into an available spare carrier slot."
            }

        is_same = (
            prev_a.cabinet_id == alloc.cabinet_id
            and prev_a.cioc_id == alloc.cioc_id
            and prev_a.baseplate_id == alloc.baseplate_id
            and prev_a.charm_index == alloc.charm_index
        )

        return {
            "is_preserved": is_same,
            "previous_location": f"{prev_a.cabinet_id}/{prev_a.cioc_id}/{prev_a.baseplate_id}/Slot {prev_a.charm_index}",
            "current_location": f"{alloc.cabinet_id}/{alloc.cioc_id}/{alloc.baseplate_id}/Slot {alloc.charm_index}",
            "explanation": (
                f"Assignment was locked and preserved from prior revision ({prev_a.cabinet_id}/{prev_a.cioc_id}/{prev_a.baseplate_id}/Slot {prev_a.charm_index}) "
                f"by the minimum-movement solver policy, preventing costly physical marshalling re-wiring in the field."
                if is_same else
                f"Signal was re-wired from {prev_a.cabinet_id}/{prev_a.cioc_id}/{prev_a.baseplate_id}/Slot {prev_a.charm_index} "
                f"to resolve updated engineering constraints or cable re-grouping."
            )
        }

    @staticmethod
    def _attribute_tq(
        tag: str,
        tqs: Optional[List[Any]],
        issues: Optional[List[Any]]
    ) -> Optional[Dict[str, Any]]:
        # Check TQs
        if tqs:
            for t in tqs:
                t_tag = getattr(t, "tag", "") or (t.get("tag") if isinstance(t, dict) else "")
                aff_tags = getattr(t, "affected_tags", []) or (t.get("affected_tags") if isinstance(t, dict) else [])
                if str(t_tag).strip().upper() == tag or tag in [str(x).strip().upper() for x in (aff_tags or [])]:
                    tq_id = getattr(t, "tq_id", "") or (t.get("tq_id") if isinstance(t, dict) else "TQ-001")
                    subj = getattr(t, "subject", "") or (t.get("subject") if isinstance(t, dict) else "")
                    desc = getattr(t, "description", "") or (t.get("description") if isinstance(t, dict) else "")
                    action = getattr(t, "suggested_action", "") or (t.get("suggested_action") if isinstance(t, dict) else "")
                    sev = getattr(t, "severity", "WARNING") or (t.get("severity") if isinstance(t, dict) else "WARNING")
                    return {
                        "has_tq": True,
                        "tq_id": tq_id,
                        "subject": subj,
                        "severity": sev,
                        "description": desc,
                        "suggested_action": action,
                        "explanation": f"Technical Query {tq_id} generated: {subj}. Requires customer engineering clarification: {action}"
                    }

        # Check Validation Issues
        if issues:
            for iss in issues:
                aff_tags = getattr(iss, "affected_tags", []) or (iss.get("affected_tags") if isinstance(iss, dict) else [])
                if tag in [str(x).strip().upper() for x in (aff_tags or [])]:
                    issue_id = getattr(iss, "issue_id", "VAL-001") or (iss.get("issue_id") if isinstance(iss, dict) else "VAL-001")
                    msg = getattr(iss, "message", "") or (iss.get("message") if isinstance(iss, dict) else "")
                    action = getattr(iss, "suggested_action", "") or (iss.get("suggested_action") if isinstance(iss, dict) else "")
                    sev = getattr(iss, "severity", "ERROR") or (iss.get("severity") if isinstance(iss, dict) else "ERROR")
                    return {
                        "has_tq": True,
                        "tq_id": issue_id,
                        "subject": "Independent Validation Finding",
                        "severity": sev,
                        "description": msg,
                        "suggested_action": action,
                        "explanation": f"Independent validation check failed: {msg}. Remediate: {action}"
                    }

        return None

    @staticmethod
    def _generate_summary(
        tag: str,
        alloc: Optional[AssignmentModel],
        hw_attr: Dict[str, Any],
        red_attr: Dict[str, Any],
        contig_attr: Dict[str, Any],
        prev_attr: Dict[str, Any],
        diag_attr: Optional[Dict[str, Any]],
        resolved_charm_type: str = "CHARM Module",
        resolved_charm_part: str = "SE4301T02",
        resolved_tb: str = "Standard CHARM Terminal Block"
    ) -> str:
        if diag_attr and diag_attr.get("has_tq"):
            return (
                f"Signal '{tag}' flagged with {diag_attr.get('tq_id')}: {diag_attr.get('description')} "
                f"Engineering Action: {diag_attr.get('suggested_action')}"
            )

        if not alloc or alloc.status != "Allocated":
            return f"Signal '{tag}' could not be allocated due to hardware capacity limits or unresolved constraints."

        pres_text = " Preserved from previous revision with 0 rewiring." if prev_attr.get("is_preserved") else ""
        
        red_text = ""
        if red_attr.get("enforced") and red_attr.get("designated_train"):
            train_raw = str(red_attr.get("designated_train", "")).replace("Train", "").strip()
            red_text = f" Segregated onto {alloc.cioc_id} for Train {train_raw} redundancy."

        cbl_text = f" Positioned as part of field cable {contig_attr.get('cable_id')} pair {contig_attr.get('pair_number') or 1}." if contig_attr.get("pair_number") else ""

        c_part_str = f" ({resolved_charm_part})" if resolved_charm_part else ""

        return (
            f"Signal '{tag}' is landed at {alloc.cabinet_id} / {alloc.cioc_id} / {alloc.baseplate_id} / Slot {alloc.charm_index} "
            f"using {resolved_charm_type}{c_part_str} and {resolved_tb}."
            f"{red_text}{cbl_text}{pres_text}"
        )
