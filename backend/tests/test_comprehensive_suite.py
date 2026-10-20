import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import (
    HardwareConfigModel, RuleConfigModel, SignalRecord, AssignmentModel,
    ApprovalRequest, ApprovalResponse, ValidationIssueModel
)
from engine.allocator import AllocationEngine
from engine.validator import ValidationEngine
from engine.revision_comparator import RevisionComparator
from engine.utilisation import UtilisationCalculator
from engine.tq_generator import TQGenerator
from engine.excel_handler import ExcelHandler

def test_1_and_2_valid_mixed_type_allocation_invokes_real_cpsat():
    config = HardwareConfigModel(cabinets_count=2, ciocs_per_cabinet=2, baseplates_per_cioc=2, charms_per_baseplate=12)
    engine = AllocationEngine(config)
    signals = [
        SignalRecord(id=1, tag="AI-101", signal_type="AI", cable_id="CBL-01", pair_number=1),
        SignalRecord(id=2, tag="AO-101", signal_type="AO", cable_id="CBL-01", pair_number=2),
        SignalRecord(id=3, tag="DI-101", signal_type="DI", cable_id="CBL-02", pair_number=1),
        SignalRecord(id=4, tag="DO-101", signal_type="DO", cable_id="CBL-02", pair_number=2),
        SignalRecord(id=5, tag="SOV-101", signal_type="DO-SOV", cable_id="CBL-03", pair_number=1),
        SignalRecord(id=6, tag="RTD-101", signal_type="RTD", cable_id="CBL-04", pair_number=1),
        SignalRecord(id=7, tag="TC-101", signal_type="TC", cable_id="CBL-05", pair_number=1),
    ]
    assignments = engine.run_allocation(signals)
    assert len(assignments) == 7
    # Verify CP-SAT solver was genuinely executed
    assert engine.last_diagnostics is not None
    assert engine.last_diagnostics.solver_name == "Google OR-Tools CP-SAT"
    assert engine.last_diagnostics.solver_status in ["OPTIMAL", "FEASIBLE"]
    assert engine.last_diagnostics.num_decision_variables > 0
    assert engine.last_diagnostics.num_constraints > 0

    for a in assignments:
        assert a.status == "Allocated"
        assert a.cabinet_id is not None
        assert a.charm_type is not None
        assert a.terminal_block is not None

def test_3_and_4_independent_validator_invoked_and_passes_valid_allocation():
    config = HardwareConfigModel()
    engine = AllocationEngine(config)
    signals = [
        SignalRecord(id=1, tag="PT-001", signal_type="AI", cable_id="CB-1", pair_number=1),
        SignalRecord(id=2, tag="PT-002", signal_type="AI", cable_id="CB-1", pair_number=2)
    ]
    assignments = engine.run_allocation(signals)
    validator = ValidationEngine(config)
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is True
    assert summary.error_count == 0

def test_8_pair_numbers_outside_cable_capacity_rejected():
    config = HardwareConfigModel()
    validator = ValidationEngine(config)
    signals = [
        SignalRecord(id=1, tag="PT-ERR-PAIR", signal_type="AI", cable_id="CB-1", pair_number=0)
    ]
    issues = validator.validate_input_dataset(signals)
    assert any("Cable Pair Bounds" in i.rule_name for i in issues)
    assert any(i.blocks_approval for i in issues)

def test_10_duplicate_signal_tags_preserved_and_detected():
    config = HardwareConfigModel()
    signals = [
        SignalRecord(id=1, tag="DUP-TAG", signal_type="AI"),
        SignalRecord(id=2, tag="DUP-TAG", signal_type="AI")
    ]
    engine = AllocationEngine(config)
    assignments = engine.run_allocation(signals)
    assert len(assignments) == 2
    # Second duplicate must be blocked
    blocked = [a for a in assignments if a.status == "Blocked"]
    assert len(blocked) >= 1
    assert "Duplicate signal tag" in blocked[0].reason

    # Independent validator also catches it
    validator = ValidationEngine(config)
    summary = validator.validate(signals, assignments)
    assert any("Unique Signal Tagging" in i.rule_name for i in summary.issues)

def test_11_unsupported_signal_type_rejected():
    config = HardwareConfigModel()
    engine = AllocationEngine(config)
    signals = [
        SignalRecord(id=1, tag="SPECIAL-440V", signal_type="UNKNOWN_440V")
    ]
    assignments = engine.run_allocation(signals)
    assert len(assignments) == 1
    assert assignments[0].status == "Blocked"
    assert "Unsupported signal type" in assignments[0].reason

def test_12_hardware_slot_collisions_detected():
    config = HardwareConfigModel()
    validator = ValidationEngine(config)
    signals = [
        SignalRecord(id=1, tag="SIG-1", signal_type="AI"),
        SignalRecord(id=2, tag="SIG-2", signal_type="AI")
    ]
    # Deliberate collision on same slot
    assignments = [
        AssignmentModel(signal_id=1, tag="SIG-1", signal_type="AI", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1, status="Allocated"),
        AssignmentModel(signal_id=2, tag="SIG-2", signal_type="AI", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1, status="Allocated")
    ]
    summary = validator.validate(signals, assignments)
    assert any("Hardware Slot Single Occupancy" in i.rule_name for i in summary.issues)
    assert summary.is_fully_validated is False

def test_14_reserved_spare_capacity_respected():
    config = HardwareConfigModel(cabinets_count=1, ciocs_per_cabinet=1, baseplates_per_cioc=1, charms_per_baseplate=12, spare_percentage=10.0)
    engine = AllocationEngine(config)
    # Slot 12 is reserved spare
    signals = [
        SignalRecord(id=i, tag=f"SIG-{i}", signal_type="AI") for i in range(1, 13)
    ]
    assignments = engine.run_allocation(signals)
    # Only 11 should be allocated to non-spare slots, 12th must not invade spare or be unallocated
    allocated = [a for a in assignments if a.status == "Allocated"]
    for a in allocated:
        assert a.charm_index < 12

def test_18_and_19_revision_diff_and_no_false_moves():
    base_signals = [
        SignalRecord(id=1, tag="PT-100", description="Old Desc", signal_type="AI"),
        SignalRecord(id=2, tag="PT-200", description="Removed Signal", signal_type="AI")
    ]
    target_signals = [
        SignalRecord(id=1, tag="PT-100", description="New Desc Adjusted", signal_type="AI"),  # MODIFIED desc only
        SignalRecord(id=3, tag="PT-300", description="Added Signal", signal_type="AI")         # ADDED
    ]
    base_alloc = [
        AssignmentModel(signal_id=1, tag="PT-100", signal_type="AI", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1, status="Allocated"),
        AssignmentModel(signal_id=2, tag="PT-200", signal_type="AI", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=2, status="Allocated")
    ]
    target_alloc = [
        # PT-100 kept at same slot
        AssignmentModel(signal_id=1, tag="PT-100", signal_type="AI", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1, status="Allocated"),
        AssignmentModel(signal_id=3, tag="PT-300", signal_type="AI", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=2, status="Allocated")
    ]
    diff = RevisionComparator.compare_revisions("Rev A", "Rev B", base_signals, target_signals, base_alloc, target_alloc)
    assert diff.total_added == 1
    assert diff.total_deleted == 1
    assert diff.total_modified == 1
    # PT-100 should be PRESERVED, not moved!
    pt_100_diff = next(d for d in diff.diff_records if d.tag == "PT-100")
    assert pt_100_diff.movement_status == "PRESERVED"
    assert pt_100_diff.change_type == "MODIFIED"

def test_20_utilisation_matches_independently_counted_records():
    config = HardwareConfigModel(cabinets_count=1, ciocs_per_cabinet=1, baseplates_per_cioc=1, charms_per_baseplate=12, spare_percentage=10.0)
    assignments = [
        AssignmentModel(signal_id=1, tag="S1", signal_type="AI", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1, status="Allocated"),
        AssignmentModel(signal_id=2, tag="S2", signal_type="AI", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=2, status="Allocated")
    ]
    summary = UtilisationCalculator.calculate(config, assignments)
    assert summary.allocated_signals == 2
    assert summary.total_charm_positions == 12
    assert summary.reserved_spare_positions == 2
    assert summary.free_unreserved_positions == 8

def test_tq_generation_from_blocking_issues():
    issues = [
        ValidationIssueModel(
            issue_id="VAL-001",
            severity="ERROR",
            rule_name="Redundancy Segregation (A/B)",
            affected_tags=["PT-1A", "PT-1B"],
            message="Redundancy conflict",
            suggested_action="Separate CIOCs",
            blocks_approval=True
        )
    ]
    assignments = []
    tqs = TQGenerator.generate_tqs_from_validation(project_id=1, revision_id=1, issues=issues, assignments=assignments)
    assert len(tqs) == 1
    assert tqs[0]["category"] == "Redundancy Segregation"
    assert "PT-1A" in tqs[0]["affected_tags"]
    assert "PT-1B" in tqs[0]["affected_tags"]
