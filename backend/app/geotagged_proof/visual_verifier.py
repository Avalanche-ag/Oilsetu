import os
import base64

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field


load_dotenv()

client = OpenAI(
    api_key=os.environ["GEMINI_API_KEY"],
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)


class VisualVerification(BaseModel):
    photo_verified: bool
    visual_match_confidence: float = Field(
        ge=0.0,
        le=1.0
    )
    reason: str


VISUAL_VERIFICATION_PROMPT = """
You are a STRICT construction activity verification classifier.

Compare the image ONLY with this reported activity:

Reported activity:
{activity_description}

Rules:
- Do not mark true merely because the image is a construction-site image.
- The image must visibly show the specific reported activity.
- If the image shows a different activity, return false.
- Do not infer hidden work.
- Do not assume that an activity happened.
- Scaffolding, workers, tools, rebar, or general construction surroundings
  alone are not sufficient evidence.
- Be conservative when the activity is unclear.

Examples:
- Shuttering/formwork image + "Erect Shuttering" = true
- Shuttering/formwork image + "Weld Joints" = false
- Shuttering/formwork image + "Backfill & Compaction" = false
- Shuttering/formwork image + "Erect Rebar" = false unless rebar installation
  is clearly the main visible activity
- Welding visibly taking place + "Weld Joints" = true

Return:
- photo_verified: true only if the specific activity is visibly supported
- visual_match_confidence: number between 0 and 1
- reason: short explanation

Do not use GPS or timestamp information.
Return only the required structured output.
"""


def verify_photo(activity_description, image_path):
    """
    Verify whether an image visually matches the reported construction activity.
    """

    if image_path.lower().endswith(".png"):
        mime_type = "image/png"
    elif image_path.lower().endswith(".webp"):
        mime_type = "image/webp"
    else:
        mime_type = "image/jpeg"

    with open(image_path, "rb") as image_file:
        image_bytes = image_file.read()

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = VISUAL_VERIFICATION_PROMPT.format(
        activity_description=activity_description
    )

    try:
        response = client.beta.chat.completions.parse(
            model="gemini-3.5-flash",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": (
                                    f"data:{mime_type};base64,"
                                    f"{image_base64}"
                                )
                            }
                        }
                    ]
                }
            ],
            response_format=VisualVerification,
            timeout=60
        )

        result = response.choices[0].message.parsed

        return result.model_dump()

    except Exception as e:
        print(f"Error during visual verification: {e}")

        return {
            "photo_verified": False,
            "visual_match_confidence": 0.0,
            "reason": f"Verification failed: {e}"
        }