import os
import sys
import tempfile
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
AI_FOLDER = os.path.join(PROJECT_ROOT, "ai")

if AI_FOLDER not in sys.path:
    sys.path.insert(0, AI_FOLDER)

from docx_processor import extract_docx_text  # noqa: E402
from pipeline import run_pipeline  # noqa: E402
from voice_processor import transcribe_audio  # noqa: E402

router = APIRouter(prefix="/reports", tags=["Reports AI"])

AUDIO_EXTENSIONS = (
    ".mp3",
    ".wav",
    ".m4a",
    ".mp4",
    ".webm",
    ".ogg",
    ".oga",
    ".aac",
    ".aiff",
    ".flac",
)


def _run_pipeline(text: str, source: str) -> dict:
    try:
        return run_pipeline(
            report_text=text,
            report_date=datetime.now().strftime("%d-%b-%Y"),
            input_source=source,
        )
    except KeyError as exc:
        raise HTTPException(status_code=502, detail=f"Missing AI credential: {exc}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI pipeline failed: {exc}")


def _read_upload_suffix(upload: UploadFile, allowed: tuple) -> str:
    name = (upload.filename or "").lower()
    if not name or not name.endswith(allowed):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {upload.filename}")
    return name


@router.post("/upload-docx")
async def upload_docx(file: UploadFile = File(...)):
    _read_upload_suffix(file, (".docx",))

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded DOCX file is empty.")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
            temp_file.write(file_bytes)
            temp_path = temp_file.name

        extracted_text = extract_docx_text(temp_path)
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="No readable text found in DOCX file.")

        result = _run_pipeline(extracted_text, "DOCX")

        return {
            "filename": file.filename,
            "source": "DOCX",
            "extracted_text": extracted_text,
            "ai_result": result,
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/upload-txt")
async def upload_txt(file: UploadFile = File(...)):
    _read_upload_suffix(file, (".txt",))

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded TXT file is empty.")

    extracted_text = file_bytes.decode("utf-8-sig", errors="replace").strip()
    if not extracted_text:
        raise HTTPException(status_code=400, detail="No readable text found in TXT file.")

    result = _run_pipeline(extracted_text, "TXT")

    return {
        "filename": file.filename,
        "source": "TXT",
        "extracted_text": extracted_text,
        "ai_result": result,
    }


@router.post("/upload-voice")
async def upload_voice(file: UploadFile = File(...)):
    _read_upload_suffix(file, AUDIO_EXTENSIONS)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    suffix = os.path.splitext(file.filename or "clip.webm")[1] or ".webm"
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(file_bytes)
            temp_path = temp_file.name

        try:
            transcribed_text = transcribe_audio(temp_path)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Voice transcription failed: {exc}")

        if not transcribed_text.strip():
            raise HTTPException(status_code=400, detail="No speech could be detected in audio.")

        result = _run_pipeline(transcribed_text, "VOICE")

        return {
            "filename": file.filename,
            "source": "VOICE",
            "extracted_text": transcribed_text,
            "transcribed_text": transcribed_text,
            "ai_result": result,
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
