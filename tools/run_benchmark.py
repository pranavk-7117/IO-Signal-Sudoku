"""
Baseline Benchmark Suite
Measures allocation runtime, solver status, allocation count, and validation violations
for 37, 300, 1000, 5000 signals.
"""

import os
import sys
import time
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from models import HardwareConfigModel, SignalRecord
from engine.allocator import AllocationEngine
from engine.validator import ValidationEngine
from engine.excel_handler import ExcelHandler

DATASETS = [
    ("37 signals", "backend/data/test_37.xlsx", 37),
    ("300 signals", "backend/data/test_300.xlsx", 300),
    ("1000 signals", "backend/data/test_1000.xlsx", 1000),
    ("5000 signals", "backend/data/test_5000.xlsx", 5000)
]

def run_suite():
    results = []
    print("=" * 80)
    print("STARTING BASELINE ALLOCATION BENCHMARKS")
    print("=" * 80)

    for label, path, expected_count in DATASETS:
        if not os.path.exists(path):
            print(f"Skipping {label}: file {path} not found.")
            continue

        print(f"\nEvaluating: {label} ({path})...")
        t0 = time.time()
        insp = ExcelHandler.inspect_workbook(path)
        sheet = insp["sheets"][0]
        mapping = insp["suggested_mappings"]
        signals = ExcelHandler.parse_mapped_signals(path, sheet, mapping)
        t_parse = time.time() - t0

        # Scale cabinet count to ensure hardware capacity
        # 1 cabinet = 384 slots. For 5000 signals, need ~14 cabinets.
        cabinets_needed = max(2, (len(signals) // 300) + 2)
        config = HardwareConfigModel(cabinets_count=cabinets_needed)

        t_alloc_start = time.time()
        engine = AllocationEngine(config)
        # Timeout 30 seconds for baseline measurement
        assignments = engine.run_allocation(signals, timeout_seconds=30.0)
        t_alloc = time.time() - t_alloc_start

        t_val_start = time.time()
        validator = ValidationEngine(config)
        val_summary = validator.validate(signals, assignments)
        t_val = time.time() - t_val_start

        allocated_count = sum(1 for a in assignments if a.status == "Allocated")
        diag = engine.last_diagnostics

        res = {
            "dataset": label,
            "signal_count": len(signals),
            "cabinets_configured": cabinets_needed,
            "parse_time_sec": round(t_parse, 3),
            "alloc_time_sec": round(t_alloc, 3),
            "val_time_sec": round(t_val, 3),
            "total_time_sec": round(t_parse + t_alloc + t_val, 3),
            "allocated_count": allocated_count,
            "unallocated_count": len(signals) - allocated_count,
            "solver_status": diag.solver_status if diag else "N/A",
            "is_optimal": diag.is_optimal if diag else False,
            "error_count": val_summary.error_count,
            "warning_count": val_summary.warning_count,
            "violations": [issue.message for issue in val_summary.issues if issue.severity == "ERROR"][:5]
        }
        results.append(res)
        print(f"  Result: {allocated_count}/{len(signals)} allocated in {res['alloc_time_sec']}s (Status: {res['solver_status']}, Errors: {res['error_count']})")

    out_file = "backend/data/baseline_benchmark.json"
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("\nBenchmark results saved to:", out_file)
    return results

if __name__ == "__main__":
    run_suite()
