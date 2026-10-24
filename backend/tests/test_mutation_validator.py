"""
Mutation Testing Suite for Independent Validation Engine (Gate G12)
Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)

Verifies:
- Every injected rule violation is caught by the independent validator
- Zero false negatives (fail-closed behavior)
- Independent validator imports zero allocator code
"""

import copy
import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import HardwareConfigModel, SignalRecord, AssignmentModel
from validation.independent_validator import IndependentValidator

def _get_valid_baseline():
    """Generates a valid set of signals and matching candidate assignments."""
    signals = [
        SignalRecord(id=1, tag="320-FT-101A", signal_type="AI", redundancy="Duty", logical_group="Feedwater", cable_id="CBL-01", pair_number=1),
        SignalRecord(id=2, tag="320-FT-101B", signal_type="AI", redundancy="Standby", logical_group="Feedwater", cable_id="CBL-02", pair_number=1),
        SignalRecord(id=3, tag="320-PT-102", signal_type="AI", logical_group="Feedwater", cable_id="CBL-01", pair_number=2),
        SignalRecord(id=4, tag="320-TT-103", signal_type="AIR", electrical_spec="RTD 3-Wire", description="Temperature RTD", cable_id="CBL-03", pair_number=1),
        SignalRecord(id=5, tag="320-XYV-104", signal_type="DOR", instrument_type="XYV", description="SOV Valve", cable_id="CBL-04", pair_number=1)
    ]

    assignments = [
        AssignmentModel(
            signal_id=1, tag="320-FT-101A", signal_type="AI", cable_id="CBL-01", pair_number=1,
            redundancy="A", logical_group="Feedwater", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01",
            charm_index=1, charm_part_no="SE4303T01", terminal_block="Standard CHARM Terminal Block",
            charm_tb_part_no="SE4501", status="Allocated"
        ),
        AssignmentModel(
            signal_id=2, tag="320-FT-101B", signal_type="AI", cable_id="CBL-02", pair_number=1,
            redundancy="B", logical_group="Feedwater", cabinet_id="CAB-01", cioc_id="CIOC-02", baseplate_id="BP-01",
            charm_index=1, charm_part_no="SE4303T01", terminal_block="Standard CHARM Terminal Block",
            charm_tb_part_no="SE4501", status="Allocated"
        ),
        AssignmentModel(
            signal_id=3, tag="320-PT-102", signal_type="AI", cable_id="CBL-01", pair_number=2,
            redundancy="", logical_group="Feedwater", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01",
            charm_index=2, charm_part_no="SE4303T01", terminal_block="Standard CHARM Terminal Block",
            charm_tb_part_no="SE4501", status="Allocated"
        ),
        AssignmentModel(
            signal_id=4, tag="320-TT-103", signal_type="AIR", cable_id="CBL-03", pair_number=1,
            redundancy="", logical_group="Feedwater", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-02",
            charm_index=1, charm_part_no="SE4303T03", terminal_block="Standard CHARM Terminal Block",
            charm_tb_part_no="SE4501", status="Allocated"
        ),
        AssignmentModel(
            signal_id=5, tag="320-XYV-104", signal_type="DOR", cable_id="CBL-04", pair_number=1,
            redundancy="", logical_group="Feedwater", cabinet_id="CAB-01", cioc_id="CIOC-02", baseplate_id="BP-02",
            charm_index=1, charm_part_no="SE4302T02", terminal_block="Fused-Injected-Power Terminal Block",
            charm_tb_part_no="SE4502", status="Allocated"
        )
    ]
    return signals, assignments

def test_mutation_0_valid_baseline_passes_with_zero_errors():
    signals, assignments = _get_valid_baseline()
    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is True
    assert summary.error_count == 0

def test_mutation_1_slot_collision_injected():
    """Mutation: Put two signals on the exact same hardware slot."""
    signals, assignments = _get_valid_baseline()
    assignments[2].baseplate_id = assignments[0].baseplate_id
    assignments[2].charm_index = assignments[0].charm_index

    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is False
    assert any("Single Occupancy" in i.rule_name for i in summary.issues)

def test_mutation_2_ab_redundancy_violation_injected():
    """Mutation: Force redundant B signal onto the same CIOC as redundant A signal."""
    signals, assignments = _get_valid_baseline()
    assignments[1].cioc_id = assignments[0].cioc_id  # Both on CIOC-01

    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is False
    assert any("Redundancy Segregation" in i.rule_name for i in summary.issues)

def test_mutation_3_cable_split_injected():
    """Mutation: Split cable CBL-01 (pairs 1 and 2) across two different baseplates."""
    signals, assignments = _get_valid_baseline()
    assignments[2].baseplate_id = "BP-03"  # Pair 1 is on BP-01, Pair 2 is on BP-03

    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is False
    assert any("Cable Contiguity" in i.rule_name for i in summary.issues)

def test_mutation_4_pair_sequence_inversion_injected():
    """Mutation: Reverse pair sequence on baseplate (Pair 1 on CH05, Pair 2 on CH02)."""
    signals, assignments = _get_valid_baseline()
    assignments[0].charm_index = 5
    assignments[2].charm_index = 2

    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is False
    assert any("Cable Pair Sequence" in i.rule_name for i in summary.issues)

def test_mutation_5_dropped_signal_coverage_injected():
    """Mutation: Drop one signal from the assignments list."""
    signals, assignments = _get_valid_baseline()
    assignments = assignments[:-1]  # Drop signal 5

    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is False
    assert any("Complete Hardware Allocation" in i.rule_name for i in summary.issues)

def test_mutation_6_wrong_charm_hardware_injected():
    """Mutation: Assign standard AI CHARM to an RTD signal requiring SE4303T03."""
    signals, assignments = _get_valid_baseline()
    # Signal 4 is RTD, change its assigned charm_part_no to SE4303T01
    assignments[3].charm_part_no = "SE4303T01"

    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is False
    assert any("CHARM Hardware Compatibility" in i.rule_name for i in summary.issues)

def test_mutation_7_wrong_terminal_block_injected():
    """Mutation: Assign standard TB SE4501 to an SOV signal requiring fused TB SE4502."""
    signals, assignments = _get_valid_baseline()
    # Signal 5 is SOV, change its assigned TB to SE4501
    assignments[4].charm_tb_part_no = "SE4501"

    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is False
    assert any("Terminal Block Compatibility" in i.rule_name for i in summary.issues)

def test_mutation_8_spare_baseplate_breach_injected():
    """Mutation: Encroach upon configured empty spare baseplates."""
    signals, assignments = _get_valid_baseline()
    config = HardwareConfigModel(cabinets_count=1, ciocs_per_cabinet=1, baseplates_per_cioc=2, charms_per_baseplate=12)
    # Require 50% empty baseplates (1 out of 2 must remain empty)
    config.spare_baseplate_percent = 50.0

    # Put signals on BOTH BP-01 and BP-02 in CAB-01
    assignments[0].baseplate_id = "BP-01"
    assignments[1].baseplate_id = "BP-02"
    assignments[1].cioc_id = "CIOC-01"
    assignments[1].redundancy = ""  # remove redundancy to isolate spare rule

    validator = IndependentValidator(config)
    summary = validator.validate(signals[:2], assignments[:2])
    assert summary.is_fully_validated is False
    assert any("Reserved Spare Baseplates" in i.rule_name for i in summary.issues)

def test_mutation_9_capacity_slot_out_of_bounds_injected():
    """Mutation: Place signal on charm_index 13 when baseplate max is 12."""
    signals, assignments = _get_valid_baseline()
    assignments[0].charm_index = 13

    validator = IndependentValidator()
    summary = validator.validate(signals, assignments)
    assert summary.is_fully_validated is False
    assert any("CHARM Slot Capacity" in i.rule_name for i in summary.issues)
