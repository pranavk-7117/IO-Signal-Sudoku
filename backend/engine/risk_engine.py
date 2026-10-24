import math
import re
from typing import List, Dict, Any, Optional
from models import (
    HardwareConfigModel, SignalRecord, AssignmentModel,
    RiskAssessmentResponse, RiskFactorModel, RuleSuggestionModel
)
from rules import RuleEvaluator, RedundancyNormalizer

class RiskEngine:
    @staticmethod
    def evaluate_project_risk(
        config: HardwareConfigModel,
        signals: List[SignalRecord],
        assignments: List[AssignmentModel]
    ) -> RiskAssessmentResponse:
        factors: List[RiskFactorModel] = []
        suggestions: List[RuleSuggestionModel] = []
        running_score = 0

        rules = config.rules
        allocated = [a for a in assignments if a.status == "Allocated"]
        signal_map = {s.tag: s for s in signals if s.tag}

        # -------------------------------------------------------------
        # 1. Redundancy & Train A/B Segregation Risk
        # -------------------------------------------------------------
        evaluator = RuleEvaluator.from_hardware_config(config)
        cioc_trains: Dict[str, Dict[str, List[str]]] = {}
        for a in allocated:
            tag = a.tag
            s = signal_map.get(tag)
            raw_red = a.redundancy or (s.redundancy if s else "")
            norm_red = evaluator.normalize_redundancy(raw_red)
            if norm_red in ["A", "B"] and a.cioc_id:
                cioc_trains.setdefault(a.cioc_id, {}).setdefault(norm_red, []).append(tag)

        ab_collisions = []
        for cioc_id, trains in cioc_trains.items():
            if "A" in trains and "B" in trains:
                ab_collisions.append((cioc_id, len(trains["A"]), len(trains["B"])))

        if not rules.enforce_ab_redundancy_separation:
            factor_score = 30
            running_score += factor_score
            factors.append(RiskFactorModel(
                id="RISK-SEG-01",
                category="segregation",
                severity="CRITICAL",
                score=factor_score,
                title="A/B Redundancy Separation Disabled",
                description="Rule 'enforce_ab_redundancy_separation' is currently disabled in hardware rules. Plant trips can occur if a single carrier failure affects both duty and standby systems.",
                affected_items=[c[0] for c in ab_collisions] if ab_collisions else ["Global Rule Config"]
            ))
            suggestions.append(RuleSuggestionModel(
                id="sug-enable-ab-seg",
                title="Enforce Train A/B CIOC Redundancy Separation",
                category="segregation",
                risk_reduction_pts=25,
                description="Enable parity-based linear CIOC segregation so Train A is assigned to even CIOCs and Train B to odd CIOCs.",
                rule_target="enforce_ab_redundancy_separation",
                suggested_value=True,
                can_auto_apply=True
            ))
        elif ab_collisions:
            factor_score = 25
            running_score += factor_score
            affected_ciocs = [f"{c[0]} ({c[1]} A-train, {c[2]} B-train)" for c in ab_collisions]
            factors.append(RiskFactorModel(
                id="RISK-SEG-02",
                category="segregation",
                severity="HIGH",
                score=factor_score,
                title="Train A and Train B Co-located on Same Carrier",
                description="Cross-train signals share the same CIOC carrier hardware. High risk of common-cause failure.",
                affected_items=affected_ciocs
            ))
            suggestions.append(RuleSuggestionModel(
                id="sug-repartition-ab",
                title="Strict CIOC Odd/Even Train Partitioning",
                category="segregation",
                risk_reduction_pts=25,
                description="Re-run solver with parity linear-segregation constraints to isolate redundant instruments.",
                rule_target="enforce_ab_redundancy_separation",
                suggested_value=True,
                can_auto_apply=True
            ))

        # -------------------------------------------------------------
        # 2. Electrical & High-Current DO Inductive Load Risk
        # -------------------------------------------------------------
        sov_keywords = ["SOV", "SOLENOID", "HORN", "BEACON", "SOUNDER", "VALVE"]
        unisolated_sov_tags = []
        for a in allocated:
            tag = a.tag or ""
            desc = (a.description or "").upper()
            sig_type = (a.signal_type or "").upper()

            is_inductive = any(kw in tag.upper() or kw in desc for kw in sov_keywords)
            if is_inductive and "DO" in sig_type:
                charm_type = (a.charm_type or a.charm_part_no or "").upper()
                tb_type = (a.terminal_block or a.charm_tb_part_no or "").upper()
                # Safe isolated combo: SE4302T02 + SE4502 (or SE4302T02)
                if ("SE4302T02" not in charm_type and "ISOLATED" not in charm_type) or ("SE4502" not in tb_type and "FUSED" not in tb_type):
                    unisolated_sov_tags.append(tag)

        if unisolated_sov_tags:
            factor_score = min(25, 5 + len(unisolated_sov_tags) * 3)
            running_score += factor_score
            factors.append(RiskFactorModel(
                id="RISK-ELEC-01",
                category="electrical",
                severity="HIGH",
                score=factor_score,
                title="High-Inrush Inductive Loads Without Isolated Hardware",
                description=f"{len(unisolated_sov_tags)} discrete output device(s) (solenoid, horn, or beacon) are assigned to standard non-isolated DO CHARMs. Inrush or back-EMF spikes can cause terminal block burnout or carrier brownout.",
                affected_items=unisolated_sov_tags[:10]
            ))
            suggestions.append(RuleSuggestionModel(
                id="sug-add-sov-rule",
                title="Map Solenoids/Horns to Isolated DO (SE4302T02) + Fused TB (SE4502)",
                category="electrical",
                risk_reduction_pts=20,
                description="Add an automated hardware mapping rule directing all inductive DO tags to SE4302T02 Isolated DO with SE4502 Fused Injected Power Terminal Blocks.",
                rule_target="custom_rule_sov_isolated",
                suggested_value={
                    "name": "Solenoid & Inductive Load Electrical Isolation",
                    "kind": "charm_terminal_map",
                    "target_column": "description",
                    "operator": "contains",
                    "match_value": "SOV",
                    "target_charm": "DO 24 VDC Isolated",
                    "target_charm_part": "SE4302T02",
                    "target_terminal": "Fused-Injected-Power Terminal Block",
                    "target_terminal_part": "SE4502",
                    "severity": "hard"
                },
                can_auto_apply=True
            ))

        # -------------------------------------------------------------
        # 3. Spare Margin & Expansion Risk (Problem Statement 10% mandate)
        # -------------------------------------------------------------
        if config.spare_percentage < 10.0:
            factor_score = 20
            running_score += factor_score
            factors.append(RiskFactorModel(
                id="RISK-SPR-01",
                category="spares",
                severity="HIGH",
                score=factor_score,
                title="Configured Spares Below 10.0% Emerson Standard",
                description=f"Spare percentage is currently set to {config.spare_percentage}%. The engineering guideline strictly requires 10% wired spares by IO type per controller to guarantee plant expansion headroom.",
                affected_items=[f"Configured Spare: {config.spare_percentage}%"]
            ))
            suggestions.append(RuleSuggestionModel(
                id="sug-set-spare-10",
                title="Set Standard 10.0% Reserved Spare Threshold",
                category="spares",
                risk_reduction_pts=20,
                description="Update spare_percentage to 10.0% to meet Emerson DeltaV commissioning and client handover criteria.",
                rule_target="spare_percentage",
                suggested_value=10.0,
                can_auto_apply=True
            ))

        # Check spare slot distribution across controllers
        ctrl_counts: Dict[str, Dict[str, int]] = {}
        ctrl_spares: Dict[str, Dict[str, int]] = {}
        for a in allocated:
            ctrl = a.controller or "CTRL-MAIN"
            st = a.signal_type or "AI"
            status = getattr(a, "tag_status", "Field")
            if status == "Wired Spare":
                ctrl_spares.setdefault(ctrl, {}).setdefault(st, 0)
                ctrl_spares[ctrl][st] += 1
            elif status == "Field":
                ctrl_counts.setdefault(ctrl, {}).setdefault(st, 0)
                ctrl_counts[ctrl][st] += 1

        deficient_ctrl_types = []
        for ctrl, types in ctrl_counts.items():
            for st, field_cnt in types.items():
                wired_cnt = ctrl_spares.get(ctrl, {}).get(st, 0)
                req_cnt = max(1, int(math.ceil(field_cnt * 0.10)))
                if wired_cnt < req_cnt and field_cnt >= 5:
                    deficient_ctrl_types.append(f"{ctrl} ({st}: {wired_cnt}/{req_cnt} wired spares)")

        if deficient_ctrl_types:
            factor_score = min(15, len(deficient_ctrl_types) * 5)
            running_score += factor_score
            factors.append(RiskFactorModel(
                id="RISK-SPR-02",
                category="spares",
                severity="MEDIUM",
                score=factor_score,
                title="Controller Spare Margin Imbalance by IO Type",
                description="Installed wired spares fall short of 10% for specific signal types on one or more controllers. The guide notes that unused AI spares cannot satisfy a DO spare requirement.",
                affected_items=deficient_ctrl_types
            ))

        # -------------------------------------------------------------
        # 4. Field Cable Grouping & Pair Sequencing Risk
        # -------------------------------------------------------------
        if not rules.enforce_cable_grouping or not rules.enforce_pair_order:
            factor_score = 15
            running_score += factor_score
            factors.append(RiskFactorModel(
                id="RISK-CBL-01",
                category="cables",
                severity="MEDIUM",
                score=factor_score,
                title="Field Cable Pairing & Contiguity Disabled",
                description="Cable grouping or pair ordering rules are disabled. Multi-pair field cables may be split or assigned out of sequence, complicating field termination and marshaling testing.",
                affected_items=["Cable Grouping Rules"]
            ))
            suggestions.append(RuleSuggestionModel(
                id="sug-enable-cable-rules",
                title="Enforce Multi-Pair Cable Contiguity & Pair Order",
                category="cables",
                risk_reduction_pts=15,
                description="Enable 'enforce_cable_grouping' and 'enforce_pair_order' to keep 12-pair and 24-pair cables contiguous across adjacent baseplates.",
                rule_target="enforce_cable_grouping",
                suggested_value=True,
                can_auto_apply=True
            ))

        # -------------------------------------------------------------
        # 5. Carrier Density & Overload Risk
        # -------------------------------------------------------------
        cioc_counts: Dict[str, int] = {}
        for a in allocated:
            if a.cioc_id:
                cioc_counts[a.cioc_id] = cioc_counts.get(a.cioc_id, 0) + 1

        overloaded_ciocs = [f"{cid} ({cnt}/96 channels)" for cid, cnt in cioc_counts.items() if cnt > 82]
        if overloaded_ciocs:
            factor_score = 10
            running_score += factor_score
            factors.append(RiskFactorModel(
                id="RISK-DEN-01",
                category="density",
                severity="MEDIUM",
                score=factor_score,
                title="Carrier Capacity Saturation (>85%)",
                description="One or more CIOC carriers are over 85% full. Adding subsequent commissioning loop changes may require re-routing field cables to different carriers.",
                affected_items=overloaded_ciocs
            ))

        # Final Score & Level Calculation
        overall_score = min(100, running_score)
        if overall_score >= 70:
            level = "CRITICAL"
            color = "purple"
            summary = "Critical operational and hardware segregation risks detected. Modifications to allocation rules required before commissioning sign-off."
        elif overall_score >= 45:
            level = "HIGH"
            color = "rose"
            summary = "High engineering risk detected. Train separation, spare capacity, or inductive load protection requires rule adjustments."
        elif overall_score >= 20:
            level = "MEDIUM"
            color = "amber"
            summary = "Moderate risk. Minor improvements in spare capacity distribution or cable grouping will optimize reliability."
        else:
            level = "LOW"
            color = "emerald"
            summary = "Low risk. Allocation conforms to Emerson DeltaV segregation, spare capacity, and electrical protection standards."

        return RiskAssessmentResponse(
            overall_score=overall_score,
            risk_level=level,
            risk_color=color,
            summary=summary,
            factors=factors,
            suggestions=suggestions
        )
