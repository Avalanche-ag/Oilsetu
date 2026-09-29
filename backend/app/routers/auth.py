import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import User
from .common import ser_user

router = APIRouter(prefix="/api/v1", tags=["Auth & Users"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
REGISTERABLE_ROLES = ("supervisor", "worker")


class LoginBody(BaseModel):
    email: str
    password: str


class RegisterBody(BaseModel):
    email: str
    password: str
    name: str
    role: str


class DemoLoginBody(BaseModel):
    userId: str


class LanguageBody(BaseModel):
    preferredLanguage: str


def _avatar_initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    initials = "".join(p[0] for p in parts[:2]).upper()
    return initials or "U"


def _token_response(user: User):
    return {"token": create_token(user.id, user.role, user.email), "user": ser_user(user)}


@router.post("/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _token_response(user)


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterBody, db: Session = Depends(get_db)):
    role = body.role.strip().lower()
    if role not in REGISTERABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisor and worker accounts can self-register",
        )
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name is too short")
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email address")
    if len(body.password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        id=f"u-{uuid.uuid4().hex[:8]}",
        name=name,
        email=email,
        password_hash=hash_password(body.password),
        role=role,
        designation="Site Supervisor" if role == "supervisor" else "Site Worker",
        preferred_language="en",
        avatar_initials=_avatar_initials(name),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
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
