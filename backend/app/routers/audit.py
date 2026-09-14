from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import AuditEvent, User
from .common import ser_audit

router = APIRouter(prefix="/api/v1", tags=["Audit"])


@router.get("/audit")
def list_audit(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(AuditEvent).order_by(AuditEvent.timestamp.desc()).all()
    return [ser_audit(e) for e in rows]
