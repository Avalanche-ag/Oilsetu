import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from backend.app.database import SessionLocal, create_tables
from backend.seed_all import seed_all

TABLES = (
    "audit_events",
    "messages",
    "conversation_threads",
    "ai_matches",
    "report_entries",
    "daily_reports",
    "delay_events",
    "worker_task_assignments",
    "worker_attendance",
    "workers",
    "assignments",
    "schedule_activities",
    "projects",
    "users",
)


def main() -> None:
    create_tables()
    db = SessionLocal()
    try:
        for table in TABLES:
            db.execute(text(f"DELETE FROM {table}"))
        db.commit()
        seed_all(db)
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        print("usage: python backend/seed_oilsetu.py  (reseeds the full demo story)")
    else:
        main()
