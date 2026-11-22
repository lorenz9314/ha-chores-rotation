"""Read and update the chore configuration from the management panel."""

from copy import deepcopy

import probatio as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .scheduler import FREQUENCIES


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
        "chores": deepcopy(entry.options["chores"]),
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
            if task["frequency"] not in FREQUENCIES:
                raise ValueError("Invalid task frequency")
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
