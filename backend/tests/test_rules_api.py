import os
import sys
import time
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import init_db
from models import ProjectCreate, SignalRecord, HardwareConfigModel
from db_service import DBService
from rules import RuleEvaluator

client = TestClient(app)

def setup_module(module):
    init_db()

def test_rules_crud_and_allocation_effect():
    ts = int(time.time() * 1000)
    # 1. Create a project
    p_data = ProjectCreate(
        project_id=f"PRJ-RULES-{ts}",
        name="Custom Rules Test Project",
        customer_name="Emerson Global",
        system="DeltaV v14.3"
    )
    p_res = client.post("/api/projects", json=p_data.model_dump())
    assert p_res.status_code == 200
    project = p_res.json()
    p_id = project["id"]

    # 2. GET rules - should return default rules (at least 15 rules)
    rules_res = client.get(f"/api/projects/{p_id}/rules")
    assert rules_res.status_code == 200
    rules = rules_res.json()
    assert len(rules) >= 15
    r_001 = next((r for r in rules if r["id"] == "R-001"), None)
    assert r_001 is not None
    assert r_001["enabled"] is True
    assert r_001["is_custom"] is False

    # 3. Toggle a default rule
    toggle_res = client.post(f"/api/projects/{p_id}/rules/R-001/toggle")
    assert toggle_res.status_code == 200
    toggled_r001 = toggle_res.json()
    assert toggled_r001["enabled"] is False

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
    create_res = client.post(f"/api/projects/{p_id}/rules", json=custom_rule_payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["id"] == f"CUST-ESD-{ts}"
    assert created["is_custom"] is True
    assert created["target_charm_part"] == "SE4302T02-ESD"

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
    put_res = client.put(f"/api/projects/{p_id}/rules/{created['id']}", json=update_payload)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["name"] == "Updated ESD Valve Rule"
    assert updated["target_charm_part"] == "SE4302T02-ESD-REV2"

    # 6. DELETE custom rule
    del_res = client.delete(f"/api/projects/{p_id}/rules/{created['id']}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Verify custom rule is gone
    rules_after_del = client.get(f"/api/projects/{p_id}/rules").json()
    assert not any(r["id"] == created["id"] for r in rules_after_del)

    # 7. Reset rules
    reset_res = client.post(f"/api/projects/{p_id}/rules/reset")
    assert reset_res.status_code == 200
    reset_rules = reset_res.json()
    r_001_reset = next(r for r in reset_rules if r["id"] == "R-001")
    assert r_001_reset["enabled"] is True  # reverted back to default True
