from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_supervisor, require_worker
from ..database import ScheduleActivity, get_db
from ..models import User, Worker, WorkerAttendance, WorkerTaskAssignment
from ..worker_service import ABSENT_STATUSES, reallocate_worker_tasks
from .common import (
    now_iso,
    push_audit,
    ser_attendance,
    ser_worker,
    ser_worker_assignment,
    today_iso,
    uid,
)

router = APIRouter(prefix="/api/v1", tags=["Workers"])


class AttendanceBody(BaseModel):
    projectId: str
    workerId: Optional[str] = None
    date: str
    status: str
    reason: Optional[str] = None


class WorkerAssignmentBody(BaseModel):
    projectId: str
    activityId: str
    workerId: str


def _worker(db: Session, project_id: str, worker_id: str) -> Worker:
    row = db.query(Worker).filter(Worker.project_id == project_id, Worker.id == worker_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    return row


def _worker_for_user(db: Session, project_id: str, user_id: str) -> Worker:
    row = db.query(Worker).filter(Worker.project_id == project_id, Worker.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker profile not found")
    return row


def _worker_attendance(db: Session, project_id: str, worker_id: str, attendance_date: str) -> str | None:
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


def _worker_payload(db: Session, worker: Worker, attendance_date: str) -> dict:
    active_tasks = _active_tasks(db, worker.project_id, worker.id)
    return ser_worker(worker, _worker_attendance(db, worker.project_id, worker.id, attendance_date), len(active_tasks))


def _active_tasks(db: Session, project_id: str, worker_id: str):
    return (
        db.query(WorkerTaskAssignment)
        .filter(
            WorkerTaskAssignment.project_id == project_id,
            WorkerTaskAssignment.worker_id == worker_id,
            WorkerTaskAssignment.status == "ACTIVE",
        )
        .all()
    )


@router.get("/workers")
def list_workers(
    project_id: str,
    attendance_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    target_date = attendance_date or today_iso()
    if current.role == "worker":
        rows = db.query(Worker).filter(Worker.project_id == project_id, Worker.user_id == current.id).all()
    else:
        rows = db.query(Worker).filter(Worker.project_id == project_id).order_by(Worker.name).all()
    return [_worker_payload(db, worker, target_date) for worker in rows]


@router.get("/worker-assignments")
def list_worker_assignments(
    project_id: str,
    worker_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    target_worker = worker_id
    if current.role == "worker":
        target_worker = _worker_for_user(db, project_id, current.id).id
    query = db.query(WorkerTaskAssignment).filter(
        WorkerTaskAssignment.project_id == project_id,
        WorkerTaskAssignment.status == "ACTIVE",
    )
    if target_worker:
        query = query.filter(WorkerTaskAssignment.worker_id == target_worker)
    rows = query.order_by(WorkerTaskAssignment.assigned_at.desc()).all()
    activities = {
        a.schedule_activity_id: a
        for a in db.query(ScheduleActivity).filter(ScheduleActivity.project_id == project_id).all()
    }
    return [ser_worker_assignment(row, activities.get(row.activity_id)) for row in rows]


@router.post("/worker-assignments")
def assign_worker(
    body: WorkerAssignmentBody,
    db: Session = Depends(get_db),
    supervisor: User = Depends(require_supervisor),
):
    worker = _worker(db, body.projectId, body.workerId)
    activity = (
        db.query(ScheduleActivity)
        .filter(ScheduleActivity.project_id == body.projectId, ScheduleActivity.schedule_activity_id == body.activityId)
        .first()
    )
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    if (worker.discipline or "").strip().lower() != (activity.discipline or "").strip().lower():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Worker discipline does not match activity")
    if _worker_attendance(db, body.projectId, worker.id, today_iso()) in ABSENT_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Worker is not available today")
    previous = (
        db.query(WorkerTaskAssignment)
        .filter(
            WorkerTaskAssignment.project_id == body.projectId,
            WorkerTaskAssignment.activity_id == body.activityId,
            WorkerTaskAssignment.status == "ACTIVE",
        )
        .first()
    )
    if previous and previous.worker_id == worker.id:
        return ser_worker_assignment(previous, activity)
    if previous:
        previous.status = "REPLACED"
    row = WorkerTaskAssignment(
        id=uid("wta"),
        project_id=body.projectId,
        activity_id=body.activityId,
        worker_id=worker.id,
        assigned_by=supervisor.id,
        assigned_at=now_iso(),
        source="MANUAL",
        replaced_worker_id=previous.worker_id if previous else None,
        reason="Supervisor allocation" if previous else None,
        status="ACTIVE",
    )
    db.add(row)
    push_audit(db, supervisor.id, "WORKER_TASK_ASSIGNED", "WorkerTaskAssignment", row.id, {"activity": activity.activity_description, "worker": worker.name})
    db.commit()
    return ser_worker_assignment(row, activity)


@router.post("/worker-attendance")
def update_attendance(body: AttendanceBody, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if body.status not in ("PRESENT", "ABSENT", "PTO", "LEAVE"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid attendance status")
    worker_id = body.workerId
    worker = _worker_for_user(db, body.projectId, current.id) if current.role == "worker" and not worker_id else _worker(db, body.projectId, worker_id or current.id)
    if current.role == "worker" and (worker.user_id != current.id or body.status not in ("PTO", "LEAVE")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workers may only mark their own PTO or leave")
    if current.role not in ("worker", "supervisor", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Attendance access denied")
    row = (
        db.query(WorkerAttendance)
        .filter(
            WorkerAttendance.project_id == body.projectId,
            WorkerAttendance.worker_id == worker.id,
            WorkerAttendance.attendance_date == body.date,
        )
        .first()
    )
    if row:
        row.status = body.status
        row.reason = body.reason
        row.reported_by = current.id
        row.created_at = now_iso()
    else:
        row = WorkerAttendance(
            id=uid("att"),
            project_id=body.projectId,
            worker_id=worker.id,
            attendance_date=body.date,
            status=body.status,
            reason=body.reason,
            reported_by=current.id,
            created_at=now_iso(),
        )
        db.add(row)
    db.flush()
    changes = []
    if body.status in ABSENT_STATUSES:
        changes = reallocate_worker_tasks(db, body.projectId, [worker.id], body.date, current.id, body.reason or body.status)
    push_audit(db, current.id, "WORKER_ATTENDANCE_UPDATED", "WorkerAttendance", row.id, {"worker": worker.name, "status": body.status, "date": body.date})
    db.commit()
    return {"attendance": ser_attendance(row), "reallocations": changes}


@router.get("/workers/me/dashboard")
def worker_dashboard(project_id: str, db: Session = Depends(get_db), worker_user: User = Depends(require_worker)):
    worker = _worker_for_user(db, project_id, worker_user.id)
    attendance = (
        db.query(WorkerAttendance)
        .filter(WorkerAttendance.project_id == project_id, WorkerAttendance.worker_id == worker.id)
        .order_by(WorkerAttendance.attendance_date.desc())
        .all()
    )
    assignments = list_worker_assignments(project_id, worker.id, db, worker_user)
    present = sum(1 for item in attendance if item.status == "PRESENT")
    absent = sum(1 for item in attendance if item.status == "ABSENT")
    leave = sum(1 for item in attendance if item.status in ("PTO", "LEAVE"))
    return {
        "worker": _worker_payload(db, worker, today_iso()),
        "attendance": [ser_attendance(item) for item in attendance],
        "assignments": assignments,
        "summary": {"presentDays": present, "absentDays": absent, "leaveDays": leave},
    }
