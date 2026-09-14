from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_manager
from ..database import ScheduleActivity, get_db
from ..init_db import import_schedule_excel
from ..models import Project, User
from ..schedule_gen import generate_schedule
from .common import dump, now_iso, push_audit, recompute_project_rollups, ser_activity, ser_project, today_iso, uid

router = APIRouter(prefix="/api/v1", tags=["Projects & Activities"])


class ProjectBody(BaseModel):
    name: str
    code: str
    client: str
    location: str
    disciplines: List[str] = []
    startDate: str
    plannedEnd: str


def project_progress(db: Session, project_id: str) -> int:
    l6 = (
        db.query(ScheduleActivity)
        .filter(ScheduleActivity.project_id == project_id, ScheduleActivity.level == "L6")
        .all()
    )
    if not l6:
        return 0
    done = sum(1 for a in l6 if a.schedule_status == "COMPLETED")
    return round((done / len(l6)) * 100)


@router.get("/projects")
def list_projects(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [ser_project(p, project_progress(db, p.id)) for p in db.query(Project).all()]


@router.get("/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ser_project(p, project_progress(db, p.id))


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectBody, db: Session = Depends(get_db), manager: User = Depends(require_manager)):
    if db.query(Project).filter(Project.code == body.code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project code already exists")
    p = Project(
        id=uid("p"),
        name=body.name,
        code=body.code,
        client=body.client,
        location=body.location,
        disciplines=dump(body.disciplines),
        start_date=body.startDate,
        planned_end=body.plannedEnd,
        status="ACTIVE",
        created_at=today_iso(),
    )
    db.add(p)
    push_audit(db, manager.id, "PROJECT_CREATED", "Project", p.id, {"project": p.name})
    db.commit()
    return ser_project(p, 0)


@router.get("/activities")
def list_activities(project_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    acts = db.query(ScheduleActivity).filter(ScheduleActivity.project_id == project_id).all()
    return [ser_activity(a) for a in acts]


@router.get("/activities/{activity_id}")
def get_activity(activity_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    a = db.query(ScheduleActivity).filter(ScheduleActivity.schedule_activity_id == activity_id).first()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return ser_activity(a)


@router.get("/work")
def supervisor_work(supervisor_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    acts = (
        db.query(ScheduleActivity)
        .filter(ScheduleActivity.assignee_id == supervisor_id, ScheduleActivity.level == "L6")
        .all()
    )
    return [ser_activity(a) for a in acts]


def _schedule_summary(db: Session, project_id: str):
    acts = db.query(ScheduleActivity).filter(ScheduleActivity.project_id == project_id).all()
    levels: dict = {}
    discs = set()
    for a in acts:
        if a.level:
            levels[a.level] = levels.get(a.level, 0) + 1
        if a.discipline:
            discs.add(a.discipline)
    return {"activityCount": len(acts), "levelCounts": levels, "disciplines": sorted(discs)}


@router.post("/projects/{project_id}/schedule/import")
async def import_project_schedule(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    manager: User = Depends(require_manager),
):
    import io as _io

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    contents = await file.read()
    result = import_schedule_excel(_io.BytesIO(contents), db_session=db, project_id=project_id)
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=result.get("message"))
    project.schedule_file_name = file.filename
    project.schedule_uploaded_at = today_iso()
    recompute_project_rollups(db, project_id)
    push_audit(db, manager.id, "SCHEDULE_UPLOADED", "Project", project_id, {"file": file.filename or "", "count": result.get("imported_count", 0)})
    db.commit()
    return _schedule_summary(db, project_id)


@router.post("/projects/{project_id}/schedule/generate")
def generate_project_schedule(project_id: str, db: Session = Depends(get_db), manager: User = Depends(require_manager)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    rows = generate_schedule(db, project)
    recompute_project_rollups(db, project_id)
    push_audit(db, manager.id, "SCHEDULE_UPLOADED", "Project", project_id, {"file": "generated", "count": len(rows)})
    db.commit()
    return _schedule_summary(db, project_id)
