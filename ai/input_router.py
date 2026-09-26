import json

from docx_processor import extract_docx_text
from voice_processor import transcribe_audio
from pipeline import run_pipeline


def process_input(input_type, file_path):
    """
    Process TXT, DOCX, or Voice input and send the
    extracted text to the common AI/NLP pipeline.
    """

    if input_type == "TXT":
        with open(file_path, "r", encoding="utf-8") as file:
            text = file.read()

        source = "TXT"

    elif input_type == "DOCX":
        text = extract_docx_text(file_path)

        source = "DOCX"

    elif input_type == "VOICE":
        text = transcribe_audio(file_path)

        source = "Voice"

    else:
        raise ValueError("Invalid input type. Use TXT, DOCX, or VOICE.")

    print("\nEXTRACTED / TRANSCRIBED TEXT")
    print("=" * 80)
    print(text)

    print("\nRunning AI/NLP pipeline...")
    result = run_pipeline(
        report_text=text,
        report_date="18-Jul-2026",
        input_source=source
    )

    return result


if __name__ == "__main__":

    print("Oilsetu Input Router")
    print("====================")
    print("1. TXT")
    print("2. DOCX")
    print("3. VOICE")

    choice = input("\nChoose input type: ").strip()

    if choice == "1":
        input_type = "TXT"
        file_path = input("Enter TXT file path: ").strip()

    elif choice == "2":
        input_type = "DOCX"
        file_path = input("Enter DOCX file path: ").strip()

    elif choice == "3":
        input_type = "VOICE"
        file_path = input("Enter audio file path: ").strip()

    else:
        print("Invalid choice.")
        exit()

    result = process_input(input_type, file_path)

    print("\nFINAL PIPELINE RESULT")
    print("=" * 80)
    print(json.dumps(result, indent=2))