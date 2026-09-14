from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Message as MessageModel
from ..models import Thread as ThreadModel
from ..models import User
from .common import now_iso, push_audit, ser_thread, uid, user_name

router = APIRouter(prefix="/api/v1", tags=["Threads"])


class ThreadBody(BaseModel):
    projectId: str
    activityId: Optional[str] = None
    supervisorId: str
    text: str


class MessageBody(BaseModel):
    text: str


@router.get("/threads")
def list_threads(
    project_id: Optional[str] = None,
    supervisor_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ThreadModel)
    if project_id:
        q = q.filter(ThreadModel.project_id == project_id)
    if supervisor_id:
        q = q.filter(ThreadModel.supervisor_id == supervisor_id)
    rows = q.all()
    rows.sort(key=lambda t: max([m.sent_at for m in t.messages] + [t.created_at]), reverse=True)
    return [ser_thread(t) for t in rows]


@router.get("/threads/{thread_id}")
def get_thread(thread_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    t = db.query(ThreadModel).filter(ThreadModel.id == thread_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return ser_thread(t)


@router.post("/threads", status_code=status.HTTP_201_CREATED)
def ask_question(body: ThreadBody, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    from ..database import ScheduleActivity

    thread_id = uid("t")
    activity = None
    if body.activityId:
        activity = db.query(ScheduleActivity).filter(ScheduleActivity.schedule_activity_id == body.activityId).first()
    thread = ThreadModel(
        id=thread_id,
        project_id=body.projectId,
        activity_id=body.activityId,
        supervisor_id=body.supervisorId,
        opened_by=actor.id,
        subject=activity.activity_description if activity else "General question",
        status="OPEN",
        created_at=now_iso(),
    )
    db.add(thread)
    db.flush()
    db.add(MessageModel(id=uid("m"), thread_id=thread_id, sender_id=actor.id, text=body.text, sent_at=now_iso()))
    push_audit(db, actor.id, "QUESTION_ASKED", "Thread", thread_id, {"activity": body.activityId or ""})
    db.commit()
    db.refresh(thread)
    return ser_thread(thread)


@router.post("/threads/{thread_id}/messages", status_code=status.HTTP_201_CREATED)
def send_message(thread_id: str, body: MessageBody, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    t = db.query(ThreadModel).filter(ThreadModel.id == thread_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    msg = MessageModel(id=uid("m"), thread_id=thread_id, sender_id=actor.id, text=body.text, sent_at=now_iso())
    db.add(msg)
    push_audit(db, actor.id, "REPLY_SENT", "Thread", thread_id, {"actor": user_name(db, actor.id)})
    db.commit()
    return {"id": msg.id, "threadId": thread_id, "senderId": actor.id, "text": body.text, "sentAt": msg.sent_at}


@router.patch("/threads/{thread_id}/resolve")
def resolve_thread(thread_id: str, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    t = db.query(ThreadModel).filter(ThreadModel.id == thread_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    t.status = "OPEN" if t.status == "RESOLVED" else "RESOLVED"
    if t.status == "RESOLVED":
        push_audit(db, actor.id, "THREAD_RESOLVED", "Thread", thread_id, {})
    db.commit()
    return {"ok": True, "status": t.status}
