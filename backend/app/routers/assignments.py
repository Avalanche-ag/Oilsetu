from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_manager
from ..database import ScheduleActivity, get_db
from ..models import Assignment, User
from .common import dump, now_iso, parse_list, push_audit, ser_assignment, today_iso, uid, user_name

router = APIRouter(prefix="/api/v1", tags=["Assignments"])


class AssignmentBody(BaseModel):
    projectId: str
    workPackageId: str
    supervisorId: str
    includedL6Ids: List[str] = []
    instructions: Optional[str] = None


@router.get("/assignments")
def list_assignments(project_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Assignment).filter(Assignment.project_id == project_id).all()
    return [ser_assignment(a) for a in rows]


@router.post("/assignments", status_code=status.HTTP_201_CREATED)
def upsert_assignment(body: AssignmentBody, db: Session = Depends(get_db), manager: User = Depends(require_manager)):
    existing = (
        db.query(Assignment)
        .filter(
            Assignment.project_id == body.projectId,
            Assignment.work_package_id == body.workPackageId,
            Assignment.status == "ACTIVE",
        )
        .first()
    )
    if existing:
        existing.supervisor_id = body.supervisorId
        existing.included_l6_ids = dump(body.includedL6Ids)
        existing.instructions = body.instructions
        row = existing
    else:
        row = Assignment(
            id=uid("a"),
            project_id=body.projectId,
            work_package_id=body.workPackageId,
            supervisor_id=body.supervisorId,
            included_l6_ids=dump(body.includedL6Ids),
            instructions=body.instructions,
            assigned_at=today_iso(),
            status="ACTIVE",
        )
        db.add(row)
    pkg = db.query(ScheduleActivity).filter(ScheduleActivity.schedule_activity_id == body.workPackageId).first()
    for act_id in body.includedL6Ids:
        act = db.query(ScheduleActivity).filter(ScheduleActivity.schedule_activity_id == act_id).first()
        if act:
            act.assignee_id = body.supervisorId
    push_audit(
        db,
        manager.id,
        "WORK_ASSIGNED",
        "Assignment",
        body.workPackageId,
        {"package": pkg.activity_description if pkg else body.workPackageId, "supervisor": user_name(db, body.supervisorId)},
    )
    db.commit()
    active = (
        db.query(Assignment)
        .filter(Assignment.project_id == body.projectId, Assignment.work_package_id == body.workPackageId, Assignment.status == "ACTIVE")
        .first()
    )
    return ser_assignment(active or row)


@router.delete("/assignments/{assignment_id}")
def unassign(assignment_id: str, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    row = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    row.status = "COMPLETED"
    for act_id in parse_list(row.included_l6_ids):
        act = db.query(ScheduleActivity).filter(ScheduleActivity.schedule_activity_id == act_id).first()
        if act and act.assignee_id == row.supervisor_id:
            act.assignee_id = None
    db.commit()
    return {"ok": True}
