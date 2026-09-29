import os

_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(
            os.environ.get("WHISPER_MODEL", "base"),
            device="cpu",
            compute_type="int8",
        )
    return _model


def transcribe_audio(file_path):
    """
    Convert an audio file into text.

    Args:
        file_path: Path to the audio file.

    Returns:
        str: Transcribed text
    """

    model = _get_model()

    segments, info = model.transcribe(
        file_path,
        language=os.environ.get("WHISPER_LANGUAGE"),
    )

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
