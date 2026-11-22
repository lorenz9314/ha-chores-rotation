"""Chore Rotation integration."""

from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from .const import DOMAIN

PLATFORMS = ["sensor"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up the read-only schedule sensor and midnight refresh."""
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    def update_at_midnight(now: datetime) -> None:
        sensor = entry.runtime_data
        sensor.async_write_ha_state()

    entry.async_on_unload(
        async_track_time_change(hass, update_at_midnight, hour=0, minute=0, second=0)
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
