from app.intelligence.reallocation import suggest_reallocation


def test_no_absent_worker():
    """
    If no worker is absent, reallocation should not be required.
    """

    activity = {
        "activity_description": "Install pipeline",
        "discipline": "PIPING",
    }

    absent_workers = []

    available_workers = [
        {
            "id": "w1",
            "name": "Worker One",
            "discipline": "PIPING",
        }
    ]

    result = suggest_reallocation(
        activity,
        absent_workers,
        available_workers,
    )

    assert result["reallocation_required"] is False
    assert result["message"] == "No worker absence reported."


def test_matching_discipline():
    """
    A worker from the same discipline should be selected.
    """

    activity = {
        "activity_description": "Install pipeline",
        "discipline": "PIPING",
    }

    absent_workers = ["w1"]

    available_workers = [
        {
            "id": "w2",
            "name": "Electrical Worker",
            "discipline": "ELECTRICAL",
        },
        {
            "id": "w3",
            "name": "Piping Worker",
            "discipline": "PIPING",
        },
    ]

    result = suggest_reallocation(
        activity,
        absent_workers,
        available_workers,
    )

    assert result["reallocation_required"] is True
    assert result["suggested_worker"]["id"] == "w3"


def test_no_suitable_worker():
    """
    If no worker has the required discipline,
    no worker should be suggested.
    """

    activity = {
        "activity_description": "Install pipeline",
        "discipline": "PIPING",
    }

    absent_workers = ["w1"]

    available_workers = [
        {
            "id": "w2",
            "name": "Electrical Worker",
            "discipline": "ELECTRICAL",
        },
        {
            "id": "w3",
            "name": "Civil Worker",
            "discipline": "CIVIL",
        },
    ]

    result = suggest_reallocation(
        activity,
        absent_workers,
        available_workers,
    )

    assert result["reallocation_required"] is True
    assert result["suggested_worker"] is None
    assert "no suitable available worker" in result["reason"].lower()


def test_absent_worker_is_not_selected():
    """
    A worker listed as absent must not be selected,
    even if their discipline matches.
    """

    activity = {
        "activity_description": "Install pipeline",
        "discipline": "PIPING",
    }

    absent_workers = ["w2"]

    available_workers = [
        {
            "id": "w2",
            "name": "Absent Piping Worker",
            "discipline": "PIPING",
            "workload": 1,
        },
        {
            "id": "w3",
            "name": "Available Piping Worker",
            "discipline": "PIPING",
            "workload": 3,
        },
    ]

    result = suggest_reallocation(
        activity,
        absent_workers,
        available_workers,
    )

    assert result["suggested_worker"]["id"] == "w3"


def test_lowest_workload_worker_is_selected():
    """
    If multiple suitable workers are available,
    the worker with the lowest workload should be selected.
    """

    activity = {
        "activity_description": "Install pipeline",
        "discipline": "PIPING",
    }

    absent_workers = ["w1"]

    available_workers = [
        {
            "id": "w2",
            "name": "Piping Worker A",
            "discipline": "PIPING",
            "workload": 8,
            "availability": 80,
        },
        {
            "id": "w3",
            "name": "Piping Worker B",
            "discipline": "PIPING",
            "workload": 2,
            "availability": 60,
        },
    ]

    result = suggest_reallocation(
        activity,
        absent_workers,
        available_workers,
    )

    assert result["suggested_worker"]["id"] == "w3"


def test_higher_availability_when_workload_is_equal():
    """
    If workload is equal, the worker with higher availability
    should be selected.
    """

    activity = {
        "activity_description": "Install pipeline",
        "discipline": "PIPING",
    }

    absent_workers = ["w1"]

    available_workers = [
        {
            "id": "w2",
            "name": "Piping Worker A",
            "discipline": "PIPING",
            "workload": 3,
            "availability": 50,
        },
        {
            "id": "w3",
            "name": "Piping Worker B",
            "discipline": "PIPING",
            "workload": 3,
            "availability": 90,
        },
    ]

    result = suggest_reallocation(
        activity,
        absent_workers,
        available_workers,
    )

    assert result["suggested_worker"]["id"] == "w3"