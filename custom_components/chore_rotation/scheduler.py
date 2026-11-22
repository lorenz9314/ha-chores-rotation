"""Pure, date-based household chore scheduling."""

from __future__ import annotations

from datetime import date, timedelta
from calendar import monthrange

REFERENCE_MONDAY = date(2026, 11, 16)

FREQUENCIES = ("daily", "twice_weekly", "weekly", "monthly", "quarterly")


def period(day: date, frequency: str) -> tuple[date, date, int, int]:
    """Return period start, exclusive end, zero-based period ID, and repeats."""
    if frequency == "daily":
        return day, day + timedelta(days=1), (day - REFERENCE_MONDAY).days, 1
    if frequency in ("weekly", "twice_weekly"):
        start = day - timedelta(days=day.weekday())
        return start, start + timedelta(days=7), (start - REFERENCE_MONDAY).days // 7, (2 if frequency == "twice_weekly" else 1)
    if frequency == "monthly":
        index = day.year * 12 + day.month - 1
        next_index = index + 1
        return date(day.year, day.month, 1), date(next_index // 12, next_index % 12 + 1, 1), index - (2026 * 12 + 10), 1
    if frequency == "quarterly":
        quarter = (day.month - 1) // 3
        index = day.year * 4 + quarter
        start = date(day.year, quarter * 3 + 1, 1)
        next_index = (index + 1) * 3
        end = date(next_index // 12, next_index % 12 + 1, 1)
        return start, end, index - (2026 * 4 + 3), 1
    raise ValueError(f"Unknown frequency: {frequency}")


def assignments(day: date, people: list[dict], chores: list[dict]) -> dict[str, list[str]]:
    """Return person-name to ordered list of tasks due on day.

    All task occurrences and assignment positions are derived from the date,
    not from previous executions. Each task has a stable ID and its own cycle.
    """
    result = {person["name"]: [] for person in people}
    names = {person["id"]: person["name"] for person in people}

    for frequency in FREQUENCIES:
        tasks = [task for task in chores if task["frequency"] == frequency]
        if not tasks:
            continue
        start, end, period_number, repetitions = period(day, frequency)
        days = (end - start).days
        index_of_day = (day - start).days
        total = len(tasks) * repetitions
        first = index_of_day * total // days
        last = (index_of_day + 1) * total // days

        for position in range(first, last):
            task = tasks[position % len(tasks)]
            occurrence = period_number * repetitions + position // len(tasks)
            cycle = task["cycle"]
            assignee = cycle[occurrence % len(cycle)]
            result[names[assignee]].append(task["name"])

    return result
