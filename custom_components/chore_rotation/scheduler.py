"""Deterministic date-based recurring household chore assignments."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

REFERENCE_MONDAY = date(2026, 11, 16)
FREQUENCIES = ("daily", "twice_weekly", "weekly", "monthly", "quarterly")


def default_schedule(frequency: str) -> dict:
    """Fallback for tasks saved by versions before per-task scheduling."""
    if frequency == "daily":
        return {"interval": 1}
    if frequency == "twice_weekly":
        return {"interval": 1, "weekdays": [0, 3], "anchor": "2026-11-16"}
    if frequency == "weekly":
        return {"interval": 1, "weekdays": [0], "anchor": "2026-11-16"}
    if frequency == "monthly":
        return {"interval": 1, "day": 1, "anchor": "2026-11-01"}
    if frequency == "quarterly":
        return {"interval": 3, "day": 1, "anchor": "2026-10-01"}
    raise ValueError(f"Unknown frequency: {frequency}")


def occurrence_number(day: date, task: dict) -> int | None:
    """Return the zero-based recurrence index when due, otherwise None.

    Numbers are absolute relative to a stable anchor, even if HA was offline.
    The assignment cycle therefore never shifts after a restart.
    """
    frequency = task["frequency"]
    schedule = task.get("schedule") or default_schedule(frequency)
    interval = schedule.get("interval", 1)

    if frequency == "daily":
        elapsed = (day - REFERENCE_MONDAY).days
        return elapsed // interval if elapsed % interval == 0 else None

    anchor = date.fromisoformat(schedule["anchor"])
    if frequency in ("weekly", "twice_weekly"):
        anchor_monday = anchor - timedelta(days=anchor.weekday())
        monday = day - timedelta(days=day.weekday())
        weeks = (monday - anchor_monday).days // 7
        weekdays = sorted(schedule["weekdays"])
        if weeks % interval != 0 or day.weekday() not in weekdays:
            return None
        return (weeks // interval) * len(weekdays) + weekdays.index(day.weekday())

    if frequency in ("monthly", "quarterly"):
        months = (day.year - anchor.year) * 12 + day.month - anchor.month
        if months % interval != 0:
            return None
        # The 29th, 30th or 31st falls on the last day in shorter months.
        assigned_day = min(schedule["day"], monthrange(day.year, day.month)[1])
        return months // interval if day.day == assigned_day else None

    raise ValueError(f"Unknown frequency: {frequency}")


def assignments(day: date, people: list[dict], chores: list[dict]) -> dict[str, list[str]]:
    """Calculate today's tasks by person in configured task order."""
    result = {person["name"]: [] for person in people}
    names = {person["id"]: person["name"] for person in people}
    for task in chores:
        number = occurrence_number(day, task)
        if number is not None:
            cycle = task["cycle"]
            result[names[cycle[number % len(cycle)]]].append(task["name"])
    return result
