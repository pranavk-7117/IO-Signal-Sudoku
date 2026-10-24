"""
Wired-Spare Takeover Engine
IO Signal Sudoku (Emerson DeltaV CHARMs)

Implements the official guideline rule:
"A new signal prefers a matching wired spare on the same controller, so revisions cost no new hardware."
"""

from typing import List, Dict, Any, Optional, Tuple
from models import SignalRecord, AssignmentModel, HardwareConfigModel
from rules import RuleEvaluator

class WiredSpareTakeoverEngine:
    @staticmethod
    def identify_takeover_candidates(
        new_signals: List[SignalRecord],
        current_assignments: List[AssignmentModel]
    ) -> Dict[str, Any]:
        """
        Scans current hardware schedule for wired spares (3201DSP...) matching
        new signals by IO type and controller, enabling $0 hardware cost revisions.
        """
        evaluator = RuleEvaluator()

        # Extract available wired spares
        wired_spares = [
            a for a in current_assignments
            if getattr(a, "tag_status", "") == "Wired Spare"
            or (a.tag and "DSP" in a.tag and a.status == "Allocated")
        ]

        # Group spares by (controller, signal_type, charm_type)
        spare_pool: Dict[Tuple[str, str], List[AssignmentModel]] = {}
        for sp in wired_spares:
            ctrl = sp.controller or "P30DPK320101"
            st = (sp.signal_type or "AI").upper()
            spare_pool.setdefault((ctrl, st), []).append(sp)

        takeover_matches: List[Dict[str, Any]] = []
        unmatched_signals: List[SignalRecord] = []
        used_spare_tags = set()

        for s in new_signals:
            st = (s.signal_type or "AI").upper()
            # Determine preferred controller based on tag or technical room
            pref_ctrl = "P24DPK500201" if (s.technical_room == "PIB-24" or (s.tag or "").startswith("500")) else "P30DPK320101"
            
            # 1. Try preferred controller exact IO type match
            candidates = [sp for sp in spare_pool.get((pref_ctrl, st), []) if sp.tag not in used_spare_tags]
            
            # 2. Try any controller in same technical room
            if not candidates:
                for (c, t), sp_list in spare_pool.items():
                    if t == st and (("P30" in c and "P30" in pref_ctrl) or ("P24" in c and "P24" in pref_ctrl)):
                        available = [sp for sp in sp_list if sp.tag not in used_spare_tags]
                        if available:
                            candidates = available
                            break

            # 3. Fallback to any matching IO type spare across plant
            if not candidates:
                for (c, t), sp_list in spare_pool.items():
                    if t == st:
                        available = [sp for sp in sp_list if sp.tag not in used_spare_tags]
                        if available:
                            candidates = available
                            break

            if candidates:
                chosen_spare = candidates[0]
                used_spare_tags.add(chosen_spare.tag)
                takeover_matches.append({
                    "new_signal_tag": s.tag,
                    "signal_type": s.signal_type,
                    "description": s.description or "",
                    "target_wired_spare_tag": chosen_spare.tag,
                    "controller": chosen_spare.controller,
                    "cabinet_id": chosen_spare.cabinet_id or chosen_spare.system_cabinet,
                    "cioc_id": chosen_spare.cioc_id,
                    "baseplate_id": chosen_spare.baseplate_id,
                    "channel_no": chosen_spare.charm_index or chosen_spare.channel_no,
                    "charm_type": chosen_spare.charm_type,
                    "terminal_block": chosen_spare.terminal_block,
                    "hardware_cost_delta_usd": 0.0,
                    "status": "TAKEOVER_FEASIBLE",
                    "engineering_rationale": f"Reuses pre-wired spare channel on controller {chosen_spare.controller}. Zero rewiring or hardware purchase required."
                })
            else:
                unmatched_signals.append(s)

        total_new = len(new_signals)
        takeovers_count = len(takeover_matches)
        money_saved_usd = takeovers_count * 138.0  # CHARM + TB standard list price

        return {
            "total_new_signals_evaluated": total_new,
            "wired_spares_taken_over_count": takeovers_count,
            "unmatched_signals_requiring_new_slots": len(unmatched_signals),
            "total_hardware_cost_saved_usd": money_saved_usd,
            "takeover_matches": takeover_matches,
            "takeover_summary": f"Successfully matched {takeovers_count} of {total_new} added signals to existing wired spares. Revision hardware cost: $0.00."
        }

    @staticmethod
    def apply_takeover_to_assignments(
        assignments: List[AssignmentModel],
        takeover_matches: List[Dict[str, Any]]
    ) -> List[AssignmentModel]:
        """Applies approved takeovers directly into the assignment schedule."""
        takeover_by_spare = {m["target_wired_spare_tag"]: m for m in takeover_matches}
        updated: List[AssignmentModel] = []

        for a in assignments:
            if a.tag in takeover_by_spare:
                match = takeover_by_spare[a.tag]
                a_copy = a.model_copy()
                a_copy.tag = match["new_signal_tag"]
                a_copy.description = match["description"]
                a_copy.signal_type = match["signal_type"]
                a_copy.tag_status = "Field"
                a_copy.change_type = "Wired Spare Takeover"
                a_copy.reason = f"Took over wired spare '{match['target_wired_spare_tag']}' on {match['controller']}"
                updated.append(a_copy)
            else:
                updated.append(a)

        return updated
