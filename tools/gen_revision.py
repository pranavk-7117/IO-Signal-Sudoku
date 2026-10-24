"""
Industrial IO Customer MDB Revision Generator
Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)

Generates Rev B dataset from Rev A with a realistic distribution of:
- Unchanged signals (~85%)
- Modified signals (~5% service/description/range change)
- Deleted signals (~5%)
- Added new signals (~10%)
Outputs Rev B file (.xlsx or .csv) and an independent diff ground truth summary.
"""

import argparse
import copy
import json
import os
import random
import openpyxl
import pandas as pd
from typing import List, Dict, Any, Tuple

def load_dataset(file_path: str) -> List[Dict[str, Any]]:
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
        return df.to_dict(orient="records")
    else:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(c).strip() if c is not None else f"COL_{i}" for i, c in enumerate(rows[0])]
        data = []
        for r in rows[1:]:
            row_dict = {}
            for h, val in zip(headers, r):
                row_dict[h] = "" if val is None else str(val).strip()
            if any(row_dict.values()):
                data.append(row_dict)
        wb.close()
        return data

def generate_revision(
    rev_a_data: List[Dict[str, Any]],
    mod_ratio: float = 0.05,
    del_ratio: float = 0.05,
    add_ratio: float = 0.10,
    seed: int = 123
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    random.seed(seed)
    
    total_a = len(rev_a_data)
    num_delete = int(total_a * del_ratio)
    num_modify = int(total_a * mod_ratio)
    num_add = int(total_a * add_ratio)

    indices = list(range(total_a))
    random.shuffle(indices)

    del_indices = set(indices[:num_delete])
    mod_indices = set(indices[num_delete:num_delete + num_modify])

    rev_b_data: List[Dict[str, Any]] = []
    diff_summary = {
        "rev_a_count": total_a,
        "unchanged": [],
        "modified": [],
        "deleted": [],
        "added": []
    }

    # Process Rev A items
    for idx, row in enumerate(rev_a_data):
        tag = row.get("Tag Number") or row.get("Tag Name") or row.get("tag") or f"TAG_{idx}"
        if idx in del_indices:
            diff_summary["deleted"].append(tag)
            continue
        elif idx in mod_indices:
            new_row = copy.deepcopy(row)
            # Modify description or service
            desc_key = next((k for k in new_row if "service" in k.lower() or "desc" in k.lower()), None)
            if desc_key:
                new_row[desc_key] = str(new_row[desc_key]) + " [REV B UPDATE]"
            diff_summary["modified"].append({
                "tag": tag,
                "reason": "Service description updated in Rev B"
            })
            rev_b_data.append(new_row)
        else:
            diff_summary["unchanged"].append(tag)
            rev_b_data.append(copy.deepcopy(row))

    # Add new signals
    max_tag_num = 80000
    for i in range(num_add):
        max_tag_num += 1
        new_tag = f"320-PT   -{max_tag_num}"
        new_sig = {
            "Tag Number": new_tag,
            "Tag Service 1 and 2": f"NEW REV B RECYCLE PRESSURE TRANSMITTER {max_tag_num}",
            "I/O Type Name": "AIR",
            "Instrument Type": "PT",
            "Signal Level": "2-Wire",
            "External Power Supply": "None",
            "Multipair Cable No.": f"320-CE-{(9000 + i):04d}",
            "Pair Number": "Pair 1",
            "IO Grouping": "320-GRP-NEW",
            "Operating Area": "OA-11",
            "Technical Room": "PIB-30",
            "Unit": "320",
            "Design Area": "RA 320-01",
            "Loop Name": f"320-P -{max_tag_num}",
            "Tag Status": "Field"
        }
        rev_b_data.append(new_sig)
        diff_summary["added"].append(new_tag)

    diff_summary["rev_b_count"] = len(rev_b_data)
    diff_summary["added_count"] = len(diff_summary["added"])
    diff_summary["deleted_count"] = len(diff_summary["deleted"])
    diff_summary["modified_count"] = len(diff_summary["modified"])
    diff_summary["unchanged_count"] = len(diff_summary["unchanged"])

    return rev_b_data, diff_summary

def export_dataset(data: List[Dict[str, Any]], output_path: str):
    if output_path.endswith(".csv"):
        df = pd.DataFrame(data)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        df.to_csv(output_path, index=False)
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Master_IO_Database"
        if data:
            headers = list(data[0].keys())
            ws.append(headers)
            for item in data:
                ws.append([item.get(h, "") for h in headers])
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        wb.save(output_path)
        wb.close()
    print(f"Exported Rev B dataset ({len(data)} signals) to: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Industrial IO Dataset Revision Generator")
    parser.add_argument("--input", type=str, required=True, help="Path to Rev A source file")
    parser.add_argument("--output", type=str, required=True, help="Path for generated Rev B file")
    parser.add_argument("--diff", type=str, default="", help="Optional JSON path to save ground truth diff")
    parser.add_argument("--mod-ratio", type=float, default=0.05, help="Ratio of modified signals")
    parser.add_argument("--del-ratio", type=float, default=0.05, help="Ratio of deleted signals")
    parser.add_argument("--add-ratio", type=float, default=0.10, help="Ratio of added signals")
    parser.add_argument("--seed", type=int, default=123, help="Random seed")
    args = parser.parse_args()

    rev_a = load_dataset(args.input)
    rev_b, diff = generate_revision(
        rev_a,
        mod_ratio=args.mod_ratio,
        del_ratio=args.del_ratio,
        add_ratio=args.add_ratio,
        seed=args.seed
    )
    export_dataset(rev_b, args.output)

    if args.diff:
        os.makedirs(os.path.dirname(os.path.abspath(args.diff)), exist_ok=True)
        with open(args.diff, "w", encoding="utf-8") as f:
            json.dump(diff, f, indent=2)
        print(f"Saved diff summary to: {args.diff}")

    print(f"Diff Summary: {diff['unchanged_count']} unchanged, {diff['modified_count']} modified, {diff['deleted_count']} deleted, {diff['added_count']} added.")

if __name__ == "__main__":
    main()
