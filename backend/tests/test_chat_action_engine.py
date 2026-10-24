import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import (
    ChatRequest, ChatMessage, ChatActionApplyRequest,
    SignalRecord, AssignmentModel
)
from database import init_db
from db_service import DBService
from engine.chat_action_engine import ChatActionEngine
from main import handle_chat_query, apply_chat_action

@pytest.fixture(autouse=True)
def setup_database():
    init_db()

def test_chat_action_propose_move_signal():
    # Fetch demo project or project 1
    projects = DBService.list_projects()
    if not projects:
        pytest.skip("No demo project available")
    proj_id = projects[0]["id"]
    revs = DBService.get_revisions(proj_id)
    rev_id = revs[0]["id"]

    assignments = DBService.get_assignments(proj_id, rev_id)
    if not assignments:
        pytest.skip("No assignments in project")

    tag = assignments[0].tag

    # Test parse and propose
    proposal = ChatActionEngine.parse_and_propose_action(
        f"Move {tag} to CIOC-02",
        proj_id,
        rev_id
    )

    assert proposal is not None
    assert proposal["action_type"] == "MOVE_SIGNAL"
    assert proposal["target_entity"] == tag
    assert "CIOC-02" in proposal["proposed_value"]
    assert "dry_run" in proposal
    assert proposal["dry_run"]["status"] in ["PASS", "WARNING"]
    assert proposal["dry_run"]["new_regressions"] >= 0

def test_chat_action_propose_upgrade_tb():
    projects = DBService.list_projects()
    if not projects:
        pytest.skip("No demo project available")
    proj_id = projects[0]["id"]
    revs = DBService.get_revisions(proj_id)
    rev_id = revs[0]["id"]

    assignments = DBService.get_assignments(proj_id, rev_id)
    if not assignments:
        pytest.skip("No assignments in project")

    tag = assignments[0].tag

    proposal = ChatActionEngine.parse_and_propose_action(
        f"Upgrade {tag} to isolated TB",
        proj_id,
        rev_id
    )

    assert proposal is not None
    assert proposal["action_type"] == "UPGRADE_TB"
    assert proposal["target_entity"] == tag
    assert "SE4302T02" in proposal["proposed_value"]
    assert proposal["dry_run"]["status"] == "PASS"

def test_chat_action_propose_rule_update():
    projects = DBService.list_projects()
    if not projects:
        pytest.skip("No demo project available")
    proj_id = projects[0]["id"]
    revs = DBService.get_revisions(proj_id)
    rev_id = revs[0]["id"]

    proposal = ChatActionEngine.parse_and_propose_action(
        "Enforce Train A/B Redundancy Separation",
        proj_id,
        rev_id
    )

    assert proposal is not None
    assert proposal["action_type"] == "UPDATE_RULE"
    assert proposal["params"]["rule_target"] == "enforce_ab_redundancy_separation"
    assert proposal["dry_run"]["status"] == "PASS"

def test_chat_action_execution_and_audit():
    projects = DBService.list_projects()
    if not projects:
        pytest.skip("No demo project available")
    proj_id = projects[0]["id"]
    revs = DBService.get_revisions(proj_id)
    rev_id = revs[0]["id"]

    assignments = DBService.get_assignments(proj_id, rev_id)
    if not assignments:
        pytest.skip("No assignments in project")

    tag = assignments[0].tag

    proposal = ChatActionEngine.parse_and_propose_action(
        f"Move {tag} to CIOC-02",
        proj_id,
        rev_id
    )
    assert proposal is not None

    # Apply via apply_chat_action endpoint function
    apply_req = ChatActionApplyRequest(
        project_id=proj_id,
        revision_id=rev_id,
        action_proposal=proposal,
        user_name="Lead DCS Engineer"
    )

    res = apply_chat_action(apply_req)
    assert res["success"] is True
    assert "Successfully applied" in res["message"]

    # Verify assignment updated in DB
    updated_assigns = DBService.get_assignments(proj_id, rev_id)
    updated_tag = next((a for a in updated_assigns if a.tag == tag), None)
    assert updated_tag is not None
    assert updated_tag.cioc_id == "CIOC-02"

    # Verify audit log was recorded
    audit_logs = DBService.get_audit_logs(proj_id)
    matching_log = next((l for l in audit_logs if l.action == "AI_COPILOT_ACTION_APPLIED" and l.entity_id == tag), None)
    assert matching_log is not None
    assert "AI Assisted" in matching_log.user_name

def test_chat_query_endpoint_attaches_proposal():
    projects = DBService.list_projects()
    if not projects:
        pytest.skip("No demo project available")
    proj_id = projects[0]["id"]
    revs = DBService.get_revisions(proj_id)
    rev_id = revs[0]["id"]

    assignments = DBService.get_assignments(proj_id, rev_id)
    if not assignments:
        pytest.skip("No assignments in project")

    tag = assignments[0].tag

    chat_req = ChatRequest(
        project_id=proj_id,
        revision_id=rev_id,
        messages=[
            ChatMessage(role="user", content=f"Move {tag} to CIOC-02")
        ]
    )

    res = handle_chat_query(chat_req)
    assert res.action_proposal is not None
    assert res.action_proposal["action_type"] == "MOVE_SIGNAL"
    assert res.action_proposal["target_entity"] == tag
