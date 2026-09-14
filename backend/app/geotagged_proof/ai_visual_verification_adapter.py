from pathlib import Path

from .visual_verifier import verify_photo


if __name__ == "__main__":

    print("AI Visual Verification Test")
    print("===========================\n")

    image = input("Enter image path: ").strip()
    activity = input("Enter the task to compare the image with: ").strip()

    image_path = Path(image)

    if not image_path.exists():
        print("\nERROR: Image file not found.")
        print("Checked path:", image_path)
        raise SystemExit(1)

    result = verify_photo(
        activity,
        str(image_path)
    )

    print("\nVISUAL VERIFICATION RESULT")
    print("==========================")
    print(result)