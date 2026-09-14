import json
import os
import re
import sys
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[2]
AI_DIR = ROOT / "ai"
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

from prompt import PROMPT  # noqa: E402
from matcher import ScheduleMatcher  # noqa: E402
from normalizer import load_terminology, ActivityNormalizer  # noqa: E402

SCHEDULE_PATH = ROOT / "data" / "oilsetu_schedule.xlsx"
TERMINOLOGY_PATH = ROOT / "data" / "05_terminology_synonym_hints.csv"
MATCH_THRESHOLD = 0.40

STATUS_MAP = {
    "Completed": "COMPLETED",
    "In Progress": "IN_PROGRESS",
    "Not Started": "NOT_STARTED",
    "Delayed": "DELAYED",
    "Partially Completed": "IN_PROGRESS",
}

DELAY_KEYWORDS = [
    ("material", "MATERIAL"),
    ("delivery", "MATERIAL"),
    ("labour", "MANPOWER"),
    ("manpower", "MANPOWER"),
    ("worker", "MANPOWER"),
    ("equipment", "EQUIPMENT"),
    ("crane", "EQUIPMENT"),
    ("rain", "WEATHER"),
    ("weather", "WEATHER"),
    ("storm", "WEATHER"),
    ("design", "DESIGN_CHANGE"),
    ("drawing", "DESIGN_CHANGE"),
    ("permit", "PERMIT"),
]

router = APIRouter(prefix="/api/v1", tags=["AI Analysis"])

_matcher: Optional[ScheduleMatcher] = None
_normalizer: Optional[ActivityNormalizer] = None
_lock = threading.Lock()


class AnalyzeRequest(BaseModel):
    report_text: str
    report_date: Optional[str] = None


def get_engine():
    global _matcher, _normalizer
    if _matcher is not None:
        return _matcher, _normalizer
    with _lock:
        if _matcher is not None:
            return _matcher, _normalizer
        if not SCHEDULE_PATH.exists():
            raise RuntimeError(f"schedule file missing: {SCHEDULE_PATH}")
        _matcher = ScheduleMatcher(str(SCHEDULE_PATH))
        terms = load_terminology(str(TERMINOLOGY_PATH)) if TERMINOLOGY_PATH.exists() else []
        _normalizer = ActivityNormalizer(terms)
        return _matcher, _normalizer


def gemini_client() -> OpenAI:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return OpenAI(api_key=key, base_url="https://generativelanguage.googleapis.com/v1beta/openai/")


def extract_activities(report_text: str, report_date: str) -> List[Dict[str, Any]]:
    client = gemini_client()
    model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    prompt = PROMPT.format(report_date=report_date, report_text=report_text)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = (resp.choices[0].message.content or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()
    data = json.loads(raw)
    activities = data.get("activities", [])
    return activities if isinstance(activities, list) else []


def map_delay_reason(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    lowered = text.lower()
    for keyword, code in DELAY_KEYWORDS:
        if keyword in lowered:
            return code
    return "OTHER"


def date_only(value: Any) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    m = re.match(r"(\d{4}-\d{2}-\d{2})", value)
    return m.group(1) if m else None


def build_keywords(norm: Dict[str, Any]) -> List[str]:
    words: List[str] = []
    for key in ("matched_field_term", "normalized_plan_term"):
        val = norm.get(key)
        if val and isinstance(val, str) and val not in ("Unmatched", "Ambiguous"):
            words.extend(re.findall(r"[A-Za-z][A-Za-z-]+", val))
    seen = set()
    out = []
    for w in words:
        lw = w.lower()
        if lw not in seen:
            seen.add(lw)
            out.append(w)
    return out[:6]


@router.post("/analyze")
def analyze_report(req: AnalyzeRequest):
    if not req.report_text or not req.report_text.strip():
        raise HTTPException(status_code=422, detail="report_text is required")
    try:
        matcher, normalizer = get_engine()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    from datetime import date as _date

    report_date = req.report_date or _date.today().isoformat()
    try:
        extracted = extract_activities(req.report_text, report_date)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"extraction failed: {exc}")

    entries = []
    for act in extracted:
        desc = str(act.get("activity_description") or "")
        disc = act.get("discipline")
        norm = normalizer.normalize_activity(desc) if desc else {}
        match = matcher.match_activity(desc, disc) if desc else None
        score = float(match.get("score", 0.0)) if match else 0.0
        matched = match is not None and score >= MATCH_THRESHOLD
        status = STATUS_MAP.get(str(act.get("status") or ""), None)
        delay_text = act.get("delay_reason")
        entries.append(
            {
                "extractedText": str(act.get("evidence") or desc),
                "matchedActivityId": match.get("matched_activity_id") if matched else None,
                "matchedActivityName": match.get("matched_activity_name") if matched else None,
                "status": status,
                "actualStart": date_only(act.get("actual_start")),
                "actualEnd": date_only(act.get("actual_end")),
                "delayReason": map_delay_reason(delay_text) if status == "DELAYED" else None,
                "delayText": delay_text,
                "confidence": round(score * 100),
                "keywords": build_keywords(norm),
                "candidates": (
                    [
                        {
                            "activityId": match.get("matched_activity_id"),
                            "name": match.get("matched_activity_name"),
                            "discipline": None,
                            "confidence": round(score * 100),
                        }
                    ]
                    if matched
                    else []
                ),
            }
        )
    return {"entries": entries, "extraction_count": len(extracted)}
