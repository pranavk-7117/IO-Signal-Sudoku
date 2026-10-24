import os
import sys

import pytest
from openpyxl import Workbook

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from engine.excel_handler import ExcelHandler


def make_workbook(tmp_path, headers, rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "IO Schedule"
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    path = tmp_path / "customer_schedule.xlsx"
    workbook.save(path)
    return str(path)


def test_mapping_handles_customer_headers_order_and_extra_columns(tmp_path):
    path = make_workbook(
        tmp_path,
        ["Customer Note", "Loop Tag", "Cable Ref", "I/O Point Type", "Pair No."],
        [["extra", "PT-001", "CB-1", "ai", "Pair 2"]],
    )
    found = ExcelHandler.parse_mapped_signals(path, "IO Schedule", {
        "tag": "Loop Tag", "signal_type": "I/O Point Type",
        "cable_id": "Cable Ref", "pair_number": "Pair No."
    })
    assert len(found) == 1
    assert (found[0].tag, found[0].signal_type, found[0].pair_number) == ("PT-001", "AI", 2)
    assert found[0].is_valid is True


def test_blank_tag_data_is_preserved_and_malformed_pair_is_marked_invalid(tmp_path):
    path = make_workbook(
        tmp_path,
        ["Loop Tag", "I/O Point Type", "Wire Pair"],
        [[None, "AI", "P2"], ["PT-002", "DI", "wire 3 spare"], [None, None, None]],
    )
    found = ExcelHandler.parse_mapped_signals(path, "IO Schedule", {
        "tag": "Loop Tag", "signal_type": "I/O Point Type", "pair_number": "Wire Pair"
    })
    assert len(found) == 2
    assert found[0].tag == "" and found[0].is_valid is False
    assert found[1].pair_number is None and found[1].is_valid is False
    assert any("Malformed wire pair" in error for error in found[1].validation_errors)


def test_missing_required_mapping_is_rejected(tmp_path):
    path = make_workbook(tmp_path, ["Loop Tag"], [["PT-003"]])
    with pytest.raises(ValueError, match="Signal Type column mapping is required"):
        ExcelHandler.parse_mapped_signals(path, "IO Schedule", {"tag": "Loop Tag"})
