"""
Industrial Rules & Hardware Configuration Models
Problem Statement #02: IO Signal Sudoku
Defines schema for rules-as-data, naming patterns, and redundancy mappings.
"""

from enum import Enum
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field

class RuleSeverity(str, Enum):
    HARD = "hard"
    SOFT = "soft"

class RuleKind(str, Enum):
    CABLE_CONTIGUOUS = "cable_contiguous"
    SEPARATE_ON = "separate_on"
    TOGETHER_ON = "together_on"
    LOGICAL_GROUP_TOGETHER = "logical_group_together"
    CAPACITY = "capacity"
    SPARE_PER_CABINET = "spare_per_cabinet"
    CHARM_TERMINAL_MAP = "charm_terminal_map"
    NAMING_PATTERN = "naming_pattern"
    MAX_PER_CONTAINER = "max_per_container"
    RESERVE = "reserve"

class RuleDefinition(BaseModel):
    id: str
    name: str
    enabled: bool = True
    kind: RuleKind
    severity: RuleSeverity = RuleSeverity.HARD
    weight: int = 100
    scope: str = "all"  # signal, cable, cabinet, logical_group, redundancy_group, spare_slot
    params: Dict[str, Any] = Field(default_factory=dict)

class HardwareHierarchyConfig(BaseModel):
    charms_per_baseplate: int = 12
    baseplates_per_cioc: int = 8
    ciocs_per_cabinet: int = 4
    default_cabinets_count: int = 2
    channels_per_cioc: int = 96
    channels_per_cabinet: int = 384

class CableSpecifications(BaseModel):
    standard_sizes: List[int] = Field(default_factory=lambda: [2, 6, 12, 24])
    max_pairs_per_baseplate: int = 12
    split_policy: Dict[str, Any] = Field(default_factory=lambda: {
        "sizes_up_to_12_split": False,
        "size_24_span_baseplates": 2
    })

class SpareCapacityConfig(BaseModel):
    spare_baseplate_percent: float = 10.0
    wired_spare_percent_per_io_type: float = 10.0
    unpopulated_slot_label: str = "Spare Slot"
    wired_spare_label: str = "Wired Spare"

class NamingPatternsConfig(BaseModel):
    system_cabinet: str = "{area}-DCS-{unit}-{seq:02d}"
    controller: str = "{area}CTL{unit}{seq:02d}"
    marshalling_cabinet: str = "{area}-DCM-{unit}-{seq:02d}"
    cioc: str = "{area}DCIOC{unit}{seq:03d}"
    baseplate: str = "{cioc_seq:03d}-CBP-{bp_num}"
    wired_spare_tag: str = "{area}DSP{controller_seq:02d}{cioc_seq:03d}{charm_no:02d}"

class HardwareSystemConfig(BaseModel):
    system_info: str = "DeltaV CHARMs Industrial Electronic Marshalling"
    version: str = "2.0.0"
    hardware_hierarchy: HardwareHierarchyConfig = Field(default_factory=HardwareHierarchyConfig)
    cable_specifications: CableSpecifications = Field(default_factory=CableSpecifications)
    spare_capacity: SpareCapacityConfig = Field(default_factory=SpareCapacityConfig)
    naming_patterns: NamingPatternsConfig = Field(default_factory=NamingPatternsConfig)
    redundancy_mappings: Dict[str, List[str]] = Field(default_factory=lambda: {
        "A": ["A", "DUTY", "PRIMARY", "MAIN", "TRAIN A", "TRAIN-A", "TRAINA", "A-CONTROL", "A_CONTROL", "A TRAIN", "SYSTEM 1", "SYS1"],
        "B": ["B", "STANDBY", "SECONDARY", "BACKUP", "TRAIN B", "TRAIN-B", "TRAINB", "B-CONTROL", "B_CONTROL", "B TRAIN", "B-ALARM", "SYSTEM 2", "SYS2"]
    })

class RedundancyNormalizer:
    @staticmethod
    def normalize(val: Optional[str], mappings: Dict[str, List[str]]) -> Optional[str]:
        if not val or not str(val).strip():
            return None
        v = str(val).strip().upper()
        if v in ["-", "N/A", "NA", "NONE", "NON-REDUNDANT", "SIMPLEX", "SINGLE", "NOT APPLICABLE", "NULL"]:
            return None
        for norm_label, aliases in mappings.items():
            if v == norm_label:
                return norm_label
            for alias in aliases:
                if v == alias.upper() or v.startswith(alias.upper()):
                    return norm_label
        # Fallback heuristic
        if "A" in v and "B" not in v and len(v) <= 15:
            return "A"
        if "B" in v and "A" not in v and len(v) <= 15:
            return "B"
        return None
