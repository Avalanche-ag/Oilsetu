def build_verification_result(
    activity_id,
    visual_match_confidence,
    photo_verified,
    reason
):
    """
    Build the final visual-only photo verification result.

    Verification is based only on AI visual verification.
    GPS/location and timestamp are not used.
    """

    if photo_verified:
        status = "Verified"
    else:
        status = "Not Verified"

    return {
        "activity_id": activity_id,
        "photo_verified": photo_verified,
        "visual_match_confidence": round(
            visual_match_confidence,
            2
        ),
        "status": status,
        "reason": reason
    }