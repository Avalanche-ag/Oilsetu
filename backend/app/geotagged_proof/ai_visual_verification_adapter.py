from .visual_verifier import verify_photo


def run_visual_verification(
    activity_description,
    image_path
):
    """
    Adapter for the Gemini visual verification function.

    Visual verification only:
    - activity description
    - uploaded photo

    No GPS, location, EXIF, or timestamp verification.
    """

    return verify_photo(
        activity_description,
        image_path
    )