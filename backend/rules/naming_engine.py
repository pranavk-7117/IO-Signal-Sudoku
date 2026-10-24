"""
Pattern-Driven Industrial Component Naming Engine
Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)
Encodes and formats all physical and software component names dynamically from templates.
"""

from typing import Dict, Any, Optional
from rules.rule_models import NamingPatternsConfig

class NamingEngine:
    def __init__(self, patterns: Optional[NamingPatternsConfig] = None):
        self.patterns = patterns or NamingPatternsConfig()

    def format_system_cabinet(self, area: str = "P30", unit: str = "32001", seq: int = 1) -> str:
        clean_area = area.replace("-", "").strip() or "P30"
        clean_unit = str(unit).replace("-", "").strip() or "32001"
        try:
            return self.patterns.system_cabinet.format(
                area=clean_area,
                unit=clean_unit,
                seq=seq
            )
        except Exception:
            return f"{clean_area}-DCS-{clean_unit}-{seq:02d}"

    def format_controller(self, area: str = "P30", unit: str = "3201", seq: int = 1) -> str:
        clean_area = area.replace("-", "").strip() or "P30"
        clean_unit = str(unit).replace("-", "").strip() or "3201"
        try:
            return self.patterns.controller.format(
                area=clean_area,
                unit=clean_unit,
                seq=seq
            )
        except Exception:
            return f"{clean_area}CTL{clean_unit}{seq:02d}"

    def format_marshalling_cabinet(self, area: str = "P30", unit: str = "32001", seq: int = 1) -> str:
        clean_area = area.replace("-", "").strip() or "P30"
        clean_unit = str(unit).replace("-", "").strip() or "32001"
        try:
            return self.patterns.marshalling_cabinet.format(
                area=clean_area,
                unit=clean_unit,
                seq=seq
            )
        except Exception:
            return f"{clean_area}-DCM-{clean_unit}-{seq:02d}"

    def format_cioc(self, area: str = "P30", unit: str = "3201", seq: int = 1) -> str:
        clean_area = area.replace("-", "").strip() or "P30"
        clean_unit = str(unit).replace("-", "").strip() or "3201"
        try:
            return self.patterns.cioc.format(
                area=clean_area,
                unit=clean_unit,
                seq=seq
            )
        except Exception:
            return f"{clean_area}DCIOC{clean_unit}{seq:03d}"

    def format_baseplate(self, cioc_seq: int, bp_num: int) -> str:
        try:
            return self.patterns.baseplate.format(
                cioc_seq=cioc_seq,
                bp_num=bp_num
            )
        except Exception:
            return f"{cioc_seq:03d}-CBP-{bp_num}"

    def format_charm_no(self, bp_num: int, channel_no: int, charms_per_baseplate: int = 12) -> int:
        return (bp_num - 1) * charms_per_baseplate + channel_no

    def format_wired_spare_tag(
        self,
        area: str = "3201",
        controller_seq: int = 1,
        cioc_seq: int = 1,
        charm_no: int = 1
    ) -> str:
        clean_area = area.replace("-", "").strip() or "3201"
        try:
            return self.patterns.wired_spare_tag.format(
                area=clean_area,
                controller_seq=controller_seq,
                cioc_seq=cioc_seq,
                charm_no=charm_no
            )
        except Exception:
            return f"{clean_area}DSP{controller_seq:02d}{cioc_seq:03d}{charm_no:02d}"
