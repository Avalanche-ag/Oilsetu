from datetime import date, timedelta

from sqlalchemy.orm import Session

from .database import ScheduleActivity
from .models import Project

DISCIPLINE_NAMES = {
    "CIVIL": "Civil & Structural",
    "PIPING": "Piping",
    "ELECTRICAL": "Electrical",
    "INSTRUMENTATION": "Instrumentation",
    "EQUIPMENT": "Mechanical Equipment",
    "HSE": "HSE",
}


def _iso(base: date, offset: int) -> str:
    return (base + timedelta(days=offset)).isoformat()


def _make(code: str, level: str, parent: str | None, disc: str | None, name: str, project_id: str, start: int, end: int, weight: float, today: date):
    return ScheduleActivity(
        schedule_activity_id=code,
        project_id=project_id,
        activity_description=name,
        discipline=disc,
        level=level,
        planned_start=_iso(today, start),
        planned_end=_iso(today, end),
        schedule_status="NOT_STARTED",
        percent_complete=0,
        parent_id=parent,
        weightage=weight,
        baseline_version="v1",
    )


def generate_schedule(db: Session, project: Project):
    today = date.today()
    try:
        total = (date.fromisoformat(project.planned_end) - date.fromisoformat(project.start_date)).days
    except (ValueError, TypeError):
        total = 30
    total_days = max(30, total)
    rows = [ _make(f"{project.code}-L1", "L1", None, None, project.name, project.id, 0, total_days, 0, today) ]

    discs = []
    try:
        import json as _json

        discs = _json.loads(project.disciplines or "[]")
    except (ValueError, TypeError):
        discs = []
    if not discs:
        discs = ["CIVIL"]

    span = max(1, total_days // len(discs))
    for i, disc in enumerate(discs):
        l2s, l2e = i * span, (i + 1) * span
        l2 = f"{project.code}-{disc}-L2"
        rows.append(_make(l2, "L2", f"{project.code}-L1", disc, DISCIPLINE_NAMES.get(disc, disc), project.id, l2s, l2e, 0, today))
        l3s, l3e = l2s + 5, max(l2s + 5, l2e - 5)
        l3 = f"{project.code}-{disc}-L3"
        rows.append(_make(l3, "L3", l2, disc, f"{DISCIPLINE_NAMES.get(disc, disc)} Execution", project.id, l3s, l3e, 0, today))
        l4span = max(1, (l3e - l3s) // 2)
        for area in (1, 2):
            l4s = l3s + (area - 1) * l4span
            l4e = min(l4s + l4span, l3e)
            l4 = f"{project.code}-{disc}-A{area}"
            rows.append(_make(l4, "L4", l3, disc, f"Area {area} — {DISCIPLINE_NAMES.get(disc, disc)}", project.id, l4s, l4e, 0, today))
            l5span = max(1, (l4e - l4s) // 2)
            for wp in (1, 2):
                l5s = l4s + (wp - 1) * l5span
                l5e = min(l5s + l5span, l4e)
                l5 = f"{project.code}-{disc}-A{area}-WP{wp}"
                rows.append(_make(l5, "L5", l4, disc, f"Work Package {wp} — Area {area}", project.id, l5s, l5e, 0, today))
                l6span = max(1, (l5e - l5s) // 2)
                for step in (1, 2):
                    l6s = l5s + (step - 1) * l6span
                    l6e = min(l6s + l6span, l5e)
                    rows.append(
                        _make(
                            f"{project.code}-{disc}-A{area}-WP{wp}-S{step}", "L6", l5, disc,
                            f"Step {step} — {DISCIPLINE_NAMES.get(disc, disc)}", project.id, l6s, l6e, 1, today,
                        )
                    )
    for r in rows:
        db.add(r)
    return rows
