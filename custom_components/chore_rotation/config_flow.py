"""Initial setup only; all chore management lives in the sidebar panel."""

from copy import deepcopy

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN, DEFAULT_PEOPLE, DEFAULT_CHORES


class ChoreRotationConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> ConfigFlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(
                title="Chore Rotation",
                data={},
                options={
                    "people": deepcopy(DEFAULT_PEOPLE),
                    "chores": deepcopy(DEFAULT_CHORES),
                },
            )
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
