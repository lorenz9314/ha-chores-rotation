import importlib.util
from pathlib import Path
from datetime import date, timedelta

root = Path(__file__).resolve().parents[1] / 'custom_components' / 'chore_rotation' / 'scheduler.py'
spec = importlib.util.spec_from_file_location('scheduler', root)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_daily_ratio_and_weekly_alternation():
    people = [{'id': 'a', 'name': 'A'}, {'id': 'b', 'name': 'B'}]
    tasks = [
        {'id':'c','name':'cook','frequency':'daily','cycle':['a']*6+['b']},
        {'id':'w','name':'bath','frequency':'weekly','cycle':['a','b']},
    ]
    for week in range(4):
        for offset in range(7):
            day = date(2026, 11, 16) + timedelta(days=7*week+offset)
            output = module.assignments(day,people,tasks)
            assert ('cook' in output['B']) == (offset == 6)
        week_days = [module.assignments(date(2026, 11, 16)+timedelta(days=7*week+d),people,tasks) for d in range(7)]
        assert sum('bath' in values['A'] for values in week_days) == (1 if week % 2 == 0 else 0)
        assert sum('bath' in values['B'] for values in week_days) == (1 if week % 2 == 1 else 0)


def test_frequency_counts_and_restart_determinism():
    people = [{'id': 'a', 'name': 'A'}]
    tasks = [{'id': freq, 'name':freq, 'frequency':freq, 'cycle':['a']} for freq in module.FREQUENCIES]
    start = date(2026, 11, 16)
    week = [module.assignments(start+timedelta(days=i),people,tasks)['A'] for i in range(7)]
    assert sum(day.count('daily') for day in week) == 7
    assert sum(day.count('twice_weekly') for day in week) == 2
    assert sum(day.count('weekly') for day in week) == 1
    assert module.assignments(start,people,tasks) == module.assignments(start,people,tasks)
    november = [module.assignments(date(2026,11,i),people,tasks)['A'] for i in range(1,31)]
    assert sum(day.count('monthly') for day in november) == 1
    quarter = [module.assignments(date(2026,m,i),people,tasks)['A'] for m in (10,11,12) for i in range(1, __import__('calendar').monthrange(2026,m)[1]+1)]
    assert sum(day.count('quarterly') for day in quarter) == 1
