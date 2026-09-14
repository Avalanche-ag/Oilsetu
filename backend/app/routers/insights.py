from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import ScheduleActivity, get_db
from ..models import DailyReport, DelayEvent, User

router = APIRouter(prefix="/api/v1", tags=["Insights"])

PATTERNS = [
    {"id": "pat-1", "titleKey": "insights.pattern1Title", "bodyKey": "insights.pattern1Body"},
    {"id": "pat-2", "titleKey": "insights.pattern2Title", "bodyKey": "insights.pattern2Body"},
    {"id": "pat-3", "titleKey": "insights.pattern3Title", "bodyKey": "insights.pattern3Body"},
    {"id": "pat-4", "titleKey": "insights.pattern4Title", "bodyKey": "insights.pattern4Body"},
]


def _days_since(iso: str) -> int:
    try:
        dt = datetime.fromisoformat(iso)
    except (ValueError, TypeError):
        return 0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc) - dt).days)


@router.get("/insights")
def get_insights(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    l6 = db.query(ScheduleActivity).filter(ScheduleActivity.level == "L6").all()
    delays = db.query(DelayEvent).all()

    disciplines = sorted({a.discipline for a in l6 if a.discipline})
    planned_vs_actual = []
    for disc in disciplines:
        group = [a for a in l6 if a.discipline == disc]
        planned_vs_actual.append(
            {
                "discipline": disc,
                "planned": round(sum(1 for a in group if (a.planned_end or "") <= datetime.now(timezone.utc).date().isoformat()) / max(len(group), 1) * 100),
                "actual": round(sum(a.percent_complete or 0 for a in group) / max(len(group), 1)),
            }
        )

    reason_counts: Dict[str, int] = {}
    for d in delays:
        reason_counts[d.reason_code] = reason_counts.get(d.reason_code, 0) + 1
    delay_reasons = [{"code": k, "count": v} for k, v in sorted(reason_counts.items(), key=lambda kv: kv[1], reverse=True)]

    reports = db.query(DailyReport).order_by(DailyReport.submitted_at.asc()).all()
    by_month: Dict[str, int] = {}
    for r in reports:
        by_month[r.submitted_at[:7]] = by_month.get(r.submitted_at[:7], 0) + 1
    months = sorted(by_month)[-6:]
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    productivity = []
    for mk in months:
        try:
            productivity.append({"month": month_names[int(mk[5:7]) - 1], "planned": 100, "actual": min(100, by_month[mk] * 25)})
        except (ValueError, IndexError):
            continue

    by_activity: Dict[str, List[DelayEvent]] = {}
    for d in delays:
        by_activity.setdefault(d.activity_id, []).append(d)
    top_delayed = []
    for act_id, ds in by_activity.items():
        avg_late = round(sum(_days_since(d.reported_at) + (d.days_impact or 0) for d in ds) / len(ds))
        act = db.query(ScheduleActivity).filter(ScheduleActivity.schedule_activity_id == act_id).first()
        top_delayed.append(
            {"name": act.activity_description if act else act_id, "occurrences": len(ds), "avgDaysLate": avg_late}
        )
    top_delayed.sort(key=lambda x: x["occurrences"], reverse=True)

    on_time = []
    for disc in disciplines:
        group = [a for a in l6 if a.discipline == disc]
        ok = sum(1 for a in group if a.schedule_status != "DELAYED")
        on_time.append({"discipline": disc, "onTimePct": round(ok / max(len(group), 1) * 100)})

    return {
        "plannedVsActual": planned_vs_actual,
        "delayReasons": delay_reasons,
        "productivity": productivity,
        "topDelayed": top_delayed[:5],
        "disciplineOnTime": on_time,
        "patterns": PATTERNS,
    }
