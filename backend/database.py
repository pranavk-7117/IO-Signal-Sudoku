import sqlite3
import json
import os
import re
import urllib.parse
from datetime import datetime
from typing import List, Dict, Any, Optional

def sanitize_database_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return url
    url = url.strip()
    prefix = "postgresql://"
    if url.startswith("postgres://"):
        url = url.replace("postgres://", prefix, 1)
    if url.startswith(prefix):
        rest = url[len(prefix):]
        if "@" in rest:
            last_at_idx = rest.rfind("@")
            user_info = rest[:last_at_idx]
            host_info = rest[last_at_idx + 1:]
            
            user = "postgres"
            password = ""
            if ":" in user_info:
                user, password = user_info.split(":", 1)
            else:
                user = user_info
            
            safe_password = urllib.parse.quote_plus(urllib.parse.unquote_plus(password))
            
            # Check if using Supabase IPv6 direct hostname (e.g. db.<ref>.supabase.co)
            # Cloud hosts like Render do not support IPv6 outbound, so automatically route to the IPv4 pooler
            supabase_direct_match = re.search(r'^db\.([a-z0-9]+)\.supabase\.co(?::\d+)?(/.*)?$', host_info)
            if supabase_direct_match:
                ref = supabase_direct_match.group(1)
                path_part = supabase_direct_match.group(2) or "/postgres"
                region = os.environ.get("SUPABASE_REGION", "ap-northeast-1")
                pooler_user = f"{user}.{ref}" if not user.endswith(f".{ref}") else user
                pooler_host = f"aws-0-{region}.pooler.supabase.com:5432"
                return f"{prefix}{pooler_user}:{safe_password}@{pooler_host}{path_part}"
                
            return f"{prefix}{user}:{safe_password}@{host_info}"
    return url

DATABASE_URL = sanitize_database_url(os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL"))
IS_POSTGRES = bool(DATABASE_URL)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None
    IS_POSTGRES = False

# Prepare fallback SQLite directory
if os.environ.get("VERCEL"):
    DB_DIR = "/tmp/data"
else:
    DB_DIR = os.path.join(os.path.dirname(__file__), "data")

try:
    os.makedirs(DB_DIR, exist_ok=True)
except Exception:
    DB_DIR = "/tmp/data"
    os.makedirs(DB_DIR, exist_ok=True)

DB_PATH = os.path.join(DB_DIR, "io_sudoku.db")


class PgCursorWrapper:
    def __init__(self, real_cursor):
        self.cursor = real_cursor
        self._lastrowid = None

    def execute(self, query: str, params: Any = None):
        clean_q = query.strip().rstrip(";").strip()
        is_insert = clean_q.upper().startswith("INSERT INTO") and "RETURNING" not in clean_q.upper()
        
        if is_insert:
            clean_q += " RETURNING id;"
            pg_query = clean_q.replace("?", "%s")
            res = self.cursor.execute(pg_query, params) if params is not None else self.cursor.execute(pg_query)
            try:
                row = self.cursor.fetchone()
                if row is not None:
                    self._lastrowid = row[0] if isinstance(row, (list, tuple)) else list(row.values())[0]
            except Exception:
                self._lastrowid = None
            return res
        else:
            pg_query = clean_q.replace("?", "%s")
            return self.cursor.execute(pg_query, params) if params is not None else self.cursor.execute(pg_query)

    def executemany(self, query: str, params_list: List[Any]):
        clean_q = query.strip().rstrip(";").strip()
        pg_query = clean_q.replace("?", "%s")
        return self.cursor.executemany(pg_query, params_list)

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def fetchmany(self, size=None):
        return self.cursor.fetchmany(size)

    @property
    def rowcount(self):
        return self.cursor.rowcount

    @property
    def lastrowid(self):
        return self._lastrowid

    def close(self):
        self.cursor.close()


class PgConnectionWrapper:
    def __init__(self, real_conn):
        self.conn = real_conn

    def cursor(self):
        return PgCursorWrapper(self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor))

    def execute(self, query: str, params: Any = None):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


def get_db():
    if IS_POSTGRES and psycopg2:
        try:
            conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
            return PgConnectionWrapper(conn)
        except Exception as e:
            print(f"[DATABASE WARNING] Failed to connect to Supabase PostgreSQL: {e}. Falling back to SQLite.")
            
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def get_db_status() -> str:
    if IS_POSTGRES:
        try:
            safe_url = re.sub(r':([^@]+)@', ':****@', DATABASE_URL)
            host_part = safe_url.split('@')[-1] if '@' in safe_url else 'connected'
            return f"Supabase PostgreSQL ({host_part})"
        except Exception:
            return "Supabase PostgreSQL (Connected)"
    return "SQLite Local Engine (Ready)"


def init_db():
    try:
        conn = get_db()
        cursor = conn.cursor()
        is_pg = isinstance(conn, PgConnectionWrapper)

        tables = [
            # 1. Projects
            """
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
            """,
            # 2. Revisions
            """
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
            """,
            # 3. Hardware Configurations
            """
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
            """,
            # 4. Imported Signals
            """
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
            """,
            # 5. Allocation Assignments
            """
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
            """,
            # 6. Allocation Snapshots
            """
            CREATE TABLE IF NOT EXISTS allocation_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                revision_id INTEGER NOT NULL,
                snapshot_name TEXT NOT NULL,
                assignments_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """,
            # 7. Independent Validation Results
            """
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
            """,
            # 8. Technical Queries (TQs)
            """
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
            """,
            # 9. Audit Logs
            """
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
            """,
            # 10. Generated Reports
            """
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
            """
        ]

        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_signals_rev ON imported_signals(project_id, revision_id);",
            "CREATE INDEX IF NOT EXISTS idx_assignments_rev ON allocation_assignments(project_id, revision_id);",
            "CREATE INDEX IF NOT EXISTS idx_tqs_rev ON technical_queries(project_id, revision_id);",
            "CREATE INDEX IF NOT EXISTS idx_validation_rev ON validation_results(project_id, revision_id);"
        ]

        for table_sql in tables:
            sql = table_sql.strip()
            if is_pg:
                sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            cursor.execute(sql)

        for index_sql in indexes:
            cursor.execute(index_sql.strip())

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DATABASE ERROR] init_db failed: {e}")

# Initialize on import
init_db()
