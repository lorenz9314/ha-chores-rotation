"""Read and update the chore configuration from the management panel."""

from copy import deepcopy

import probatio as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .scheduler import FREQUENCIES, default_schedule


@callback
def async_setup(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, get_configuration)
    websocket_api.async_register_command(hass, save_configuration)


def find_entry(hass):
    return next(iter(hass.config_entries.async_entries(DOMAIN)), None)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "chore_rotation/get"})
@websocket_api.async_response
async def get_configuration(hass, connection, msg):
    entry = find_entry(hass)
    if entry is None:
        connection.send_error(msg["id"], "not_configured", "Chore Rotation is not configured")
        return
    connection.send_result(msg["id"], {
        "people": deepcopy(entry.options["people"]),
        "chores": [
            {**deepcopy(task), "schedule": deepcopy(task.get("schedule") or default_schedule(task["frequency"]))}
            for task in entry.options["chores"]
        ],
    })


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): "chore_rotation/save",
    vol.Required("people"): list,
    vol.Required("chores"): list,
})
@websocket_api.async_response
async def save_configuration(hass, connection, msg):
    entry = find_entry(hass)
    if entry is None:
        connection.send_error(msg["id"], "not_configured", "Chore Rotation is not configured")
        return

    people = msg["people"]
    chores = msg["chores"]
    try:
        if not people or len({p["id"] for p in people}) != len(people):
            raise ValueError("At least one person with a unique ID is required")
        if any(not isinstance(p["name"], str) or not p["name"].strip() for p in people):
            raise ValueError("Every person needs a name")
        if len({p["name"].strip() for p in people}) != len(people):
            raise ValueError("Person names must be unique")
        ids = {p["id"] for p in people}
        if len({t["id"] for t in chores}) != len(chores):
            raise ValueError("Task IDs must be unique")
        for task in chores:
            if not isinstance(task["name"], str) or not task["name"].strip():
                raise ValueError("Every task needs a name")
            frequency = task["frequency"]
            if frequency not in FREQUENCIES:
                raise ValueError("Invalid task frequency")
            schedule = task["schedule"]
            if not isinstance(schedule, dict):
                raise ValueError("Invalid schedule")
            interval = schedule.get("interval")
            if type(interval) is not int or not 1 <= interval <= 120:
                raise ValueError("Schedule interval must be between 1 and 120")
            if frequency in ("weekly", "twice_weekly"):
                weekdays = schedule.get("weekdays")
                if (not isinstance(weekdays, list) or not weekdays
                        or len(set(weekdays)) != len(weekdays)
                        or any(type(day) is not int or day not in range(7) for day in weekdays)):
                    raise ValueError("Select at least one valid weekday")
                if frequency == "twice_weekly" and len(weekdays) != 2:
                    raise ValueError("Twice-weekly tasks need two weekdays")
            if frequency in ("weekly", "twice_weekly", "monthly", "quarterly"):
                from datetime import date
                date.fromisoformat(schedule["anchor"])
            if frequency in ("monthly", "quarterly"):
                if type(schedule.get("day")) is not int or not 1 <= schedule["day"] <= 31:
                    raise ValueError("Monthly day must be between 1 and 31")
            cycle = task["cycle"]
            if not isinstance(cycle, list) or not cycle or any(pid not in ids for pid in cycle):
                raise ValueError("Each task requires a valid assignment cycle")
            if len(cycle) > 1000:
                raise ValueError("Assignment cycle is too long")
    except (KeyError, TypeError, ValueError) as exc:
        connection.send_error(msg["id"], "invalid_configuration", str(exc))
        return

    hass.config_entries.async_update_entry(
        entry, options={"people": deepcopy(people), "chores": deepcopy(chores)}
    )
    sensor = entry.runtime_data
    sensor.async_write_ha_state()
    connection.send_result(msg["id"], {"saved": True})
