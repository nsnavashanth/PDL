import sqlite3
import json
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "cubesec.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS security_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                module TEXT NOT NULL,
                status TEXT NOT NULL,
                client_ip TEXT NOT NULL,
                summary TEXT NOT NULL,
                details_json TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                issued_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                ttl_seconds INTEGER NOT NULL,
                cube_digest_ref TEXT,
                status TEXT NOT NULL
            )
        """)
        conn.commit()

def log_event(event_type, module, status, summary, details=None, client_ip="127.0.0.1"):
    now_iso = datetime.now(timezone.utc).isoformat()
    details_str = json.dumps(details or {}, ensure_ascii=False)
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO security_logs (timestamp, event_type, module, status, client_ip, summary, details_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (now_iso, event_type, module, status, client_ip, summary, details_str))
            conn.commit()
    except Exception as e:
        print(f"Error logging event to database: {e}")

def get_recent_logs(limit=50, event_type=None, status=None):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT id, timestamp, event_type, module, status, client_ip, summary, details_json FROM security_logs"
        params = []
        conditions = []
        if event_type:
            conditions.append("event_type = ?")
            params.append(event_type)
        if status:
            conditions.append("status = ?")
            params.append(status)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        logs = []
        for r in rows:
            details = {}
            if r["details_json"]:
                try:
                    details = json.loads(r["details_json"])
                except Exception:
                    details = {"raw": r["details_json"]}
            logs.append({
                "id": r["id"],
                "timestamp": r["timestamp"],
                "event_type": r["event_type"],
                "module": r["module"],
                "status": r["status"],
                "client_ip": r["client_ip"],
                "summary": r["summary"],
                "details": details
            })
        return logs

def clear_logs():
    with get_db() as conn:
        conn.execute("DELETE FROM security_logs")
        conn.commit()
