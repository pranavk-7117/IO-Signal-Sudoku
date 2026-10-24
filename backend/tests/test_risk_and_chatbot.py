import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import (
    HardwareConfigModel, SignalRecord, AssignmentModel,
    ApplySuggestionRequest, ChatRequest, ChatMessage
)
from engine.risk_engine import RiskEngine
from engine.chatbot import ChatbotService
from main import get_project_risk_assessment, apply_rule_suggestion, handle_chat_query
from database import init_db

def test_risk_engine_calculation_and_suggestions():
    config = HardwareConfigModel()
    config.spare_percentage = 5.0  # < 10%
    config.rules.enforce_ab_redundancy_separation = False
    config.rules.enforce_cable_grouping = False

    signals = [
        SignalRecord(id=1, tag="SOV-101", description="EMERGENCY SHUTDOWN SOLENOID VALVE", signal_type="DO"),
        SignalRecord(id=2, tag="PT-101A", description="PRESSURE TRANSMITTER TRAIN A", signal_type="AI", redundancy="Train A"),
        SignalRecord(id=3, tag="PT-101B", description="PRESSURE TRANSMITTER TRAIN B", signal_type="AI", redundancy="Train B"),
    ]

    # Non-isolated assignments
    assignments = [
        AssignmentModel(signal_id=1, tag="SOV-101", signal_type="DO", charm_type="SE4302T01", terminal_block="SE4501", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=1, status="Allocated"),
        AssignmentModel(signal_id=2, tag="PT-101A", signal_type="AI", redundancy="Train A", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=2, status="Allocated"),
        AssignmentModel(signal_id=3, tag="PT-101B", signal_type="AI", redundancy="Train B", cabinet_id="CAB-01", cioc_id="CIOC-01", baseplate_id="BP-01", charm_index=3, status="Allocated"),
    ]

    res = RiskEngine.evaluate_project_risk(config, signals, assignments)

    assert res.overall_score > 50, f"Expected high risk score, got {res.overall_score}"
    assert res.risk_level in ["HIGH", "CRITICAL"]

    # Verify actionable suggestions exist
    sug_targets = [s.rule_target for s in res.suggestions]
    assert "enforce_ab_redundancy_separation" in sug_targets
    assert "spare_percentage" in sug_targets
    assert "custom_rule_sov_isolated" in sug_targets

def test_apply_rule_suggestion_api():
    init_db()
    # Apply 10% spare suggestion
    req = ApplySuggestionRequest(
        suggestion_id="sug-set-spare-10",
        rule_target="spare_percentage",
        suggested_value=10.0
    )
    res = apply_rule_suggestion(project_id=1, req=req)
    assert res["rule_target"] == "spare_percentage"
    assert res["new_value"] == 10.0

def test_chatbot_answering_service():
    init_db()
    req = ChatRequest(
        project_id=1,
        messages=[
            ChatMessage(role="user", content="Explain why Solenoid valves require isolated DO modules in DeltaV.")
        ]
    )
    res = handle_chat_query(req)
    assert res.message is not None
    assert len(res.message.content) > 20
    assert "Isolated" in res.message.content or "SE4302T02" in res.message.content or "DeltaV" in res.message.content
