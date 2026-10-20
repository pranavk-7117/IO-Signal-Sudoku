import pytest
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import init_db
from models import ProjectCreate, SignalRecord
from db_service import DBService

client = TestClient(app)

def setup_module(module):
    init_db()

def test_api_real_cpsat_solver_and_approval_flow():
    ts = int(time.time() * 1000)
    # 1. Create a clean test project with unique ID
    p_data = ProjectCreate(
        project_id=f"PRJ-API-{ts}",
        name="API CP-SAT Test Project",
        customer_name="Test Engineering Corp",
        system="DeltaV v14.3"
    )
    p_res = client.post("/api/projects", json=p_data.model_dump())
    assert p_res.status_code == 200
    project = p_res.json()
    p_id = project["id"]

    # 2. Get active revision
    revs_res = client.get(f"/api/projects/{p_id}/revisions")
    assert revs_res.status_code == 200
    revs = revs_res.json()
    assert len(revs) > 0
    rev_id = revs[0]["id"]

    # 3. Insert valid signals
    signals = [
        SignalRecord(id=1, tag=f"TT-101-{ts}", signal_type="AI", cable_id="CBL-01", pair_number=1, logical_group="Unit1"),
        SignalRecord(id=2, tag=f"TT-102-{ts}", signal_type="AI", cable_id="CBL-01", pair_number=2, logical_group="Unit1"),
        SignalRecord(id=3, tag=f"FV-101-{ts}", signal_type="AO", cable_id="CBL-01", pair_number=3, logical_group="Unit1"),
    ]
    DBService.save_imported_signals(p_id, rev_id, signals)

    # 4. Trigger allocation via POST /api/allocation/run
    alloc_res = client.post(f"/api/allocation/run?project_id={p_id}&revision_id={rev_id}&preserve_existing=true")
    assert alloc_res.status_code == 200
    result = alloc_res.json()

    # Verify structured CP-SAT instrumentation evidence in the response
    assert result["allocated_count"] == 3
    assert result["unallocated_count"] == 0
    assert result["validation_errors"] == 0
    assert result["approval_eligible"] is True
    assert "diagnostics" in result
    diag = result["diagnostics"]
    assert diag["solver_name"] == "Google OR-Tools CP-SAT"
    assert diag["solver_status"] in ["OPTIMAL", "FEASIBLE"]
    assert diag["num_decision_variables"] > 0
    assert diag["num_constraints"] > 0

    # 5. Call Approval Gate
    approve_res = client.post("/api/allocation/approve", json={
        "project_id": p_id,
        "revision_id": rev_id,
        "reviewer_name": "Chief Automation Engineer",
        "notes": "Verified against design rules"
    })
    assert approve_res.status_code == 200
    appr = approve_res.json()
    assert appr["is_approved"] is True
    assert appr["approval_status"] == "Approved"
    assert appr["blocking_issues_count"] == 0

    # 6. Verify fail-closed approval when an unallocated or conflicting signal exists
    p2_res = client.post("/api/projects", json={
        "project_id": f"PRJ-FAIL-{ts}",
        "name": "Failing Gate Test",
        "customer_name": "Test Client"
    })
    p2 = p2_res.json()
    p2_id = p2["id"]
    rev2_id = client.get(f"/api/projects/{p2_id}/revisions").json()[0]["id"]

    # Insert an unallocated/unsupported signal
    bad_signals = [
        SignalRecord(id=1, tag=f"BAD-OPTIC-{ts}", signal_type="UNSUPPORTED_440V")
    ]
    DBService.save_imported_signals(p2_id, rev2_id, bad_signals)
    client.post(f"/api/allocation/run?project_id={p2_id}&revision_id={rev2_id}")

    # Attempt to approve
    bad_approve_res = client.post("/api/allocation/approve", json={
        "project_id": p2_id,
        "revision_id": rev2_id,
        "reviewer_name": "Chief Engineer"
    })
    assert bad_approve_res.status_code == 200
    bad_appr = bad_approve_res.json()
    # MUST BE REJECTED
    assert bad_appr["is_approved"] is False
    assert bad_appr["approval_status"] == "Rejected"
    assert bad_appr["blocking_issues_count"] > 0
