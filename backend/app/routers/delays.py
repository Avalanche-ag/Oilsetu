from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import ScheduleActivity, get_db
from ..models import DelayEvent, User
from .common import ser_activity, ser_delay

router = APIRouter(prefix="/api/v1", tags=["Delays"])

STALE_DAYS = 3
RISK_NEAR_DAYS = 14


def _days_since(iso: str) -> int:
    try:
        dt = datetime.fromisoformat(iso)
    except (ValueError, TypeError):
        return 0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - dt).days


@router.get("/delays")
def list_delays(project_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(DelayEvent)
        .filter(DelayEvent.project_id == project_id)
        .order_by(DelayEvent.reported_at.desc())
        .all()
    )
    return [ser_delay(d) for d in rows]


@router.get("/delays/at-risk")
def at_risk(project_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    acts = (
        db.query(ScheduleActivity)
        .filter(ScheduleActivity.project_id == project_id, ScheduleActivity.level == "L6")
        .all()
    )
    today = datetime.now(timezone.utc).date().isoformat()
    out = []
    for a in acts:
        if a.schedule_status in ("COMPLETED", "NOT_STARTED"):
            continue
        if a.schedule_status == "IN_PROGRESS" and a.last_reported_at and _days_since(a.last_reported_at) > STALE_DAYS:
            out.append({"activity": ser_activity(a), "reason": "stale"})
            continue
        if a.schedule_status in ("COMPLETED", "NOT_STARTED") or not a.planned_end or a.planned_end < today:
            continue
        try:
            days_left = (datetime.fromisoformat(a.planned_end).date() - datetime.now(timezone.utc).date()).days
        except (ValueError, TypeError):
            continue
        if 0 <= days_left <= RISK_NEAR_DAYS and (a.percent_complete or 0) < 60:
            out.append({"activity": ser_activity(a), "reason": "deadline"})
    return out
