import json
import os
import subprocess
import sys

_WHISPER_WORKER = (
    "import json, os, sys; "
    "from faster_whisper import WhisperModel; "
    "model = WhisperModel(os.environ.get('WHISPER_MODEL', 'base'), device='cpu', compute_type='int8'); "
    "segments, _info = model.transcribe(sys.argv[1], language=(os.environ.get('WHISPER_LANGUAGE') or None)); "
    "print(json.dumps({'text': ' '.join(seg.text.strip() for seg in segments)}))"
)


def transcribe_audio(file_path):
    """
    Convert an audio file into text.

    Runs faster-whisper in a child process: loading its native libraries in the
    server process crashes the interpreter (torch/MKL thread conflict), which
    would kill the whole backend mid-request.

    Args:
        file_path: Path to the audio file.

    Returns:
        str: Transcribed text
    """
    timeout = int(os.environ.get("WHISPER_TIMEOUT", "300"))
    try:
        proc = subprocess.run(
            [sys.executable, "-c", _WHISPER_WORKER, file_path],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Voice transcription timed out after {timeout}s")
    if proc.returncode != 0:
        lines = (proc.stderr or "").strip().splitlines()
        tail = " ".join(lines[-3:]) if lines else "unknown error"
        raise RuntimeError(f"Voice transcription failed: {tail[:500]}")
    try:
        lines = (proc.stdout or "").strip().splitlines()
        return json.loads(lines[-1]).get("text", "")
    except (json.JSONDecodeError, IndexError):
        raise RuntimeError("Voice transcription returned unreadable output")


if __name__ == "__main__":
    file_path = input("Enter audio file path: ").strip()

    text = transcribe_audio(file_path)

    print("\nTRANSCRIBED TEXT")
    print("================")
    print(text)
