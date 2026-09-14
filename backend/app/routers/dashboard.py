from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import ScheduleActivity, get_db
from ..models import AiMatch, AuditEvent, DelayEvent, Project, Thread, User
from .common import parse_list, ser_activity, ser_audit

router = APIRouter(prefix="/api/v1", tags=["Dashboard"])

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

DISCIPLINE_COLORS = {
    "CIVIL": "bg-amber-500",
    "PIPING": "bg-sky-500",
    "ELECTRICAL": "bg-yellow-500",
    "INSTRUMENTATION": "bg-violet-500",
    "EQUIPMENT": "bg-orange-500",
    "HSE": "bg-emerald-500",
}


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _days_since(iso: str) -> int:
    try:
        dt = datetime.fromisoformat(iso)
    except (ValueError, TypeError):
        return 0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - dt).days


def _month_key(iso_date: str) -> str:
    return iso_date[:7]


def _month_label(key: str) -> str:
    try:
        year, mon = key.split("-")
        return f"{MONTHS[int(mon) - 1]} {year[2:]}"
    except (ValueError, IndexError):
        return key


@router.get("/dashboard/{project_id}")
def get_dashboard(project_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    today = _today()
    l6 = (
        db.query(ScheduleActivity)
        .filter(ScheduleActivity.project_id == project_id, ScheduleActivity.level == "L6")
        .all()
    )
    total = len(l6) or 1
    completed = [a for a in l6 if a.schedule_status == "COMPLETED"]
    overall = round(sum(a.percent_complete or 0 for a in l6) / total)
    planned = round(sum(1 for a in l6 if (a.planned_end or "") <= today) / total * 100)

    open_delays = (
        db.query(DelayEvent).filter(DelayEvent.project_id == project_id, DelayEvent.status == "OPEN").count()
    )
    pending = (
        db.query(AiMatch).filter(AiMatch.project_id == project_id, AiMatch.decision == "PENDING").count()
    )
    threads = db.query(Thread).filter(Thread.project_id == project_id, Thread.status == "OPEN").all()
    users = {u.id: u.role for u in db.query(User).all()}

    def last_sender_role(t) -> str:
        if not t.messages:
            return ""
        last = max(t.messages, key=lambda m: m.sent_at)
        return users.get(last.sender_id, "")

    awaiting = sum(1 for t in threads if last_sender_role(t) == "manager")
    try:
        days_remaining = max(0, (datetime.fromisoformat(project.planned_end).date() - datetime.now(timezone.utc).date()).days)
    except (ValueError, TypeError):
        days_remaining = 0

    disciplines = sorted({a.discipline for a in l6 if a.discipline})
    disc_progress = []
    for disc in disciplines:
        group = [a for a in l6 if a.discipline == disc]
        disc_progress.append(
            {
                "discipline": disc,
                "progress": round(sum(a.percent_complete or 0 for a in group) / len(group)),
                "planned": round(sum(1 for a in group if (a.planned_end or "") <= today) / len(group) * 100),
                "colorClass": DISCIPLINE_COLORS.get(disc or "", "bg-slate-500"),
            }
        )

    delayed = []
    for a in [x for x in l6 if x.schedule_status == "DELAYED"]:
        d = (
            db.query(DelayEvent)
            .filter(DelayEvent.activity_id == a.schedule_activity_id, DelayEvent.status == "OPEN")
            .first()
        )
        delayed.append(
            {
                "activity": ser_activity(a),
                "daysLate": _days_since(d.reported_at) if d else 0,
                "reason": d.reason_code if d else None,
            }
        )

    recent = db.query(AuditEvent).order_by(AuditEvent.timestamp.desc()).limit(8).all()

    months: List[str] = []
    try:
        y, m = [int(x) for x in project.start_date[:7].split("-")]
        ey, em = [int(x) for x in project.planned_end[:7].split("-")]
        while (y, m) <= (ey, em):
            months.append(f"{y}-{m:02d}")
            m += 1
            if m > 12:
                m, y = 1, y + 1
    except (ValueError, IndexError, TypeError):
        months = []
    trend = []
    for mk in months:
        month_end = f"{mk}-31"
        planned_m = round(sum(1 for a in l6 if (a.planned_end or "") <= month_end) / total * 100)
        if month_end <= today:
            actual_m = round(
                sum(1 for a in completed if ((a.actual_end or a.planned_end) or "") <= month_end) / total * 100
            )
        else:
            actual_m = 0
        trend.append({"label": _month_label(mk), "planned": planned_m, "actual": actual_m})

    return {
        "overallProgress": overall,
        "plannedProgress": planned,
        "completedCount": len(completed),
        "totalCount": len(l6),
        "openDelays": open_delays,
        "pendingReviews": pending,
        "awaitingReply": awaiting,
        "daysRemaining": days_remaining,
        "disciplineProgress": disc_progress,
        "delayedActivities": delayed,
        "recentAudit": [ser_audit(e) for e in recent],
        "progressTrend": trend,
    }
