import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.mapping_engine import MappingEngine
from rules import RedundancyNormalizer, HardwareSystemConfig

def test_scored_mapping_hierarchy():
    headers = [
        "Tag Number",
        "Tag Service 1 and 2",
        "I/O Type Name",
        "Multipair Cable No.",
        "Pair Number",
        "IO Grouping",
        "Multi-cable / Cable",
        "Operating Area",
        "Loop Name"
    ]
    mappings = MappingEngine.compute_scored_mappings(headers)

    # All expected fields must map to unique columns with high confidence
    assert mappings["tag"]["header"] == "Tag Number"
    assert mappings["tag"]["confidence_percent"] == 100.0
    assert mappings["tag"]["tier"] == "Exact Synonym"

    assert mappings["description"]["header"] == "Tag Service 1 and 2"
    assert mappings["signal_type"]["header"] == "I/O Type Name"
    assert mappings["cable_id"]["header"] == "Multipair Cable No."
    assert mappings["pair_number"]["header"] == "Pair Number"
    assert mappings["cable_size"]["header"] == "Multi-cable / Cable"

    # Confirm 1-to-1 invariant: no column is assigned more than once
    assigned_headers = [m["header"] for m in mappings.values()]
    assert len(assigned_headers) == len(set(assigned_headers)), "Every assigned header must be unique"

def test_rapidfuzz_token_set_fuzzy_matching():
    # Customer provides headers with word reordering or variations
    messy_headers = [
        "Instrument Signal Tag",
        "Full Service Description",
        "Signal IO Type",
        "Field Multicore Cable Tag",
        "Cable Wire Pair No"
    ]
    mappings = MappingEngine.compute_scored_mappings(messy_headers)

    assert mappings["tag"]["header"] == "Instrument Signal Tag"
    assert mappings["tag"]["confidence_percent"] >= 80.0

    assert mappings["description"]["header"] == "Full Service Description"
    assert mappings["signal_type"]["header"] == "Signal IO Type"
    assert mappings["cable_id"]["header"] == "Field Multicore Cable Tag"
    assert mappings["pair_number"]["header"] == "Cable Wire Pair No"

def test_pair_number_parser():
    assert MappingEngine.parse_pair_number("Pair 1") == 1
    assert MappingEngine.parse_pair_number("Pair 12") == 12
    assert MappingEngine.parse_pair_number("P24") == 24
    assert MappingEngine.parse_pair_number("Triad 3") == 3
    assert MappingEngine.parse_pair_number("5") == 5
    assert MappingEngine.parse_pair_number(7) == 7
    assert MappingEngine.parse_pair_number("Invalid") is None
    assert MappingEngine.parse_pair_number("") is None
    assert MappingEngine.parse_pair_number(None) is None

def test_cable_size_inference():
    # Infers smallest in {2, 6, 12, 24} covering max_pair
    assert MappingEngine.infer_cable_size(max_pair=1) == 2
    assert MappingEngine.infer_cable_size(max_pair=2) == 2
    assert MappingEngine.infer_cable_size(max_pair=5) == 6
    assert MappingEngine.infer_cable_size(max_pair=6) == 6
    assert MappingEngine.infer_cable_size(max_pair=7) == 12
    assert MappingEngine.infer_cable_size(max_pair=12) == 12
    assert MappingEngine.infer_cable_size(max_pair=13) == 24
    assert MappingEngine.infer_cable_size(max_pair=24) == 24

    # Explicit string override parsing
    assert MappingEngine.infer_cable_size(max_pair=4, explicit_size="12PX1MM2/FR/ARM/NIS") == 12
    assert MappingEngine.infer_cable_size(max_pair=8, explicit_size="24PX1.5MM2") == 24

def test_redundancy_normalisation_duty_standby():
    cfg = HardwareSystemConfig()
    # Fixes D12: Duty/Standby and Train A/B normalisation
    assert RedundancyNormalizer.normalize("Duty", cfg.redundancy_mappings) == "A"
    assert RedundancyNormalizer.normalize("Standby", cfg.redundancy_mappings) == "B"
    assert RedundancyNormalizer.normalize("Primary", cfg.redundancy_mappings) == "A"
    assert RedundancyNormalizer.normalize("Secondary", cfg.redundancy_mappings) == "B"
    assert RedundancyNormalizer.normalize("Train A", cfg.redundancy_mappings) == "A"
    assert RedundancyNormalizer.normalize("Train B", cfg.redundancy_mappings) == "B"
    assert RedundancyNormalizer.normalize("A-CONTROL", cfg.redundancy_mappings) == "A"
    assert RedundancyNormalizer.normalize("B-ALARM", cfg.redundancy_mappings) == "B"

def test_path_traversal_sanitizer():
    # Fixes D15: Path traversal, raw filenames
    bad_filename = "../../../etc/passwd"
    sanitized = MappingEngine.sanitize_filename(bad_filename)
    assert ".." not in sanitized
    assert "/" not in sanitized
    assert "\\" not in sanitized

    bad_windows = "..\\..\\Windows\\System32\\cmd.exe"
    sanitized_win = MappingEngine.sanitize_filename(bad_windows)
    assert ".." not in sanitized_win
    assert "\\" not in sanitized_win

    token, storage_name = MappingEngine.generate_storage_id("customer_io.xlsx")
    assert len(token) == 36  # UUID length
    assert storage_name.endswith("customer_io.xlsx")
