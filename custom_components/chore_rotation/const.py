"""Constants and initial example chores."""

DOMAIN = "chore_rotation"
RUNTIME_KEY = f"{DOMAIN}_runtime"
DEFAULT_PEOPLE = [
    {"id": "a", "name": "Person A"},
    {"id": "b", "name": "Person B"},
]

_DEFAULT_TASKS = {
    "daily": ["Einkaufen", "Kochen", "Spülmaschine einräumen", "Spülmaschine ausräumen", "Tisch abwischen", "Küche saubermachen"],
    "twice_weekly": ["Wäsche waschen", "Müll rausbringen", "Einen Raum aufräumen", "Staubsaugen"],
    "weekly": ["Bad putzen", "Toilette putzen", "Bettwäsche wechseln", "Einen Schrank aufräumen", "Eine Kiste einräumen", "Blumen gießen"],
    "monthly": ["Ein Date planen"],
    "quarterly": ["Fenster putzen", "Kühlschrank reinigen"],
}
from .scheduler import default_schedule

DEFAULT_CHORES = [
    {
        "id": f"{frequency}_{index}",
        "name": name,
        "frequency": frequency,
        "schedule": default_schedule(frequency),
        "cycle": (["a", "a", "a", "a", "a", "a", "b"] if name == "Kochen" else ["a"] if name == "Wäsche waschen" else ["a", "b"]),
    }
    for frequency, names in _DEFAULT_TASKS.items()
    for index, name in enumerate(names)
]
