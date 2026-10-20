import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DB_DIR, "io_sudoku.db")

os.makedirs(DB_DIR, exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Projects
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        description TEXT,
        system TEXT NOT NULL DEFAULT 'DeltaV v14.3 / CHARMs IO',
        current_revision TEXT NOT NULL DEFAULT 'Rev A',
        status TEXT NOT NULL DEFAULT 'Active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # 2. Revisions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        revision_code TEXT NOT NULL,
        description TEXT,
        source_filename TEXT,
        template_filename TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE (project_id, revision_code)
    );
    """)

    # 3. Hardware & Rules Configuration
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hardware_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        revision_id INTEGER,
        cabinets_count INTEGER NOT NULL DEFAULT 2,
        ciocs_per_cabinet INTEGER NOT NULL DEFAULT 4,
        baseplates_per_cioc INTEGER NOT NULL DEFAULT 8,
        charms_per_baseplate INTEGER NOT NULL DEFAULT 12,
        spare_percentage REAL NOT NULL DEFAULT 10.0,
        rules_json TEXT NOT NULL,
        compatibility_matrix_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    # 4. Imported Signals
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS imported_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        revision_id INTEGER NOT NULL,
        row_index INTEGER NOT NULL,
        tag TEXT NOT NULL,
        description TEXT,
        signal_type TEXT NOT NULL,
        cable_id TEXT,
        pair_number INTEGER,
        redundancy TEXT,
        logical_group TEXT,
        segregation TEXT,
        service_id TEXT,
        existing_cabinet TEXT,
        existing_cioc TEXT,
        existing_baseplate TEXT,
        existing_charm INTEGER,
        existing_terminal TEXT,
        custom_fields_json TEXT,
        is_valid INTEGER NOT NULL DEFAULT 1,
        validation_errors_json TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (revision_id) REFERENCES revisions(id) ON DELETE CASCADE
    );
    """)

    # 5. Allocation Assignments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS allocation_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        revision_id INTEGER NOT NULL,
        signal_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        cabinet_id TEXT,
        cioc_id TEXT,
        baseplate_id TEXT,
        charm_index INTEGER,
        terminal_block TEXT,
        charm_type TEXT,
        status TEXT NOT NULL DEFAULT 'Pending',
        reason TEXT,
        is_manual_override INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (revision_id) REFERENCES revisions(id) ON DELETE CASCADE,
        FOREIGN KEY (signal_id) REFERENCES imported_signals(id) ON DELETE CASCADE
    );
    """)

    # 6. Allocation Snapshots (for revert)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS allocation_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        revision_id INTEGER NOT NULL,
        snapshot_name TEXT NOT NULL,
        assignments_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    # 7. Independent Validation Results
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS validation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        revision_id INTEGER NOT NULL,
        issue_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        affected_tags_json TEXT NOT NULL,
        affected_hardware TEXT,
        message TEXT NOT NULL,
        suggested_action TEXT NOT NULL,
        blocks_approval INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (revision_id) REFERENCES revisions(id) ON DELETE CASCADE
    );
    """)

    # 8. Technical Queries (TQs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS technical_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tq_code TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        revision_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        root_cause TEXT NOT NULL,
        specific_clarification TEXT NOT NULL,
        suggested_action TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Open',
        resolution_notes TEXT DEFAULT '',
        affected_tags_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (revision_id) REFERENCES revisions(id) ON DELETE CASCADE,
        UNIQUE (project_id, tq_code)
    );
    """)

    # 9. Audit Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        user_name TEXT NOT NULL DEFAULT 'Lead DCS Engineer',
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    # 10. Generated Reports
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS generated_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        revision_id INTEGER NOT NULL,
        report_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_signals_rev ON imported_signals(project_id, revision_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_assignments_rev ON allocation_assignments(project_id, revision_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tqs_rev ON technical_queries(project_id, revision_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_validation_rev ON validation_results(project_id, revision_id);")

    conn.commit()
    conn.close()

# Initialize on import
init_db()
