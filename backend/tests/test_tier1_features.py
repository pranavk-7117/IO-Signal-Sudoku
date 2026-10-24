import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from engine.counterfactual_engine import CounterfactualEngine, BlastRadiusSimulator
from engine.preflight_lint import PreflightLintDoctor, ReferenceScorecardEngine
from models import HardwareConfigModel, SignalRecord, AssignmentModel

client = TestClient(app)

def test_counterfactual_engine_logic():
    config = HardwareConfigModel()
    sig_a = SignalRecord(tag="101-FT-001", signal_type="AI", redundancy="A", cable_id="CBL-01", pair_number=1)
    sig_b = SignalRecord(tag="101-FT-002", signal_type="AI", redundancy="B", cable_id="CBL-02", pair_number=1)
    
    # Place sig_a on even CIOC (CIOC-02, BP-01, CH 1)
    assign_a = AssignmentModel(
        signal_id=1,
        tag="101-FT-001",
        signal_type="AI",
        status="Allocated",
        redundancy="A",
        cabinet_id="CAB-01",
        cioc_id="P30DCIOC3201002",
        baseplate_id="001-CBP-1",
        charm_index=1,
        channel_no=1
    )
    
    # 1. Non-existent tag check
    res_missing = CounterfactualEngine.evaluate_why_not_here(
        config=config,
        signals=[sig_a, sig_b],
        assignments=[assign_a],
        tag="UNKNOWN-TAG",
        target_cabinet="CAB-01",
        target_cioc="P30DCIOC3201002",
        target_baseplate="001-CBP-1",
        target_channel=2
    )
    assert res_missing["is_allowed"] is False
    assert "verdict" in res_missing
    assert "not found" in res_missing["verdict"]

    # 2. Candidate slot collision (slot already occupied by sig_a)
    res_collision = CounterfactualEngine.evaluate_why_not_here(
        config=config,
        signals=[sig_a, sig_b],
        assignments=[assign_a],
        tag="101-FT-002",
        target_cabinet="CAB-01",
        target_cioc="P30DCIOC3201002",
        target_baseplate="001-CBP-1",
        target_channel=1
    )
    assert res_collision["is_allowed"] is False
    assert any("occupied" in r.lower() for r in res_collision["blocking_reasons"])

    # 3. Candidate slot parity conflict (Train B placed on even CIOC P30DCIOC3201002 where Train A lives)
    res_parity = CounterfactualEngine.evaluate_why_not_here(
        config=config,
        signals=[sig_a, sig_b],
        assignments=[assign_a],
        tag="101-FT-002",
        target_cabinet="CAB-01",
        target_cioc="P30DCIOC3201002",
        target_baseplate="001-CBP-1",
        target_channel=2
    )
    assert res_parity["is_allowed"] is False
    assert any("train b" in r.lower() for r in res_parity["blocking_reasons"])

    # 4. Valid placement on odd CIOC (P30DCIOC3201001, BP-02, CH 3)
    res_valid = CounterfactualEngine.evaluate_why_not_here(
        config=config,
        signals=[sig_a, sig_b],
        assignments=[assign_a],
        tag="101-FT-002",
        target_cabinet="CAB-01",
        target_cioc="P30DCIOC3201001",
        target_baseplate="001-CBP-2",
        target_channel=3
    )
    assert res_valid["is_allowed"] is True
    assert res_valid["verdict"] == "Mathematically Feasible"

def test_blast_radius_simulator_resilience():
    config = HardwareConfigModel()
    sig_a = SignalRecord(tag="101-FT-001", signal_type="AI", redundancy="A", loop_name="LOOP-101")
    sig_b = SignalRecord(tag="101-FT-002", signal_type="AI", redundancy="B", loop_name="LOOP-101")
    sig_c = SignalRecord(tag="102-TT-001", signal_type="AI", redundancy="SIMPLEX", loop_name="LOOP-102")

    assigns = [
        AssignmentModel(signal_id=1, tag="101-FT-001", signal_type="AI", status="Allocated", redundancy="A", loop_name="LOOP-101", cioc_id="CIOC-01", cabinet_id="CAB-01", baseplate_id="BP-01", charm_index=1),
        AssignmentModel(signal_id=2, tag="101-FT-002", signal_type="AI", status="Allocated", redundancy="B", loop_name="LOOP-101", cioc_id="CIOC-02", cabinet_id="CAB-01", baseplate_id="BP-01", charm_index=1),
        AssignmentModel(signal_id=3, tag="102-TT-001", signal_type="AI", status="Allocated", redundancy="SIMPLEX", loop_name="LOOP-102", cioc_id="CIOC-01", cabinet_id="CAB-01", baseplate_id="BP-01", charm_index=2),
    ]

    sim = BlastRadiusSimulator.simulate_hardware_failure(
        config=config,
        signals=[sig_a, sig_b, sig_c],
        assignments=assigns,
        failure_type="cioc",
        target_id="CIOC-01"
    )

    assert sim["total_channels_lost"] == 2
    assert sim["protected_channels_count"] == 1  # 101-FT-001 has 101-FT-002 surviving on CIOC-02!
    assert sim["tripped_channels_count"] == 1    # 102-TT-001 has no redundant counterpart
    assert sim["resilience_score_pct"] == 50.0

def test_preflight_lint_and_reference_scorecard():
    config = HardwareConfigModel()
    signals = []
    assignments = [
        # Inductive DO with generic non-isolated hardware
        AssignmentModel(signal_id=1, tag="SOV-101", description="SOLENOID VALVE", signal_type="DO", status="Allocated", charm_type="SE4002S", charm_tb_part_no="SE4501", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1),
        # Protected DO
        AssignmentModel(signal_id=2, tag="SOV-102", description="SOLENOID VALVE", signal_type="DO", status="Allocated", charm_type="SE4302T02", charm_tb_part_no="SE4502", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=2),
    ]

    lint = PreflightLintDoctor.run_preflight_checks(config, signals, assignments)
    assert lint["health_score"] < 100
    assert any(c["id"] == "LINT-DO-01" and c["status"] == "FAIL" for c in lint["checks"])

    # Scorecard
    scorecard = ReferenceScorecardEngine.generate_scorecard(assignments)
    assert "parity_score_pct" in scorecard
    assert len(scorecard["scorecard_items"]) > 0
