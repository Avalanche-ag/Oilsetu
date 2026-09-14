from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db

router = APIRouter(prefix="/api/v1", tags=["Dev"])


# Local-demo only: no auth by design so the login-page "Reset demo data" link and
# supervisor menu work without a manager session. Never expose this router publicly.
@router.post("/dev/reset")
def reset_demo(db: Session = Depends(get_db)):
    from backend.seed_all import seed_all

    for table in (
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
    ):
        db.execute(text(f"DELETE FROM {table}"))
    db.commit()
    seed_all(db)
    return {"ok": True}
