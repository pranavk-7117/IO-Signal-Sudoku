import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from rules import (
    RuleEvaluator,
    NamingEngine,
    NamingPatternsConfig,
    HardwareSystemConfig,
    RuleDefinition,
    RuleKind,
    RuleSeverity
)
from models import SignalRecord

def test_rule_engine_loads_defaults():
    evaluator = RuleEvaluator()
    assert len(evaluator.rules) >= 10
    assert evaluator.hardware_config is not None
    assert evaluator.hardware_config.hardware_hierarchy.charms_per_baseplate == 12
    assert evaluator.hardware_config.hardware_hierarchy.baseplates_per_cioc == 8

def test_redundancy_normalisation_table():
    evaluator = RuleEvaluator()
    # Industrial redundancy aliases mapped to A
    assert evaluator.normalize_redundancy("Duty") == "A"
    assert evaluator.normalize_redundancy("PRIMARY") == "A"
    assert evaluator.normalize_redundancy("Train A") == "A"
    assert evaluator.normalize_redundancy("A-CONTROL") == "A"
    assert evaluator.normalize_redundancy("A") == "A"

    # Industrial redundancy aliases mapped to B
    assert evaluator.normalize_redundancy("Standby") == "B"
    assert evaluator.normalize_redundancy("SECONDARY") == "B"
    assert evaluator.normalize_redundancy("Backup") == "B"
    assert evaluator.normalize_redundancy("Train B") == "B"
    assert evaluator.normalize_redundancy("B-ALARM") == "B"
    assert evaluator.normalize_redundancy("B") == "B"

def test_hardware_resolution_from_rules():
    evaluator = RuleEvaluator()

    # 1. RTD Temperature Element
    rtd_sig = SignalRecord(
        tag="320-TT-101",
        signal_type="AIR",
        electrical_spec="RTD 3-Wire",
        description="Reactor temperature sensor"
    )
    rtd_hw = evaluator.resolve_hardware_for_signal(rtd_sig)
    assert rtd_hw["charm_part_no"] == "SE4303T03"
    assert rtd_hw["charm_tb_part_no"] == "SE4501"
    assert rtd_hw["charm_tb_terminals"] == "1, 2, 4"

    # 2. 4-Wire Coriolis Meter with 230VAC
    coriolis_sig = SignalRecord(
        tag="320-FT-201",
        signal_type="AIR",
        signal_level="4-Wire",
        external_power="230VAC",
        description="Mass flow Coriolis meter"
    )
    cor_hw = evaluator.resolve_hardware_for_signal(coriolis_sig)
    assert cor_hw["charm_part_no"] == "SE4303T01"
    assert cor_hw["charm_tb_terminals"] == "-, 2, 4"

    # 3. Solenoid Valve (Isolated DO / Injected Power)
    sov_sig = SignalRecord(
        tag="320-XYV-301",
        signal_type="DOR",
        instrument_type="XYV",
        description="Emergency Depressurisation Solenoid Valve"
    )
    sov_hw = evaluator.resolve_hardware_for_signal(sov_sig)
    assert sov_hw["charm_part_no"] == "SE4302T02"
    assert sov_hw["charm_tb_part_no"] == "SE4502"
    assert sov_hw["charm_tb_terminals"] == "-, 2, 4"

    # 4. Interposing Relay Output
    relay_sig = SignalRecord(
        tag="320-XR-401",
        signal_type="DOR",
        instrument_type="XR",
        description="Pump start trip interposing relay"
    )
    relay_hw = evaluator.resolve_hardware_for_signal(relay_sig)
    assert relay_hw["charm_part_no"] == "SE4302T01"
    assert relay_hw["charm_tb_part_no"] == "SE4503"
    assert relay_hw["charm_tb_terminals"] == "1, 2"

    # 5. Standard Discrete Input
    di_sig = SignalRecord(
        tag="320-ZS-501",
        signal_type="DIR",
        instrument_type="ZS",
        description="Valve limit switch closed"
    )
    di_hw = evaluator.resolve_hardware_for_signal(di_sig)
    assert di_hw["charm_part_no"] == "SE4301T02"
    assert di_hw["charm_tb_part_no"] == "SE4501"
    assert di_hw["charm_tb_terminals"] == "1, 2"

def test_naming_pattern_engine_and_dynamic_override():
    # Test Gate G7: changing pattern changes every name without code change
    engine = NamingEngine()
    cab_name = engine.format_marshalling_cabinet(area="P30", unit="32001", seq=1)
    assert cab_name == "P30-DCM-32001-01"

    cioc_name = engine.format_cioc(area="P30", unit="3201", seq=1)
    assert cioc_name == "P30DCIOC3201001"

    bp_name = engine.format_baseplate(cioc_seq=1, bp_num=2)
    assert bp_name == "001-CBP-2"

    charm_no = engine.format_charm_no(bp_num=2, channel_no=1)
    assert charm_no == 13

    # Dynamic pattern change (e.g. customized by user for a different site convention)
    custom_patterns = NamingPatternsConfig(
        marshalling_cabinet="CAB-MARSH-{area}-{unit}-S{seq:03d}",
        cioc="CIOC-{seq:02d}",
        baseplate="BP_{bp_num:02d}",
        system_cabinet="SYS-{area}-{seq}"
    )
    custom_engine = NamingEngine(custom_patterns)
    assert custom_engine.format_marshalling_cabinet(area="P24", unit="500", seq=5) == "CAB-MARSH-P24-500-S005"
    assert custom_engine.format_cioc(area="P24", unit="500", seq=3) == "CIOC-03"
    assert custom_engine.format_baseplate(cioc_seq=3, bp_num=4) == "BP_04"

def test_adding_new_custom_rule_dynamically():
    # Test Gate G10: add new rule via data with no code change
    evaluator = RuleEvaluator()
    custom_rule = RuleDefinition(
        id="R-CUSTOM-ESD",
        name="Emergency Safety Shutdown Optical Isolation TB",
        enabled=True,
        kind=RuleKind.CHARM_TERMINAL_MAP,
        severity=RuleSeverity.HARD,
        weight=150,
        scope="signal",
        params={
            "conditions": [
                {"column": "tag", "operator": "contains", "value": "-ESD-"}
            ],
            "match_mode": "any",
            "hardware": {
                "charm_type": "ESD Safety Optical CHARM",
                "charm_part_no": "SE4399SAFE",
                "terminal_block": "Safety Optical Terminal Block",
                "charm_tb_part_no": "SE4599OPT",
                "charm_tb_terminals": "1, 2"
            }
        }
    )
    # Prepend custom rule so it evaluates with higher priority
    evaluator.rules.insert(0, custom_rule)

    esd_sig = SignalRecord(tag="320-ESD-9901", signal_type="DIR", description="Reactor ESD Pushbutton")
    res = evaluator.resolve_hardware_for_signal(esd_sig)

    assert res["charm_part_no"] == "SE4399SAFE"
    assert res["charm_tb_part_no"] == "SE4599OPT"
