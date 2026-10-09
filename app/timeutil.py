from datetime import datetime, timedelta, time, date
from zoneinfo import ZoneInfo

HK = ZoneInfo("Asia/Hong_Kong")


def now():
    return datetime.now(HK)


def parse(value):
    d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return d.replace(tzinfo=HK) if d.tzinfo is None else d.astimezone(HK)


def service_time(service_date, clock):
    h, m, s = map(int, clock.split(":"))
    if h < 0 or not 0 <= m < 60 or not 0 <= s < 60:
        raise ValueError("Invalid GTFS service time")
    return datetime.combine(date.fromisoformat(service_date), time(), HK) + timedelta(
        hours=h, minutes=m, seconds=s
    )


def calendar_active(calendar, day, exceptions=()):
    d = date.fromisoformat(day)
    for e in exceptions:
        if e["date"] == day:
            return e["exception_type"] == 1
    return calendar["start_date"] <= day <= calendar["end_date"] and bool(
        calendar["weekdays"][d.weekday()]
    )
