"""Persisted chore occurrences with completion status."""

from datetime import date

from homeassistant.helpers.storage import Store

from .scheduler import occurrence_number


class ChoreBacklog:
    """Keep unfinished occurrences after their scheduled date has passed."""

    def __init__(self, hass, entry):
        self.entry = entry
        self.sensor = None
        self.store = Store(hass, 1, f"chore_rotation.{entry.entry_id}.backlog")
        self.pending = []
        self.completed = set()
        self.last_date = None

    async def load(self):
        data = await self.store.async_load() or {}
        self.pending = data.get("pending", [])
        self.completed = set(data.get("completed", []))
        self.last_date = data.get("last_date")

    async def refresh(self, today: date):
        today_str = today.isoformat()
        if self.last_date != today_str:
            # Past occurrences are never backfilled. Completion identifiers
            # from previous days no longer need to be retained.
            self.completed = set()
        names = {p["id"]: p["name"] for p in self.entry.options["people"]}
        existing = {item["id"] for item in self.pending}
        for chore in self.entry.options["chores"]:
            index = occurrence_number(today, chore)
            if index is None:
                continue
            key = f"{today_str}:{chore['id']}"
            if key in existing or key in self.completed:
                continue
            cycle = chore["cycle"]
            pid = cycle[index % len(cycle)]
            if chore.get("assignment_mode", "cycle") in ("weekday", "override"):
                pid = chore.get("weekday_assignments", {}).get(str(today.weekday()), pid)
            self.pending.append({
                "id": key, "task_id": chore["id"],
                "date": today_str, "name": chore["name"],
                "person_id": pid, "person": names[pid],
            })
        self.last_date = today_str
        await self.save()

    async def complete(self, occurrence_id: str):
        old_length = len(self.pending)
        self.pending = [item for item in self.pending if item["id"] != occurrence_id]
        if len(self.pending) == old_length:
            raise ValueError("Occurrence not found")
        if occurrence_id.startswith(f"{self.last_date}:"):
            self.completed.add(occurrence_id)
        await self.save()

    async def save(self):
        await self.store.async_save({
            "last_date": self.last_date,
            "pending": self.pending,
            "completed": sorted(self.completed),
        })

    def grouped(self):
        result = {p["name"]: [] for p in self.entry.options["people"]}
        for item in self.pending:
            result.setdefault(item["person"], []).append(item["name"])
        return result
