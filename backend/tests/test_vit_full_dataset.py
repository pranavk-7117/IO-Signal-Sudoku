import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import HardwareConfigModel, SignalRecord
from engine.allocator import AllocationEngine
from engine.validator import ValidationEngine
from engine.excel_handler import ExcelHandler

def test_full_customer_io_mdb_dataset_100_percent_allocation():
    mdb_path = os.path.join(os.path.dirname(__file__), "..", "sample_files", "official", "Customer_IO_MDB.xlsx")
    assert os.path.exists(mdb_path), "Customer_IO_MDB.xlsx must exist in sample_files/official"

    # 1. Column Inspection & Auto-mapping
    insp = ExcelHandler.inspect_workbook(mdb_path)
    assert "MDB-1" in insp["sheets"]
    mapping = insp["suggested_mappings"]

    # 2. Parse mapped signals
    signals = ExcelHandler.parse_mapped_signals(mdb_path, "MDB-1", mapping)
    assert len(signals) == 190, f"Expected 190 customer signals, got {len(signals)}"
    assert all(s.is_valid for s in signals), "All signals in Customer_IO_MDB must be valid"

    # 3. Run Allocation
    config = HardwareConfigModel()
    engine = AllocationEngine(config)
    assignments = engine.run_allocation(signals)

    # Rule 3: Check 100% allocated
    allocated = [a for a in assignments if a.status == "Allocated"]
    unallocated = [a for a in assignments if a.status != "Allocated"]
    assert len(unallocated) == 0, f"Expected 0 unallocated signals, found: {[u.tag for u in unallocated]}"
    assert len(allocated) == 190, f"Expected 190 allocated signals, got {len(allocated)}"

    # 4. Independent Validation
    validator = ValidationEngine(config)
    summary = validator.validate(signals, assignments)

    assert summary.is_fully_validated is True, "Dataset allocation must be fully validated"
    assert summary.error_count == 0, f"Expected 0 errors, found: {[i.message for i in summary.issues if i.severity == 'ERROR']}"

    # 5. Rule Verification:
    # Rule 2: Never put A and B together on same CIOC
    ciocs = {}
    for a in allocated:
        red = engine.evaluator.normalize_redundancy(a.redundancy)
        if red in ["A", "B"] and a.cabinet_id and a.cioc_id:
            ciocs.setdefault((a.cabinet_id, a.cioc_id), set()).add(red)
    for (cab, cioc), trains in ciocs.items():
        assert not ("A" in trains and "B" in trains), f"CIOC {cab}/{cioc} violated A/B segregation: {trains}"

    # Rule 4: Keep each cable together, 24-pair cables span 2 adjacent baseplates
    cables = {}
    for a in allocated:
        cid = (a.cable_id or "").strip()
        if cid and cid.upper() not in ["INTERNAL WIRING", "INTERNAL-WIRING", "INTERNAL", "-"]:
            cables.setdefault(cid, []).append(a)

    for cid, c_assigns in cables.items():
        baseplates = set((a.cabinet_id, a.cioc_id, a.baseplate_id) for a in c_assigns)
        if len(c_assigns) > 12:  # 24-pair cable
            assert len(baseplates) == 2, f"24-pair cable {cid} must span exactly 2 baseplates, got {len(baseplates)}"
            bp_list = sorted(list(baseplates), key=lambda x: x[2])
            bp1_num = int(bp_list[0][2].split("-")[-1])
            bp2_num = int(bp_list[1][2].split("-")[-1])
            assert bp1_num + 1 == bp2_num, f"24-pair cable {cid} must span adjacent baseplates, got {bp1_num} and {bp2_num}"
        else:
            assert len(baseplates) == 1, f"Cable {cid} (size <= 12) must be contained in 1 baseplate, got {len(baseplates)}"

    # Rule 6: Hardware selection
    for a in allocated:
        sig = next(s for s in signals if s.tag == a.tag)
        # RTD temperature input
        if (sig.electrical_spec or "").upper() == "RTD":
            assert a.charm_part_no == "SE4303T03"
            assert a.charm_tb_part_no == "SE4501"
            assert a.charm_tb_terminals == "1, 2, 4"
        # Standard AI HART
        elif a.signal_type in ["AI", "AIR"]:
            assert a.charm_part_no == "SE4303T01"
            assert a.charm_tb_part_no == "SE4501"
        # AO HART
        elif a.signal_type in ["AO", "AOR"]:
            assert a.charm_part_no == "SE4304T01"
            assert a.charm_tb_part_no == "SE4501"
        # DI
        elif a.signal_type in ["DI", "DIR"]:
            assert a.charm_part_no == "SE4301T02"
            assert a.charm_tb_part_no == "SE4501"
        # Solenoid Valves (SOV) / High-current DO
        elif a.signal_type in ["DO", "DOR"] and any(k in a.tag for k in ["XYV", "ZYV"]):
            assert a.charm_part_no == "SE4302T02", f"SOV {a.tag} must use Isolated DO SE4302T02"
            assert a.charm_tb_part_no == "SE4502", f"SOV {a.tag} must use Fused Injected Power TB SE4502"
            assert a.charm_tb_terminals == "-, 2, 4"
