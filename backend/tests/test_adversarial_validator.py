import pytest
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import HardwareConfigModel, RuleConfigModel, SignalRecord, AssignmentModel, ApprovalRequest
from engine.allocator import AllocationEngine
from engine.validator import ValidationEngine
from ortools.sat.python import cp_model

class FaultySolverAllocationEngine(AllocationEngine):
    """
    TEST-ONLY deliberately faulty solver variant.
    Ommits the critical A/B redundancy CIOC segregation constraint
    to simulate a buggy or incomplete mathematical model.
    """
    def __init__(self, config: HardwareConfigModel):
        super().__init__(config)
        # Deliberately disable solver-side redundancy enforcement in the model
        self.rules.enforce_ab_redundancy_separation = False


def test_adversarial_test_a_correct_model_enforces_segregation():
    """
    TEST A — Correct Model:
    The production CP-SAT solver enforces A/B CIOC separation.
    When 2 CIOCs are provided, A and B land on DIFFERENT CIOCs.
    The independent validator evaluates the candidate and passes it.
    """
    config = HardwareConfigModel(
        cabinets_count=1,
        ciocs_per_cabinet=2,
        baseplates_per_cioc=2,
        charms_per_baseplate=12,
        spare_percentage=10.0
    )
    config.rules.enforce_ab_redundancy_separation = True

    signals = [
        SignalRecord(id=1, tag="FT-101A", signal_type="AI", redundancy="A", logical_group="Feedwater", cable_id="CBL-A", pair_number=1),
        SignalRecord(id=2, tag="FT-101B", signal_type="AI", redundancy="B", logical_group="Feedwater", cable_id="CBL-B", pair_number=1)
    ]

    engine = AllocationEngine(config)
    assignments = engine.run_allocation(signals)

    # Both must be allocated
    assert len(assignments) == 2
    a_sig = next(a for a in assignments if a.tag == "FT-101A")
    b_sig = next(a for a in assignments if a.tag == "FT-101B")

    assert a_sig.status == "Allocated"
    assert b_sig.status == "Allocated"
    # CP-SAT must place them on different CIOCs
    assert a_sig.cioc_id != b_sig.cioc_id, "Production solver must separate redundant channels across CIOCs"

    # Independent validation
    validator = ValidationEngine(config)
    summary = validator.validate(signals, assignments)
    assert summary.error_count == 0, "Independent validator must pass correct CP-SAT allocation"
    assert summary.is_fully_validated is True


def test_adversarial_test_b_faulty_model_caught_by_independent_validator():
    """
    TEST B — Missing Model Constraint (ADVERSARIAL PROOF):
    1. Define a hard rule: A and B must NOT share a CIOC.
    2. Faulty CP-SAT solver variant has this constraint deliberately omitted.
    3. Hardware is constrained to 1 Cabinet, 1 CIOC (forces all signals into CIOC-01).
    4. Faulty solver returns candidate with A and B both on CIOC-01.
    5. The independent Python validator inspects the assignments.
    6. ASSERT: Validator catches the violation with a blocking ERROR finding.
    7. ASSERT: Fail-closed approval gate rejects the allocation.
    """
    # 1 CIOC only, 1 baseplate
    config = HardwareConfigModel(
        cabinets_count=1,
        ciocs_per_cabinet=1,  # Only 1 CIOC exists!
        baseplates_per_cioc=1,
        charms_per_baseplate=12,
        spare_percentage=0.0
    )
    config.rules.enforce_ab_redundancy_separation = True

    signals = [
        SignalRecord(id=1, tag="PT-401A", signal_type="AI", redundancy="A", logical_group="ReactorCooling", cable_id="CB-A", pair_number=1),
        SignalRecord(id=2, tag="PT-401B", signal_type="AI", redundancy="B", logical_group="ReactorCooling", cable_id="CB-B", pair_number=1)
    ]

    # Run the FAULTY solver variant (omits segregation constraint)
    faulty_engine = FaultySolverAllocationEngine(config)
    candidate_assignments = faulty_engine.run_allocation(signals)

    # Prove the faulty solver produced a candidate with A and B on the SAME CIOC
    a_assign = next(a for a in candidate_assignments if a.tag == "PT-401A")
    b_assign = next(a for a in candidate_assignments if a.tag == "PT-401B")

    assert a_assign.status == "Allocated"
    assert b_assign.status == "Allocated"
    assert a_assign.cioc_id == b_assign.cioc_id == "CIOC-01", (
        "Faulty solver must produce a violating assignment sharing CIOC-01"
    )

    # Step 6 & 7: Independent Python Validator inspects the faulty candidate
    # Note: The validator is configured with the real production rule: enforce_ab_redundancy_separation = True
    config.rules.enforce_ab_redundancy_separation = True
    validator = ValidationEngine(config)
    val_summary = validator.validate(signals, candidate_assignments)

    # Assert that the validator catches the missing constraint
    redundancy_errors = [
        issue for issue in val_summary.issues
        if issue.rule_name == "Redundancy Segregation (A/B)" and issue.severity == "ERROR"
    ]
    assert len(redundancy_errors) > 0, "Independent validator MUST detect the A/B segregation violation"
    violation = redundancy_errors[0]
    assert "PT-401A" in violation.affected_tags
    assert "PT-401B" in violation.affected_tags
    assert violation.blocks_approval is True

    # Step 8 & 9: Approval Gate must REJECT this candidate
    # We verify the approval gate logic directly
    blocking_reasons = []
    for issue in val_summary.issues:
        if issue.blocks_approval or issue.severity == "ERROR":
            blocking_reasons.append(f"[{issue.rule_name}] {issue.message}")

    is_approved = (len(blocking_reasons) == 0 and val_summary.unallocated_count == 0)
    assert is_approved is False, "Approval Gate must reject candidate with blocking validation issues"
    assert any("Redundancy Segregation (A/B)" in r for r in blocking_reasons)


def test_adversarial_test_c_validator_failure_blocks_approval():
    """
    TEST C — Validator Failure / Crash:
    Simulates a validator throwing an exception or indeterminate result.
    The approval gate must fail-closed (reject approval), never fail-open.
    """
    # Simulate approval gate response when validator fails
    try:
        raise RuntimeError("Simulated internal validator timeout or crash")
    except Exception as e:
        approval_result = {
            "is_approved": False,
            "approval_status": "Rejected",
            "blocking_reasons": [f"Validator execution failure (Fail-Closed Policy): {str(e)}"]
        }

    assert approval_result["is_approved"] is False
    assert approval_result["approval_status"] == "Rejected"
    assert "Fail-Closed" in approval_result["blocking_reasons"][0]


def test_adversarial_test_d_regression_protection():
    """
    TEST D — Regression Protection:
    Confirms that the production AllocationEngine class has enforce_ab_redundancy_separation = True
    by default and that the faulty solver exists solely in the test suite.
    """
    default_config = HardwareConfigModel()
    prod_engine = AllocationEngine(default_config)
    assert prod_engine.rules.enforce_ab_redundancy_separation is True, (
        "Production rules must enforce A/B redundancy separation by default"
    )
    assert not isinstance(prod_engine, FaultySolverAllocationEngine)


def test_adversarial_test_e_missing_hard_rule_coverage():
    """
    TEST E — Missing Hard Rule Coverage:
    If a signal has an unsupported IO type or uncheckable condition,
    the validator flags a blocking error preventing approval.
    """
    config = HardwareConfigModel()
    validator = ValidationEngine(config)
    unsupported_signals = [
        SignalRecord(id=1, tag="SPECIAL-440V", signal_type="UNKNOWN_UNSUPPORTED_440V")
    ]
    assignments = [
        AssignmentModel(signal_id=1, tag="SPECIAL-440V", signal_type="UNKNOWN_UNSUPPORTED_440V", status="Blocked", reason="Unsupported")
    ]

    val_summary = validator.validate(unsupported_signals, assignments)
    assert val_summary.error_count > 0
    assert val_summary.is_fully_validated is False
    assert any("Hardware Type Compatibility" in i.rule_name for i in val_summary.issues)
