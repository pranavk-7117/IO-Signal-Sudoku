import re
from engine.mapping_engine import MappingEngine
from rules import RedundancyNormalizer, HardwareSystemConfig
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from models import (
    SignalRecord, AssignmentModel, ValidationIssueModel,
    TQResponseModel, UtilisationSummaryModel, RevisionComparisonResponse
)

if os.environ.get("VERCEL"):
    REPORT_OUTPUT_DIR = "/tmp/reports"
else:
    REPORT_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "reports")

try:
    os.makedirs(REPORT_OUTPUT_DIR, exist_ok=True)
except Exception:
    REPORT_OUTPUT_DIR = "/tmp/reports"
    os.makedirs(REPORT_OUTPUT_DIR, exist_ok=True)

class ExcelHandler:
    @staticmethod
    def inspect_workbook(file_path: str) -> Dict[str, Any]:
        """
        Reads workbook sheets (Excel or CSV), headers, sample rows and computes fuzzy column mappings.
        """
        is_csv = file_path.lower().endswith('.csv')
        previews = {}
        headers_map = {}
        suggested_map = {}
        sheet_names = []

        if is_csv:
            sheet_names = ["Master_IO_Database"]
            df = None
            for enc in ['utf-8', 'latin1', 'cp1252', 'utf-8-sig']:
                try:
                    df = pd.read_csv(file_path, encoding=enc, nrows=20)
                    break
                except Exception:
                    continue
            
            if df is None:
                raise ValueError("Could not parse CSV file with supported encodings (utf-8, latin1, cp1252).")

            header_row = [str(c).strip() for c in df.columns]
            headers_map["Master_IO_Database"] = header_row

            preview_rows = []
            for _, r in df.head(10).iterrows():
                row_dict = {}
                for h in header_row:
                    val = r.get(h)
                    row_dict[h] = "" if pd.isna(val) else str(val).strip()
                preview_rows.append(row_dict)
            previews["Master_IO_Database"] = preview_rows
            ExcelHandler._compute_suggested_mappings(header_row, suggested_map)
        else:
            wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
            sheet_names = wb.sheetnames

            for sheet in sheet_names:
                ws = wb[sheet]
                rows = list(ws.iter_rows(values_only=True))
                if not rows:
                    continue

                header_row = None
                header_row_idx = 0
                for idx, r in enumerate(rows[:10]):
                    non_empty = [c for c in r if c is not None and str(c).strip()]
                    if len(non_empty) >= 2:
                        header_row = [str(c).strip() if c is not None else f"COL_{i+1}" for i, c in enumerate(r)]
                        header_row_idx = idx
                        break

                if not header_row:
                    continue

                headers_map[sheet] = header_row

                preview_rows = []
                for r in rows[header_row_idx + 1 : header_row_idx + 11]:
                    row_dict = {}
                    for h, val in zip(header_row, r):
                        row_dict[h] = str(val) if val is not None else ""
                    preview_rows.append(row_dict)

                previews[sheet] = preview_rows
                ExcelHandler._compute_suggested_mappings(header_row, suggested_map)

            wb.close()

        return {
            "sheets": sheet_names,
            "headers": headers_map,
            "previews": previews,
            "suggested_mappings": suggested_map
        }

    @staticmethod
    def _compute_suggested_mappings(header_row: List[str], suggested_map: Dict[str, str], details_map: Optional[Dict[str, Any]] = None):
        scored = MappingEngine.compute_scored_mappings(header_row)
        for field, info in scored.items():
            suggested_map[field] = info["header"]
            if details_map is not None:
                details_map[field] = info
        norm_headers = [(h, h.lower().replace("_", " ").replace("-", " ").strip()) for h in header_row]

        priorities = [
            (
                "tag",
                ["tag number", "tag no", "tag no.", "instrument tag", "signal tag", "tag_number", "tagnumber", "tag name", "tag"],
                lambda hl: "tag" in hl and not any(x in hl for x in ["old", "service", "cable", "status", "ferrule", "system"])
            ),
            (
                "description",
                ["tag service 1 and 2", "service description", "signal description", "tag service", "service", "signal desc", "io description", "description"],
                lambda hl: any(w in hl for w in ["service", "description", "desc"]) and not any(x in hl for x in ["type", "equipment"])
            ),
            (
                "signal_type",
                ["i/o type name", "io type name", "i/o type", "io type", "signal type", "i/o type name 2", "point type"],
                lambda hl: any(hl == w for w in ["signal type", "io type"]) or ("i/o" in hl and "type" in hl)
            ),
            (
                "cable_id",
                ["multipair cable no.", "multipair cable no", "multi cable / cable", "cable tag", "field cable tag", "cable id", "cable no", "cable number"],
                lambda hl: "cable" in hl and any(x in hl for x in ["no", "tag", "num", "id"]) and not any(x in hl for x in ["term", "length", "type"])
            ),
            (
                "pair_number",
                ["pair number", "pair no.", "pair no", "field cable pair", "wire pair", "pair_number", "pair"],
                lambda hl: "pair" in hl and "multipair" not in hl
            ),
            (
                "redundancy",
                ["io grouping", "segregation", "redundancy designator", "redundancy", "system 1 (system)", "system", "voting"],
                lambda hl: any(x in hl for x in ["redund", "grouping", "segreg"])
            ),
            (
                "logical_group",
                ["process function type", "operating area", "design area", "unit", "logical group", "loop name"],
                lambda hl: any(x in hl for x in ["area", "unit", "loop name", "process function"])
            ),
        ]

        for field, exact_candidates, _ in priorities:
            if field in suggested_map:
                continue
            for cand in exact_candidates:
                cand_norm = cand.lower().replace("_", " ").replace("-", " ").strip()
                for original_h, hl in norm_headers:
                    if hl == cand_norm:
                        suggested_map[field] = original_h
                        break
                if field in suggested_map:
                    break

        for field, _, fallback_fn in priorities:
            if field in suggested_map:
                continue
            for original_h, hl in norm_headers:
                if fallback_fn(hl):
                    suggested_map[field] = original_h
                    break

    @staticmethod
    def parse_mapped_signals(file_path: str, sheet_name: str, mapping: Dict[str, str]) -> List[SignalRecord]:
        """
        Parses imported signals based on user-approved column mappings from CSV or Excel.
        """
        is_csv = file_path.lower().endswith('.csv')
        df = None

        if is_csv:
            for enc in ['utf-8', 'latin1', 'cp1252', 'utf-8-sig']:
                try:
                    df = pd.read_csv(file_path, encoding=enc)
                    break
                except Exception:
                    continue
        else:
            df = pd.read_excel(file_path, sheet_name=sheet_name)

        if df is None:
            raise ValueError(f"Could not read source dataset from {file_path}")

        signals: List[SignalRecord] = []

        tag_col = mapping.get("tag")
        type_col = mapping.get("signal_type")
        desc_col = mapping.get("description")
        cable_col = mapping.get("cable_id")
        pair_col = mapping.get("pair_number")
        red_col = mapping.get("redundancy")
        group_col = mapping.get("logical_group")

        if not tag_col:
            raise ValueError("Tag column mapping is required")
        if not type_col:
            raise ValueError("Signal Type column mapping is required")

        for idx, row in df.iterrows():
            if row.isna().all():
                continue

            tag_val = str(row[tag_col]).strip() if tag_col in row and pd.notna(row[tag_col]) else ""
            if tag_val.lower() == "nan":
                tag_val = ""

            type_val = str(row[type_col]).strip().upper() if type_col in row and pd.notna(row[type_col]) else "UNKNOWN"
            if type_val.lower() == "nan":
                type_val = "UNKNOWN"

            desc_val = str(row[desc_col]).strip() if desc_col and desc_col in row and pd.notna(row[desc_col]) else ""
            cable_val = str(row[cable_col]).strip() if cable_col and cable_col in row and pd.notna(row[cable_col]) else ""

            # If all mapped columns are empty, skip row
            if not tag_val and type_val == "UNKNOWN" and not desc_val and not cable_val and (not pair_col or pair_col not in row or pd.isna(row[pair_col])):
                continue

            pair_val = None
            pair_invalid = False
            if pair_col and pair_col in row and pd.notna(row[pair_col]):
                pair_text = str(row[pair_col]).strip()
                match = re.fullmatch(r"(?:pair\s*|p)?(\d+)", pair_text, flags=re.IGNORECASE)
                if match:
                    pair_val = int(match.group(1))
                    if pair_val < 1:
                        pair_val = None
                        pair_invalid = True
                else:
                    pair_invalid = True

            _cfg = HardwareSystemConfig()
            raw_red = str(row[red_col]).strip() if red_col and red_col in row and pd.notna(row[red_col]) else ""
            red_val = RedundancyNormalizer.normalize(raw_red, _cfg.redundancy_mappings) or ""

            group_val = str(row[group_col]).strip() if group_col and group_col in row and pd.notna(row[group_col]) else ""

            # Check validity
            is_valid = True
            errors = []
            if not tag_val:
                is_valid = False
                errors.append("Empty Tag name")
            if type_val == "UNKNOWN":
                is_valid = False
                errors.append("Missing signal type")
            if pair_invalid:
                is_valid = False
                errors.append(f"Malformed wire pair value: {row[pair_col]!r}")

            # Check for extra DeltaV metadata in customer columns
            inst_type = ""
            for c in ["Instrument Type", "Instrument", "Type"]:
                if c in row and pd.notna(row[c]):
                    inst_type = str(row[c]).strip()
                    break

            sig_level = ""
            for c in ["Signal Level", "Level", "Wire Type"]:
                if c in row and pd.notna(row[c]):
                    sig_level = str(row[c]).strip()
                    break

            elec_spec = ""
            for c in ["Signal Type", "Electrical Spec", "Power Specification"]:
                if c in row and pd.notna(row[c]):
                    elec_spec = str(row[c]).strip()
                    break

            ext_pwr = ""
            for c in ["External Power Supply", "Power Supply", "External Power"]:
                if c in row and pd.notna(row[c]):
                    ext_pwr = str(row[c]).strip()
                    break

            loop_nm = ""
            for c in ["Loop Name", "Loop", "Internal Loop Order"]:
                if c in row and pd.notna(row[c]):
                    loop_nm = str(row[c]).strip()
                    break

            signals.append(SignalRecord(
                id=idx + 1,
                tag=tag_val,
                description=desc_val,
                signal_type=type_val,
                signal_level=sig_level,
                electrical_spec=elec_spec,
                instrument_type=inst_type,
                external_power=ext_pwr,
                cable_id=cable_val,
                pair_number=pair_val,
                redundancy=red_val,
                logical_group=group_val,
                loop_name=loop_nm,
                is_valid=is_valid,
                validation_errors=errors if errors else None
            ))

        return signals

    # Styling helpers for OpenPyXL
    @staticmethod
    def _apply_header_style(ws, cols_count: int, title: str = "IO SIGNAL SUDOKU REPORT"):
        navy_fill = PatternFill(start_color="0B132B", end_color="0B132B", fill_type="solid")
        title_font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
        sub_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1C2541", end_color="1C2541", fill_type="solid")

        # Title row
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=cols_count)
        top_cell = ws.cell(row=1, column=1)
        top_cell.value = f"EMERSON DeltaV™ HARDWARE ALLOCATION PLATFORM — {title.upper()}"
        top_cell.font = title_font
        top_cell.fill = navy_fill
        top_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 30

        # Header row 2
        for col in range(1, cols_count + 1):
            c = ws.cell(row=2, column=col)
            c.font = sub_font
            c.fill = header_fill
            c.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[2].height = 24

    @staticmethod
    def _auto_fit_columns(ws):
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if len(val) > max_len and "\n" not in val:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    # --- REPORT GENERATORS ---

    @classmethod
    def export_completed_allocation(
        cls,
        project_name: str,
        revision_code: str,
        assignments: List[AssignmentModel]
    ) -> str:
        filename = f"{project_name.replace(' ', '_')}_{revision_code}_Completed_Allocation.xlsx"
        file_path = os.path.join(REPORT_OUTPUT_DIR, filename)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Allocated IO Signals"

        headers = [
            "Tag Name", "Description", "Signal Type", "Cable ID", "Pair #",
            "Redundancy", "Logical Group", "Cabinet", "CIOC", "Baseplate",
            "CHARM Slot", "CHARM Hardware Type", "Terminal Block", "Allocation Status", "Notes"
        ]

        cls._apply_header_style(ws, len(headers), f"Hardware Allocation — {revision_code}")

        for col_idx, h in enumerate(headers, 1):
            ws.cell(row=2, column=col_idx, value=h)

        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        valid_fill = PatternFill(start_color="E6F4EA", end_color="E6F4EA", fill_type="solid")
        review_fill = PatternFill(start_color="FEF7E0", end_color="FEF7E0", fill_type="solid")
        blocked_fill = PatternFill(start_color="FCE8E6", end_color="FCE8E6", fill_type="solid")

        for row_idx, a in enumerate(assignments, 3):
            status_fill = valid_fill if a.status == "Allocated" else (review_fill if a.status == "Needs Review" else blocked_fill)
            row_vals = [
                a.tag, a.description, a.signal_type, a.cable_id, a.pair_number or "",
                a.redundancy or "", a.logical_group or "", a.cabinet_id or "—", a.cioc_id or "—",
                a.baseplate_id or "—", a.charm_index or "—", a.charm_type or "—",
                a.terminal_block or "—", a.status, a.reason or ""
            ]
            for col_idx, val in enumerate(row_vals, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.border = thin_border
                if col_idx == 14: # Status column
                    cell.fill = status_fill
                    cell.font = Font(name="Calibri", bold=True)
                    cell.alignment = Alignment(horizontal="center")
                else:
                    cell.font = Font(name="Calibri", size=10)

        cls._auto_fit_columns(ws)
        wb.save(file_path)
        return file_path

    @classmethod
    def export_validation_report(
        cls,
        project_name: str,
        revision_code: str,
        issues: List[ValidationIssueModel]
    ) -> str:
        filename = f"{project_name.replace(' ', '_')}_{revision_code}_Validation_Report.xlsx"
        file_path = os.path.join(REPORT_OUTPUT_DIR, filename)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Validation Issues"

        headers = ["Issue ID", "Severity", "Rule Name", "Affected Tags", "Hardware Location", "Finding Description", "Recommended Engineering Action", "Blocks Approval"]
        cls._apply_header_style(ws, len(headers), f"Validation Audit Log — {revision_code}")

        for col_idx, h in enumerate(headers, 1):
            ws.cell(row=2, column=col_idx, value=h)

        err_fill = PatternFill(start_color="FCE8E6", end_color="FCE8E6", fill_type="solid")
        wrn_fill = PatternFill(start_color="FEF7E0", end_color="FEF7E0", fill_type="solid")
        inf_fill = PatternFill(start_color="E8F0FE", end_color="E8F0FE", fill_type="solid")

        for row_idx, issue in enumerate(issues, 3):
            fill = err_fill if issue.severity == "ERROR" else (wrn_fill if issue.severity == "WARNING" else inf_fill)
            row_vals = [
                issue.issue_id, issue.severity, issue.rule_name,
                ", ".join(issue.affected_tags), issue.affected_hardware or "—",
                issue.message, issue.suggested_action, "YES" if issue.blocks_approval else "NO"
            ]
            for col_idx, val in enumerate(row_vals, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                if col_idx == 2:
                    cell.fill = fill
                    cell.font = Font(name="Calibri", bold=True)
                    cell.alignment = Alignment(horizontal="center")

        cls._auto_fit_columns(ws)
        wb.save(file_path)
        return file_path

    @classmethod
    def export_tq_report(
        cls,
        project_name: str,
        revision_code: str,
        tqs: List[TQResponseModel]
    ) -> str:
        filename = f"{project_name.replace(' ', '_')}_{revision_code}_Technical_Queries.xlsx"
        file_path = os.path.join(REPORT_OUTPUT_DIR, filename)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Technical Queries"

        headers = ["TQ Code", "Status", "Category", "Affected Signals", "Problem Description", "Root Cause Analysis", "Specific Clarification Required", "Suggested Action", "Resolution Notes", "Created At"]
        cls._apply_header_style(ws, len(headers), f"Technical Queries Register — {revision_code}")

        for col_idx, h in enumerate(headers, 1):
            ws.cell(row=2, column=col_idx, value=h)

        for row_idx, tq in enumerate(tqs, 3):
            row_vals = [
                tq.tq_code, tq.status, tq.category, ", ".join(tq.affected_tags),
                tq.description, tq.root_cause, tq.specific_clarification,
                tq.suggested_action, tq.resolution_notes, tq.created_at[:16]
            ]
            for col_idx, val in enumerate(row_vals, 1):
                ws.cell(row=row_idx, column=col_idx, value=val)

        cls._auto_fit_columns(ws)
        wb.save(file_path)
        return file_path

    @classmethod
    def export_utilisation_report(
        cls,
        project_name: str,
        revision_code: str,
        util: UtilisationSummaryModel
    ) -> str:
        filename = f"{project_name.replace(' ', '_')}_{revision_code}_Hardware_Utilisation.xlsx"
        file_path = os.path.join(REPORT_OUTPUT_DIR, filename)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Cabinet & CIOC Utilisation"

        headers = ["Cabinet ID", "CIOC ID", "Total Baseplates", "Occupied Baseplates", "Total CHARMs", "Used CHARMs", "Reserved Spares", "Available Free Slots", "Utilisation %"]
        cls._apply_header_style(ws, len(headers), f"Hardware Utilisation & Spare Audit — {revision_code}")

        for col_idx, h in enumerate(headers, 1):
            ws.cell(row=2, column=col_idx, value=h)

        row_idx = 3
        for cab in util.cabinets:
            for cioc in cab.ciocs:
                row_vals = [
                    cab.cabinet_id, cioc.cioc_id, cioc.total_baseplates, cioc.used_baseplates,
                    cioc.total_slots, cioc.used_slots, cioc.reserved_spare_slots,
                    cioc.free_slots, f"{cioc.utilization_pct}%"
                ]
                for col_idx, val in enumerate(row_vals, 1):
                    ws.cell(row=row_idx, column=col_idx, value=val)
                row_idx += 1

        cls._auto_fit_columns(ws)
        wb.save(file_path)
        return file_path

    @classmethod
    def export_revision_diff(
        cls,
        project_name: str,
        diff: RevisionComparisonResponse
    ) -> str:
        filename = f"{project_name.replace(' ', '_')}_{diff.base_revision}_to_{diff.target_revision}_Revision_Impact.xlsx"
        file_path = os.path.join(REPORT_OUTPUT_DIR, filename)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Revision Impact Analysis"

        headers = ["Signal Tag", "Change Type", "Base Allocation", "Revised Allocation", "Movement Status", "Movement Reason", "Old Properties", "New Properties"]
        cls._apply_header_style(ws, len(headers), f"Revision Diff: {diff.base_revision} → {diff.target_revision}")

        for col_idx, h in enumerate(headers, 1):
            ws.cell(row=2, column=col_idx, value=h)

        add_fill = PatternFill(start_color="E6F4EA", end_color="E6F4EA", fill_type="solid")
        del_fill = PatternFill(start_color="FCE8E6", end_color="FCE8E6", fill_type="solid")
        mod_fill = PatternFill(start_color="FEF7E0", end_color="FEF7E0", fill_type="solid")

        for row_idx, item in enumerate(diff.diff_records, 3):
            fill = add_fill if item.change_type == "ADDED" else (del_fill if item.change_type == "DELETED" else (mod_fill if item.change_type == "MODIFIED" else None))
            row_vals = [
                item.tag, item.change_type, item.old_assignment or "—", item.new_assignment or "—",
                item.movement_status, item.movement_reason or "—",
                str(item.old_values) if item.old_values else "—",
                str(item.new_values) if item.new_values else "—"
            ]
            for col_idx, val in enumerate(row_vals, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                if col_idx == 2 and fill:
                    cell.fill = fill
                    cell.font = Font(name="Calibri", bold=True)
                    cell.alignment = Alignment(horizontal="center")

        cls._auto_fit_columns(ws)
        wb.save(file_path)
        return file_path
