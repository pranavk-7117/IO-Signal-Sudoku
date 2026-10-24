import math
from typing import List, Dict, Any, Optional, Tuple, Set
from models import HardwareConfigModel, SignalRecord, AssignmentModel
from rules import RuleEvaluator, RedundancyNormalizer
from engine.allocator import extract_bp_num

class CounterfactualEngine:
    @staticmethod
    def evaluate_why_not_here(
        config: HardwareConfigModel,
        signals: List[SignalRecord],
        assignments: List[AssignmentModel],
        tag: str,
        target_cabinet: str,
        target_cioc: str,
        target_baseplate: str,
        target_channel: int
    ) -> Dict[str, Any]:
        """
        Evaluates mathematical and engineering rules determining why a signal
        CAN or CANNOT be placed at a candidate CHARM slot.
        """
        signal_map = {s.tag: s for s in signals if s.tag}
        alloc_map = {a.tag: a for a in assignments if a.tag}
        
        sig = signal_map.get(tag)
        current_assign = alloc_map.get(tag)
        
        if not sig:
            return {
                "tag": tag,
                "is_allowed": False,
                "blocking_reasons": [f"Signal '{tag}' not found in active project database."],
                "rule_checks": [],
                "verdict": "Signal not found in active project database"
            }

        rule_evals: List[Dict[str, Any]] = []
        blocking_reasons: List[str] = []

        target_bp_num = extract_bp_num(target_baseplate)
        target_ch = int(target_channel)

        # 1. Single Occupancy Check
        occupant = next((
            a for a in assignments
            if a.status == "Allocated"
            and (a.cabinet_id == target_cabinet or a.system_cabinet == target_cabinet)
            and a.cioc_id == target_cioc
            and extract_bp_num(a.baseplate_id) == target_bp_num
            and (a.charm_index or a.channel_no) == target_ch
            and a.tag != tag
        ), None)

        if occupant and getattr(occupant, "tag_status", "Field") != "Spare Slot":
            reason = f"Slot is already occupied by instrument '{occupant.tag}' ({occupant.signal_type})."
            blocking_reasons.append(reason)
            rule_evals.append({"rule": "Single Occupancy", "passed": False, "detail": reason})
        else:
            rule_evals.append({"rule": "Single Occupancy", "passed": True, "detail": "Slot is unoccupied or available."})

        # 2. Redundancy A/B Segregation
        evaluator = RuleEvaluator.from_hardware_config(config)
        raw_red = sig.redundancy or (current_assign.redundancy if current_assign else "")
        norm_red = evaluator.normalize_redundancy(raw_red)

        if config.rules.enforce_ab_redundancy_separation and norm_red in ["A", "B"]:
            # Check other train signals on target CIOC
            opposing_train = "B" if norm_red == "A" else "A"
            opposing_occupants = [
                a.tag for a in assignments
                if a.status == "Allocated"
                and a.cioc_id == target_cioc
                and evaluator.normalize_redundancy(a.redundancy) == opposing_train
                and a.tag != tag
            ]

            # Parity check: Train A even CIOCs, Train B odd CIOCs
            import re
            m = re.search(r'(\d+)$', target_cioc)
            seq = int(m.group(1)) % 100 if m else 1
            is_even = (seq % 2 == 0)
            parity_expected = "A" if is_even else "B"

            if norm_red != parity_expected or opposing_occupants:
                reason = f"Redundancy Violation: Carrier {target_cioc} is designated for Train {parity_expected}. Signal '{tag}' is Train {norm_red}."
                if opposing_occupants:
                    reason += f" Co-locating with {len(opposing_occupants)} Train {opposing_train} tags breaches fail-safe segregation."
                blocking_reasons.append(reason)
                rule_evals.append({"rule": "Redundancy Segregation (A/B)", "passed": False, "detail": reason})
            else:
                rule_evals.append({"rule": "Redundancy Segregation (A/B)", "passed": True, "detail": f"Train {norm_red} matches CIOC {target_cioc} parity."})
        else:
            rule_evals.append({"rule": "Redundancy Segregation (A/B)", "passed": True, "detail": "Signal is non-redundant or segregation check disabled."})

        # 3. Cable Contiguity & Pairing Check
        cid = (sig.cable_id or "").strip()
        if config.rules.enforce_cable_grouping and cid and cid.upper() not in ["-", "INTERNAL", "INTERNAL WIRING"]:
            cable_peers = [
                a for a in assignments
                if a.status == "Allocated"
                and (a.cable_id == cid or getattr(a, "field_cable_no", "") == cid)
                and a.tag != tag
                and a.baseplate_id
            ]

            if cable_peers:
                peer_bps = {extract_bp_num(a.baseplate_id) for a in cable_peers}
                peer_ciocs = {a.cioc_id for a in cable_peers}
                peer_cabs = {a.cabinet_id or a.system_cabinet for a in cable_peers}

                if target_cioc not in peer_ciocs or target_cabinet not in peer_cabs:
                    reason = f"Cable Split: Cable '{cid}' terminates on {list(peer_ciocs)[0]}. Placing pair on {target_cioc} splits multi-pair cable across carriers."
                    blocking_reasons.append(reason)
                    rule_evals.append({"rule": "Cable Contiguity", "passed": False, "detail": reason})
                elif target_bp_num not in peer_bps and not any(abs(target_bp_num - p_bp) == 1 for p_bp in peer_bps):
                    reason = f"Baseplate Gap: Cable '{cid}' pairs land on BP {sorted(list(peer_bps))}. BP {target_bp_num} is non-adjacent."
                    blocking_reasons.append(reason)
                    rule_evals.append({"rule": "Cable Contiguity", "passed": False, "detail": reason})
                else:
                    rule_evals.append({"rule": "Cable Contiguity", "passed": True, "detail": f"Matches Cable '{cid}' boundary."})
            else:
                rule_evals.append({"rule": "Cable Contiguity", "passed": True, "detail": "Single pair or first cable pair placement."})

        # 4. Cabinet Alarm Baseplate Reservation
        if config.rules.reserve_first_baseplate_for_cabinet_alarms and target_bp_num == 1:
            is_alarm = (sig.tag_status == "Cabinet Alarm") or ("-EJA" in sig.tag.upper())
            if not is_alarm and ("001" in target_cioc or "013" in target_cioc or target_cioc.endswith("1")):
                reason = "Reserved Baseplate: Baseplate 1 of primary CIOC is reserved for internal Cabinet Alarms (-EJA)."
                blocking_reasons.append(reason)
                rule_evals.append({"rule": "Cabinet Alarm Reservation", "passed": False, "detail": reason})
            else:
                rule_evals.append({"rule": "Cabinet Alarm Reservation", "passed": True, "detail": "Permitted on Baseplate 1."})

        # 5. Spare Capacity Threshold Check
        charms_per_bp = config.charms_per_baseplate or 12
        spare_pct = config.spare_percentage
        spare_slots_count = max(1, int(math.ceil(charms_per_bp * (spare_pct / 100.0)))) if spare_pct > 0 else 0
        spare_threshold = charms_per_bp - spare_slots_count

        if target_ch > spare_threshold and spare_pct > 0:
            is_wired_spare = (getattr(sig, "tag_status", "") == "Wired Spare")
            if not is_wired_spare:
                reason = f"Reserved Spare Slot: Channel {target_ch} on Baseplate {target_bp_num} falls within the {spare_pct}% reserved spare margin (Slots {spare_threshold + 1}-{charms_per_bp})."
                blocking_reasons.append(reason)
                rule_evals.append({"rule": "Spare Capacity Margin", "passed": False, "detail": reason})
            else:
                rule_evals.append({"rule": "Spare Capacity Margin", "passed": True, "detail": "Wired spare correctly occupies spare margin."})
        else:
            rule_evals.append({"rule": "Spare Capacity Margin", "passed": True, "detail": "Within standard field allocation zone."})

        is_allowed = (len(blocking_reasons) == 0)
        return {
            "tag": tag,
            "target": {
                "cabinet": target_cabinet,
                "cioc": target_cioc,
                "baseplate": target_baseplate,
                "channel": target_ch
            },
            "is_allowed": is_allowed,
            "blocking_reasons": blocking_reasons,
            "rule_checks": rule_evals,
            "verdict": "Mathematically Feasible" if is_allowed else f"Blocked by {len(blocking_reasons)} Engineering Constraint(s)"
        }


class BlastRadiusSimulator:
    @staticmethod
    def simulate_hardware_failure(
        config: HardwareConfigModel,
        signals: List[SignalRecord],
        assignments: List[AssignmentModel],
        failure_type: str,  # "cioc" | "cabinet" | "power_bus"
        target_id: str
    ) -> Dict[str, Any]:
        """
        Simulates failure of a physical carrier, cabinet, or power train,
        measuring loss of process loops and evaluating A/B resilience.
        """
        evaluator = RuleEvaluator.from_hardware_config(config)
        allocated = [a for a in assignments if a.status == "Allocated"]
        
        # Identify lost signals
        lost_signals: List[AssignmentModel] = []
        surviving_signals: List[AssignmentModel] = []

        for a in allocated:
            is_lost = False
            if failure_type == "cioc" and a.cioc_id == target_id:
                is_lost = True
            elif failure_type == "cabinet" and (a.cabinet_id == target_id or a.system_cabinet == target_id):
                is_lost = True
            elif failure_type == "power_bus":
                # Even CIOCs bus A, odd CIOCs bus B
                import re
                m = re.search(r'(\d+)$', a.cioc_id or "")
                seq = int(m.group(1)) % 100 if m else 1
                bus = "BUS-A" if (seq % 2 == 0) else "BUS-B"
                if bus == target_id.upper():
                    is_lost = True

            if is_lost:
                lost_signals.append(a)
            else:
                surviving_signals.append(a)

        # Loop redundancy analysis
        surviving_loops: Dict[str, Set[str]] = {}
        for s in surviving_signals:
            lp = (s.loop_name or "").strip()
            red = evaluator.normalize_redundancy(s.redundancy)
            if lp and lp != "-":
                surviving_loops.setdefault(lp, set()).add(red or "SIMPLEX")

        lost_loop_status = []
        protected_count = 0
        tripped_count = 0

        for a in lost_signals:
            lp = (a.loop_name or "").strip()
            raw_red = evaluator.normalize_redundancy(a.redundancy)
            opposing = "B" if raw_red == "A" else "A" if raw_red == "B" else None

            if lp and lp != "-" and opposing and opposing in surviving_loops.get(lp, set()):
                status = "PROTECTED"
                detail = f"Counterpart {opposing}-Train instrument is active on surviving carrier."
                protected_count += 1
            else:
                status = "TRIPPED"
                detail = "No surviving redundant counterpart. Loop function lost."
                tripped_count += 1

            lost_loop_status.append({
                "tag": a.tag,
                "loop_name": lp,
                "signal_type": a.signal_type,
                "redundancy": raw_red or "Simplex",
                "hardware_location": f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index}",
                "status": status,
                "resilience_detail": detail
            })

        total_affected = len(lost_signals)
        resilience_score = round((protected_count / max(1, total_affected)) * 100.0, 1)

        return {
            "failure_type": failure_type,
            "target_id": target_id,
            "total_channels_lost": total_affected,
            "protected_channels_count": protected_count,
            "tripped_channels_count": tripped_count,
            "resilience_score_pct": resilience_score,
            "resilience_rating": "HIGH RESILIENCE" if resilience_score >= 80 else "MODERATE RESILIENCE" if resilience_score >= 50 else "CRITICAL VULNERABILITY",
            "impact_summary": f"Failure of {failure_type.upper()} '{target_id}' impacts {total_affected} channels ({tripped_count} unredundant loops lost, {protected_count} protected by A/B segregation).",
            "affected_signals": lost_loop_status[:50]
        }
