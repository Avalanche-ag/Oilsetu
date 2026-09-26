from faster_whisper import WhisperModel


model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)


def transcribe_audio(file_path):
    """
    Convert an audio file into text.

    Args:
        file_path: Path to the audio file.

    Returns:
        str: Transcribed text
    """

    segments, info = model.transcribe(file_path)

    text_parts = []

    for segment in segments:
        text_parts.append(segment.text.strip())

    return " ".join(text_parts)


if __name__ == "__main__":
    file_path = input("Enter audio file path: ").strip()

    text = transcribe_audio(file_path)

    print("\nTRANSCRIBED TEXT")
    print("================")
    print(text)