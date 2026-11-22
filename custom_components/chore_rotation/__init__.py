"""Chore Rotation integration."""

from datetime import datetime
from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_change

from .const import DOMAIN
from .websocket import async_setup as async_setup_websocket

PLATFORMS = ["sensor"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Register the management panel and the daily assignment sensor."""
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = True
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
            module_url=f"/{DOMAIN}_frontend/chore-rotation-panel.js",
            require_admin=True,
        )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    def update_at_midnight(now: datetime) -> None:
        entry.runtime_data.async_write_ha_state()

    entry.async_on_unload(
        async_track_time_change(hass, update_at_midnight, hour=0, minute=0, second=0)
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
