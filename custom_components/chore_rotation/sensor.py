"""Automation-readable outstanding chore assignments."""

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import DOMAIN, RUNTIME_KEY


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    sensor = ChoreRotationSensor(hass.data[RUNTIME_KEY][entry.entry_id], entry)
    entry.runtime_data = sensor
    async_add_entities([sensor])


class ChoreRotationSensor(SensorEntity):
    """Count of outstanding chores, grouped by person in attributes."""

    _attr_name = "Chore Rotation Today"
    _attr_icon = "mdi:clipboard-list"
    _attr_should_poll = False

    def __init__(self, backlog, entry: ConfigEntry) -> None:
        self.backlog = backlog
        self.entry = entry
        self._attr_unique_id = f"{entry.entry_id}_today"

    @property
    def native_value(self) -> int:
        return len(self.backlog.pending)

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "date": dt_util.now().date().isoformat(),
            "assignments": self.backlog.grouped(),
            "pending": list(self.backlog.pending),
        }
