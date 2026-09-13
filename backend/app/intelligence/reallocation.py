def suggest_reallocation(activity, absent_workers, available_workers):
    """
    Suggest a suitable worker when a worker absence is reported.

    Selection priority:
    1. A worker must belong to the same discipline as the activity.
    2. A worker must not be absent.
    3. Select the worker with the lowest workload.
    4. If workload is equal, select the worker with higher availability.
    """

    activity_description = activity.get("activity_description", "")
    discipline = activity.get("discipline", "").strip().lower()

    # Case 1: No absence reported
    if not absent_workers:
        return {
            "reallocation_required": False,
            "message": "No worker absence reported.",
        }

    # Convert absent worker IDs/dictionaries into a set of IDs/names
    absent_worker_ids = set()

    for worker in absent_workers:
        if isinstance(worker, dict):
            worker_id = worker.get("id") or worker.get("worker_id")
            worker_name = worker.get("name") or worker.get("worker_name")

            if worker_id:
                absent_worker_ids.add(worker_id)

            if worker_name:
                absent_worker_ids.add(worker_name)

        else:
            absent_worker_ids.add(worker)

    suitable_workers = []

    for worker in available_workers:
        worker_discipline = worker.get("discipline", "").strip().lower()

        worker_id = worker.get("id") or worker.get("worker_id")
        worker_name = worker.get("name") or worker.get("worker_name")

        # Do not select a worker who is also absent
        if worker_id in absent_worker_ids or worker_name in absent_worker_ids:
            continue

        # Select only workers from the same discipline
        if worker_discipline != discipline:
            continue

        suitable_workers.append(worker)

    # Case 2: No suitable worker found
    if not suitable_workers:
        return {
            "reallocation_required": True,
            "activity": activity_description,
            "absent_workers": absent_workers,
            "suggested_worker": None,
            "reason": (
                "Worker absence detected, but no suitable available "
                "worker was found."
            ),
        }

    # Case 3: Select the best worker
    #
    # Lower workload is better.
    # Higher availability is better.
    suggested_worker = min(
        suitable_workers,
        key=lambda worker: (
            worker.get("workload", 0),
            -worker.get("availability", 100),
            worker.get("id", worker.get("worker_id", "")),
        ),
    )

    return {
        "reallocation_required": True,
        "activity": activity_description,
        "absent_workers": absent_workers,
        "suggested_worker": suggested_worker,
        "reason": (
            "Worker absence detected. Suitable available worker found."
        ),
    }