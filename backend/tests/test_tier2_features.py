import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import HardwareConfigModel, SignalRecord, AssignmentModel
from engine.preprocessing_pipeline import SignalPreprocessor, ConflictAffinityGraph
from engine.pareto_layout import ParetoLayoutEngine
from engine.wired_spare_takeover import WiredSpareTakeoverEngine
from engine.deliverables_generator import DeliverablesGenerator

def test_preprocessing_partitioning_and_conflict_graph():
    signals = [
        # PIB-30 signals
        SignalRecord(tag="320-FT-80001", signal_type="AI", redundancy="A", loop_name="LP-80001", cable_id="320-CBL-01", pair_number=1, technical_room="PIB-30"),
        SignalRecord(tag="320-FT-80002", signal_type="AI", redundancy="B", loop_name="LP-80001", cable_id="320-CBL-02", pair_number=1, technical_room="PIB-30"),
        # PIB-24 signal
        SignalRecord(tag="500-PT-50001", signal_type="AI", redundancy="SIMPLEX", loop_name="LP-50001", cable_id="500-CBL-01", pair_number=1, technical_room="PIB-24"),
        # Cabinet alarm
        SignalRecord(tag="320-EJA01001-T", signal_type="DI", tag_status="Cabinet Alarm", technical_room="PIB-30"),
        # Deleted signal
        SignalRecord(tag="320-FT-DELETED", signal_type="AI", tag_status="DELETED", technical_room="PIB-30")
    ]

    prep = SignalPreprocessor.preprocess_dataset(signals)
    assert prep["total_signals_received"] == 5
    assert prep["deleted_signals_vacated"] == 1
    assert prep["internal_alarms_preassigned"] == 1
    assert prep["active_signals_fed_to_solver"] == 3
    assert "PIB-30" in prep["technical_room_partitions"]
    assert "PIB-24" in prep["technical_room_partitions"]
    assert prep["solver_search_space_reduction_pct"] > 0

    # Conflict graph
    graph_dict = prep["conflict_graph"]
    assert graph_dict["node_count"] >= 3
    # LP-80001 has Train A and Train B -> conflict edge
    assert any(e["type"] == "conflict_ab" for e in graph_dict["edges"])

    # Vector similarity test
    v1 = SignalPreprocessor.compute_token_vector("PRESSURE TRANSMITTER SEPARATOR 101")
    v2 = SignalPreprocessor.compute_token_vector("PRESSURE INDICATOR SEPARATOR 101")
    v3 = SignalPreprocessor.compute_token_vector("TEMPERATURE SENSOR BOILER 99")
    sim12 = SignalPreprocessor.vector_cosine_similarity(v1, v2)
    sim13 = SignalPreprocessor.vector_cosine_similarity(v1, v3)
    assert sim12 > sim13

def test_preprocessing_analysis_endpoint():
    from main import get_preprocessing_analysis
    from db_service import DBService
    from database import init_db
    init_db()
    projs = DBService.list_projects()
    if not projs:
        pytest.skip("No projects available")
    proj_id = projs[0]["id"]
    res = get_preprocessing_analysis(proj_id)
    assert res is not None
    assert "total_signals_received" in res
    assert "active_signals_fed_to_solver" in res
    assert "conflict_graph" in res

def test_pareto_layout_alternatives():
    config = HardwareConfigModel()
    signals = [SignalRecord(tag=f"FT-{i}", signal_type="AI") for i in range(1, 101)]
    assignments = [
        AssignmentModel(signal_id=i, tag=f"FT-{i}", signal_type="AI", status="Allocated", tag_status="Field")
        for i in range(1, 101)
    ]

    pareto = ParetoLayoutEngine.generate_pareto_alternatives(config, signals, assignments)
    assert len(pareto["alternatives"]) == 3
    
    alt_ids = [a["id"] for a in pareto["alternatives"]]
    assert "ALT_MIN_HARDWARE" in alt_ids
    assert "ALT_MAX_SPARE" in alt_ids
    assert "ALT_MIN_MOVEMENT" in alt_ids

    # Min hardware should have fewer cabinets and lowest cost
    alt1 = next(a for a in pareto["alternatives"] if a["id"] == "ALT_MIN_HARDWARE")
    alt2 = next(a for a in pareto["alternatives"] if a["id"] == "ALT_MAX_SPARE")
    assert alt1["metrics"]["estimated_hardware_cost_usd"] < alt2["metrics"]["estimated_hardware_cost_usd"]
    assert alt1["boq"]["cioc_carriers"] < alt2["boq"]["cioc_carriers"]

def test_wired_spare_takeover_zero_hardware_cost():
    # Existing allocation with 1 wired spare AI on P30DPK320101
    current_assigns = [
        AssignmentModel(
            signal_id=999,
            tag="3201DSP0100111",
            signal_type="AI",
            status="Allocated",
            tag_status="Wired Spare",
            controller="P30DPK320101",
            cabinet_id="P30-DCS-32001-01",
            cioc_id="P30DCIOC3201001",
            baseplate_id="001-CBP-1",
            charm_index=11,
            charm_type="AI 4-20 MA HART CHARM",
            terminal_block="Standard CHARM Terminal Block"
        )
    ]

    # New signal added in Rev B
    new_signals = [
        SignalRecord(tag="320-PT-80099", signal_type="AI", description="NEW PRESSURE TRANSMITTER", technical_room="PIB-30")
    ]

    takeover = WiredSpareTakeoverEngine.identify_takeover_candidates(new_signals, current_assigns)
    assert takeover["wired_spares_taken_over_count"] == 1
    assert takeover["total_hardware_cost_saved_usd"] > 0
    match = takeover["takeover_matches"][0]
    assert match["new_signal_tag"] == "320-PT-80099"
    assert match["target_wired_spare_tag"] == "3201DSP0100111"
    assert match["hardware_cost_delta_usd"] == 0.0

    # Apply takeover
    updated_assigns = WiredSpareTakeoverEngine.apply_takeover_to_assignments(current_assigns, takeover["takeover_matches"])
    assert len(updated_assigns) == 1
    assert updated_assigns[0].tag == "320-PT-80099"
    assert updated_assigns[0].tag_status == "Field"
    assert updated_assigns[0].change_type == "Wired Spare Takeover"

def test_deliverables_and_qr_labels_generator():
    assignments = [
        AssignmentModel(
            signal_id=1,
            tag="320-FT-80001",
            signal_type="AI",
            description="FLOW TRANSMITTER",
            status="Allocated",
            tag_status="Field",
            cable_id="320-CBL-01",
            pair_number=1,
            loop_name="LOOP-80001",
            cabinet_id="P30-DCS-32001-01",
            cioc_id="P30DCIOC3201001",
            baseplate_id="001-CBP-1",
            charm_index=1
        ),
        AssignmentModel(
            signal_id=2,
            tag="320-FT-80002",
            signal_type="AI",
            description="FLOW TRANSMITTER B",
            status="Allocated",
            tag_status="Field",
            cable_id="320-CBL-01",
            pair_number=2,
            loop_name="LOOP-80001",
            cabinet_id="P30-DCS-32001-01",
            cioc_id="P30DCIOC3201001",
            baseplate_id="001-CBP-1",
            charm_index=2
        )
    ]

    pack = DeliverablesGenerator.generate_deliverables_pack("Test Plant", "Rev A", assignments)
    assert len(pack["termination_schedules"]) == 1
    assert len(pack["master_cable_schedule"]) == 1
    assert len(pack["loop_check_sheets"]) == 2
    assert len(pack["fat_checklist"]) >= 4

    # QR labels
    labels = DeliverablesGenerator.generate_field_qr_labels(assignments)
    assert len(labels) == 1
    assert labels[0]["assigned_signals_count"] == 2
    assert "DELTAV://BP" in labels[0]["qr_payload"]
    assert len(labels[0]["channels"]) == 12
