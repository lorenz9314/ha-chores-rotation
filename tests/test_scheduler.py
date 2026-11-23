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


def test_every_second_monday_alternates_across_occurrences():
    people = [{'id': 'a', 'name': 'A'}, {'id': 'b', 'name': 'B'}]
    task = {'id': 'w', 'name': 'bath', 'frequency': 'weekly', 'cycle': ['a', 'b'],
            'schedule': {'interval': 2, 'weekdays': [0], 'anchor': '2026-11-16'}}
    start = date(2026, 11, 16)
    expected = [(0, 'A'), (14, 'B'), (28, 'A'), (42, 'B')]
    for offset in range(50):
        out = module.assignments(start + timedelta(days=offset), people, [task])
        assignees = [p for p, chores in out.items() if chores]
        match = [p for index, p in expected if index == offset]
        assert assignees == match


def test_monthly_day_and_month_interval_with_short_month_clamping():
    people = [{'id': 'a', 'name': 'A'}, {'id': 'b', 'name': 'B'}]
    task = {'id': 'm', 'name': 'clean', 'frequency': 'monthly', 'cycle': ['a', 'b'],
            'schedule': {'interval': 1, 'day': 31, 'anchor': '2026-11-01'}}
    expected = [(date(2026,11,30), 'A'), (date(2026,12,31), 'B'),
                (date(2027,1,31), 'A'), (date(2027,2,28), 'B')]
    for day, person in expected:
        assert module.assignments(day, people, [task])[person] == ['clean']
        assert not any(module.assignments(day - timedelta(days=1), people, [task]).values())
    task['schedule']['interval'] = 3
    assert module.assignments(date(2027,2,28), people, [task])['B'] == ['clean']
    assert not any(module.assignments(date(2026,12,31), people, [task]).values())


def test_selected_weekdays_and_stable_date_derived_output():
    people = [{'id': 'a', 'name': 'A'}]
    task = {'id': 'x', 'name': 'x', 'frequency': 'twice_weekly', 'cycle': ['a'],
            'schedule': {'interval': 1, 'weekdays': [0, 3], 'anchor': '2026-11-16'}}
    start = date(2026, 11, 16)
    assert [offset for offset in range(14) if module.assignments(start + timedelta(days=offset), people, [task])['A']] == [0, 3, 7, 10]
