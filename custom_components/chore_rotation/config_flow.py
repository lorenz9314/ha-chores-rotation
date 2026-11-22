"""Native HA forms for configuring people, tasks, ordering and assignment cycles."""

from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult, OptionsFlowWithReload
from homeassistant.core import callback

from .const import DOMAIN, DEFAULT_PEOPLE, DEFAULT_CHORES
from .scheduler import FREQUENCIES


class ChoreRotationConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> ConfigFlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(
                title="Chore Rotation", data={},
                options={"people": deepcopy(DEFAULT_PEOPLE), "chores": deepcopy(DEFAULT_CHORES)},
            )
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return ChoreRotationOptionsFlow()


class ChoreRotationOptionsFlow(OptionsFlowWithReload):
    """One mutation per configuration flow, persisted in config entry options."""

    def people(self):
        return deepcopy(self.config_entry.options.get("people", DEFAULT_PEOPLE))

    def chores(self):
        return deepcopy(self.config_entry.options.get("chores", DEFAULT_CHORES))

    def save(self, people=None, chores=None):
        return self.async_create_entry(data={
            "people": self.people() if people is None else people,
            "chores": self.chores() if chores is None else chores,
        })

    def person_choices(self):
        return {p["id"]: p["name"] for p in self.people()}

    def task_choices(self):
        return {t["id"]: f'{t["frequency"]}: {t["name"]}' for t in self.chores()}

    def parse_cycle(self, text):
        """Parse comma-separated names of people in their preferred order."""
        names = {p["name"]: p["id"] for p in self.people()}
        parts = [part.strip() for part in text.split(",")]
        if not parts or any(part not in names for part in parts):
            raise ValueError("invalid cycle")
        return [names[part] for part in parts]

    def cycle_text(self, cycle):
        names = {p["id"]: p["name"] for p in self.people()}
        return ", ".join(names[id_] for id_ in cycle)

    async def async_step_init(self, user_input=None):
        return self.async_show_menu(
            step_id="init",
            menu_options=["add_person", "rename_person", "delete_person", "add_task", "edit_task", "delete_task"],
        )

    async def async_step_add_person(self, user_input=None):
        errors = {}
        if user_input is not None:
            name = user_input["name"].strip()
            if not name or name in [p["name"] for p in self.people()]:
                errors["name"] = "invalid_name"
            else:
                people = self.people()
                people.append({"id": uuid4().hex, "name": name})
                return self.save(people=people)
        return self.async_show_form(step_id="add_person", data_schema=vol.Schema({vol.Required("name"): str}), errors=errors)

    async def async_step_rename_person(self, user_input=None):
        if not self.people():
            return self.async_abort(reason="empty")
        errors = {}
        if user_input is not None:
            name = user_input["name"].strip()
            if not name or any(p["name"] == name and p["id"] != user_input["person"] for p in self.people()):
                errors["name"] = "invalid_name"
            else:
                people = self.people()
                next(p for p in people if p["id"] == user_input["person"])["name"] = name
                return self.save(people=people)
        return self.async_show_form(step_id="rename_person", data_schema=vol.Schema({vol.Required("person"): vol.In(self.person_choices()), vol.Required("name"): str}), errors=errors)

    async def async_step_delete_person(self, user_input=None):
        errors = {}
        if user_input is not None:
            pid = user_input["person"]
            if any(pid in task["cycle"] for task in self.chores()):
                errors["person"] = "person_in_use"
            else:
                return self.save(people=[p for p in self.people() if p["id"] != pid])
        return self.async_show_form(step_id="delete_person", data_schema=vol.Schema({vol.Required("person"): vol.In(self.person_choices())}), errors=errors)

    async def async_step_add_task(self, user_input=None):
        errors = {}
        if user_input is not None:
            try:
                cycle = self.parse_cycle(user_input["cycle"])
            except ValueError:
                errors["cycle"] = "invalid_cycle"
            else:
                chores = self.chores()
                frequency = user_input["frequency"]
                group = [c for c in chores if c["frequency"] == frequency]
                index = min(user_input["position"] - 1, len(group))
                group.insert(index, {"id": uuid4().hex, "name": user_input["name"].strip(), "frequency": frequency, "cycle": cycle})
                remaining = [c for c in chores if c["frequency"] != frequency]
                return self.save(chores=self.merge_groups(remaining, frequency, group))
        return self.async_show_form(step_id="add_task", data_schema=vol.Schema({
            vol.Required("name"): str,
            vol.Required("frequency"): vol.In(FREQUENCIES),
            vol.Required("cycle", default=self.people()[0]["name"] if self.people() else ""): str,
            vol.Required("position", default=1): vol.All(vol.Coerce(int), vol.Range(min=1)),
        }), errors=errors)

    @staticmethod
    def merge_groups(chores, frequency, group):
        """Insert an ordered frequency group, maintaining the other groups."""
        result = []
        inserted = False
        for freq in FREQUENCIES:
            if freq == frequency:
                result.extend(group)
                inserted = True
            else:
                result.extend(t for t in chores if t["frequency"] == freq)
        return result

    async def async_step_edit_task(self, user_input=None):
        if not self.chores():
            return self.async_abort(reason="empty")
        return self.async_show_form(step_id="edit_task", data_schema=vol.Schema({vol.Required("task"): vol.In(self.task_choices())}), errors={}) if user_input is None else await self.async_step_edit_task_details(task_id=user_input["task"])

    async def async_step_edit_task_details(self, user_input=None, task_id=None):
        if task_id is not None:
            self._selected_task = task_id
        task = next(t for t in self.chores() if t["id"] == self._selected_task)
        errors = {}
        if user_input is not None:
            try:
                cycle = self.parse_cycle(user_input["cycle"])
            except ValueError:
                errors["cycle"] = "invalid_cycle"
            else:
                chores = [t for t in self.chores() if t["id"] != task["id"]]
                frequency = user_input["frequency"]
                group = [t for t in chores if t["frequency"] == frequency]
                updated = {"id": task["id"], "name": user_input["name"].strip(), "frequency": frequency, "cycle": cycle}
                group.insert(min(user_input["position"] - 1, len(group)), updated)
                return self.save(chores=self.merge_groups(chores, frequency, group))
        position = [t["id"] for t in self.chores() if t["frequency"] == task["frequency"]].index(task["id"]) + 1
        return self.async_show_form(step_id="edit_task_details", data_schema=vol.Schema({
            vol.Required("name", default=task["name"]): str,
            vol.Required("frequency", default=task["frequency"]): vol.In(FREQUENCIES),
            vol.Required("cycle", default=self.cycle_text(task["cycle"])): str,
            vol.Required("position", default=position): vol.All(vol.Coerce(int), vol.Range(min=1)),
        }), errors=errors)

    async def async_step_delete_task(self, user_input=None):
        if not self.chores():
            return self.async_abort(reason="empty")
        if user_input is not None:
            return self.save(chores=[t for t in self.chores() if t["id"] != user_input["task"]])
        return self.async_show_form(step_id="delete_task", data_schema=vol.Schema({vol.Required("task"): vol.In(self.task_choices())}))
