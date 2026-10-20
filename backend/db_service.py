import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from database import get_db
from models import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    RevisionCreate, RevisionResponse, HardwareConfigModel, RuleConfigModel,
    SignalRecord, AssignmentModel, ValidationIssueModel, TQResponseModel,
    AuditLogModel
)

class DBService:
    @staticmethod
    def list_projects() -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects ORDER BY created_at DESC;")
        rows = cursor.fetchall()
        projects = []
        for r in rows:
            p_id = r["id"]
            # get counts
            cursor.execute("SELECT COUNT(*) as c FROM imported_signals WHERE project_id = ?;", (p_id,))
            sig_count = cursor.fetchone()["c"]
            cursor.execute("SELECT COUNT(*) as c FROM allocation_assignments WHERE project_id = ? AND status = 'Allocated';", (p_id,))
            alloc_count = cursor.fetchone()["c"]
            cursor.execute("SELECT COUNT(*) as c FROM validation_results WHERE project_id = ? AND severity = 'ERROR';", (p_id,))
            err_count = cursor.fetchone()["c"]
            cursor.execute("SELECT COUNT(*) as c FROM technical_queries WHERE project_id = ? AND status != 'Closed';", (p_id,))
            tq_count = cursor.fetchone()["c"]

            projects.append({
                "id": r["id"],
                "project_id": r["project_id"],
                "name": r["name"],
                "customer_name": r["customer_name"],
                "description": r["description"] or "",
                "system": r["system"],
                "current_revision": r["current_revision"],
                "status": r["status"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "signal_count": sig_count,
                "allocated_count": alloc_count,
                "validation_errors_count": err_count,
                "open_tqs_count": tq_count
            })
        conn.close()
        return projects

    @staticmethod
    def get_project(project_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?;", (project_id,))
        r = cursor.fetchone()
        if not r:
            conn.close()
            return None
        
        cursor.execute("SELECT COUNT(*) as c FROM imported_signals WHERE project_id = ?;", (project_id,))
        sig_count = cursor.fetchone()["c"]
        cursor.execute("SELECT COUNT(*) as c FROM allocation_assignments WHERE project_id = ? AND status = 'Allocated';", (project_id,))
        alloc_count = cursor.fetchone()["c"]
        cursor.execute("SELECT COUNT(*) as c FROM validation_results WHERE project_id = ? AND severity = 'ERROR';", (project_id,))
        err_count = cursor.fetchone()["c"]
        cursor.execute("SELECT COUNT(*) as c FROM technical_queries WHERE project_id = ? AND status != 'Closed';", (project_id,))
        tq_count = cursor.fetchone()["c"]

        proj = {
            "id": r["id"],
            "project_id": r["project_id"],
            "name": r["name"],
            "customer_name": r["customer_name"],
            "description": r["description"] or "",
            "system": r["system"],
            "current_revision": r["current_revision"],
            "status": r["status"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "signal_count": sig_count,
            "allocated_count": alloc_count,
            "validation_errors_count": err_count,
            "open_tqs_count": tq_count
        }
        conn.close()
        return proj

    @staticmethod
    def create_project(data: ProjectCreate) -> Dict[str, Any]:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO projects (project_id, name, customer_name, description, system, current_revision, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'Rev A', 'Active', ?, ?);
        """, (data.project_id, data.name, data.customer_name, data.description or "", data.system, now, now))
        p_id = cursor.lastrowid

        # Create initial Rev A
        cursor.execute("""
            INSERT INTO revisions (project_id, revision_code, description, is_active, created_at)
            VALUES (?, 'Rev A', 'Initial baseline revision', 1, ?);
        """, (p_id, now))
        rev_id = cursor.lastrowid

        # Create default hardware configuration
        default_hw = HardwareConfigModel()
        cursor.execute("""
            INSERT INTO hardware_configurations (project_id, revision_id, cabinets_count, ciocs_per_cabinet, baseplates_per_cioc, charms_per_baseplate, spare_percentage, rules_json, compatibility_matrix_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (p_id, rev_id, default_hw.cabinets_count, default_hw.ciocs_per_cabinet, default_hw.baseplates_per_cioc, default_hw.charms_per_baseplate, default_hw.spare_percentage, default_hw.rules.model_dump_json(), json.dumps(default_hw.compatibility_matrix), now))

        # Log audit
        cursor.execute("""
            INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
            VALUES (?, 'CREATE', 'Project', ?, NULL, ?, 'Lead DCS Engineer', ?);
        """, (p_id, str(p_id), f"Created project {data.name} ({data.project_id})", now))

        conn.commit()
        conn.close()
        return DBService.get_project(p_id)

    @staticmethod
    def update_project(project_id: int, data: ProjectUpdate) -> Optional[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        updates = []
        params = []
        if data.name is not None:
            updates.append("name = ?")
            params.append(data.name)
        if data.customer_name is not None:
            updates.append("customer_name = ?")
            params.append(data.customer_name)
        if data.description is not None:
            updates.append("description = ?")
            params.append(data.description)
        if data.system is not None:
            updates.append("system = ?")
            params.append(data.system)
        
        if not updates:
            conn.close()
            return DBService.get_project(project_id)
        
        updates.append("updated_at = ?")
        params.append(now)
        params.append(project_id)
        
        cursor.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?;", tuple(params))
        
        cursor.execute("""
            INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
            VALUES (?, 'UPDATE', 'Project', ?, NULL, 'Updated project details', 'Lead DCS Engineer', ?);
        """, (project_id, str(project_id), now))

        conn.commit()
        conn.close()
        return DBService.get_project(project_id)

    @staticmethod
    def delete_project(project_id: int) -> bool:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM projects WHERE id = ?;", (project_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    @staticmethod
    def get_revisions(project_id: int) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM revisions WHERE project_id = ? ORDER BY created_at ASC;", (project_id,))
        rows = cursor.fetchall()
        revs = []
        for r in rows:
            revs.append({
                "id": r["id"],
                "project_id": r["project_id"],
                "revision_code": r["revision_code"],
                "description": r["description"] or "",
                "source_filename": r["source_filename"],
                "template_filename": r["template_filename"],
                "is_active": bool(r["is_active"]),
                "created_at": r["created_at"]
            })
        conn.close()
        return revs

    @staticmethod
    def create_revision(project_id: int, data: RevisionCreate) -> Dict[str, Any]:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        # Deactivate previous active revisions
        cursor.execute("UPDATE revisions SET is_active = 0 WHERE project_id = ?;", (project_id,))
        
        cursor.execute("""
            INSERT INTO revisions (project_id, revision_code, description, is_active, created_at)
            VALUES (?, ?, ?, 1, ?);
        """, (project_id, data.revision_code, data.description or "", now))
        rev_id = cursor.lastrowid
        
        # Update current revision on project
        cursor.execute("UPDATE projects SET current_revision = ?, updated_at = ? WHERE id = ?;", (data.revision_code, now, project_id))
        
        # Copy latest hardware config for new revision
        cursor.execute("""
            SELECT * FROM hardware_configurations WHERE project_id = ? ORDER BY id DESC LIMIT 1;
        """, (project_id,))
        last_hw = cursor.fetchone()
        if last_hw:
            cursor.execute("""
                INSERT INTO hardware_configurations (project_id, revision_id, cabinets_count, ciocs_per_cabinet, baseplates_per_cioc, charms_per_baseplate, spare_percentage, rules_json, compatibility_matrix_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (project_id, rev_id, last_hw["cabinets_count"], last_hw["ciocs_per_cabinet"], last_hw["baseplates_per_cioc"], last_hw["charms_per_baseplate"], last_hw["spare_percentage"], last_hw["rules_json"], last_hw["compatibility_matrix_json"], now))

        cursor.execute("""
            INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
            VALUES (?, 'CREATE_REVISION', 'Revision', ?, NULL, ?, 'Lead DCS Engineer', ?);
        """, (project_id, str(rev_id), f"Created new revision {data.revision_code}", now))

        conn.commit()
        conn.close()
        return {
            "id": rev_id,
            "project_id": project_id,
            "revision_code": data.revision_code,
            "description": data.description or "",
            "is_active": True,
            "created_at": now
        }

    @staticmethod
    def get_hardware_config(project_id: int, revision_id: Optional[int] = None) -> HardwareConfigModel:
        conn = get_db()
        cursor = conn.cursor()
        if revision_id:
            cursor.execute("""
                SELECT * FROM hardware_configurations WHERE project_id = ? AND revision_id = ? ORDER BY id DESC LIMIT 1;
            """, (project_id, revision_id))
        else:
            cursor.execute("""
                SELECT * FROM hardware_configurations WHERE project_id = ? ORDER BY id DESC LIMIT 1;
            """, (project_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return HardwareConfigModel()

        rules_dict = json.loads(row["rules_json"])
        compat_dict = json.loads(row["compatibility_matrix_json"])
        return HardwareConfigModel(
            cabinets_count=row["cabinets_count"],
            ciocs_per_cabinet=row["ciocs_per_cabinet"],
            baseplates_per_cioc=row["baseplates_per_cioc"],
            charms_per_baseplate=row["charms_per_baseplate"],
            spare_percentage=row["spare_percentage"],
            rules=RuleConfigModel(**rules_dict),
            compatibility_matrix=compat_dict
        )

    @staticmethod
    def save_hardware_config(project_id: int, revision_id: Optional[int], config: HardwareConfigModel) -> bool:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        rules_json = config.rules.model_dump_json()
        compat_json = json.dumps(config.compatibility_matrix)

        cursor.execute("""
            INSERT INTO hardware_configurations (project_id, revision_id, cabinets_count, ciocs_per_cabinet, baseplates_per_cioc, charms_per_baseplate, spare_percentage, rules_json, compatibility_matrix_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (project_id, revision_id, config.cabinets_count, config.ciocs_per_cabinet, config.baseplates_per_cioc, config.charms_per_baseplate, config.spare_percentage, rules_json, compat_json, now))

        cursor.execute("""
            INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
            VALUES (?, 'UPDATE_CONFIG', 'HardwareConfig', ?, NULL, 'Updated hardware capacities & rules', 'Lead DCS Engineer', ?);
        """, (project_id, str(project_id), now))

        conn.commit()
        conn.close()
        return True

    @staticmethod
    def save_imported_signals(project_id: int, revision_id: int, signals: List[SignalRecord], source_filename: Optional[str] = None) -> int:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        # Clear existing signals for this revision
        cursor.execute("DELETE FROM imported_signals WHERE project_id = ? AND revision_id = ?;", (project_id, revision_id))
        cursor.execute("DELETE FROM allocation_assignments WHERE project_id = ? AND revision_id = ?;", (project_id, revision_id))

        if source_filename:
            cursor.execute("UPDATE revisions SET source_filename = ? WHERE id = ?;", (source_filename, revision_id))

        for idx, sig in enumerate(signals, 1):
            custom_json = json.dumps(sig.custom_fields) if sig.custom_fields else None
            val_err_json = json.dumps(sig.validation_errors) if sig.validation_errors else None
            cursor.execute("""
                INSERT INTO imported_signals (
                    project_id, revision_id, row_index, tag, description, signal_type,
                    cable_id, pair_number, redundancy, logical_group, segregation, service_id,
                    existing_cabinet, existing_cioc, existing_baseplate, existing_charm, existing_terminal,
                    custom_fields_json, is_valid, validation_errors_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                project_id, revision_id, idx, sig.tag, sig.description or "", sig.signal_type.upper(),
                sig.cable_id or "", sig.pair_number, sig.redundancy or "", sig.logical_group or "",
                sig.segregation or "", sig.service_id or "", sig.existing_cabinet, sig.existing_cioc,
                sig.existing_baseplate, sig.existing_charm, sig.existing_terminal,
                custom_json, 1 if sig.is_valid else 0, val_err_json
            ))

        cursor.execute("""
            INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
            VALUES (?, 'IMPORT_SIGNALS', 'SignalList', ?, NULL, ?, 'Lead DCS Engineer', ?);
        """, (project_id, str(revision_id), f"Imported {len(signals)} signals for revision {revision_id}", now))

        conn.commit()
        conn.close()
        return len(signals)

    @staticmethod
    def get_imported_signals(project_id: int, revision_id: int) -> List[SignalRecord]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM imported_signals WHERE project_id = ? AND revision_id = ? ORDER BY row_index ASC;
        """, (project_id, revision_id))
        rows = cursor.fetchall()
        signals = []
        for r in rows:
            signals.append(SignalRecord(
                id=r["id"],
                tag=r["tag"],
                description=r["description"] or "",
                signal_type=r["signal_type"],
                cable_id=r["cable_id"] or "",
                pair_number=r["pair_number"],
                redundancy=r["redundancy"] or "",
                logical_group=r["logical_group"] or "",
                segregation=r["segregation"] or "",
                service_id=r["service_id"] or "",
                existing_cabinet=r["existing_cabinet"],
                existing_cioc=r["existing_cioc"],
                existing_baseplate=r["existing_baseplate"],
                existing_charm=r["existing_charm"],
                existing_terminal=r["existing_terminal"],
                custom_fields=json.loads(r["custom_fields_json"]) if r["custom_fields_json"] else None,
                is_valid=bool(r["is_valid"]),
                validation_errors=json.loads(r["validation_errors_json"]) if r["validation_errors_json"] else None
            ))
        conn.close()
        return signals

    @staticmethod
    def save_assignments(project_id: int, revision_id: int, assignments: List[AssignmentModel], create_snapshot: bool = True) -> int:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        # Delete current assignments
        cursor.execute("DELETE FROM allocation_assignments WHERE project_id = ? AND revision_id = ?;", (project_id, revision_id))

        for a in assignments:
            cursor.execute("""
                INSERT INTO allocation_assignments (
                    project_id, revision_id, signal_id, tag, cabinet_id, cioc_id, baseplate_id,
                    charm_index, terminal_block, charm_type, status, reason, is_manual_override, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                project_id, revision_id, a.signal_id, a.tag, a.cabinet_id, a.cioc_id, a.baseplate_id,
                a.charm_index, a.terminal_block, a.charm_type, a.status, a.reason,
                1 if a.is_manual_override else 0, now
            ))

        if create_snapshot:
            snapshot_json = json.dumps([a.model_dump() for a in assignments])
            cursor.execute("""
                INSERT INTO allocation_snapshots (project_id, revision_id, snapshot_name, assignments_json, created_at)
                VALUES (?, ?, ?, ?, ?);
            """, (project_id, revision_id, f"Run @ {now}", snapshot_json, now))

        cursor.execute("""
            INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
            VALUES (?, 'RUN_ALLOCATION', 'AllocationEngine', ?, NULL, ?, 'Lead DCS Engineer', ?);
        """, (project_id, str(revision_id), f"Allocated {len([a for a in assignments if a.status == 'Allocated'])} of {len(assignments)} signals", now))

        conn.commit()
        conn.close()
        return len(assignments)

    @staticmethod
    def get_assignments(project_id: int, revision_id: int) -> List[AssignmentModel]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, s.description, s.signal_type, s.cable_id, s.pair_number, s.redundancy, s.logical_group
            FROM allocation_assignments a
            JOIN imported_signals s ON a.signal_id = s.id
            WHERE a.project_id = ? AND a.revision_id = ?
            ORDER BY a.cabinet_id, a.cioc_id, a.baseplate_id, a.charm_index ASC;
        """, (project_id, revision_id))
        rows = cursor.fetchall()
        results = []
        for r in rows:
            results.append(AssignmentModel(
                id=r["id"],
                signal_id=r["signal_id"],
                tag=r["tag"],
                description=r["description"] or "",
                signal_type=r["signal_type"],
                cable_id=r["cable_id"] or "",
                pair_number=r["pair_number"],
                redundancy=r["redundancy"] or "",
                logical_group=r["logical_group"] or "",
                cabinet_id=r["cabinet_id"],
                cioc_id=r["cioc_id"],
                baseplate_id=r["baseplate_id"],
                charm_index=r["charm_index"],
                terminal_block=r["terminal_block"],
                charm_type=r["charm_type"],
                status=r["status"],
                reason=r["reason"],
                is_manual_override=bool(r["is_manual_override"])
            ))
        conn.close()
        return results

    @staticmethod
    def update_single_assignment(project_id: int, revision_id: int, assignment_id: int, cabinet_id: str, cioc_id: str, baseplate_id: str, charm_index: int, terminal_block: Optional[str] = None) -> bool:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        # Get old assignment
        cursor.execute("SELECT * FROM allocation_assignments WHERE id = ?;", (assignment_id,))
        old_row = cursor.fetchone()
        if not old_row:
            conn.close()
            return False

        old_desc = f"{old_row['cabinet_id']}/{old_row['cioc_id']}/{old_row['baseplate_id']}/CHARM {old_row['charm_index']}"
        new_desc = f"{cabinet_id}/{cioc_id}/{baseplate_id}/CHARM {charm_index}"

        # Check if slot occupied by another signal
        cursor.execute("""
            SELECT id, tag FROM allocation_assignments 
            WHERE project_id = ? AND revision_id = ? AND cabinet_id = ? AND cioc_id = ? AND baseplate_id = ? AND charm_index = ? AND id != ?;
        """, (project_id, revision_id, cabinet_id, cioc_id, baseplate_id, charm_index, assignment_id))
        conflict = cursor.fetchone()
        if conflict:
            conn.close()
            raise ValueError(f"Hardware slot {new_desc} is already occupied by signal '{conflict['tag']}'. Cannot double-assign.")

        cursor.execute("""
            UPDATE allocation_assignments
            SET cabinet_id = ?, cioc_id = ?, baseplate_id = ?, charm_index = ?, 
                terminal_block = COALESCE(?, terminal_block), status = 'Allocated',
                is_manual_override = 1, reason = 'Manual engineering override'
            WHERE id = ?;
        """, (cabinet_id, cioc_id, baseplate_id, charm_index, terminal_block, assignment_id))

        cursor.execute("""
            INSERT INTO audit_logs (project_id, action, entity_type, entity_id, old_value, new_value, user_name, created_at)
            VALUES (?, 'MANUAL_REASSIGN', 'Assignment', ?, ?, ?, 'Lead DCS Engineer', ?);
        """, (project_id, str(assignment_id), old_desc, new_desc, now))

        conn.commit()
        conn.close()
        return True

    @staticmethod
    def revert_to_last_snapshot(project_id: int, revision_id: int) -> bool:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM allocation_snapshots 
            WHERE project_id = ? AND revision_id = ? 
            ORDER BY id DESC LIMIT 1 OFFSET 1;
        """, (project_id, revision_id))
        prev_snap = cursor.fetchone()
        if not prev_snap:
            # try most recent snapshot if only one exists
            cursor.execute("""
                SELECT * FROM allocation_snapshots 
                WHERE project_id = ? AND revision_id = ? 
                ORDER BY id DESC LIMIT 1;
            """, (project_id, revision_id))
            prev_snap = cursor.fetchone()
            if not prev_snap:
                conn.close()
                return False

        snapshot_data = json.loads(prev_snap["assignments_json"])
        conn.close()

        assignments = [AssignmentModel(**d) for d in snapshot_data]
        DBService.save_assignments(project_id, revision_id, assignments, create_snapshot=False)
        return True

    @staticmethod
    def save_validation_results(project_id: int, revision_id: int, issues: List[ValidationIssueModel]):
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        cursor.execute("DELETE FROM validation_results WHERE project_id = ? AND revision_id = ?;", (project_id, revision_id))

        for issue in issues:
            cursor.execute("""
                INSERT INTO validation_results (
                    project_id, revision_id, issue_id, severity, rule_name,
                    affected_tags_json, affected_hardware, message, suggested_action, blocks_approval, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                project_id, revision_id, issue.issue_id, issue.severity, issue.rule_name,
                json.dumps(issue.affected_tags), issue.affected_hardware, issue.message,
                issue.suggested_action, 1 if issue.blocks_approval else 0, now
            ))

        conn.commit()
        conn.close()

    @staticmethod
    def get_validation_results(project_id: int, revision_id: int) -> List[ValidationIssueModel]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM validation_results WHERE project_id = ? AND revision_id = ? ORDER BY severity ASC;
        """, (project_id, revision_id))
        rows = cursor.fetchall()
        issues = []
        for r in rows:
            issues.append(ValidationIssueModel(
                id=r["id"],
                issue_id=r["issue_id"],
                severity=r["severity"],
                rule_name=r["rule_name"],
                affected_tags=json.loads(r["affected_tags_json"]),
                affected_hardware=r["affected_hardware"],
                message=r["message"],
                suggested_action=r["suggested_action"],
                blocks_approval=bool(r["blocks_approval"])
            ))
        conn.close()
        return issues

    @staticmethod
    def get_tqs(project_id: int, revision_id: Optional[int] = None) -> List[TQResponseModel]:
        conn = get_db()
        cursor = conn.cursor()
        if revision_id:
            cursor.execute("""
                SELECT * FROM technical_queries WHERE project_id = ? AND revision_id = ? ORDER BY id DESC;
            """, (project_id, revision_id))
        else:
            cursor.execute("""
                SELECT * FROM technical_queries WHERE project_id = ? ORDER BY id DESC;
            """, (project_id,))
        rows = cursor.fetchall()
        tqs = []
        for r in rows:
            tqs.append(TQResponseModel(
                id=r["id"],
                tq_code=r["tq_code"],
                project_id=r["project_id"],
                revision_id=r["revision_id"],
                category=r["category"],
                description=r["description"],
                root_cause=r["root_cause"],
                specific_clarification=r["specific_clarification"],
                suggested_action=r["suggested_action"],
                status=r["status"],
                resolution_notes=r["resolution_notes"] or "",
                affected_tags=json.loads(r["affected_tags_json"]),
                created_at=r["created_at"],
                updated_at=r["updated_at"]
            ))
        conn.close()
        return tqs

    @staticmethod
    def create_or_update_tq(tq_dict: Dict[str, Any]) -> int:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        cursor.execute("""
            SELECT id FROM technical_queries WHERE project_id = ? AND tq_code = ?;
        """, (tq_dict["project_id"], tq_dict["tq_code"]))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE technical_queries
                SET description = ?, root_cause = ?, specific_clarification = ?, suggested_action = ?,
                    affected_tags_json = ?, updated_at = ?
                WHERE id = ?;
            """, (
                tq_dict["description"], tq_dict["root_cause"], tq_dict["specific_clarification"],
                tq_dict["suggested_action"], json.dumps(tq_dict["affected_tags"]), now, existing["id"]
            ))
            tq_id = existing["id"]
        else:
            cursor.execute("""
                INSERT INTO technical_queries (
                    tq_code, project_id, revision_id, category, description, root_cause,
                    specific_clarification, suggested_action, status, resolution_notes, affected_tags_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', '', ?, ?, ?);
            """, (
                tq_dict["tq_code"], tq_dict["project_id"], tq_dict["revision_id"], tq_dict["category"],
                tq_dict["description"], tq_dict["root_cause"], tq_dict["specific_clarification"],
                tq_dict["suggested_action"], json.dumps(tq_dict["affected_tags"]), now, now
            ))
            tq_id = cursor.lastrowid

        conn.commit()
        conn.close()
        return tq_id

    @staticmethod
    def update_tq_status(tq_id: int, status: Optional[str], resolution_notes: Optional[str]) -> bool:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        updates = ["updated_at = ?"]
        params = [now]
        if status:
            updates.append("status = ?")
            params.append(status)
        if resolution_notes is not None:
            updates.append("resolution_notes = ?")
            params.append(resolution_notes)

        params.append(tq_id)
        cursor.execute(f"UPDATE technical_queries SET {', '.join(updates)} WHERE id = ?;", tuple(params))
        updated = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return updated

    @staticmethod
    def get_audit_logs(project_id: int) -> List[AuditLogModel]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM audit_logs WHERE project_id = ? ORDER BY id DESC LIMIT 200;
        """, (project_id,))
        rows = cursor.fetchall()
        logs = []
        for r in rows:
            logs.append(AuditLogModel(
                id=r["id"],
                project_id=r["project_id"],
                action=r["action"],
                entity_type=r["entity_type"],
                entity_id=r["entity_id"],
                old_value=r["old_value"],
                new_value=r["new_value"],
                user_name=r["user_name"],
                created_at=r["created_at"]
            ))
        conn.close()
        return logs
