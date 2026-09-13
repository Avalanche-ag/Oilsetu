"""
Loads real project activities from the baseline schedule (01_baseline_schedule.xlsx)
and turns each row into the shape suggest_reallocation() expects for `activity`:

    {"activity_description": <Activity_Name>, "discipline": <Discipline>}

This replaces hand-typed activity dicts like {"activity_description": "Install
pipeline", "discipline": "PIPING"} with rows pulled straight from the project's
actual schedule data, so tests exercise real activity names/disciplines instead
of invented ones.

NOTE: This file only sources the ACTIVITY side of a reallocation call. The
baseline schedule has no worker/roster data (no worker id, discipline-per-worker,
workload, or availability, and no absence records) - nothing in the dataset
does. The worker roster used alongside this loader is a separate, clearly
synthetic fixture (tests/fixtures/worker_roster.csv) until a real worker
roster/absence source exists.
"""

from pathlib import Path
import pandas as pd


def load_activities_from_schedule(schedule_path):
    """
    Read the baseline schedule xlsx and return a list of activity dicts
    shaped for suggest_reallocation(), one per schedule row.

    Each dict also keeps the original Activity_ID and Schedule_Status so
    tests can pick specific real rows (e.g. the one that's actually
    In Progress) instead of guessing.
    """
    schedule_path = Path(schedule_path)
    df = pd.read_excel(schedule_path)

    required_cols = {"Activity_ID", "Activity_Name", "Discipline"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(
            f"Schedule file {schedule_path} is missing expected columns: {missing}"
        )

    activities = []
    for _, row in df.iterrows():
        activities.append(
            {
                "activity_id": row["Activity_ID"],
                "activity_description": row["Activity_Name"],
                "discipline": row["Discipline"],
                "status": row.get("Schedule_Status"),
                "percent_complete": row.get("Percent_Complete"),
            }
        )
    return activities


def get_activity_by_id(schedule_path, activity_id):
    """Convenience lookup for a single real activity by its Activity_ID."""
    for activity in load_activities_from_schedule(schedule_path):
        if activity["activity_id"] == activity_id:
            return activity
    raise KeyError(f"No activity with id {activity_id!r} in {schedule_path}")


def load_worker_roster(roster_path):
    """
    Load the worker roster fixture (tests/fixtures/worker_roster.csv).

    IMPORTANT: this roster is synthetic. None of the project's uploaded
    dataset files (baseline schedule, DPR text, piping log, extraction
    ground truth, terminology hints) contain any worker-level data - no
    worker IDs, no per-worker discipline, no workload/availability numbers,
    no absence records. This fixture only reuses discipline names and a
    couple of names that genuinely appear in the dataset (e.g. "K. Iyer",
    "M. Verma" from the piping log's Reported_By column) so it's at least
    consistent with the project - the workload/availability numbers
    themselves are made up and should be replaced once a real roster or
    absence-reporting source exists.
    """
    roster_path = Path(roster_path)
    df = pd.read_csv(roster_path)
    return df.to_dict(orient="records")
