from typing import Any, Dict, Iterable, List, Set

from sqlalchemy.orm import Session

from .database import ScheduleActivity
from .models import Worker, WorkerAttendance, WorkerTaskAssignment
from .routers.common import now_iso, push_audit, uid


ABSENT_STATUSES = {"ABSENT", "PTO", "LEAVE"}


def _attendance_status(db: Session, project_id: str, worker_id: str, attendance_date: str) -> str | None:
    row = (
        db.query(WorkerAttendance)
        .filter(
            WorkerAttendance.project_id == project_id,
            WorkerAttendance.worker_id == worker_id,
            WorkerAttendance.attendance_date == attendance_date,
        )
        .first()
    )
    return row.status if row else None


def _active_task_count(db: Session, project_id: str, worker_id: str) -> int:
    return (
        db.query(WorkerTaskAssignment)
        .filter(
            WorkerTaskAssignment.project_id == project_id,
            WorkerTaskAssignment.worker_id == worker_id,
            WorkerTaskAssignment.status == "ACTIVE",
        )
        .count()
    )


def reallocate_worker_tasks(
    db: Session,
    project_id: str,
    absent_worker_ids: Iterable[str],
    attendance_date: str,
    actor_id: str,
    reason: str,
) -> List[Dict[str, Any]]:
    absent: Set[str] = set(absent_worker_ids)
    if not absent:
        return []

    active_assignments = (
        db.query(WorkerTaskAssignment)
        .filter(
            WorkerTaskAssignment.project_id == project_id,
            WorkerTaskAssignment.worker_id.in_(absent),
            WorkerTaskAssignment.status == "ACTIVE",
        )
        .order_by(WorkerTaskAssignment.activity_id)
        .all()
    )
    if not active_assignments:
        return []

    workers = (
        db.query(Worker)
        .filter(Worker.project_id == project_id, Worker.status == "ACTIVE", ~Worker.id.in_(absent))
        .all()
    )
    activities = {
        a.schedule_activity_id: a
        for a in db.query(ScheduleActivity).filter(ScheduleActivity.project_id == project_id).all()
    }
    changes: List[Dict[str, Any]] = []

    for old_assignment in active_assignments:
        activity = activities.get(old_assignment.activity_id)
        if not activity:
            continue
        candidates = []
        for worker in workers:
            if (worker.discipline or "").strip().lower() != (activity.discipline or "").strip().lower():
                continue
            status = _attendance_status(db, project_id, worker.id, attendance_date)
            if status in ABSENT_STATUSES:
                continue
            candidates.append(worker)
        candidates.sort(
            key=lambda worker: (
                (worker.workload or 0) + _active_task_count(db, project_id, worker.id),
                -(worker.availability or 0),
                worker.id,
            )
        )
        if not candidates:
            push_audit(
                db,
                actor_id,
                "TASK_UNALLOCATED",
                "WorkerTaskAssignment",
                old_assignment.id,
                {"activity": activity.activity_description, "worker": old_assignment.worker_id, "reason": reason},
            )
            changes.append(
                {
                    "activityId": activity.schedule_activity_id,
                    "activityName": activity.activity_description,
                    "fromWorkerId": old_assignment.worker_id,
                    "toWorkerId": None,
                    "status": "UNALLOCATED",
                    "reason": "No available worker in the same discipline",
                }
            )
            continue

        new_worker = candidates[0]
        old_assignment.status = "REPLACED"
        new_assignment = WorkerTaskAssignment(
            id=uid("wta"),
            project_id=project_id,
            activity_id=old_assignment.activity_id,
            worker_id=new_worker.id,
            assigned_by=actor_id,
            assigned_at=now_iso(),
            source="AUTO_REALLOCATION",
            replaced_worker_id=old_assignment.worker_id,
            reason=reason,
            status="ACTIVE",
        )
        db.add(new_assignment)
        push_audit(
            db,
            actor_id,
            "TASK_REALLOCATED",
            "WorkerTaskAssignment",
            new_assignment.id,
            {
                "activity": activity.activity_description,
                "fromWorker": old_assignment.worker_id,
                "toWorker": new_worker.id,
                "reason": reason,
            },
        )
        changes.append(
            {
                "activityId": activity.schedule_activity_id,
                "activityName": activity.activity_description,
                "fromWorkerId": old_assignment.worker_id,
                "toWorkerId": new_worker.id,
                "toWorkerName": new_worker.name,
                "status": "REALLOCATED",
                "reason": reason,
            }
        )
    return changes
