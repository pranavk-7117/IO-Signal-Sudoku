import os
import shutil
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from database import init_db, get_db_status
from datetime import datetime
from database import get_db
from models import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    RevisionCreate, RevisionResponse, HardwareConfigModel,
    SignalRecord, AssignmentModel, AssignmentUpdateModel,
    ValidationIssueModel, ValidationSummaryModel,
    TQCreateModel, TQUpdateModel, TQResponseModel,
    RevisionComparisonResponse, UtilisationSummaryModel,
    AuditLogModel, SheetInspectResponse, ColumnMappingRequest,
    ApprovalRequest, ApprovalResponse, AllocationRunResult, SolverDiagnostics
)
from db_service import DBService
from engine.allocator import AllocationEngine
from engine.validator import ValidationEngine
from engine.tq_generator import TQGenerator
from engine.utilisation import UtilisationCalculator
from engine.excel_handler import ExcelHandler, REPORT_OUTPUT_DIR
from engine.revision_comparator import RevisionComparator
from demo_data import seed_demo_project, SAMPLE_DIR

if os.environ.get("VERCEL"):
    UPLOAD_DIR = "/tmp/uploads"
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "data", "uploads")

try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception:
    UPLOAD_DIR = "/tmp/uploads"
    os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="IO Signal Sudoku — Industrial IO Signal Allocation Platform",
    description="Intelligent constraint-based industrial IO signal allocation and validation engine for DeltaV control systems.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()
    # Clean zero-preload startup: wait for user uploads during testing

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "IO Signal Sudoku Allocation Platform",
        "version": "1.0.0",
        "database": get_db_status()
    }

# --- Project Routes ---
@app.get("/api/projects", response_model=List[ProjectResponse])
def get_projects():
    return DBService.list_projects()

@app.post("/api/projects", response_model=ProjectResponse)
def create_project(data: ProjectCreate):
    try:
        return DBService.create_project(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int):
    proj = DBService.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj

@app.put("/api/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, data: ProjectUpdate):
    proj = DBService.update_project(project_id, data)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int):
    deleted = DBService.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully"}

# --- Revisions ---
@app.get("/api/projects/{project_id}/revisions", response_model=List[RevisionResponse])
def get_revisions(project_id: int):
    return DBService.get_revisions(project_id)

@app.post("/api/projects/{project_id}/revisions", response_model=RevisionResponse)
def create_revision(project_id: int, data: RevisionCreate):
    try:
        return DBService.create_revision(project_id, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/projects/{project_id}/revisions/switch")
def switch_active_revision(project_id: int, revision_id: int = Query(...)):
    revs = DBService.get_revisions(project_id)
    target_rev = next((r for r in revs if r["id"] == revision_id), None)
    if not target_rev:
        raise HTTPException(status_code=404, detail="Revision not found")
    
    conn = DBService.get_db() if hasattr(DBService, "get_db") else None
    from database import get_db
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE revisions SET is_active = 0 WHERE project_id = ?;", (project_id,))
    cursor.execute("UPDATE revisions SET is_active = 1 WHERE id = ?;", (revision_id,))
    cursor.execute("UPDATE projects SET current_revision = ? WHERE id = ?;", (target_rev["revision_code"], project_id))
    conn.commit()
    conn.close()
    return {"message": f"Switched active revision to {target_rev['revision_code']}"}

# --- Excel Upload & Column Mapping ---
@app.post("/api/upload/inspect")
async def inspect_uploaded_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported.")
    
    saved_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_size_kb = round(os.path.getsize(saved_path) / 1024.0, 1)

    try:
        inspection = ExcelHandler.inspect_workbook(saved_path)
        return {
            "filename": file.filename,
            "file_size_kb": file_size_kb,
            "sheets": inspection["sheets"],
            "sheet_headers": inspection["headers"],
            "sheet_data_preview": inspection["previews"],
            "suggested_mappings": inspection["suggested_mappings"],
            "temp_file_path": saved_path
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to inspect Excel workbook: {str(e)}")

@app.post("/api/upload/import")
def import_mapped_data(
    project_id: int = Query(...),
    revision_id: int = Query(...),
    file_path: str = Query(...),
    sheet_name: str = Query(...),
    mapping: Dict[str, str] = ...
):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Uploaded file not found on server")

    try:
        signals = ExcelHandler.parse_mapped_signals(file_path, sheet_name, mapping)
        saved_count = DBService.save_imported_signals(project_id, revision_id, signals, os.path.basename(file_path))
        return {
            "message": f"Successfully parsed and imported {saved_count} signals.",
            "imported_count": saved_count,
            "invalid_count": len([s for s in signals if not s.is_valid])
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")

# --- Hardware Configuration & Rules ---
@app.get("/api/projects/{project_id}/hardware-config", response_model=HardwareConfigModel)
def get_hardware_config(project_id: int, revision_id: Optional[int] = None):
    return DBService.get_hardware_config(project_id, revision_id)

@app.put("/api/projects/{project_id}/hardware-config")
def save_hardware_config(project_id: int, config: HardwareConfigModel, revision_id: Optional[int] = None):
    success = DBService.save_hardware_config(project_id, revision_id, config)
    return {"message": "Hardware configuration and rules updated successfully", "success": success}

# --- Allocation Engine Routes ---
@app.post("/api/allocation/run", response_model=AllocationRunResult)
def run_allocation(
    project_id: int = Query(...),
    revision_id: int = Query(...),
    preserve_existing: bool = Query(True),
    timeout_seconds: float = Query(15.0)
):
    signals = DBService.get_imported_signals(project_id, revision_id)
    if not signals:
        raise HTTPException(status_code=400, detail="No imported signals found for this revision. Please import an IO list first.")

    hw_config = DBService.get_hardware_config(project_id, revision_id)
    hw_config.rules.preserve_previous_assignments = preserve_existing

    # Check for previous assignments if preserving
    prev_assignments_map = None
    if preserve_existing:
        revs = DBService.get_revisions(project_id)
        curr_idx = next((i for i, r in enumerate(revs) if r["id"] == revision_id), None)
        if curr_idx is not None and curr_idx > 0:
            prev_rev = revs[curr_idx - 1]
            prev_allocs = DBService.get_assignments(project_id, prev_rev["id"])
            prev_assignments_map = {a.tag: a for a in prev_allocs}

    engine = AllocationEngine(hw_config)
    assignments = engine.run_allocation(signals, previous_assignments=prev_assignments_map, timeout_seconds=timeout_seconds)
    DBService.save_assignments(project_id, revision_id, assignments)

    # Immediately run independent validator
    validator = ValidationEngine(hw_config)
    val_summary = validator.validate(signals, assignments)
    DBService.save_validation_results(project_id, revision_id, val_summary.issues)

    # Generate or update TQs
    tqs = TQGenerator.generate_tqs_from_validation(project_id, revision_id, val_summary.issues, assignments)
    for tq in tqs:
        DBService.create_or_update_tq(tq)

    allocated = len([a for a in assignments if a.status == "Allocated"])
    unallocated = len(assignments) - allocated

    diagnostics = engine.last_diagnostics or SolverDiagnostics(
        solver_name="Google OR-Tools CP-SAT",
        solver_status="OPTIMAL",
        is_optimal=True,
        solve_time_seconds=0.0
    )

    approval_eligible = (val_summary.error_count == 0 and unallocated == 0)

    return AllocationRunResult(
        message="Allocation completed via Google OR-Tools CP-SAT",
        total_signals=len(signals),
        allocated_count=allocated,
        unallocated_count=unallocated,
        validation_errors=val_summary.error_count,
        validation_warnings=val_summary.warning_count,
        is_fully_validated=val_summary.is_fully_validated,
        approval_eligible=approval_eligible,
        diagnostics=diagnostics
    )

# --- Fail-Closed Approval Gate ---
@app.post("/api/allocation/approve", response_model=ApprovalResponse)
def approve_allocation(data: ApprovalRequest):
    project = DBService.get_project(data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    signals = DBService.get_imported_signals(data.project_id, data.revision_id)
    assignments = DBService.get_assignments(data.project_id, data.revision_id)

    if not signals or not assignments:
        return ApprovalResponse(
            project_id=data.project_id,
            revision_id=data.revision_id,
            is_approved=False,
            approval_status="Rejected",
            blocking_issues_count=1,
            blocking_reasons=["No allocation records found to approve. Please execute the CP-SAT solver first."]
        )

    hw_config = DBService.get_hardware_config(data.project_id, data.revision_id)
    validator = ValidationEngine(hw_config)
    try:
        val_summary = validator.validate(signals, assignments)
    except Exception as e:
        return ApprovalResponse(
            project_id=data.project_id,
            revision_id=data.revision_id,
            is_approved=False,
            approval_status="Rejected",
            blocking_issues_count=1,
            blocking_reasons=[f"Validator execution failure (Fail-Closed Policy): {str(e)}"]
        )

    blocking_reasons = []
    for issue in val_summary.issues:
        if issue.blocks_approval or issue.severity == "ERROR":
            blocking_reasons.append(f"[{issue.rule_name}] {issue.message}")

    unallocated_blocked = [a for a in assignments if a.status == "Blocked"]
    if unallocated_blocked:
        blocking_reasons.append(f"{len(unallocated_blocked)} signals are in 'Blocked' state.")

    # Slot collisions check
    slot_counts = {}
    for a in assignments:
        if a.status == "Allocated" and a.cabinet_id and a.cioc_id and a.baseplate_id and a.charm_index:
            addr = f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/CH{a.charm_index:02d}"
            slot_counts[addr] = slot_counts.get(addr, 0) + 1
            if slot_counts[addr] > 1:
                blocking_reasons.append(f"Hardware collision at {addr}.")

    if blocking_reasons:
        now = datetime.now().isoformat()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
            VALUES (?, 'APPROVAL_REJECTED', 'Allocation', ?, NULL, ?, ?, ?);
        """, (data.project_id, str(data.revision_id), f"Rejected with {len(blocking_reasons)} blocking issues", data.reviewer_name, now))
        conn.commit()
        conn.close()

        return ApprovalResponse(
            project_id=data.project_id,
            revision_id=data.revision_id,
            is_approved=False,
            approval_status="Rejected",
            blocking_issues_count=len(blocking_reasons),
            blocking_reasons=blocking_reasons,
            validator_summary=val_summary.model_dump()
        )

    # All checks passed: Grant Approval
    now = datetime.now().isoformat()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE projects SET status = 'Approved', updated_at = ? WHERE id = ?;", (now, data.project_id))
    cursor.execute("""
        INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
        VALUES (?, 'APPROVAL_GRANTED', 'Allocation', ?, 'Pending', 'Approved', ?, ?);
    """, (data.project_id, str(data.revision_id), data.reviewer_name, now))
    conn.commit()
    conn.close()

    return ApprovalResponse(
        project_id=data.project_id,
        revision_id=data.revision_id,
        is_approved=True,
        approval_status="Approved",
        approval_timestamp=now,
        blocking_issues_count=0,
        blocking_reasons=[],
        validator_summary=val_summary.model_dump()
    )

@app.get("/api/allocation/assignments", response_model=List[AssignmentModel])
def get_assignments(
    project_id: int = Query(...),
    revision_id: int = Query(...),
    status: Optional[str] = None,
    signal_type: Optional[str] = None,
    cable_id: Optional[str] = None,
    search: Optional[str] = None
):
    assignments = DBService.get_assignments(project_id, revision_id)
    if status:
        assignments = [a for a in assignments if a.status.lower() == status.lower()]
    if signal_type:
        assignments = [a for a in assignments if a.signal_type.upper() == signal_type.upper()]
    if cable_id:
        assignments = [a for a in assignments if a.cable_id == cable_id]
    if search:
        s_low = search.lower()
        assignments = [
            a for a in assignments 
            if s_low in a.tag.lower() or s_low in a.description.lower() or s_low in (a.cable_id or "").lower()
        ]
    return assignments

@app.put("/api/allocation/assignment/{assignment_id}")
def update_assignment(
    project_id: int = Query(...),
    revision_id: int = Query(...),
    assignment_id: int = ...,
    data: AssignmentUpdateModel = ...
):
    try:
        # First test the update
        DBService.update_single_assignment(
            project_id=project_id,
            revision_id=revision_id,
            assignment_id=assignment_id,
            cabinet_id=data.cabinet_id,
            cioc_id=data.cioc_id,
            baseplate_id=data.baseplate_id,
            charm_index=data.charm_index,
            terminal_block=data.terminal_block
        )

        # Run independent validator to ensure this manual override didn't violate hard constraints
        signals = DBService.get_imported_signals(project_id, revision_id)
        assignments = DBService.get_assignments(project_id, revision_id)
        hw_config = DBService.get_hardware_config(project_id, revision_id)
        validator = ValidationEngine(hw_config)
        val_summary = validator.validate(signals, assignments)
        DBService.save_validation_results(project_id, revision_id, val_summary.issues)

        return {
            "message": "Assignment updated and re-validated successfully",
            "is_valid": val_summary.is_fully_validated,
            "error_count": val_summary.error_count
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/allocation/revert")
def revert_allocation(project_id: int = Query(...), revision_id: int = Query(...)):
    success = DBService.revert_to_last_snapshot(project_id, revision_id)
    if not success:
        raise HTTPException(status_code=400, detail="No prior allocation snapshot found to revert to.")
    
    # Revalidate
    signals = DBService.get_imported_signals(project_id, revision_id)
    assignments = DBService.get_assignments(project_id, revision_id)
    hw_config = DBService.get_hardware_config(project_id, revision_id)
    validator = ValidationEngine(hw_config)
    val_summary = validator.validate(signals, assignments)
    DBService.save_validation_results(project_id, revision_id, val_summary.issues)

    return {"message": "Reverted to previous valid allocation snapshot"}

# --- Independent Validation & TQs ---
@app.get("/api/validation/summary", response_model=ValidationSummaryModel)
def get_validation_summary(project_id: int = Query(...), revision_id: int = Query(...)):
    signals = DBService.get_imported_signals(project_id, revision_id)
    assignments = DBService.get_assignments(project_id, revision_id)
    hw_config = DBService.get_hardware_config(project_id, revision_id)

    validator = ValidationEngine(hw_config)
    summary = validator.validate(signals, assignments)
    return summary

@app.get("/api/tqs", response_model=List[TQResponseModel])
def get_technical_queries(project_id: int = Query(...), revision_id: Optional[int] = None):
    return DBService.get_tqs(project_id, revision_id)

@app.post("/api/tqs", response_model=TQResponseModel)
def create_technical_query(data: TQCreateModel):
    tq_dict = data.model_dump()
    tq_dict["tq_code"] = f"TQ-{data.project_id:02d}-MANUAL"
    tq_id = DBService.create_or_update_tq(tq_dict)
    tqs = DBService.get_tqs(data.project_id, data.revision_id)
    return next(t for t in tqs if t.id == tq_id)

@app.put("/api/tqs/{tq_id}")
def update_technical_query(tq_id: int, data: TQUpdateModel):
    success = DBService.update_tq_status(tq_id, data.status, data.resolution_notes)
    if not success:
        raise HTTPException(status_code=404, detail="Technical Query not found")
    return {"message": "Technical Query updated successfully"}

# --- Hardware Utilisation & Hierarchy ---
@app.get("/api/utilisation", response_model=UtilisationSummaryModel)
def get_utilisation_summary(project_id: int = Query(...), revision_id: int = Query(...)):
    hw_config = DBService.get_hardware_config(project_id, revision_id)
    assignments = DBService.get_assignments(project_id, revision_id)
    return UtilisationCalculator.calculate_utilisation(hw_config, assignments)

# --- Revision Comparison ---
@app.get("/api/projects/{project_id}/revisions/compare", response_model=RevisionComparisonResponse)
def compare_revisions(
    project_id: int,
    base_revision_id: int = Query(...),
    target_revision_id: int = Query(...)
):
    revs = DBService.get_revisions(project_id)
    base_rev = next((r for r in revs if r["id"] == base_revision_id), None)
    target_rev = next((r for r in revs if r["id"] == target_revision_id), None)
    if not base_rev or not target_rev:
        raise HTTPException(status_code=404, detail="One or both revisions not found")

    base_signals = DBService.get_imported_signals(project_id, base_revision_id)
    target_signals = DBService.get_imported_signals(project_id, target_revision_id)

    base_assignments = DBService.get_assignments(project_id, base_revision_id)
    target_assignments = DBService.get_assignments(project_id, target_revision_id)

    return RevisionComparator.compare_revisions(
        base_rev["revision_code"],
        target_rev["revision_code"],
        base_signals,
        target_signals,
        base_assignments,
        target_assignments
    )

# --- Report Downloads & Excel Exports ---
@app.get("/api/reports/export/allocation")
def export_allocation_workbook(project_id: int = Query(...), revision_id: int = Query(...)):
    proj = DBService.get_project(project_id)
    revs = DBService.get_revisions(project_id)
    curr_rev = next((r for r in revs if r["id"] == revision_id), {"revision_code": "Rev_A"})
    assignments = DBService.get_assignments(project_id, revision_id)

    file_path = ExcelHandler.export_completed_allocation(proj["name"], curr_rev["revision_code"], assignments)
    return FileResponse(file_path, filename=os.path.basename(file_path), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.get("/api/reports/export/validation")
def export_validation_report(project_id: int = Query(...), revision_id: int = Query(...)):
    proj = DBService.get_project(project_id)
    revs = DBService.get_revisions(project_id)
    curr_rev = next((r for r in revs if r["id"] == revision_id), {"revision_code": "Rev_A"})
    issues = DBService.get_validation_results(project_id, revision_id)

    file_path = ExcelHandler.export_validation_report(proj["name"], curr_rev["revision_code"], issues)
    return FileResponse(file_path, filename=os.path.basename(file_path), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.get("/api/reports/export/tqs")
def export_tq_report(project_id: int = Query(...), revision_id: int = Query(...)):
    proj = DBService.get_project(project_id)
    revs = DBService.get_revisions(project_id)
    curr_rev = next((r for r in revs if r["id"] == revision_id), {"revision_code": "Rev_A"})
    tqs = DBService.get_tqs(project_id, revision_id)

    file_path = ExcelHandler.export_tq_report(proj["name"], curr_rev["revision_code"], tqs)
    return FileResponse(file_path, filename=os.path.basename(file_path), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.get("/api/reports/export/utilisation")
def export_utilisation_report(project_id: int = Query(...), revision_id: int = Query(...)):
    proj = DBService.get_project(project_id)
    revs = DBService.get_revisions(project_id)
    curr_rev = next((r for r in revs if r["id"] == revision_id), {"revision_code": "Rev_A"})
    hw_config = DBService.get_hardware_config(project_id, revision_id)
    assignments = DBService.get_assignments(project_id, revision_id)
    util = UtilisationCalculator.calculate_utilisation(hw_config, assignments)

    file_path = ExcelHandler.export_utilisation_report(proj["name"], curr_rev["revision_code"], util)
    return FileResponse(file_path, filename=os.path.basename(file_path), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.get("/api/reports/export/revision-diff")
def export_revision_diff(project_id: int = Query(...), base_id: int = Query(...), target_id: int = Query(...)):
    proj = DBService.get_project(project_id)
    diff = compare_revisions(project_id, base_id, target_id)
    file_path = ExcelHandler.export_revision_diff(proj["name"], diff)
    return FileResponse(file_path, filename=os.path.basename(file_path), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.get("/api/sample-files/download/{file_name}")
def download_sample_file(file_name: str):
    allowed_files = ["Customer_IO_List_RevA.xlsx", "Customer_IO_List_RevB.xlsx", "DeltaV_Allocation_Template.xlsx"]
    if file_name not in allowed_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = os.path.join(SAMPLE_DIR, file_name)
    if not os.path.exists(file_path):
        from demo_data import create_sample_excel_files
        create_sample_excel_files()

    return FileResponse(file_path, filename=file_name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# --- Audit Logs & Demo Seed ---
@app.get("/api/audit-logs/{project_id}", response_model=List[AuditLogModel])
def get_audit_logs(project_id: int):
    return DBService.get_audit_logs(project_id)

@app.post("/api/demo/seed")
def seed_demo():
    proj_id = seed_demo_project()
    return {"message": "Demo project initialized successfully", "project_id": proj_id}
