import json
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from backend.app.auth import hash_password
from backend.app.database import ScheduleActivity, SessionLocal, create_tables
from backend.app.models import (
    AiMatch,
    Assignment,
    AuditEvent,
    DailyReport,
    DelayEvent,
    Message,
    Project,
    ReportEntry,
    Thread,
    User,
    Worker,
    WorkerAttendance,
    WorkerTaskAssignment,
)
from backend.app.routers.common import dump, recompute_project_rollups

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DEMO_PASSWORD = "oilsetu123"

USER_EMAILS = {
    "u-mgr-01": "priya.sharma@oilindia.in",
    "u-sup-01": "rajesh.kumar@oilindia.in",
    "u-sup-02": "amit.singh@oilindia.in",
}

WORKER_SEED = [
    {"id": "w-civ-01", "userId": "u-wkr-01", "name": "Ramesh Yadav", "email": "ramesh.yadav@oilindia.in", "discipline": "CIVIL", "workload": 5, "availability": 70, "designation": "Civil Site Worker", "initials": "RY"},
    {"id": "w-pip-01", "userId": "u-wkr-02", "name": "Kiran Iyer", "email": "kiran.iyer@oilindia.in", "discipline": "PIPING", "workload": 8, "availability": 60, "designation": "Piping Site Worker", "initials": "KI"},
    {"id": "w-pip-02", "userId": "u-wkr-03", "name": "Manoj Verma", "email": "manoj.verma@oilindia.in", "discipline": "PIPING", "workload": 3, "availability": 85, "designation": "Piping Site Worker", "initials": "MV"},
    {"id": "w-pip-03", "userId": "u-wkr-04", "name": "Amit Dsouza", "email": "amit.dsouza@oilindia.in", "discipline": "PIPING", "workload": 3, "availability": 95, "designation": "Piping Site Worker", "initials": "AD"},
    {"id": "w-ele-01", "userId": "u-wkr-05", "name": "Voltguard Tech", "email": "voltguard@oilindia.in", "discipline": "ELECTRICAL", "workload": 4, "availability": 75, "designation": "Electrical Site Worker", "initials": "VT"},
]


def _load(name: str):
    return json.loads((DATA_DIR / name).read_text())


def seed_all(db: Session) -> None:
    full = _load("seed_full.json")
    activities = _load("seed_activities.json")

    for u in full["users"]:
        db.add(
            User(
                id=u["id"],
                name=u["name"],
                email=USER_EMAILS.get(u["id"], f"{u['id']}@oilindia.in"),
                password_hash=hash_password(DEMO_PASSWORD),
                role=u["role"],
                designation=u["designation"],
                phone=u.get("phone"),
                preferred_language=u.get("preferredLanguage", "en"),
                avatar_initials=u["avatarInitials"],
            )
        )

    for worker in WORKER_SEED:
        db.add(
            User(
                id=worker["userId"],
                name=worker["name"],
                email=worker["email"],
                password_hash=hash_password(DEMO_PASSWORD),
                role="worker",
                designation=worker["designation"],
                preferred_language="en",
                avatar_initials=worker["initials"],
            )
        )

    p = full["project"]
    db.add(
        Project(
            id=p["id"],
            name=p["name"],
            code=p["code"],
            client=p["client"],
            location=p["location"],
            disciplines=dump(p["disciplines"]),
            start_date=p["startDate"],
            planned_end=p["plannedEnd"],
            status=p["status"],
            created_at=p["createdAt"],
            schedule_file_name=p.get("scheduleFileName"),
            schedule_uploaded_at=p.get("scheduleUploadedAt"),
        )
    )

    for worker in WORKER_SEED:
        db.add(
            Worker(
                id=worker["id"],
                user_id=worker["userId"],
                project_id=p["id"],
                name=worker["name"],
                discipline=worker["discipline"],
                workload=worker["workload"],
                availability=worker["availability"],
                status="ACTIVE",
            )
        )

    for r in activities:
        db.add(
            ScheduleActivity(
                schedule_activity_id=r["id"],
                project_id=p["id"],
                activity_description=r["name"],
                discipline=r["discipline"],
                wbs_id=None,
                level=r["level"],
                planned_start=r["plannedStart"],
                planned_end=r["plannedEnd"],
                schedule_status=r["status"],
                percent_complete=r["progressPct"],
                parent_id=r.get("parentId"),
                assignee_id=r.get("assigneeId"),
                baseline_version="v1",
            )
        )

    for a in full["assignments"]:
        db.add(
            Assignment(
                id=a["id"],
                project_id=a["projectId"],
                work_package_id=a["workPackageId"],
                supervisor_id=a["supervisorId"],
                included_l6_ids=dump(a["includedL6Ids"]),
                instructions=a.get("instructions"),
                assigned_at=a["assignedAt"],
                status=a["status"],
            )
        )

    worker_assignments = {
        "w-pip-01": ["PIP-L6-024", "PIP-L6-024W"],
        "w-pip-02": ["PIP-L6-025"],
        "w-pip-03": ["PIP-L6-026"],
        "w-civ-01": ["CIV-L6-101B"],
        "w-ele-01": ["ELE-L6-401B"],
    }
    for worker_id, activity_ids in worker_assignments.items():
        for activity_id in activity_ids:
            db.add(
                WorkerTaskAssignment(
                    id=f"wta-{worker_id}-{activity_id}",
                    project_id=p["id"],
                    activity_id=activity_id,
                    worker_id=worker_id,
                    assigned_by="u-mgr-01",
                    assigned_at=p["createdAt"],
                    source="SEED",
                    status="ACTIVE",
                )
            )

    today = date.today()
    attendance_seed = [
        ("w-pip-01", (today - timedelta(days=2)).isoformat(), "PRESENT", None),
        ("w-pip-01", (today - timedelta(days=1)).isoformat(), "ABSENT", "Medical leave"),
        ("w-pip-02", (today - timedelta(days=2)).isoformat(), "PRESENT", None),
        ("w-pip-02", (today - timedelta(days=1)).isoformat(), "ABSENT", "Medical leave"),
        ("w-pip-02", today.isoformat(), "PRESENT", None),
        ("w-civ-01", (today - timedelta(days=1)).isoformat(), "PTO", "Approved PTO"),
    ]
    for worker_id, attendance_date, attendance_status, reason in attendance_seed:
        db.add(
            WorkerAttendance(
                id=f"att-{worker_id}-{attendance_date}",
                project_id=p["id"],
                worker_id=worker_id,
                attendance_date=attendance_date,
                status=attendance_status,
                reason=reason,
                reported_by="u-sup-01",
                created_at=f"{attendance_date}T08:00:00+00:00",
            )
        )

    for r in full["reports"]:
        db.add(
            DailyReport(
                id=r["id"],
                project_id=r["projectId"],
                supervisor_id=r["supervisorId"],
                report_date=r["reportDate"],
                submitted_at=r["submittedAt"],
                source=r["source"],
                raw_content=r["rawContent"],
                file_name=r.get("fileName"),
            )
        )
        for e in r["entries"]:
            db.add(
                ReportEntry(
                    id=e["id"],
                    report_id=r["id"],
                    extracted_text=e["extractedText"],
                    status=e.get("status"),
                    actual_start=e.get("actualStart"),
                    actual_end=e.get("actualEnd"),
                    delay_reason=e.get("delayReason"),
                    delay_text=e.get("delayText"),
                    adjusted=bool(e.get("adjusted", False)),
                )
            )

    for m in full["aiMatches"]:
        db.add(
            AiMatch(
                id=m["id"],
                report_entry_id=m["reportEntryId"],
                report_id=m["reportId"],
                project_id=m["projectId"],
                extracted_activity=m["extractedActivity"],
                matched_activity_id=m.get("matchedActivityId"),
                matched_activity_name=m.get("matchedActivityName"),
                status=m.get("status"),
                actual_start=m.get("actualStart"),
                actual_end=m.get("actualEnd"),
                delay_reason=m.get("delayReason"),
                delay_text=m.get("delayText"),
                confidence=m["confidence"],
                band=m["band"],
                keywords=dump(m.get("keywords", [])),
                candidates=dump(m.get("candidates", [])),
                source=m["source"],
                created_at=m["createdAt"],
                decision=m["decision"],
                decided_by=m.get("decidedBy"),
                decided_at=m.get("decidedAt"),
            )
        )

    for t in full["threads"]:
        db.add(
            Thread(
                id=t["id"],
                project_id=t["projectId"],
                activity_id=t.get("activityId"),
                supervisor_id=t["supervisorId"],
                opened_by=t["openedBy"],
                subject=t["subject"],
                status=t["status"],
                created_at=t["createdAt"],
            )
        )
        for msg in t["messages"]:
            db.add(
                Message(
                    id=msg["id"],
                    thread_id=t["id"],
                    sender_id=msg["senderId"],
                    text=msg["text"],
                    sent_at=msg["sentAt"],
                )
            )

    for d in full["delays"]:
        db.add(
            DelayEvent(
                id=d["id"],
                project_id=d["projectId"],
                activity_id=d["activityId"],
                reason_code=d["reasonCode"],
                reason_text=d.get("reasonText"),
                reported_at=d["reportedAt"],
                status=d["status"],
                days_impact=d.get("daysImpact", 0),
            )
        )

    for e in full["audit"]:
        db.add(
            AuditEvent(
                id=e["id"],
                actor_id=e["actorId"],
                action=e["action"],
                entity_type=e["entityType"],
                entity_id=e["entityId"],
                description_params=dump(e.get("descriptionParams", {})),
                timestamp=e["timestamp"],
            )
        )

    db.commit()
    recompute_project_rollups(db, p["id"])
    db.commit()
    print(f"seeded full story for project {p['id']}")


if __name__ == "__main__":
    create_tables()
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()
