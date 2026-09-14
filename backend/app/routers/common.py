import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ..database import ScheduleActivity
from ..models import (
    Assignment,
    AiMatch,
    AuditEvent,
    DailyReport,
    DelayEvent,
    Message,
    Project,
    Thread,
    User,
    Worker,
    WorkerAttendance,
    WorkerTaskAssignment,
)

CONFIDENCE_AUTO = 90
CONFIDENCE_REVIEW = 70


def uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def parse_list(raw: Any) -> List[Any]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        val = json.loads(raw)
        return val if isinstance(val, list) else []
    except (ValueError, TypeError):
        return []


def parse_dict(raw: Any) -> Dict[str, Any]:
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        val = json.loads(raw)
        return val if isinstance(val, dict) else {}
    except (ValueError, TypeError):
        return {}


def dump(value: Any) -> str:
    return json.dumps(value if value is not None else [])


def push_audit(
    db: Session,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    params: Dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditEvent(
            id=uid("ae"),
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description_params=json.dumps(params or {}),
            timestamp=now_iso(),
        )
    )


def band_for(pct: float) -> str:
    if pct >= CONFIDENCE_AUTO:
        return "AUTO"
    if pct >= CONFIDENCE_REVIEW:
        return "REVIEW"
    return "UNMATCHED"


def recompute_project_rollups(db: Session, project_id: str) -> None:
    acts = db.query(ScheduleActivity).filter(ScheduleActivity.project_id == project_id).all()
    by_parent: Dict[str, List[ScheduleActivity]] = {}
    for a in acts:
        if a.parent_id:
            by_parent.setdefault(a.parent_id, []).append(a)
    for level in ("L6", "L5", "L4", "L3", "L2", "L1"):
        for parent in [a for a in acts if a.level == level]:
            children = by_parent.get(parent.schedule_activity_id, [])
            if not children:
                continue
            parent.percent_complete = round(sum(c.percent_complete or 0 for c in children) / len(children))
            statuses = [c.schedule_status for c in children]
            if all(s == "COMPLETED" for s in statuses):
                parent.schedule_status = "COMPLETED"
            elif "DELAYED" in statuses:
                parent.schedule_status = "DELAYED"
            elif "ON_HOLD" in statuses:
                parent.schedule_status = "ON_HOLD"
            elif "IN_PROGRESS" in statuses:
                parent.schedule_status = "IN_PROGRESS"
            else:
                parent.schedule_status = "NOT_STARTED"


def apply_activity_update(
    db: Session, activity_id: str | None, status: str | None, delay_reason: str | None, delay_text: str | None, actor_id: str
) -> None:
    if not activity_id or not status:
        return
    activity = (
        db.query(ScheduleActivity).filter(ScheduleActivity.schedule_activity_id == activity_id).first()
    )
    if not activity:
        return
    activity.schedule_status = status
    activity.last_reported_at = now_iso()
    if status == "COMPLETED":
        activity.percent_complete = 100
        activity.actual_end = today_iso()
        if not activity.actual_start:
            activity.actual_start = activity.planned_start
    elif status == "IN_PROGRESS":
        activity.percent_complete = max(activity.percent_complete or 0, 40)
        if not activity.actual_start:
            activity.actual_start = today_iso()
    elif status == "DELAYED":
        activity.percent_complete = activity.percent_complete or 0
        if not activity.actual_start:
            activity.actual_start = today_iso()
        existing = (
            db.query(DelayEvent)
            .filter(DelayEvent.activity_id == activity_id, DelayEvent.status == "OPEN")
            .first()
        )
        if not existing:
            db.add(
                DelayEvent(
                    id=uid("d"),
                    project_id=activity.project_id or "",
                    activity_id=activity_id,
                    reason_code=delay_reason or "OTHER",
                    reason_text=delay_text,
                    reported_at=now_iso(),
                    status="OPEN",
                    days_impact=0,
                )
            )
            push_audit(db, actor_id, "DELAY_REPORTED", "Delay", activity_id, {"activity": activity.activity_description, "reason": delay_reason or "OTHER"})


def ser_user(u: User) -> Dict[str, Any]:
    return {
        "id": u.id,
        "name": u.name,
        "role": u.role,
        "designation": u.designation,
        "phone": u.phone,
        "preferredLanguage": u.preferred_language,
        "avatarInitials": u.avatar_initials,
    }


def ser_project(p: Project, progress: int = 0) -> Dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "code": p.code,
        "client": p.client,
        "location": p.location,
        "disciplines": parse_list(p.disciplines),
        "startDate": p.start_date,
        "plannedEnd": p.planned_end,
        "status": p.status,
        "createdAt": p.created_at,
        "scheduleFileName": p.schedule_file_name,
        "scheduleUploadedAt": p.schedule_uploaded_at,
        "progress": progress,
    }


def ser_activity(a: ScheduleActivity) -> Dict[str, Any]:
    return {
        "id": a.schedule_activity_id,
        "projectId": a.project_id,
        "level": a.level,
        "parentId": a.parent_id,
        "discipline": a.discipline,
        "name": a.activity_description,
        "plannedStart": a.planned_start,
        "plannedEnd": a.planned_end,
        "weightage": a.weightage or 0,
        "status": a.schedule_status,
        "assigneeId": a.assignee_id,
        "baselineVersion": a.baseline_version or "v1",
        "actualStart": a.actual_start,
        "actualEnd": a.actual_end,
        "lastReportedAt": a.last_reported_at,
        "progressPct": a.percent_complete or 0,
    }


def ser_assignment(a: Assignment) -> Dict[str, Any]:
    return {
        "id": a.id,
        "projectId": a.project_id,
        "workPackageId": a.work_package_id,
        "supervisorId": a.supervisor_id,
        "includedL6Ids": parse_list(a.included_l6_ids),
        "instructions": a.instructions,
        "assignedAt": a.assigned_at,
        "status": a.status,
    }


def ser_worker(w: Worker, attendance_status: str | None = None, active_tasks: int = 0) -> Dict[str, Any]:
    return {
        "id": w.id,
        "userId": w.user_id,
        "projectId": w.project_id,
        "name": w.name,
        "discipline": w.discipline,
        "workload": w.workload or 0,
        "activeTaskCount": active_tasks,
        "availability": w.availability or 0,
        "status": w.status,
        "attendanceStatus": attendance_status,
    }


def ser_attendance(a: WorkerAttendance) -> Dict[str, Any]:
    return {
        "id": a.id,
        "projectId": a.project_id,
        "workerId": a.worker_id,
        "date": a.attendance_date,
        "status": a.status,
        "reason": a.reason,
        "reportedBy": a.reported_by,
        "createdAt": a.created_at,
    }


def ser_worker_assignment(a: WorkerTaskAssignment, activity: ScheduleActivity | None = None) -> Dict[str, Any]:
    return {
        "id": a.id,
        "projectId": a.project_id,
        "activityId": a.activity_id,
        "activityName": activity.activity_description if activity else a.activity_id,
        "activityStatus": activity.schedule_status if activity else None,
        "progressPct": activity.percent_complete if activity else 0,
        "workerId": a.worker_id,
        "assignedBy": a.assigned_by,
        "assignedAt": a.assigned_at,
        "source": a.source,
        "replacedWorkerId": a.replaced_worker_id,
        "reason": a.reason,
        "status": a.status,
    }


def ser_report(r: DailyReport) -> Dict[str, Any]:
    return {
        "id": r.id,
        "projectId": r.project_id,
        "supervisorId": r.supervisor_id,
        "reportDate": r.report_date,
        "submittedAt": r.submitted_at,
        "source": r.source,
        "rawContent": r.raw_content,
        "fileName": r.file_name,
        "entries": [
            {
                "id": e.id,
                "reportId": e.report_id,
                "extractedText": e.extracted_text,
                "status": e.status,
                "actualStart": e.actual_start,
                "actualEnd": e.actual_end,
                "delayReason": e.delay_reason,
                "delayText": e.delay_text,
                "adjusted": bool(e.adjusted),
            }
            for e in r.entries
        ],
    }


def ser_match(m: AiMatch) -> Dict[str, Any]:
    return {
        "id": m.id,
        "reportEntryId": m.report_entry_id,
        "reportId": m.report_id,
        "projectId": m.project_id,
        "extractedActivity": m.extracted_activity,
        "matchedActivityId": m.matched_activity_id,
        "matchedActivityName": m.matched_activity_name,
        "status": m.status,
        "actualStart": m.actual_start,
        "actualEnd": m.actual_end,
        "delayReason": m.delay_reason,
        "delayText": m.delay_text,
        "confidence": m.confidence,
        "band": m.band,
        "keywords": parse_list(m.keywords),
        "candidates": parse_list(m.candidates),
        "source": m.source,
        "createdAt": m.created_at,
        "decision": m.decision,
        "decidedBy": m.decided_by,
        "decidedAt": m.decided_at,
    }


def ser_thread(t: Thread) -> Dict[str, Any]:
    msgs = sorted(t.messages, key=lambda m: m.sent_at)
    return {
        "id": t.id,
        "projectId": t.project_id,
        "activityId": t.activity_id,
        "supervisorId": t.supervisor_id,
        "openedBy": t.opened_by,
        "subject": t.subject,
        "status": t.status,
        "createdAt": t.created_at,
        "messages": [
            {"id": m.id, "threadId": m.thread_id, "senderId": m.sender_id, "text": m.text, "sentAt": m.sent_at}
            for m in msgs
        ],
    }


def ser_delay(d: DelayEvent) -> Dict[str, Any]:
    return {
        "id": d.id,
        "projectId": d.project_id,
        "activityId": d.activity_id,
        "reasonCode": d.reason_code,
        "reasonText": d.reason_text,
        "reportedAt": d.reported_at,
        "status": d.status,
        "daysImpact": d.days_impact,
    }


def ser_audit(e: AuditEvent) -> Dict[str, Any]:
    return {
        "id": e.id,
        "actorId": e.actor_id,
        "action": e.action,
        "entityType": e.entity_type,
        "entityId": e.entity_id,
        "descriptionParams": parse_dict(e.description_params),
        "timestamp": e.timestamp,
    }


def user_name(db: Session, user_id: str) -> str:
    u = db.query(User).filter(User.id == user_id).first()
    return u.name if u else user_id
