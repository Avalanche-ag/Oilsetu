from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from ..database import get_connection

from .storage import save_uploaded_photo
from .verify import build_verification_result
from .ai_visual_verification_adapter import run_visual_verification


router = APIRouter(
    prefix="/visual-proof",
    tags=["Visual Proof"]
)


# =========================================================
# UPLOAD PHOTO
# =========================================================

@router.post("/upload")
async def upload_visual_proof(
    activity_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload a photo for an activity.

    This endpoint is visual-only.

    No GPS, EXIF location, site boundary,
    or timestamp verification is performed.
    """

    # -----------------------------------------------------
    # 1. Validate uploaded file
    # -----------------------------------------------------

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type"
        )

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed"
        )

    # -----------------------------------------------------
    # 2. Save uploaded photo
    # -----------------------------------------------------

    file_path = save_uploaded_photo(
        file,
        activity_id
    )

    # -----------------------------------------------------
    # 3. Store photo reference
    # -----------------------------------------------------

    connection = get_connection()
    cursor = connection.cursor()

    try:

        cursor.execute("""
            INSERT INTO visual_proofs (
                activity_id,
                photo_path
            )
            VALUES (?, ?)
        """, (
            activity_id,
            file_path
        ))

        connection.commit()

    finally:
        connection.close()

    # -----------------------------------------------------
    # 4. Return upload result
    # -----------------------------------------------------

    return {
        "activity_id": activity_id,
        "photo_path": file_path
    }


# =========================================================
# VISUAL VERIFICATION
# =========================================================

@router.post("/verify")
def verify_visual_proof(
    activity_id: str = Form(...)
):
    """
    Perform visual-only verification.

    Verification uses only:

    - Activity description
    - Uploaded photo
    - Gemini visual verification

    GPS, EXIF location, site boundary,
    and timestamp are NOT required.
    """

    connection = get_connection()
    cursor = connection.cursor()

    try:

        # -------------------------------------------------
        # 1. Get activity description
        # -------------------------------------------------

        cursor.execute("""
            SELECT activity_description
            FROM schedule_activities
            WHERE schedule_activity_id = ?
            LIMIT 1
        """, (activity_id,))

        activity = cursor.fetchone()

        if not activity:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No schedule activity found for "
                    f"activity_id: {activity_id}"
                )
            )

        activity_description = activity[0]

        # -------------------------------------------------
        # 2. Get latest uploaded photo
        # -------------------------------------------------

        cursor.execute("""
            SELECT
                id,
                photo_path
            FROM visual_proofs
            WHERE activity_id = ?
            ORDER BY id DESC
            LIMIT 1
        """, (activity_id,))

        proof = cursor.fetchone()

        if not proof:
            raise HTTPException(
                status_code=404,
                detail=(
                    "No uploaded visual proof found "
                    "for this activity."
                )
            )

        proof_id = proof[0]
        photo_path = proof[1]

        # -------------------------------------------------
        # 3. Run AI visual verification
        # -------------------------------------------------

        ai_result = run_visual_verification(
            activity_description=activity_description,
            image_path=photo_path
        )

        photo_verified = ai_result["photo_verified"]

        visual_match_confidence = ai_result[
            "visual_match_confidence"
        ]

        reason = ai_result["reason"]

        # -------------------------------------------------
        # 4. Build visual-only result
        # -------------------------------------------------

        result = build_verification_result(
            activity_id=activity_id,
            visual_match_confidence=visual_match_confidence,
            photo_verified=photo_verified,
            reason=reason
        )

        # -------------------------------------------------
        # 5. Save visual verification result
        # -------------------------------------------------

        cursor.execute("""
            UPDATE visual_proofs
            SET
                photo_verified = ?,
                visual_match_confidence = ?,
                verification_status = ?,
                verification_reason = ?
            WHERE id = ?
        """, (
            int(result["photo_verified"]),
            result["visual_match_confidence"],
            result["status"],
            result["reason"],
            proof_id
        ))

        connection.commit()

        # -------------------------------------------------
        # 6. Return final result
        # -------------------------------------------------

        return result

    finally:
        connection.close()