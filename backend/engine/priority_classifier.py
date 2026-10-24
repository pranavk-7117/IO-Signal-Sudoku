"""
Industrial Priority Classification Engine
Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)

Classifies all Technical Queries (TQs), Validation Audit Issues, and Rule Violations into
three pragmatic, high-impact industrial commissioning categories:

🔴 P1: Commissioning Blockers (Safety & Hardware Integrity) — Impact Score 90-100
    - Redundancy / Train A/B Segregation breaches (common-cause plant emergency shutdown hazard)
    - High-inrush inductive solenoid loads without isolated terminal blocks (SE4302T02 + SE4502)
    - Hardware slot physical collisions / double occupancy
    - Cabinet / CIOC controller hardware boundary overruns
    - Duplicate signal tags in DCS configuration database
    Consequence: Halts Factory Acceptance Testing (FAT/SAT), catastrophic card failure, or trip risk.

🟡 P2: Operational & Commercial Constraints (Hardware Headroom & Spares) — Impact Score 60-89
    - 10% Wired Spares deficiency by I/O type per controller
    - Multi-pair trunk cable contiguity breaches (split across non-adjacent baseplates/CIOCs)
    - Reserved empty baseplate expansion headroom violations (<3 empty baseplates per cabinet)
    - Unallocated pending field signals
    Consequence: Commercial EPC contract non-compliance, cable raceway rework, cold loop delays.

🟢 P3: Maintenance & Documentation Hygiene (Engineering Advisories) — Impact Score 10-59
    - Inferred cable size or wire specifications
    - Missing P&ID loop names, service IDs, or operating areas
    - Internal wire color sequences & naming syntax conformities
    Consequence: Minor documentation corrections,SAT loop sheet redlining.
"""

from typing import Dict, Any, List, Optional

class PriorityClassifier:
    P1_CRITICAL = "P1_CRITICAL"
    P2_HIGH = "P2_HIGH"
    P3_ADVISORY = "P3_ADVISORY"

    P1_LABEL = "P1 - Commissioning Blocker"
    P2_LABEL = "P2 - Commercial & Spares Risk"
    P3_LABEL = "P3 - Engineering Advisory"

    @classmethod
    def classify_issue(
        cls,
        rule_name: str,
        message: str,
        severity: str,
        affected_hardware: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates priority tier, impact score (0-100), plant impact description,
        and recommended 1-click remedy for a validation audit issue.
        """
        r_lower = (rule_name or "").lower()
        m_lower = (message or "").lower()
        s_upper = (severity or "WARNING").upper()

        # --- P1: Commissioning Blockers (Safety & Hardware Integrity) ---
        if "redundancy" in r_lower or "a/b" in r_lower or "train a" in m_lower or "segregation" in r_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 98,
                "impact_description": "Safety & Trip Hazard: Primary (Train A) and Backup (Train B) signals share the same CIOC. A single carrier fault drops both redundant trains simultaneously.",
                "recommended_remedy": "Separate redundant channels across odd/even CIOCs or split between independent cabinets."
            }

        if "single occupancy" in r_lower or "collision" in r_lower or "multiple signals" in m_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 100,
                "impact_description": "Physical Terminal Collision: Two distinct field loops terminate onto the exact same CHARM slot and terminal block.",
                "recommended_remedy": "Reallocate conflicting signal to an unoccupied CHARM position on an adjacent baseplate."
            }

        if "terminal block" in r_lower and ("solenoid" in m_lower or "sov" in m_lower or "isolated" in m_lower or "se4302t02" in m_lower or "se4502" in m_lower):
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 96,
                "impact_description": "Hardware Destruction Hazard: High-inrush inductive DO solenoid assigned to standard TB instead of isolated terminal block (SE4302T02 + SE4502). Inductive kickback will destroy the CHARM module.",
                "recommended_remedy": "Switch terminal block part to SE4302T02 with SE4502 CHARM module immediately."
            }

        if "unique signal tag" in r_lower or "duplicate" in m_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 92,
                "impact_description": "DCS Database Corruption: Duplicate tag names cause DeltaV database import rejection and signal ambiguity.",
                "recommended_remedy": "Deduplicate tag names in source IO list with unique channel/unit suffixes."
            }

        if "cabinet count limit" in r_lower or "exceeds configured cabinet limit" in m_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 94,
                "impact_description": "Physical Skid Boundary Overrun: Allocation exceeds physical enclosure floorplan and Marshalling Cabinet layout.",
                "recommended_remedy": "Increase configured cabinet count or enable high-density packing optimization."
            }

        if "cioc capacity limit" in r_lower or "exceeding configured limit of" in m_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 91,
                "impact_description": "Controller Communication Bus Overrun: CIOC count exceeds DeltaV controller local I/O carrier limit.",
                "recommended_remedy": "Distribute baseplates across additional controllers or expand cabinet footprint."
            }

        if "slot capacity bounds" in r_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 90,
                "impact_description": "Invalid Hardware Addressing: Slot index exceeds physical 12-CHARM baseplate carrier limit.",
                "recommended_remedy": "Remap signal to valid channel number between CH01 and CH12."
            }

        # --- P2: Operational & Commercial Constraints (Hardware Headroom & Spares) ---
        if "cable contiguity" in r_lower or "split across" in m_lower or "non-adjacent" in m_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 84,
                "impact_description": "Marshalling Raceway Defect: Multi-pair field trunk cable is split across non-adjacent baseplates or separate CIOCs, causing wire bird-nesting.",
                "recommended_remedy": "Consolidate cable pairs into consecutive slots on the same baseplate or adjacent carrier pair."
            }

        if "cable pair sequence" in r_lower or "sequential pair" in m_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 74,
                "impact_description": "Loop Checkout Inefficiency: Cable wire pairs landed out of order, causing wire tracing confusion during loop commissioning.",
                "recommended_remedy": "Sort CHARM positions to match ascending field cable pair order (Pair 1 -> CH01, Pair 2 -> CH02)."
            }

        if "reserved spare baseplate" in r_lower or "empty baseplate" in m_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 85,
                "impact_description": "Contractual Headroom Violation: Available empty baseplates below contract specification (minimum reserved for future plant expansion).",
                "recommended_remedy": "Reserve at least 3 completely unallocated baseplates per cabinet for future skid additions."
            }

        if "reserved spare capacity" in r_lower or "wired spare" in m_lower or "encroaches" in m_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 80,
                "impact_description": "Commercial Spare Shortage: Spare allocation falls below 10% wired spare quota per IO type, preventing punch-list additions.",
                "recommended_remedy": "Relocate signal to free up designated wired spare channels per controller."
            }

        if "charm hardware compatibility" in r_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 76,
                "impact_description": "Module Mismatch: Assigned CHARM hardware part does not match signal electrical specification (e.g. 2-wire vs 4-wire HART AI).",
                "recommended_remedy": "Update CHARM module catalog selection to match signal electrical loop requirement."
            }

        if "baseplate capacity limit" in r_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 78,
                "impact_description": "Carrier Overload: Baseplate index exceeds maximum baseplates supported per CIOC bus.",
                "recommended_remedy": "Move baseplates to an under-utilized CIOC carrier."
            }

        # --- P3: Maintenance & Documentation Hygiene (Engineering Advisories) ---
        if "mandatory field" in r_lower or "missing" in r_lower:
            return {
                "priority": cls.P3_ADVISORY,
                "priority_label": cls.P3_LABEL,
                "impact_score": 45,
                "impact_description": "Documentation Gap: Signal record missing optional engineering attributes (operating area, loop tag, or service ID).",
                "recommended_remedy": "Enrich signal metadata in customer IO list before final DCS export."
            }

        if "conformity" in r_lower or "naming" in r_lower:
            return {
                "priority": cls.P3_ADVISORY,
                "priority_label": cls.P3_LABEL,
                "impact_score": 40,
                "impact_description": "Naming Convention Advisory: Component identifier syntax deviates from plant tagging conventions.",
                "recommended_remedy": "Apply Emerson standard naming template (e.g. P30-DCM-32001-01)."
            }

        # Severity-based fallback
        if s_upper == "ERROR":
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 90,
                "impact_description": f"Engineering Validation Failure: Rule '{rule_name}' reported a blocking compliance error.",
                "recommended_remedy": "Review hardware layout and resolve rule violation."
            }
        elif s_upper == "WARNING":
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 70,
                "impact_description": f"Operational Advisory: Rule '{rule_name}' reported a design constraint warning.",
                "recommended_remedy": "Review and verify if engineering deviation is acceptable."
            }
        else:
            return {
                "priority": cls.P3_ADVISORY,
                "priority_label": cls.P3_LABEL,
                "impact_score": 35,
                "impact_description": f"Maintenance Note: Informational check for rule '{rule_name}'.",
                "recommended_remedy": "No immediate action required for commissioning."
            }

    @classmethod
    def classify_tq(
        cls,
        category: str,
        description: str,
        root_cause: str,
        suggested_action: str
    ) -> Dict[str, Any]:
        """
        Classifies Technical Queries (TQs) into P1 / P2 / P3.
        """
        c_lower = (category or "").lower()
        d_lower = (description or "").lower()
        r_lower = (root_cause or "").lower()

        # P1 Conditions
        if "redundancy" in c_lower or "redundancy" in r_lower or "a/b" in d_lower or "segregation" in r_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 98,
                "impact_description": "FAT Blocker: Redundant primary and backup signals violate physical segregation. Common-cause CIOC failure could trip production unit.",
                "recommended_remedy": suggested_action or "Separate redundant signals across separate CIOCs or cabinets."
            }

        if "collision" in d_lower or "single occupancy" in r_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 100,
                "impact_description": "Hardware Conflict: Physical terminal double occupancy detected. Signals will short-circuit if landed simultaneously.",
                "recommended_remedy": suggested_action or "Reassign conflicting signal to an empty CHARM channel."
            }

        if "solenoid" in d_lower or "sov" in d_lower or "se4302t02" in r_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 96,
                "impact_description": "Electrical Safety Hazard: High-inrush solenoid load requires isolated terminal block to protect CHARM electronics.",
                "recommended_remedy": suggested_action or "Assign isolated terminal block SE4302T02."
            }

        if "unique" in r_lower or "duplicate" in d_lower:
            return {
                "priority": cls.P1_CRITICAL,
                "priority_label": cls.P1_LABEL,
                "impact_score": 92,
                "impact_description": "Database Blocker: Duplicate tag names prevent reliable DCS signal binding and automated loop checking.",
                "recommended_remedy": suggested_action or "Assign unique signal tag identifiers in source IO list."
            }

        # P2 Conditions
        if "capacity" in c_lower or "unresolved" in c_lower or "could not be assigned" in d_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 82,
                "impact_description": "Hardware Headroom Limitation: Unallocated field signal cannot be terminated on current hardware allocation.",
                "recommended_remedy": suggested_action or "Add CHARM baseplates or expand cabinet hardware configuration."
            }

        if "cable" in c_lower or "continuity" in c_lower or "contiguity" in r_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 80,
                "impact_description": "Raceway Non-conformance: Multi-core trunk cable split violates plant cable routing and marshalling specifications.",
                "recommended_remedy": suggested_action or "Re-cluster cable wire pairs into contiguous baseplate channels."
            }

        if "spare" in c_lower or "spare" in r_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 75,
                "impact_description": "Commercial Spare Margin: Available wired or baseplate spares fall short of contractual 10% guarantee.",
                "recommended_remedy": suggested_action or "Reallocate non-critical channels to preserve spare quota."
            }

        if "compatibility" in c_lower or "compatibility" in r_lower:
            return {
                "priority": cls.P2_HIGH,
                "priority_label": cls.P2_LABEL,
                "impact_score": 76,
                "impact_description": "Hardware Specification Discrepancy: Signal characteristics do not match assigned CHARM module or TB type.",
                "recommended_remedy": suggested_action or "Update hardware selection rule or clarify signal electrical specifications."
            }

        # P3 Conditions
        if "missing information" in c_lower or "missing" in r_lower:
            return {
                "priority": cls.P3_ADVISORY,
                "priority_label": cls.P3_LABEL,
                "impact_score": 45,
                "impact_description": "Engineering Documentation Advisory: Non-critical attributes missing from instrument index.",
                "recommended_remedy": suggested_action or "Request updated IO schedule with complete loop definitions."
            }

        return {
            "priority": cls.P2_HIGH,
            "priority_label": cls.P2_LABEL,
            "impact_score": 70,
            "impact_description": f"Engineering Clarification: {description[:80]}...",
            "recommended_remedy": suggested_action or "Review engineering query and approve layout exception."
        }
