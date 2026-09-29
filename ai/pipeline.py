import os
import json

from openai import OpenAI
from pydantic import BaseModel
from typing import Optional, List

from proactive_intelligence import predict_risks
from prompt import PROMPT
from matcher import ScheduleMatcher
from normalizer import ActivityNormalizer, load_terminology


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BASELINE_SCHEDULE = os.path.join(
    PROJECT_ROOT,
    "data",
    "oilsetu_schedule.xlsx"
)

TERMINOLOGY_CSV = os.path.join(
    PROJECT_ROOT,
    "data",
    "05_terminology_synonym_hints.csv"
)

MATCH_THRESHOLD = 0.40


class Activity(BaseModel):
    activity_description: str
    discipline: str
    asset_id: Optional[str] = None
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None
    status: str
    percent_complete: Optional[float] = None
    delay_reason: Optional[str] = None
    source: str
    evidence: str = ""
    confidence: float


class ReportExtraction(BaseModel):
    activities: List[Activity]


def run_pipeline(
    report_text,
    report_date="18-Jul-2026",
    input_source="Daily Progress Report (DPR)"
):
    """
    Run the complete AI/NLP pipeline on already-extracted text.

    report_text can come from:
    - TXT
    - DOCX
    - Voice transcription
    - Any other text input

    Args:
        report_text: Text to process.
        report_date: Date associated with the report/update.
        input_source: Source of the input.

    Returns:
        dict: Final pipeline result.
    """

    print("Loading Activity Normalizer...")

    terminology = load_terminology(TERMINOLOGY_CSV)
    normalizer = ActivityNormalizer(terminology)

    print("Loading Schedule Matcher...")

    matcher = ScheduleMatcher(BASELINE_SCHEDULE)

    print("Preparing report text...")

    formatted_prompt = PROMPT.format(
        report_date=report_date,
        report_text=report_text
    )

    client = OpenAI(
        api_key=os.environ["GEMINI_API_KEY"],
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    print("Sending text to AI...")

    response = client.chat.completions.create(
        model=os.environ.get("GEMINI_MODEL", "gemini-3.6-flash"),
        messages=[
            {
                "role": "user",
                "content": formatted_prompt
            }
        ]
    )

    raw_output = response.choices[0].message.content

    print("Parsing AI response...")

    parsed_json = json.loads(raw_output)

    if isinstance(parsed_json, list):
        parsed_json = {
            "activities": parsed_json
        }

    for activity in parsed_json.get("activities", []):
        activity.setdefault("percent_complete", None)
        activity.setdefault("evidence", "")

    extracted_data = ReportExtraction.model_validate(parsed_json)

    final_output = []

    print("Running normalization and schedule matching...")

    for act in extracted_data.activities:

        # -------------------------
        # STEP 1: NORMALIZATION
        # -------------------------

        norm_result = normalizer.normalize_activity(
            act.activity_description
        )

        search_description = act.activity_description
        normalized_term_used = None

        if norm_result["confidence_tier"] in [
            "High",
            "Medium"
        ]:
            normalized_term_used = (
                norm_result["normalized_plan_term"]
            )

            search_description = (
                f"{act.activity_description} - "
                f"{normalized_term_used}"
            )

        # -------------------------
        # STEP 2: L5/L6 MATCHING
        # -------------------------

        match_result = matcher.match_activity(
            search_description,
            act.discipline
        )

        if (
            match_result is None
            or match_result["score"] < MATCH_THRESHOLD
        ):
            matched_id = "UNMATCHED_NEW_ACTIVITY"

            match_score = (
                None
                if match_result is None
                else match_result["score"]
            )

            near_match = (
                None
                if match_result is None
                else {
                    "activity_id": str(
                        match_result.get(
                            "matched_activity_id"
                        )
                    ),
                    "name": match_result.get(
                        "matched_activity_name"
                    ),
                    "score": match_result.get("score"),
                }
            )

        else:
            matched_id = str(
                match_result["matched_activity_id"]
            )

            match_score = match_result["score"]

            near_match = None

        # -------------------------
        # STEP 3: BUILD FINAL DATA
        # -------------------------

        combined_activity = act.model_dump()

        # The actual input source comes from the caller.
        combined_activity["source"] = input_source

        combined_activity[
            "normalized_term_applied"
        ] = normalized_term_used

        combined_activity[
            "matched_activity_id"
        ] = matched_id

        combined_activity[
            "matcher_score"
        ] = match_score

        combined_activity["near_match"] = near_match

        final_output.append(combined_activity)

    # -------------------------
    # STEP 4: RISK PREDICTION
    # -------------------------

    predicted_risks = predict_risks(
        final_output
    )

    pipeline_result = {
        "activities": final_output,
        "predicted_risks": predicted_risks
    }

    return pipeline_result

# --------------------------------------------------
# LOCAL DOCX TEST
# --------------------------------------------------

if __name__ == "__main__":

    from docx_processor import extract_docx_text

    docx_path = "sample.docx"

    print(f"Reading DOCX: {docx_path}")

    extracted_text = extract_docx_text(docx_path)

    print("\nEXTRACTED DOCX TEXT")
    print("=" * 80)
    print(extracted_text)

    result = run_pipeline(
        report_text=extracted_text,
        report_date="18-Jul-2026",
        input_source="DOCX"
    )

    output_json = json.dumps(
        result,
        indent=2
    )

    print("\n")
    print("=" * 80)
    print("FINAL PIPELINE RESULT")
    print("=" * 80)
    print(output_json)