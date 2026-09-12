from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from ..database import get_connection

from .storage import save_uploaded_photo
from .metadata import extract_metadata
from .location import is_point_inside_boundary
from .timestamp import verify_photo_timestamp
from .verify import build_verification_result
from .ai_visual_verification_adapter import run_visual_verification


router = APIRouter(
    prefix="/visual-proof",
    tags=["Geotagged Visual Proof"]
)


@router.post("/upload")
async def upload_visual_proof(
    activity_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload a site photo for a reported activity.

    Steps:
    1. Receive activity ID and photo.
    2. Validate image type.
    3. Save uploaded photo.
    4. Extract GPS and timestamp metadata.
    5. Validate GPS against site boundary.
    6. Store visual proof information in database.
    """

    # ---------------------------------------------------------
    # 1. Validate uploaded file
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # 2. Save uploaded photo
    # ---------------------------------------------------------

    file_path = save_uploaded_photo(
        file,
        activity_id
    )

    # ---------------------------------------------------------
    # 3. Extract EXIF metadata
    # ---------------------------------------------------------

    metadata = extract_metadata(
        file_path
    )

    # ---------------------------------------------------------
    # 4. Verify photo location
    # ---------------------------------------------------------

    location_verified = is_point_inside_boundary(
        metadata["latitude"],
        metadata["longitude"]
    )

    # ---------------------------------------------------------
    # 5. Store visual proof in database
    # ---------------------------------------------------------

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            INSERT INTO visual_proofs (
                activity_id,
                photo_path,
                latitude,
                longitude,
                photo_timestamp,
                location_verified
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            activity_id,
            file_path,
            metadata["latitude"],
            metadata["longitude"],
            metadata["timestamp"],
            int(location_verified)
        ))

        connection.commit()

    finally:
        connection.close()

    # ---------------------------------------------------------
    # 6. Return upload result
    # ---------------------------------------------------------

    return {
        "activity_id": activity_id,
        "photo_path": file_path,
        "latitude": metadata["latitude"],
        "longitude": metadata["longitude"],
        "timestamp": metadata["timestamp"],
        "location_verified": location_verified,
        "metadata_available": (
            metadata["latitude"] is not None
            or metadata["longitude"] is not None
            or metadata["timestamp"] is not None
        )
    }


@router.post("/verify")
def verify_visual_proof(
    activity_id: str = Form(...),
    reported_start: str = Form(...),
    reported_end: str = Form(...)
):
    """
    Perform complete visual proof verification.

    Activity description is fetched automatically
    from schedule_activities using activity_id.

    Backend verification:
    - Photo location
    - Photo timestamp

    AI verification:
    - Whether the photo visually matches the activity
    - Visual match confidence
    - Verification reason

    Final verification:
    - Combines location, timestamp and AI visual verification.
    """

    connection = get_connection()
    cursor = connection.cursor()

    try:

        # -----------------------------------------------------
        # 1. Get activity description from schedule database
        # -----------------------------------------------------

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

        # -----------------------------------------------------
        # 2. Get latest uploaded visual proof
        # -----------------------------------------------------

        cursor.execute("""
            SELECT
                id,
                location_verified,
                photo_path,
                latitude,
                longitude,
                photo_timestamp
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
        location_verified = bool(proof[1])
        photo_path = proof[2]
        photo_timestamp = proof[5]

        # -----------------------------------------------------
        # 3. Verify photo timestamp
        # -----------------------------------------------------

        timestamp_verified = verify_photo_timestamp(
            photo_timestamp=photo_timestamp,
            reported_start=reported_start,
            reported_end=reported_end
        )

        # -----------------------------------------------------
        # 4. Run AI visual verification
        # -----------------------------------------------------

        ai_result = run_visual_verification(
            activity_description=activity_description,
            image_path=photo_path
        )

        photo_verified = ai_result["photo_verified"]

        visual_match_confidence = ai_result[
            "visual_match_confidence"
        ]

        reason = ai_result["reason"]

        # -----------------------------------------------------
        # 5. Build final verification result
        # -----------------------------------------------------

        result = build_verification_result(
            activity_id=activity_id,
            location_verified=location_verified,
            timestamp_verified=timestamp_verified,
            visual_match_confidence=visual_match_confidence,
            photo_verified=photo_verified,
            reason=reason
        )

        # -----------------------------------------------------
        # 6. Save final verification result
        # -----------------------------------------------------

        cursor.execute("""
            UPDATE visual_proofs
            SET
                photo_verified = ?,
                timestamp_verified = ?,
                visual_match_confidence = ?,
                overall_confidence = ?,
                verification_status = ?,
                verification_reason = ?
            WHERE id = ?
        """, (
            int(result["photo_verified"]),
            int(result["timestamp_verified"]),
            result["visual_match_confidence"],
            result["overall_confidence"],
            result["status"],
            result["reason"],
            proof_id
        ))

        connection.commit()

        # -----------------------------------------------------
        # 7. Return final result
        # -----------------------------------------------------

        return result

    finally:
        connection.close()