import os
import sys
import tempfile
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DailyReport, ReportEntry, AiMatchResult


# --------------------------------------------------
# AI PROJECT PATH
# --------------------------------------------------

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../")
)

AI_FOLDER = os.path.join(PROJECT_ROOT, "ai")

if AI_FOLDER not in sys.path:
    sys.path.insert(0, AI_FOLDER)


from docx_processor import extract_docx_text
from voice_processor import transcribe_audio
from pipeline import run_pipeline


router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)


# --------------------------------------------------
# DOCX UPLOAD + AI PROCESSING + DATABASE
# --------------------------------------------------

@router.post("/upload-docx")
async def upload_docx(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400,
            detail="Only DOCX files are supported."
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded DOCX file is empty."
        )

    temp_path = None

    try:

        # --------------------------------------------------
        # 1. SAVE TEMPORARY DOCX
        # --------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".docx"
        ) as temp_file:

            temp_file.write(file_bytes)
            temp_path = temp_file.name


        # --------------------------------------------------
        # 2. EXTRACT DOCX TEXT
        # --------------------------------------------------

        extracted_text = extract_docx_text(temp_path)

        if not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No readable text found in DOCX file."
            )


        # --------------------------------------------------
        # 3. RUN AI/NLP PIPELINE
        # --------------------------------------------------

        result = run_pipeline(
            report_text=extracted_text,
            input_source="DOCX"
        )


        # --------------------------------------------------
        # 4. GENERATE IDs
        # --------------------------------------------------

        report_id = str(uuid.uuid4())
        report_entry_id = str(uuid.uuid4())

        created_at = datetime.now().isoformat()

        # Temporary values for first integration test
        project_id = "UNASSIGNED"
        supervisor_id = "AI-UPLOAD"


        # --------------------------------------------------
        # 5. CREATE DAILY REPORT
        # --------------------------------------------------

        daily_report = DailyReport(
            id=report_id,
            project_id=project_id,
            supervisor_id=supervisor_id,
            report_date=datetime.now().date().isoformat(),
            submitted_at=created_at,
            source="FILE",
            raw_content=extracted_text,
            file_name=file.filename
        )

        db.add(daily_report)


        # --------------------------------------------------
        # 6. CREATE REPORT ENTRY
        # --------------------------------------------------

        report_entry = ReportEntry(
            id=report_entry_id,
            report_id=report_id,
            extracted_text=extracted_text,
            status="PROCESSED"
        )

        db.add(report_entry)


        # --------------------------------------------------
        # 7. SAVE AI MATCH RESULTS
        # --------------------------------------------------

        saved_results = []

        for activity in result.get("activities", []):

            matched_activity_id = activity.get(
                "matched_activity_id"
            )

            # Determine current AI band
            if matched_activity_id == "UNMATCHED_NEW_ACTIVITY":
                band = "UNMATCHED"
            else:
                band = "REVIEW"


            ai_result = AiMatchResult(

                id=str(uuid.uuid4()),

                report_entry_id=report_entry_id,

                report_id=report_id,

                project_id=project_id,

                extracted_activity=activity.get(
                    "activity_description",
                    ""
                ),

                matched_activity_id=matched_activity_id,

                matched_activity_name=activity.get(
                    "matched_activity_name"
                ),

                status=activity.get(
                    "status"
                ),

                actual_start=activity.get(
                    "actual_start"
                ),

                actual_end=activity.get(
                    "actual_end"
                ),

                delay_reason=activity.get(
                    "delay_reason"
                ),

                delay_text=activity.get(
                    "evidence"
                ),

                confidence=activity.get(
                    "confidence"
                ),

                band=band,

                keywords=json.dumps(
                    activity.get("keywords", [])
                ),

                candidates=json.dumps(
                    activity.get("candidates", [])
                ),

                source="FILE",

                created_at=created_at,

                decision="PENDING"
            )

            db.add(ai_result)

            saved_results.append(ai_result.id)


        # --------------------------------------------------
        # 8. COMMIT DATABASE
        # --------------------------------------------------

        db.commit()


        # --------------------------------------------------
        # 9. RETURN RESPONSE
        # --------------------------------------------------

        return {
            "filename": file.filename,
            "source": "DOCX",

            "report_id": report_id,

            "report_entry_id": report_entry_id,

            "extracted_text": extracted_text,

            "ai_result": result,

            "database": {
                "saved": True,
                "records_saved": len(saved_results),
                "ai_result_ids": saved_results
            }
        }


    except HTTPException:
        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"AI pipeline/database failed: {str(e)}"
        )

    finally:

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# --------------------------------------------------
# VOICE UPLOAD + AI PROCESSING + DATABASE
# --------------------------------------------------

@router.post("/upload-voice")
async def upload_voice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    allowed_extensions = (
        ".mp3",
        ".wav",
        ".m4a",
        ".mp4",
        ".webm",
        ".ogg"
    )

    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported audio format. "
                "Use MP3, WAV, M4A, MP4, WEBM or OGG."
            )
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded audio file is empty."
        )

    temp_path = None

    try:

        # --------------------------------------------------
        # 1. SAVE TEMPORARY AUDIO
        # --------------------------------------------------

        extension = os.path.splitext(
            file.filename
        )[1]

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:

            temp_file.write(file_bytes)
            temp_path = temp_file.name


        # --------------------------------------------------
        # 2. TRANSCRIBE VOICE
        # --------------------------------------------------

        transcribed_text = transcribe_audio(
            temp_path
        )

        if not transcribed_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No speech could be detected in audio."
            )


        # --------------------------------------------------
        # 3. RUN SAME AI/NLP PIPELINE
        # --------------------------------------------------

        result = run_pipeline(
            report_text=transcribed_text,
            input_source="VOICE"
        )


        # --------------------------------------------------
        # 4. GENERATE IDs
        # --------------------------------------------------

        report_id = str(uuid.uuid4())

        report_entry_id = str(uuid.uuid4())

        created_at = datetime.now().isoformat()

        project_id = "UNASSIGNED"

        supervisor_id = "AI-VOICE"


        # --------------------------------------------------
        # 5. CREATE DAILY REPORT
        # --------------------------------------------------

        daily_report = DailyReport(
            id=report_id,
            project_id=project_id,
            supervisor_id=supervisor_id,
            report_date=datetime.now().date().isoformat(),
            submitted_at=created_at,
            source="VOICE",
            raw_content=transcribed_text,
            file_name=file.filename
        )

        db.add(daily_report)


        # --------------------------------------------------
        # 6. CREATE REPORT ENTRY
        # --------------------------------------------------

        report_entry = ReportEntry(
            id=report_entry_id,
            report_id=report_id,
            extracted_text=transcribed_text,
            status="PROCESSED"
        )

        db.add(report_entry)


        # --------------------------------------------------
        # 7. SAVE AI RESULTS
        # --------------------------------------------------

        saved_results = []

        for activity in result.get("activities", []):

            matched_activity_id = activity.get(
                "matched_activity_id"
            )

            if matched_activity_id == "UNMATCHED_NEW_ACTIVITY":
                band = "UNMATCHED"
            else:
                band = "REVIEW"


            ai_result = AiMatchResult(

                id=str(uuid.uuid4()),

                report_entry_id=report_entry_id,

                report_id=report_id,

                project_id=project_id,

                extracted_activity=activity.get(
                    "activity_description",
                    ""
                ),

                matched_activity_id=matched_activity_id,

                matched_activity_name=activity.get(
                    "matched_activity_name"
                ),

                status=activity.get(
                    "status"
                ),

                actual_start=activity.get(
                    "actual_start"
                ),

                actual_end=activity.get(
                    "actual_end"
                ),

                delay_reason=activity.get(
                    "delay_reason"
                ),

                delay_text=activity.get(
                    "evidence"
                ),

                confidence=activity.get(
                    "confidence"
                ),

                band=band,

                keywords=json.dumps(
                    activity.get("keywords", [])
                ),

                candidates=json.dumps(
                    activity.get("candidates", [])
                ),

                source="VOICE",

                created_at=created_at,

                decision="PENDING"
            )

            db.add(ai_result)

            saved_results.append(ai_result.id)


        # --------------------------------------------------
        # 8. COMMIT
        # --------------------------------------------------

        db.commit()


        # --------------------------------------------------
        # 9. RETURN RESULT
        # --------------------------------------------------

        return {
            "filename": file.filename,
            "source": "VOICE",

            "report_id": report_id,

            "report_entry_id": report_entry_id,

            "transcribed_text": transcribed_text,

            "ai_result": result,

            "database": {
                "saved": True,
                "records_saved": len(saved_results),
                "ai_result_ids": saved_results
            }
        }


    except HTTPException:
        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Voice AI pipeline/database failed: {str(e)}"
        )

    finally:

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)