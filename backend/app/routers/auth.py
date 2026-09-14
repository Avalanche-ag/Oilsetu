from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, require_manager, verify_password
from ..database import get_db
from ..models import User
from .common import ser_user

router = APIRouter(prefix="/api/v1", tags=["Auth & Users"])


class LoginBody(BaseModel):
    email: str
    password: str


class DemoLoginBody(BaseModel):
    userId: str


class LanguageBody(BaseModel):
    preferredLanguage: str


def _token_response(user: User):
    return {"token": create_token(user.id, user.role), "user": ser_user(user)}


@router.post("/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _token_response(user)


@router.post("/auth/demo-login")
def demo_login(body: DemoLoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == body.userId).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown demo user")
    return _token_response(user)


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return ser_user(user)


@router.get("/users", response_model=List[dict])
def list_users(db: Session = Depends(get_db)):
    return [ser_user(u) for u in db.query(User).all()]


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    body: LanguageBody,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.id != user_id and current.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.preferredLanguage not in ("en", "hi"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported language")
    user.preferred_language = body.preferredLanguage
    db.commit()
    return ser_user(user)
