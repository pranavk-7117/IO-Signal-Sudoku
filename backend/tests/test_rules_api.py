import os
import sys
import time
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import (
    create_project, get_revisions, get_project_rules, toggle_project_rule,
    add_custom_rule, update_project_rule, delete_project_rule, reset_project_rules,
    run_allocation, explain_signal, export_allocation_workbook
)
from database import init_db
from models import ProjectCreate, SignalRecord, HardwareConfigModel
from db_service import DBService
from rules import RuleEvaluator

def setup_module(module):
    init_db()

def _get_val(obj, key):
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)

def test_rules_crud_and_allocation_effect():
    ts = int(time.time() * 1000)
    # 1. Create a project
    p_data = ProjectCreate(
        project_id=f"PRJ-RULES-{ts}",
        name="Custom Rules Test Project",
        customer_name="Emerson Global",
        system="DeltaV v14.3"
    )
    project = create_project(p_data)
    p_id = _get_val(project, "id")

    # 2. GET rules - should return default rules (at least 15 rules)
    rules = get_project_rules(p_id)
    assert len(rules) >= 15
    r_001 = next((r for r in rules if _get_val(r, "id") == "R-001"), None)
    assert r_001 is not None
    assert _get_val(r_001, "enabled") is True
    assert _get_val(r_001, "is_custom") is False

    # 3. Toggle a default rule
    toggled_r001 = toggle_project_rule(p_id, "R-001")
    assert _get_val(toggled_r001, "enabled") is False

    # 4. POST a new custom rule
    custom_rule_payload = {
        "id": f"CUST-ESD-{ts}",
        "name": "ESD High-Reliability Solenoid TB",
        "description": "Special fused TB SE4502-ESD for emergency trip valves",
        "enabled": True,
        "kind": "charm_terminal_map",
        "severity": "hard",
        "weight": 200,
        "target_column": "tag",
        "operator": "contains",
        "match_value": "-ESD-",
        "target_charm": "DO 24V DC Isolated",
        "target_charm_part": "SE4302T02-ESD",
        "target_terminal": "Fused-Injected-Power Terminal Block",
        "target_terminal_part": "SE4502-ESD",
        "target_terminals": "-, 2, 4"
    }
    created = add_custom_rule(p_id, custom_rule_payload)
    c_id = _get_val(created, "id")
    assert c_id == f"CUST-ESD-{ts}"
    assert _get_val(created, "is_custom") is True
    assert _get_val(created, "target_charm_part") == "SE4302T02-ESD"

    # Verify rule is evaluated by RuleEvaluator.from_hardware_config
    hw_config = DBService.get_hardware_config(p_id)
    evaluator = RuleEvaluator.from_hardware_config(hw_config)
    esd_sig = SignalRecord(id=1, tag=f"320-ESD-101-{ts}", signal_type="DO", description="ESD Valve")
    resolved_hw = evaluator.resolve_hardware_for_signal(esd_sig)
    assert resolved_hw["charm_part_no"] == "SE4302T02-ESD"
    assert resolved_hw["charm_tb_part_no"] == "SE4502-ESD"

    # 5. PUT (Edit) custom rule
    update_payload = {
        "name": "Updated ESD Valve Rule",
        "target_charm_part": "SE4302T02-ESD-REV2"
    }
    updated = update_project_rule(p_id, c_id, update_payload)
    assert _get_val(updated, "name") == "Updated ESD Valve Rule"
    assert _get_val(updated, "target_charm_part") == "SE4302T02-ESD-REV2"

    # 6. DELETE custom rule
    del_res = delete_project_rule(p_id, c_id)
    assert _get_val(del_res, "success") is True

    # Verify custom rule is gone
    rules_after_del = get_project_rules(p_id)
    assert not any(_get_val(r, "id") == c_id for r in rules_after_del)

    # 7. Reset rules
    reset_rules = reset_project_rules(p_id)
    r_001_reset = next(r for r in reset_rules if _get_val(r, "id") == "R-001")
    assert _get_val(r_001_reset, "enabled") is True  # reverted back to default True


def test_explainability_and_76_col_export():
    ts = int(time.time() * 1000)
    # 1. Create project
    p_data = ProjectCreate(
        project_id=f"PRJ-EXP-{ts}",
        name="Explainability Test Project",
        customer_name="Emerson Global",
        system="DeltaV v14.3"
    )
    project = create_project(p_data)
    p_id = _get_val(project, "id")

    revs = get_revisions(p_id)
    rev_id = _get_val(revs[0], "id")

    # 2. Insert RTD signal
    signals = [
        SignalRecord(
            id=1,
            tag=f"320-TT-101-{ts}",
            signal_type="AIR",
            electrical_spec="RTD 3-Wire",
            description="Reactor feed temperature",
            cable_id="320-CBL-01",
            pair_number=1,
            redundancy="A",
            logical_group="Unit 320"
        )
    ]
    DBService.save_imported_signals(p_id, rev_id, signals)

    # 3. Run allocation
    alloc_res = run_allocation(project_id=p_id, revision_id=rev_id, preserve_existing=True)
    assert alloc_res.allocated_count == 1

    # 4. Test Explainability endpoint
    exp = explain_signal(project_id=p_id, tag=f"320-TT-101-{ts}", revision_id=rev_id)
    assert exp["found"] is True
    assert exp["tag"] == f"320-TT-101-{ts}"
    assert "hardware_attribution" in exp
    assert exp["hardware_attribution"]["rule_id"] in ["R-MAP-01", "R-MAP-DEFAULT"]
    assert "redundancy_attribution" in exp
    assert "contiguity_attribution" in exp
    assert "summary_narrative" in exp

    # 5. Test 76-column Excel export
    file_response = export_allocation_workbook(project_id=p_id, revision_id=rev_id)
    assert file_response.path is not None
    assert os.path.exists(file_response.path)
    assert os.path.getsize(file_response.path) > 1000
