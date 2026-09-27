from sqlalchemy import Column, String, Float, Text

from .database import Base


# ============================================================
# USER
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    designation = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    preferred_language = Column(String, default="en")
    avatar_initials = Column(String, nullable=True)


# ============================================================
# PROJECT
# ============================================================

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False, unique=True)
    client = Column(String, nullable=True)
    location = Column(String, nullable=True)

    # Stored as JSON text for SQLite
    disciplines = Column(Text, nullable=True)

    start_date = Column(String, nullable=True)
    planned_end = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")


# ============================================================
# ACTIVITY - L1 TO L6
# ============================================================

class Activity(Base):
    __tablename__ = "activities"

    id = Column(String, primary_key=True)

    project_id = Column(
        String,
        nullable=False,
        index=True
    )

    # L1 / L2 / L3 / L4 / L5 / L6
    level = Column(
        String,
        nullable=False
    )

    # Parent activity in the L1-L6 hierarchy
    parent_id = Column(
        String,
        nullable=True,
        index=True
    )

    discipline = Column(
        String,
        nullable=True
    )

    name = Column(
        String,
        nullable=False
    )

    planned_start = Column(
        String,
        nullable=True
    )

    planned_end = Column(
        String,
        nullable=True
    )

    weightage = Column(
        Float,
        default=0
    )

    status = Column(
        String,
        default="NOT_STARTED"
    )

    assignee_id = Column(
        String,
        nullable=True,
        index=True
    )

    baseline_version = Column(
        String,
        default="v1"
    )

    actual_start = Column(
        String,
        nullable=True
    )

    actual_end = Column(
        String,
        nullable=True
    )

    last_reported_at = Column(
        String,
        nullable=True
    )

    progress_pct = Column(
        Float,
        default=0
    )


# ============================================================
# DAILY REPORT
# ============================================================

class DailyReport(Base):
    __tablename__ = "daily_reports"

    id = Column(
        String,
        primary_key=True
    )

    project_id = Column(
        String,
        nullable=False,
        index=True
    )

    supervisor_id = Column(
        String,
        nullable=False,
        index=True
    )

    report_date = Column(
        String,
        nullable=False
    )

    submitted_at = Column(
        String,
        nullable=False
    )

    # TEXT / VOICE / FILE
    source = Column(
        String,
        nullable=False
    )

    raw_content = Column(
        Text,
        nullable=True
    )

    file_name = Column(
        String,
        nullable=True
    )


# ============================================================
# REPORT ENTRY
# ============================================================

class ReportEntry(Base):
    __tablename__ = "report_entries"

    id = Column(
        String,
        primary_key=True
    )

    report_id = Column(
        String,
        nullable=False,
        index=True
    )

    extracted_text = Column(
        Text,
        nullable=False
    )

    status = Column(
        String,
        nullable=True
    )

    actual_start = Column(
        String,
        nullable=True
    )

    actual_end = Column(
        String,
        nullable=True
    )

    delay_reason = Column(
        String,
        nullable=True
    )

    delay_text = Column(
        Text,
        nullable=True
    )


# ============================================================
# AI MATCH RESULT
# ============================================================

class AiMatchResult(Base):
    __tablename__ = "ai_match_results"

    id = Column(
        String,
        primary_key=True
    )

    report_entry_id = Column(
        String,
        nullable=False,
        index=True
    )

    report_id = Column(
        String,
        nullable=False,
        index=True
    )

    project_id = Column(
        String,
        nullable=False,
        index=True
    )

    # Text extracted by Sans's AI/NLP
    extracted_activity = Column(
        Text,
        nullable=False
    )

    # Activity matched by AI
    matched_activity_id = Column(
        String,
        nullable=True
    )

    matched_activity_name = Column(
        String,
        nullable=True
    )

    status = Column(
        String,
        nullable=True
    )

    actual_start = Column(
        String,
        nullable=True
    )

    actual_end = Column(
        String,
        nullable=True
    )

    delay_reason = Column(
        String,
        nullable=True
    )

    delay_text = Column(
        Text,
        nullable=True
    )

    # AI confidence: 0-100
    confidence = Column(
        Float,
        default=0
    )

    # AUTO / REVIEW / UNMATCHED
    band = Column(
        String,
        nullable=False
    )

    # Stored as JSON text in SQLite
    keywords = Column(
        Text,
        nullable=True
    )

    # Stored as JSON text in SQLite
    candidates = Column(
        Text,
        nullable=True
    )

    # TEXT / VOICE / FILE
    source = Column(
        String,
        nullable=False
    )

    created_at = Column(
        String,
        nullable=False
    )

    # AUTO_APPROVED / ACCEPTED / CORRECTED /
    # LINKED / PENDING / ASKED
    decision = Column(
        String,
        nullable=False
    )

    decided_by = Column(
        String,
        nullable=True
    )

    decided_at = Column(
        String,
        nullable=True
    )