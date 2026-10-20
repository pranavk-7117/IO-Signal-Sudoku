import pytest
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import HardwareConfigModel, RuleConfigModel, SignalRecord, AssignmentModel
from engine.allocator import AllocationEngine
from engine.validator import ValidationEngine
from engine.revision_comparator import RevisionComparator
from engine.utilisation import UtilisationCalculator

def test_valid_allocation():
    config = HardwareConfigModel()
    engine = AllocationEngine(config)
    signals = [
        SignalRecord(id=1, tag="PT-101", signal_type="AI", cable_id="CB-01", pair_number=1, logical_group="Boiler"),
        SignalRecord(id=2, tag="PT-102", signal_type="AI", cable_id="CB-01", pair_number=2, logical_group="Boiler"),
        SignalRecord(id=3, tag="FT-101", signal_type="AI", cable_id="CB-01", pair_number=3, logical_group="Boiler"),
        SignalRecord(id=4, tag="FV-101", signal_type="AO", cable_id="CB-01", pair_number=4, logical_group="Boiler")
    ]
    assignments = engine.run_allocation(signals)
    assert len(assignments) == 4
    for a in assignments:
        assert a.status == "Allocated"
        assert a.cabinet_id is not None
        assert a.cioc_id is not None
        assert a.baseplate_id is not None
        assert 1 <= a.charm_index <= 12

def test_incompatible_signal_type_rejected():
    config = HardwareConfigModel()
    engine = AllocationEngine(config)
    signals = [
        SignalRecord(id=1, tag="TAG-INVALID", signal_type="SPECIAL_OPTICAL_440V", cable_id="CB-99")
    ]
    assignments = engine.run_allocation(signals)
    assert len(assignments) == 1
    assert assignments[0].status == "Blocked"
    assert "Unsupported signal type" in assignments[0].reason

def test_ab_redundancy_separation():
    config = HardwareConfigModel()
    config.rules.enforce_ab_redundancy_separation = True
    engine = AllocationEngine(config)
    signals = [
        SignalRecord(id=1, tag="PT-1001A", signal_type="AI", redundancy="A", logical_group="Feedwater"),
        SignalRecord(id=2, tag="PT-1001B", signal_type="AI", redundancy="B", logical_group="Feedwater")
    ]
    assignments = engine.run_allocation(signals)
    assert len(assignments) == 2
    a_sig = next(a for a in assignments if a.tag == "PT-1001A")
    b_sig = next(a for a in assignments if a.tag == "PT-1001B")

    assert a_sig.status == "Allocated"
    assert b_sig.status == "Allocated"
    # Must NOT share the same CIOC if in the same cabinet
    if a_sig.cabinet_id == b_sig.cabinet_id:
        assert a_sig.cioc_id != b_sig.cioc_id

def test_cable_pair_ordering_and_continuity():
    config = HardwareConfigModel()
    engine = AllocationEngine(config)
    signals = [
        SignalRecord(id=1, tag="PT-201", signal_type="AI", cable_id="CB-X", pair_number=1),
        SignalRecord(id=2, tag="PT-202", signal_type="AI", cable_id="CB-X", pair_number=2),
        SignalRecord(id=3, tag="PT-203", signal_type="AI", cable_id="CB-X", pair_number=3)
    ]
    assignments = engine.run_allocation(signals)
    assert len(assignments) == 3
    # Check that they land in the same baseplate and in ascending charm indices
    bp = assignments[0].baseplate_id
    assert assignments[1].baseplate_id == bp
    assert assignments[2].baseplate_id == bp
    assert assignments[0].charm_index < assignments[1].charm_index < assignments[2].charm_index

def test_spare_capacity_reservation():
    config = HardwareConfigModel()
    config.charms_per_baseplate = 12
    config.spare_percentage = 10.0  # reserves at least 1 slot (slot 12)
    engine = AllocationEngine(config)
    # create 11 signals on same baseplate
    signals = [
        SignalRecord(id=i, tag=f"SIG-{i:02d}", signal_type="AI", cable_id="CB-BIG", pair_number=i)
        for i in range(1, 12)
    ]
    assignments = engine.run_allocation(signals)
    for a in assignments:
        # None should touch slot 12
        assert a.charm_index < 12

def test_validator_detects_duplicate_tags():
    config = HardwareConfigModel()
    validator = ValidationEngine(config)
    signals = [
        SignalRecord(id=1, tag="PT-DUP", signal_type="AI"),
        SignalRecord(id=2, tag="PT-DUP", signal_type="AI")
    ]
    assignments = [
        AssignmentModel(signal_id=1, tag="PT-DUP", signal_type="AI", status="Allocated", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1),
        AssignmentModel(signal_id=2, tag="PT-DUP", signal_type="AI", status="Allocated", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=2)
    ]
    summary = validator.validate(signals, assignments)
    assert not summary.is_fully_validated
    assert summary.error_count > 0
    dup_issue = next(i for i in summary.issues if i.rule_name == "Unique Signal Tagging")
    assert dup_issue.severity == "ERROR"

def test_revision_comparison_detects_changes():
    base_signals = [
        SignalRecord(id=1, tag="PT-01", signal_type="AI", description="Initial"),
        SignalRecord(id=2, tag="PT-02", signal_type="AI", description="To be deleted")
    ]
    target_signals = [
        SignalRecord(id=1, tag="PT-01", signal_type="AI", description="Updated description"),
        SignalRecord(id=3, tag="PT-03", signal_type="AI", description="Newly added")
    ]
    base_assignments = [
        AssignmentModel(signal_id=1, tag="PT-01", signal_type="AI", status="Allocated", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1),
        AssignmentModel(signal_id=2, tag="PT-02", signal_type="AI", status="Allocated", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=2)
    ]
    target_assignments = [
        AssignmentModel(signal_id=1, tag="PT-01", signal_type="AI", status="Allocated", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1),
        AssignmentModel(signal_id=3, tag="PT-03", signal_type="AI", status="Allocated", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=3)
    ]
    diff = RevisionComparator.compare_revisions("Rev A", "Rev B", base_signals, target_signals, base_assignments, target_assignments)
    assert diff.total_added == 1
    assert diff.total_deleted == 1
    assert diff.total_modified == 1
    assert diff.total_preserved_assignments == 1
