"""Chore Rotation integration."""

from datetime import datetime
from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from .backlog import ChoreBacklog
from .const import DOMAIN, RUNTIME_KEY
from .websocket import async_setup as async_setup_websocket

PLATFORMS = ["sensor"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load outstanding chores and register management and sensor interfaces."""
    if RUNTIME_KEY not in hass.data:
        hass.data[RUNTIME_KEY] = {}
        async_setup_websocket(hass)
        await hass.http.async_register_static_paths([
            StaticPathConfig(
                f"/{DOMAIN}_frontend",
                str(Path(__file__).parent / "frontend"),
                cache_headers=False,
            )
        ])
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="chore-rotation-panel",
            frontend_url_path="chore-rotation",
            sidebar_title="Chore Rotation",
            sidebar_icon="mdi:clipboard-list",
            module_url=f"/{DOMAIN}_frontend/chore-rotation-panel.js?v=0.6.4",
            require_admin=False,
        )

    backlog = ChoreBacklog(hass, entry)
    await backlog.load()
    await backlog.refresh(dt_util.now().date())
    entry.runtime_data = backlog
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async def update_at_midnight(now: datetime) -> None:
        await backlog.refresh(dt_util.now().date())
        if backlog.sensor is not None:
            backlog.sensor.async_write_ha_state()

    entry.async_on_unload(
        async_track_time_change(hass, update_at_midnight, hour=0, minute=0, second=0)
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    return unloaded
