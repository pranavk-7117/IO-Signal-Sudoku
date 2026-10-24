"""
Validation Engine Facade
Provides backward-compatible ValidationEngine interface backed by the independent validation architecture.
"""

from typing import List, Optional
from models import HardwareConfigModel, SignalRecord, AssignmentModel, ValidationSummaryModel, ValidationIssueModel
from validation.independent_validator import IndependentValidator

class ValidationEngine(IndependentValidator):
    """
    Backwards-compatible wrapper around IndependentValidator.
    Ensures zero coupling between validation logic and allocator.
    """
    def __init__(self, config: Optional[HardwareConfigModel] = None):
        super().__init__(config)
