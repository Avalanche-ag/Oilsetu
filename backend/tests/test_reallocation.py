from pathlib import Path

from app.intelligence.reallocation import suggest_reallocation
from app.intelligence.schedule_loader import (
    get_activity_by_id,
    load_activities_from_schedule,
    load_worker_roster,
)

DATA_DIR = Path(__file__).parent.parent / "data"
SCHEDULE_PATH = DATA_DIR / "01_baseline_schedule.xlsx"
ROSTER_PATH = Path(__file__).parent / "fixtures" / "worker_roster.csv"


def test_schedule_loads_expected_row_count():
    """
    Sanity check that the real schedule file is being read correctly
    before trusting any test built on top of it.
    """
    activities = load_activities_from_schedule(SCHEDULE_PATH)
    assert len(activities) == 17


def test_no_absent_worker():
    """
    Real activity (Weld Joints, Piping, still Not Started per the schedule).
    No absence reported -> no reallocation needed.
    """
    activity = get_activity_by_id(SCHEDULE_PATH, "PIP-3100-0130")
    workers = load_worker_roster(ROSTER_PATH)

    result = suggest_reallocation(activity, [], workers)

    assert result["reallocation_required"] is False
    assert result["message"] == "No worker absence reported."


def test_matching_discipline_civil_activity():
    """
    Real Civil activity (Erect Rebar & Shutter, currently 80% complete
    per the schedule). The absent Civil worker should be skipped and a
    Civil worker selected.
    """
    activity = get_activity_by_id(SCHEDULE_PATH, "CIV-2200-0030")
    workers = load_worker_roster(ROSTER_PATH)
    absent_workers = ["W-CIV-01"]

    result = suggest_reallocation(activity, absent_workers, workers)

    assert result["reallocation_required"] is True
    assert result["suggested_worker"]["discipline"] == "Civil"
    assert result["suggested_worker"]["id"] != "W-CIV-01"


def test_no_suitable_worker_for_hse_when_only_hse_worker_absent():
    """
    Real HSE activity (Toolbox Talk & Permit Issuance). The roster only
    has one HSE worker - if that worker is absent, no suitable worker
    should be suggested.
    """
    activity = get_activity_by_id(SCHEDULE_PATH, "HSE-7700-0010")
    workers = load_worker_roster(ROSTER_PATH)
    absent_workers = ["W-HSE-01"]

    result = suggest_reallocation(activity, absent_workers, workers)

    assert result["reallocation_required"] is True
    assert result["suggested_worker"] is None
    assert "no suitable available worker" in result["reason"].lower()


def test_lowest_workload_worker_selected_for_piping_activity():
    """
    Real Piping activity (Erect Line 24-PL-1004-CS1A Rack Section 3).
    Roster has 3 Piping workers; W-PIP-01 is absent, leaving W-PIP-02
    (workload 3, availability 85) and W-PIP-03 (workload 3, availability 95).
    Equal workload -> higher availability wins (W-PIP-03).
    """
    activity = get_activity_by_id(SCHEDULE_PATH, "PIP-3100-0120")
    workers = load_worker_roster(ROSTER_PATH)
    absent_workers = ["W-PIP-01"]

    result = suggest_reallocation(activity, absent_workers, workers)

    assert result["suggested_worker"]["id"] == "W-PIP-03"


def test_discipline_names_are_case_and_whitespace_insensitive():
    """
    The schedule stores disciplines like 'Civil', 'Piping', 'Electrical'
    (title case) while earlier hand-written tests used 'PIPING' (upper
    case). suggest_reallocation() must treat these as equivalent since
    both forms now genuinely occur across the codebase/tests.
    """
    activity = get_activity_by_id(SCHEDULE_PATH, "ELE-5500-0410")
    workers = load_worker_roster(ROSTER_PATH)

    result = suggest_reallocation(activity, ["someone_else"], workers)

    assert result["reallocation_required"] is True
    assert result["suggested_worker"]["discipline"] == "Electrical"
