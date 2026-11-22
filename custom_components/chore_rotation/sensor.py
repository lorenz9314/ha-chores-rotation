"""Daily, automation-readable person-to-task schedule."""

from datetime import date

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import DOMAIN, DEFAULT_CHORES, DEFAULT_PEOPLE
from .scheduler import assignments


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    sensor = ChoreRotationSensor(entry)
    entry.runtime_data = sensor
    async_add_entities([sensor])


class ChoreRotationSensor(SensorEntity):
    """Count of today's tasks, with mapping in attributes."""

    _attr_name = "Chore Rotation Today"
    _attr_icon = "mdi:clipboard-list"
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry) -> None:
        self.entry = entry
        self._attr_unique_id = f"{entry.entry_id}_today"

    @property
    def native_value(self) -> int:
        return sum(len(tasks) for tasks in self._today().values())

    @property
    def extra_state_attributes(self) -> dict:
        today = dt_util.now().date()
        return {"date": today.isoformat(), "assignments": self._today()}

    def _today(self) -> dict[str, list[str]]:
        options = self.entry.options
        return assignments(
            dt_util.now().date(),
            options.get("people", DEFAULT_PEOPLE),
            options.get("chores", DEFAULT_CHORES),
        )
