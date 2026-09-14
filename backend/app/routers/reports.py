from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import AiMatch, DailyReport, ReportEntry, User, Worker, WorkerAttendance
from ..worker_service import reallocate_worker_tasks
from .common import (
    apply_activity_update,
    band_for,
    dump,
    now_iso,
    push_audit,
    recompute_project_rollups,
    ser_match,
    ser_report,
    today_iso,
    uid,
    user_name,
)

router = APIRouter(prefix="/api/v1", tags=["Reports & Reconciliation"])


class PreviewEntryBody(BaseModel):
    extractedText: str
    matchedActivityId: Optional[str] = None
    matchedActivityName: Optional[str] = None
    status: Optional[str] = None
    actualStart: Optional[str] = None
    actualEnd: Optional[str] = None
    delayReason: Optional[str] = None
    delayText: Optional[str] = None
    confidence: float = 0
    keywords: List[str] = []
    candidates: List[Dict[str, Any]] = []


class SubmitReportBody(BaseModel):
    projectId: str
    supervisorId: str
    source: str
    rawContent: str
    fileName: Optional[str] = None
    absentWorkerIds: List[str] = []
    absenceDate: Optional[str] = None
    absenceReason: Optional[str] = None
    entries: List[PreviewEntryBody] = []


class DecideBody(BaseModel):
    action: str
    activityId: Optional[str] = None
    question: Optional[str] = None


@router.get("/reports")
def list_reports(
    project_id: Optional[str] = None,
    supervisor_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(DailyReport)
    if project_id:
        q = q.filter(DailyReport.project_id == project_id)
    if supervisor_id:
        q = q.filter(DailyReport.supervisor_id == supervisor_id)
    rows = q.order_by(DailyReport.submitted_at.desc()).all()
    return [ser_report(r) for r in rows]


@router.post("/reports", status_code=status.HTTP_201_CREATED)
def submit_report(body: SubmitReportBody, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role != "supervisor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor role required")
    now = now_iso()
    report_id = uid("r")
    report = DailyReport(
        id=report_id,
        project_id=body.projectId,
        supervisor_id=body.supervisorId,
        report_date=today_iso(),
        submitted_at=now,
        source=body.source,
        raw_content=body.rawContent,
        file_name=body.fileName,
    )
    db.add(report)
    reallocations = []
    attendance_date = body.absenceDate or today_iso()
    if body.absentWorkerIds:
        for worker_id in body.absentWorkerIds:
            worker = (
                db.query(Worker)
                .filter(Worker.project_id == body.projectId, Worker.id == worker_id)
                .first()
            )
            if not worker:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown worker: {worker_id}")
            attendance = (
                db.query(WorkerAttendance)
                .filter(
                    WorkerAttendance.project_id == body.projectId,
                    WorkerAttendance.worker_id == worker_id,
                    WorkerAttendance.attendance_date == attendance_date,
                )
                .first()
            )
            if attendance:
                attendance.status = "ABSENT"
                attendance.reason = body.absenceReason
                attendance.reported_by = actor.id
                attendance.created_at = now
            else:
                db.add(
                    WorkerAttendance(
                        id=uid("att"),
                        project_id=body.projectId,
                        worker_id=worker_id,
                        attendance_date=attendance_date,
                        status="ABSENT",
                        reason=body.absenceReason,
                        reported_by=actor.id,
                        created_at=now,
                    )
                )
        db.flush()
        reallocations = reallocate_worker_tasks(
            db,
            body.projectId,
            body.absentWorkerIds,
            attendance_date,
            actor.id,
            body.absenceReason or "Worker absence",
        )
    auto_count = 0
    flagged_count = 0
    for preview in body.entries:
        entry = ReportEntry(
            id=uid("re"),
            report_id=report_id,
            extracted_text=preview.extractedText,
            status=preview.status,
            actual_start=preview.actualStart,
            actual_end=preview.actualEnd,
            delay_reason=preview.delayReason,
            delay_text=preview.delayText,
            adjusted=False,
        )
        db.add(entry)
        db.flush()
        band = band_for(preview.confidence)
        decision = "AUTO_APPROVED" if band == "AUTO" else "PENDING"
        match = AiMatch(
            id=uid("aim"),
            report_entry_id=entry.id,
            report_id=report_id,
            project_id=body.projectId,
            extracted_activity=preview.extractedText,
            matched_activity_id=preview.matchedActivityId,
            matched_activity_name=preview.matchedActivityName,
            status=preview.status,
            actual_start=preview.actualStart,
            actual_end=preview.actualEnd,
            delay_reason=preview.delayReason,
            delay_text=preview.delayText,
            confidence=preview.confidence,
            band=band,
            keywords=dump(preview.keywords),
            candidates=dump(preview.candidates),
            source=body.source,
            created_at=now,
            decision=decision,
        )
        db.add(match)
        if band == "AUTO" and preview.status:
            auto_count += 1
            apply_activity_update(db, preview.matchedActivityId, preview.status, preview.delayReason, preview.delayText, actor.id)
            push_audit(
                db, actor.id, "AI_AUTO_APPROVED", "AiMatch", match.id,
                {"extracted": preview.extractedText[:60], "activity": preview.matchedActivityName or "", "confidence": preview.confidence},
            )
        else:
            flagged_count += 1
    recompute_project_rollups(db, body.projectId)
    push_audit(
        db, actor.id, "REPORT_SUBMITTED", "Report", report_id,
        {"supervisor": user_name(db, body.supervisorId), "source": body.source},
    )
    push_audit(db, actor.id, "AI_PROCESSED", "Report", report_id, {"matched": auto_count, "flagged": flagged_count})
    db.commit()
    db.refresh(report)
    response = ser_report(report)
    response["reallocations"] = reallocations
    return response


@router.get("/reconciliation/queue")
def recon_queue(project_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(AiMatch)
        .filter(AiMatch.project_id == project_id, AiMatch.decision == "PENDING")
        .order_by(AiMatch.created_at.desc())
        .all()
    )
    return [ser_match(m) for m in rows]


@router.get("/reconciliation/auto-log")
def recon_auto_log(project_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(AiMatch)
        .filter(AiMatch.project_id == project_id, AiMatch.decision != "PENDING")
        .order_by(AiMatch.created_at.desc())
        .all()
    )
    return [ser_match(m) for m in rows]


@router.post("/reconciliation/{match_id}/decide")
def decide_match(match_id: str, body: DecideBody, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    from ..models import Thread as ThreadModel, Message as MessageModel
    from ..database import ScheduleActivity

    if actor.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager role required")
    if body.action not in ("ACCEPT", "CORRECT", "LINK", "ASK"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown action")
    match = db.query(AiMatch).filter(AiMatch.id == match_id).first()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    now = now_iso()
    match.decided_at = now
    match.decided_by = actor.id

    if body.action == "ACCEPT":
        match.decision = "ACCEPTED"
        if match.status:
            apply_activity_update(db, match.matched_activity_id, match.status, match.delay_reason, match.delay_text, actor.id)
            push_audit(db, actor.id, "AI_REVIEW_ACCEPTED", "AiMatch", match.id, {"activity": match.matched_activity_name or match.matched_activity_id or ""})
    elif body.action in ("CORRECT", "LINK"):
        if not body.activityId:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="activityId required")
        match.decision = "CORRECTED" if body.action == "CORRECT" else "LINKED"
        match.matched_activity_id = body.activityId
        act = db.query(ScheduleActivity).filter(ScheduleActivity.schedule_activity_id == body.activityId).first()
        match.matched_activity_name = act.activity_description if act else body.activityId
        if match.status:
            apply_activity_update(db, body.activityId, match.status, match.delay_reason, match.delay_text, actor.id)
            push_audit(db, actor.id, "AI_CORRECTED" if body.action == "CORRECT" else "AI_LINKED", "AiMatch", match.id, {"activity": match.matched_activity_name or body.activityId})
    else:
        if not body.question:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="question required")
        match.decision = "ASKED"
        report = db.query(DailyReport).filter(DailyReport.id == match.report_id).first()
        supervisor_id = report.supervisor_id if report else ""
        cands = match.candidates or "[]"
        import json as _json

        try:
            first_cand = (_json.loads(cands) or [{}])[0].get("activityId", "")
        except (ValueError, TypeError):
            first_cand = ""
        target_activity = body.activityId or match.matched_activity_id or first_cand or ""
        thread_id = uid("t")
        thread = ThreadModel(
            id=thread_id,
            project_id=match.project_id,
            activity_id=target_activity or None,
            supervisor_id=supervisor_id,
            opened_by=actor.id,
            subject=match.extracted_activity,
            status="OPEN",
            created_at=now,
        )
        db.add(thread)
        db.add(MessageModel(id=uid("m"), thread_id=thread_id, sender_id=actor.id, text=body.question, sent_at=now))
        push_audit(db, actor.id, "AI_ASKED", "AiMatch", match.id, {"supervisor": user_name(db, supervisor_id)})
        push_audit(db, actor.id, "QUESTION_ASKED", "Thread", thread_id, {"activity": target_activity})
    recompute_project_rollups(db, match.project_id)
    db.commit()
    return {"ok": True}
