import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.priority_classifier import PriorityClassifier
from engine.tq_generator import TQGenerator
from models import ValidationIssueModel, AssignmentModel

def test_p1_critical_classification():
    # 1. Redundancy segregation breach
    p1_red = PriorityClassifier.classify_issue(
        rule_name="Redundancy Segregation (A/B)",
        message="Primary signal FT-101 and Standby signal FT-102 share the same CIOC (CAB-01/CIOC-01).",
        severity="ERROR"
    )
    assert p1_red["priority"] == PriorityClassifier.P1_CRITICAL
    assert p1_red["impact_score"] >= 95
    assert "Trip Hazard" in p1_red["impact_description"] or "Safety" in p1_red["impact_description"]

    # 2. Hardware slot single occupancy collision
    p1_col = PriorityClassifier.classify_issue(
        rule_name="Hardware Slot Single Occupancy",
        message="Hardware collision at CAB-01/CIOC-01/001-CBP-1/CH03: multiple signals allocated simultaneously.",
        severity="ERROR"
    )
    assert p1_col["priority"] == PriorityClassifier.P1_CRITICAL
    assert p1_col["impact_score"] == 100

    # 3. High inrush solenoid without isolated TB
    p1_sov = PriorityClassifier.classify_issue(
        rule_name="Terminal Block Compatibility",
        message="Signal XV-101 assigned Terminal Block standard, but rules require SE4302T02 for inductive solenoid valve.",
        severity="ERROR"
    )
    assert p1_sov["priority"] == PriorityClassifier.P1_CRITICAL
    assert p1_sov["impact_score"] >= 90
    assert "SE4302T02" in p1_sov["impact_description"] or "solenoid" in p1_sov["impact_description"].lower()

def test_p2_high_classification():
    # 1. Cable contiguity split
    p2_cbl = PriorityClassifier.classify_issue(
        rule_name="Cable Contiguity",
        message="Cable CBL-01 is split across multiple baseplates (001-CBP-1, 001-CBP-2).",
        severity="ERROR"
    )
    assert p2_cbl["priority"] == PriorityClassifier.P2_HIGH
    assert 60 <= p2_cbl["impact_score"] < 90

    # 2. Reserved empty baseplates headroom
    p2_bp = PriorityClassifier.classify_issue(
        rule_name="Reserved Spare Baseplates",
        message="Cabinet CAB-01 has 1 empty baseplates, breaching configured minimum of 3.",
        severity="ERROR"
    )
    assert p2_bp["priority"] == PriorityClassifier.P2_HIGH
    assert 60 <= p2_bp["impact_score"] < 90

    # 3. Cable pair sequence
    p2_seq = PriorityClassifier.classify_issue(
        rule_name="Cable Pair Sequence",
        message="Cable CBL-02 pair #2 (CH03) and pair #3 (CH01) violate sequential pair ordering.",
        severity="ERROR"
    )
    assert p2_seq["priority"] == PriorityClassifier.P2_HIGH

def test_p3_advisory_classification():
    # 1. Missing non-critical metadata
    p3_meta = PriorityClassifier.classify_issue(
        rule_name="Mandatory Field Completeness",
        message="Signal PT-101 is missing service description and operating area.",
        severity="WARNING"
    )
    assert p3_meta["priority"] == PriorityClassifier.P3_ADVISORY
    assert p3_meta["impact_score"] < 60

    # 2. Informational check
    p3_info = PriorityClassifier.classify_issue(
        rule_name="Component Naming Conformity",
        message="Component name deviates from standard plant syntax.",
        severity="INFO"
    )
    assert p3_info["priority"] == PriorityClassifier.P3_ADVISORY
    assert p3_info["impact_score"] < 50

def test_tq_generator_priority_triage():
    issues = [
        ValidationIssueModel(
            issue_id="VAL-01",
            severity="ERROR",
            rule_name="Redundancy Segregation (A/B)",
            affected_tags=["ESD-A", "ESD-B"],
            message="Train A and Train B signals placed on same CIOC",
            suggested_action="Separate across CIOCs",
            blocks_approval=True
        ),
        ValidationIssueModel(
            issue_id="VAL-02",
            severity="ERROR",
            rule_name="Cable Contiguity",
            affected_tags=["SIG-1", "SIG-2"],
            message="Cable CBL-10 split across baseplates",
            suggested_action="Consolidate cable on one baseplate",
            blocks_approval=True
        )
    ]
    assignments = [
        AssignmentModel(
            signal_id=99,
            tag="PENDING-01",
            signal_type="AI",
            status="Blocked",
            reason="Capacity reached"
        )
    ]

    tqs = TQGenerator.generate_tqs_from_validation(1, 1, issues, assignments)
    assert len(tqs) == 3
    # First TQ should be highest impact score (P1)
    assert tqs[0]["priority"] == PriorityClassifier.P1_CRITICAL
    assert tqs[0]["impact_score"] >= tqs[1]["impact_score"]
    assert "priority_label" in tqs[0]
    assert "recommended_remedy" in tqs[0]
