"""
Rule Evaluator Engine
Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)
Evaluates dynamic rules-as-data for hardware selection, constraints, and validation.
"""

import json
import os
import re
from typing import List, Dict, Any, Optional, Tuple
from rules.rule_models import RuleDefinition, RuleKind, RuleSeverity, HardwareSystemConfig, RedundancyNormalizer

class RuleEvaluator:
    def __init__(
        self,
        rules: Optional[List[RuleDefinition]] = None,
        hardware_config: Optional[HardwareSystemConfig] = None
    ):
        self.rules: List[RuleDefinition] = rules or []
        self.hardware_config: HardwareSystemConfig = hardware_config or HardwareSystemConfig()
        if not self.rules:
            self.load_default_rules()

    def load_default_rules(self, config_dir: Optional[str] = None):
        """Loads default_rules.json and default_hardware.json from config directory."""
        if config_dir is None:
            # Look in ../config or ./config or ../../config
            possible_dirs = [
                os.path.join(os.path.dirname(__file__), "..", "..", "config"),
                os.path.join(os.path.dirname(__file__), "..", "config"),
                os.path.join(os.getcwd(), "config")
            ]
            for d in possible_dirs:
                if os.path.exists(os.path.join(d, "default_rules.json")):
                    config_dir = d
                    break

        if config_dir:
            rules_path = os.path.join(config_dir, "default_rules.json")
            if os.path.exists(rules_path):
                with open(rules_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.rules = [RuleDefinition(**r) for r in data]

            hw_path = os.path.join(config_dir, "default_hardware.json")
            if os.path.exists(hw_path):
                with open(hw_path, "r", encoding="utf-8") as f:
                    hw_data = json.load(f)
                    self.hardware_config = HardwareSystemConfig(**hw_data)

    @classmethod
    def from_hardware_config(cls, hw_config: Optional[Any] = None) -> "RuleEvaluator":
        evaluator = cls()
        if not hw_config:
            return evaluator

        # Gather custom rules from hardware config or nested rules
        custom_rules_data = []
        if hasattr(hw_config, "custom_rules") and hw_config.custom_rules:
            custom_rules_data.extend(hw_config.custom_rules)
        elif hasattr(hw_config, "rules") and hasattr(hw_config.rules, "custom_rules") and hw_config.rules.custom_rules:
            custom_rules_data.extend(hw_config.rules.custom_rules)

        # Check for rules_override (e.g. toggled enabled status for default rules)
        overrides = {}
        if hasattr(hw_config, "rules_override") and isinstance(hw_config.rules_override, dict):
            overrides = hw_config.rules_override

        # Apply overrides to existing default rules
        for r in evaluator.rules:
            if r.id in overrides:
                ov = overrides[r.id]
                if isinstance(ov, dict):
                    if "enabled" in ov:
                        r.enabled = bool(ov["enabled"])
                    if "severity" in ov:
                        r.severity = RuleSeverity.HARD if str(ov["severity"]).lower() == "hard" else RuleSeverity.SOFT
                elif isinstance(ov, bool):
                    r.enabled = ov

        # Convert custom rules into RuleDefinitions and prepend them
        parsed_custom = []
        for cr in custom_rules_data:
            try:
                if isinstance(cr, RuleDefinition):
                    parsed_custom.append(cr)
                elif isinstance(cr, dict):
                    rule_id = cr.get("id", f"CUST-{len(parsed_custom)+1:03d}")
                    name = cr.get("name", "Custom Rule")
                    enabled = cr.get("enabled", True)
                    kind_str = cr.get("kind", "charm_terminal_map")
                    severity_str = str(cr.get("severity", "hard")).lower()
                    severity = RuleSeverity.HARD if severity_str == "hard" else RuleSeverity.SOFT
                    params = cr.get("params") or {}
                    
                    if (not params or not params.get("hardware")) and (cr.get("target_charm") or cr.get("match_value")):
                        cond = {
                            "column": cr.get("target_column") or "signal_type",
                            "operator": cr.get("operator") or "equals",
                            "value": cr.get("match_value") or "",
                        }
                        if cr.get("operator") == "in":
                            cond["values"] = [v.strip() for v in (cr.get("match_value") or "").split(",") if v.strip()]
                        
                        params = {
                            "conditions": [cond],
                            "match_mode": "any",
                            "hardware": {
                                "charm_type": cr.get("target_charm") or "AI 4-20 MA HART CHARM",
                                "charm_part_no": cr.get("target_charm_part") or "SE4303T01",
                                "terminal_block": cr.get("target_terminal") or "Standard CHARM Terminal Block",
                                "charm_tb_part_no": cr.get("target_terminal_part") or "SE4501",
                                "charm_tb_terminals": cr.get("target_terminals") or "1, 2"
                            }
                        }
                    
                    parsed_custom.append(RuleDefinition(
                        id=rule_id,
                        name=name,
                        enabled=enabled,
                        kind=RuleKind(kind_str) if kind_str in [k.value for k in RuleKind] else RuleKind.CHARM_TERMINAL_MAP,
                        severity=severity,
                        weight=int(cr.get("weight", 120)),
                        scope=cr.get("scope", "signal"),
                        params=params
                    ))
            except Exception:
                continue

        if parsed_custom:
            evaluator.rules = parsed_custom + [r for r in evaluator.rules if r.id not in {c.id for c in parsed_custom}]

        return evaluator

    def normalize_redundancy(self, raw_val: Optional[str]) -> Optional[str]:
        return RedundancyNormalizer.normalize(raw_val, self.hardware_config.redundancy_mappings)

    @staticmethod
    def _match_single_condition(sig_dict: Dict[str, Any], cond: Dict[str, Any]) -> bool:
        col = cond.get("column", "")
        op = cond.get("operator", "equals").lower()
        val = cond.get("value")
        values = cond.get("values", [])

        # Get field value from signal dictionary (case-insensitive key)
        raw_val = None
        for k, v in sig_dict.items():
            if k.lower() == col.lower() or k.lower().replace("_", "") == col.lower().replace("_", ""):
                raw_val = v
                break

        if raw_val is None:
            return False

        s_val = str(raw_val).strip()
        s_val_lower = s_val.lower()

        if op == "equals":
            return s_val_lower == str(val).lower()
        elif op == "contains":
            return str(val).lower() in s_val_lower
        elif op == "in":
            return any(s_val_lower == str(v).lower() for v in values)
        elif op == "regex":
            pat = cond.get("pattern", str(val))
            return bool(re.search(pat, s_val, re.IGNORECASE))
        elif op == "startswith":
            return s_val_lower.startswith(str(val).lower())
        elif op == "endswith":
            return s_val_lower.endswith(str(val).lower())
        return False

    def resolve_hardware_for_signal(self, signal: Any) -> Dict[str, str]:
        """
        Determines (charm_type, charm_part_no, terminal_block, charm_tb_part_no, charm_tb_terminals)
        by evaluating charm_terminal_map rules in priority order.
        """
        # Convert signal to dictionary
        if hasattr(signal, "model_dump"):
            sig_dict = signal.model_dump()
        elif hasattr(signal, "__dict__"):
            sig_dict = signal.__dict__
        elif isinstance(signal, dict):
            sig_dict = signal
        else:
            sig_dict = {}

        for rule in self.rules:
            if not rule.enabled or rule.kind != RuleKind.CHARM_TERMINAL_MAP:
                continue

            params = rule.params
            # Optional type check (e.g. must be a DO type)
            if "type_check" in params:
                if not self._match_single_condition(sig_dict, params["type_check"]):
                    continue

            conditions = params.get("conditions", [])
            match_mode = params.get("match_mode", "any")

            if not conditions:
                # If scope is spare_slot and tag indicates spare slot
                if rule.scope == "spare_slot" and sig_dict.get("tag_status") == "Spare Slot":
                    return params.get("hardware", {})
                continue

            matches = [self._match_single_condition(sig_dict, cond) for cond in conditions]
            is_match = all(matches) if match_mode == "all" else any(matches)

            if is_match and "hardware" in params:
                return params["hardware"]

        # Universal fallback if no rule matched
        st = sig_dict.get("signal_type", "UNKNOWN")
        return {
            "charm_type": f"{st} CHARM",
            "charm_part_no": "SE4303T01",
            "terminal_block": "Standard CHARM Terminal Block",
            "charm_tb_part_no": "SE4501",
            "charm_tb_terminals": "1, 2"
        }

    def is_cabinet_diagnostic_alarm(self, signal: Any) -> bool:
        """Evaluates reserve rules (e.g. Baseplate 1 diagnostics)."""
        if hasattr(signal, "model_dump"):
            sig_dict = signal.model_dump()
        elif hasattr(signal, "__dict__"):
            sig_dict = signal.__dict__
        else:
            sig_dict = signal if isinstance(signal, dict) else {}

        for rule in self.rules:
            if not rule.enabled or rule.kind != RuleKind.RESERVE:
                continue
            params = rule.params
            cond = params.get("match_condition")
            if cond and self._match_single_condition(sig_dict, cond):
                return True
            fb_cond = params.get("fallback_condition")
            if fb_cond and self._match_single_condition(sig_dict, fb_cond):
                return True
        return False
