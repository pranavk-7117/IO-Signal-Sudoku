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

    # Rule 3: Check 100% of active signals allocated (189 active + 1 decommissioned/deleted)
    allocated = [a for a in assignments if a.status == "Allocated"]
    deleted = [a for a in assignments if a.status == "Deleted"]
    failed = [a for a in assignments if a.status not in ["Allocated", "Deleted"]]
    assert len(failed) == 0, f"Expected 0 failed signals, found: {[u.tag for u in failed]}"
    assert len(allocated) == 189, f"Expected 189 allocated signals, got {len(allocated)}"
    assert len(deleted) == 1, f"Expected 1 deleted signal, got {len(deleted)}"

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


def test_rev_b_exact_pinning_zero_unchanged_moves():
    mdb_path = os.path.join(os.path.dirname(__file__), "..", "sample_files", "official", "Customer_IO_MDB.xlsx")
    insp = ExcelHandler.inspect_workbook(mdb_path)
    mapping = insp["suggested_mappings"]
    signals_rev_a = ExcelHandler.parse_mapped_signals(mdb_path, "MDB-1", mapping)

    config = HardwareConfigModel()
    engine = AllocationEngine(config)
    assigns_rev_a = engine.run_allocation(signals_rev_a)
    allocated_a = {a.tag: a for a in assigns_rev_a if a.status == "Allocated"}

    # Simulate Rev B: Delete 2 signals, Add 3 new signals
    all_tags = list(allocated_a.keys())
    tags_to_delete = all_tags[:2]
    unchanged_tags = all_tags[2:]

    signals_rev_b = []
    # Retain unchanged signals
    for s in signals_rev_a:
        if s.tag in tags_to_delete:
            continue
        signals_rev_b.append(s)

    # Add 3 new signals
    signals_rev_b.append(SignalRecord(tag="320-NEW-FT-001", signal_type="AI", electrical_spec="4-20mA", cable_id="CABLE-NEW-01", pair_number=1))
    signals_rev_b.append(SignalRecord(tag="320-NEW-FT-002", signal_type="AI", electrical_spec="4-20mA", cable_id="CABLE-NEW-01", pair_number=2))
    signals_rev_b.append(SignalRecord(tag="320-NEW-XV-003", signal_type="DO", electrical_spec="24VDC", cable_id="CABLE-NEW-02", pair_number=1))

    # Run allocation for Rev B with previous_assignments passed
    assigns_rev_b = engine.run_allocation(signals_rev_b, previous_assignments=allocated_a)
    allocated_b = {a.tag: a for a in assigns_rev_b if a.status == "Allocated"}

    # Verify that exactly 0 unchanged signals moved!
    moved_signals = []
    for tag in unchanged_tags:
        a_old = allocated_a[tag]
        a_new = allocated_b.get(tag)
        assert a_new is not None, f"Unchanged signal {tag} must be allocated in Rev B"
        old_loc = (a_old.cabinet_id, a_old.cioc_id, a_old.baseplate_id, a_old.charm_index)
        new_loc = (a_new.cabinet_id, a_new.cioc_id, a_new.baseplate_id, a_new.charm_index)
        if old_loc != new_loc:
            moved_signals.append((tag, old_loc, new_loc))

    assert len(moved_signals) == 0, f"Expected 0 moved signals on Rev B, but {len(moved_signals)} moved: {moved_signals[:5]}"

