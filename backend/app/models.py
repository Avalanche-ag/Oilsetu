import json

from sqlalchemy import Boolean, Column, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

from .database import Base


def _json_default(v):
    return json.dumps(v or [])


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    preferred_language = Column(String, default="en")
    avatar_initials = Column(String, nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    client = Column(String, nullable=False)
    location = Column(String, nullable=False)
    disciplines = Column(Text, default="[]")
    start_date = Column(String, nullable=False)
    planned_end = Column(String, nullable=False)
    status = Column(String, default="ACTIVE")
    created_at = Column(String, nullable=False)
    schedule_file_name = Column(String, nullable=True)
    schedule_uploaded_at = Column(String, nullable=True)


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    work_package_id = Column(String, nullable=False)
    supervisor_id = Column(String, ForeignKey("users.id"), nullable=False)
    included_l6_ids = Column(Text, default="[]")
    instructions = Column(Text, nullable=True)
    assigned_at = Column(String, nullable=False)
    status = Column(String, default="ACTIVE")


class Worker(Base):
    __tablename__ = "workers"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    discipline = Column(String, nullable=False)
    workload = Column(Integer, default=0)
    availability = Column(Float, default=100)
    status = Column(String, default="ACTIVE")


class WorkerAttendance(Base):
    __tablename__ = "worker_attendance"
    __table_args__ = (UniqueConstraint("project_id", "worker_id", "attendance_date", name="uq_worker_attendance_day"),)

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    worker_id = Column(String, ForeignKey("workers.id"), nullable=False, index=True)
    attendance_date = Column(String, nullable=False)
    status = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    reported_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(String, nullable=False)


class WorkerTaskAssignment(Base):
    __tablename__ = "worker_task_assignments"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    activity_id = Column(String, nullable=False, index=True)
    worker_id = Column(String, ForeignKey("workers.id"), nullable=False, index=True)
    assigned_by = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(String, nullable=False)
    source = Column(String, default="MANUAL")
    replaced_worker_id = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE")


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    supervisor_id = Column(String, ForeignKey("users.id"), nullable=False)
    report_date = Column(String, nullable=False)
    submitted_at = Column(String, nullable=False)
    source = Column(String, nullable=False)
    raw_content = Column(Text, nullable=False)
    file_name = Column(String, nullable=True)
    entries = relationship("ReportEntry", backref="report", cascade="all, delete-orphan")


class ReportEntry(Base):
    __tablename__ = "report_entries"

    id = Column(String, primary_key=True)
    report_id = Column(String, ForeignKey("daily_reports.id"), nullable=False)
    extracted_text = Column(Text, nullable=False)
    status = Column(String, nullable=True)
    actual_start = Column(String, nullable=True)
    actual_end = Column(String, nullable=True)
    delay_reason = Column(String, nullable=True)
    delay_text = Column(Text, nullable=True)
    adjusted = Column(Boolean, default=False)


class AiMatch(Base):
    __tablename__ = "ai_matches"

    id = Column(String, primary_key=True)
    report_entry_id = Column(String, ForeignKey("report_entries.id"), unique=True, nullable=False)
    report_id = Column(String, ForeignKey("daily_reports.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    extracted_activity = Column(Text, nullable=False)
    matched_activity_id = Column(String, nullable=True)
    matched_activity_name = Column(String, nullable=True)
    status = Column(String, nullable=True)
    actual_start = Column(String, nullable=True)
    actual_end = Column(String, nullable=True)
    delay_reason = Column(String, nullable=True)
    delay_text = Column(Text, nullable=True)
    confidence = Column(Float, nullable=False)
    band = Column(String, nullable=False)
    keywords = Column(Text, default="[]")
    candidates = Column(Text, default="[]")
    source = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    decision = Column(String, default="PENDING")
    decided_by = Column(String, nullable=True)
    decided_at = Column(String, nullable=True)


class Thread(Base):
    __tablename__ = "conversation_threads"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    activity_id = Column(String, nullable=True)
    supervisor_id = Column(String, ForeignKey("users.id"), nullable=False)
    opened_by = Column(String, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)
    status = Column(String, default="OPEN")
    created_at = Column(String, nullable=False)
    messages = relationship("Message", backref="thread", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True)
    thread_id = Column(String, ForeignKey("conversation_threads.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    sent_at = Column(String, nullable=False)


class DelayEvent(Base):
    __tablename__ = "delay_events"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    activity_id = Column(String, nullable=False)
    reason_code = Column(String, nullable=False)
    reason_text = Column(Text, nullable=True)
    reported_at = Column(String, nullable=False)
    status = Column(String, default="OPEN")
    days_impact = Column(Float, default=0)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=None)
    actor_id = Column(String, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    description_params = Column(Text, default="{}")
    timestamp = Column(String, nullable=False)
