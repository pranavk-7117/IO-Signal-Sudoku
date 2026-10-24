"""
Industrial IO Customer MDB Dataset Generator
Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)

Generates realistic customer IO lists matching official MDB structures:
- Standard multi-pair cable sizes: 2, 6, 12, 24 pairs
- Realistic signal types: AIR (RTD, 4-wire Coriolis, 2-wire HART), AOR, DIR, DOR (SOV/XYV/ZYV, High-side, Relay)
- Redundant A/B pairings with train/loop groupings
- Realistic tag nomenclature: <Unit>-<Type>-<Number>[A/B]
- Optional noise injection: missing tags, duplicates, unrecognised types
"""

import argparse
import os
import random
import sys
from typing import List, Dict, Any
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

UNIT_CODES = ["320", "500", "210", "440", "110"]
AREAS = ["OA-11", "OA-14", "OA-21"]
ROOMS = ["PIB-30", "PIB-24", "PIB-12"]

SIGNAL_CATALOGUE = [
    # (IO Type, Instrument Types, Typical Descriptions, Signal Level, Ext Power, TB Type)
    ("AIR", ["FT", "LT", "PT"], "4-20 ma HART Differential Pressure / Level Transmitter", "2-Wire", "None", "SE4501"),
    ("AIR", ["TT", "TE"], "RTD Temperature Element 3-Wire", "3-Wire", "None", "SE4501"),
    ("AIR", ["FT", "CT"], "Coriolis Flow Meter 4-Wire Mass Flow", "4-Wire", "230VAC", "SE4501"),
    ("AOR", ["FV", "PV", "TV"], "Control Valve Actuator 4-20 mA HART", "2-Wire", "None", "SE4501"),
    ("DIR", ["XS", "ZS", "LS", "PS"], "Dry Contact Limit / Level / Pressure Switch", "Voltfree-contact", "None", "SE4501"),
    ("DOR", ["XYV", "ZYV", "SOV"], "Process Solenoid Valve High-Inrush Injected Power", "Volt-contact", "24VDC", "SE4502"),
    ("DOR", ["XA", "ZA", "YA"], "Local Control Station Lamp / Beacon / Alarm Horn", "Volt-contact", "24VDC", "SE4501"),
    ("DOR", ["XR", "MR"], "Interposing Relay Dry Contact DO", "Relay-contact", "24VDC", "SE4503"),
]

def generate_signals(
    count: int = 300,
    seed: int = 42,
    noise_ratio: float = 0.0,
    include_alarms: bool = True
) -> List[Dict[str, Any]]:
    random.seed(seed)
    signals: List[Dict[str, Any]] = []

    # Cabinet Alarms (Baseplate 1 Diagnostics) if included
    if include_alarms and count >= 20:
        alarm_types = [
            ("320-EJA  -01001-T", "AIR", "RTD", "TEMPERATURE SENSOR", "3-Wire", "None", "Cabinet Alarm"),
            ("320-EJA  -01001-AC", "DIR", "EJA", "AC POWER SUPPLY FAIL", "Voltfree-contact", "None", "Cabinet Alarm"),
            ("320-EJA  -01001-DC", "DIR", "EJA", "DC POWER SUPPLY 24VDC FAIL", "Voltfree-contact", "None", "Cabinet Alarm"),
            ("320-EJA  -01001-D", "DIR", "EJA", "CABINET DOOR SWITCH OPEN", "Voltfree-contact", "None", "Cabinet Alarm"),
            ("320-EJA  -01001-F", "DIR", "EJA", "FAN FAILURE STATUS", "Voltfree-contact", "None", "Cabinet Alarm")
        ]
        for tag, stype, inst, desc, level, pwr, status in alarm_types:
            signals.append({
                "Tag Number": tag,
                "Tag Service 1 and 2": desc,
                "I/O Type Name": stype,
                "Instrument Type": inst,
                "Signal Level": level,
                "External Power Supply": pwr,
                "Multipair Cable No.": "INTERNAL-WIRING",
                "Pair Number": "Pair 1",
                "IO Grouping": "DIAGNOSTICS",
                "Operating Area": "OA-11",
                "Technical Room": "PIB-30",
                "Unit": "320",
                "Design Area": "RA 320-01",
                "Loop Name": "320-E -01001",
                "Tag Status": status
            })

    # Group generation (by loop / process equipment)
    cable_seq = 1
    sig_num = 10000

    while len(signals) < count:
        unit = random.choice(UNIT_CODES)
        area = random.choice(AREAS)
        room = random.choice(ROOMS)
        group_id = f"{unit}-GRP-{random.randint(10, 99)}"

        # Select cable size: 2, 6, 12, or 24 pairs
        cable_size = random.choice([2, 6, 12, 24])
        cable_id = f"{unit}-CE-{cable_seq:04d}"
        cable_seq += 1

        # How many active pairs for this cable? (some spare slots left)
        if cable_size == 24:
            active_pairs = random.randint(16, 22)  # leave 2-8 spare pairs
        elif cable_size == 12:
            active_pairs = random.randint(8, 12)
        elif cable_size == 6:
            active_pairs = random.randint(4, 6)
        else:
            active_pairs = 2

        # Decide if this cluster contains an A/B redundant pair
        has_redundancy = random.random() < 0.25
        pair_num = 1

        while pair_num <= active_pairs and len(signals) < count:
            sig_num += 1
            cat = random.choice(SIGNAL_CATALOGUE)
            stype, inst_list, desc_base, level, pwr, tb = cat
            inst = random.choice(inst_list)

            if has_redundancy and pair_num + 1 <= active_pairs and len(signals) + 1 < count:
                # Generate Redundant Pair: A and B
                tag_a = f"{unit}-{inst}   -{sig_num}-A"
                tag_b = f"{unit}-{inst}   -{sig_num}-B"
                loop_nm = f"{unit}-{inst[0]} -{sig_num}"

                signals.append({
                    "Tag Number": tag_a,
                    "Tag Service 1 and 2": f"{desc_base} - TRAIN A",
                    "I/O Type Name": stype,
                    "Instrument Type": inst,
                    "Signal Level": level,
                    "External Power Supply": pwr,
                    "Multipair Cable No.": cable_id,
                    "Pair Number": f"Pair {pair_num}",
                    "IO Grouping": "A-CONTROL",
                    "Operating Area": area,
                    "Technical Room": room,
                    "Unit": unit,
                    "Design Area": f"RA {unit}-01",
                    "Loop Name": loop_nm,
                    "Tag Status": "Field"
                })
                pair_num += 1

                # Train B is placed on another cable or next pair
                signals.append({
                    "Tag Number": tag_b,
                    "Tag Service 1 and 2": f"{desc_base} - TRAIN B",
                    "I/O Type Name": stype,
                    "Instrument Type": inst,
                    "Signal Level": level,
                    "External Power Supply": pwr,
                    "Multipair Cable No.": f"{unit}-CE-{(cable_seq+50):04d}",
                    "Pair Number": f"Pair 1",
                    "IO Grouping": "B-CONTROL",
                    "Operating Area": area,
                    "Technical Room": room,
                    "Unit": unit,
                    "Design Area": f"RA {unit}-01",
                    "Loop Name": loop_nm,
                    "Tag Status": "Field"
                })
                has_redundancy = False
            else:
                tag = f"{unit}-{inst}   -{sig_num}"
                loop_nm = f"{unit}-{inst[0]} -{sig_num}"

                signals.append({
                    "Tag Number": tag,
                    "Tag Service 1 and 2": f"{desc_base} {loop_nm}",
                    "I/O Type Name": stype,
                    "Instrument Type": inst,
                    "Signal Level": level,
                    "External Power Supply": pwr,
                    "Multipair Cable No.": cable_id,
                    "Pair Number": f"Pair {pair_num}",
                    "IO Grouping": group_id,
                    "Operating Area": area,
                    "Technical Room": room,
                    "Unit": unit,
                    "Design Area": f"RA {unit}-01",
                    "Loop Name": loop_nm,
                    "Tag Status": "Field"
                })
                pair_num += 1

    # Truncate to exact count
    signals = signals[:count]

    # Inject noise if requested
    if noise_ratio > 0.0:
        noise_count = int(count * noise_ratio)
        indices = random.sample(range(len(signals)), min(noise_count, len(signals)))
        for idx in indices:
            anomaly_type = random.choice(["missing_tag", "duplicate", "invalid_type", "bad_pair"])
            if anomaly_type == "missing_tag":
                signals[idx]["Tag Number"] = ""
            elif anomaly_type == "duplicate" and idx > 0:
                signals[idx]["Tag Number"] = signals[0]["Tag Number"]
            elif anomaly_type == "invalid_type":
                signals[idx]["I/O Type Name"] = "UNKNOWN_BUS_PROTOCOL"
            elif anomaly_type == "bad_pair":
                signals[idx]["Pair Number"] = "Invalid_0"

    return signals

def export_to_excel(signals: List[Dict[str, Any]], output_path: str):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Master_IO_Database"

    headers = [
        "Tag Number", "Tag Service 1 and 2", "I/O Type Name", "Instrument Type",
        "Signal Level", "External Power Supply", "Multipair Cable No.", "Pair Number",
        "IO Grouping", "Operating Area", "Technical Room", "Unit", "Design Area", "Loop Name", "Tag Status"
    ]

    header_fill = PatternFill(start_color="0B132B", end_color="0B132B", fill_type="solid")
    header_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    data_font = Font(name="Segoe UI", size=9)

    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for row_idx, sig in enumerate(signals, 2):
        row_vals = [sig.get(h, "") for h in headers]
        ws.append(row_vals)
        for col_idx in range(1, len(headers) + 1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.font = data_font

    for col in ws.columns:
        col_letter = col[0].column_letter
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    wb.save(output_path)
    wb.close()
    print(f"Successfully generated {len(signals)} signals to: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Industrial IO Dataset Generator")
    parser.add_argument("--count", type=int, default=300, help="Number of IO signals to generate")
    parser.add_argument("--output", type=str, default="data/generated_io_list.xlsx", help="Output file path (.xlsx or .csv)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--noise", type=float, default=0.0, help="Fraction of rows with anomalies (0.0 to 1.0)")
    args = parser.parse_args()

    signals = generate_signals(count=args.count, seed=args.seed, noise_ratio=args.noise)
    if args.output.endswith(".csv"):
        import pandas as pd
        df = pd.DataFrame(signals)
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        df.to_csv(args.output, index=False)
        print(f"Successfully generated {len(signals)} signals to CSV: {args.output}")
    else:
        export_to_excel(signals, args.output)

if __name__ == "__main__":
    main()
