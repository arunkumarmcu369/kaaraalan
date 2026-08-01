from __future__ import annotations

from datetime import date, datetime, timedelta, timezone


def resolve_period_bounds(
    range_key: str = "7d",
    *,
    on_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[datetime, datetime, date, int]:
    """
    Return (start_dt, end_dt, first_day, num_days) for standardized report periods.

    Supported range_key values:
      today | yesterday | 7d | 30d | custom
    """
    today = datetime.now(timezone.utc).date()

    if range_key == "custom" or (date_from and date_to and range_key not in ("today", "yesterday", "7d", "30d")):
        if not date_from or not date_to:
            raise ValueError("Custom range requires date_from and date_to")
        if date_to < date_from:
            date_from, date_to = date_to, date_from
        start = datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = datetime.combine(date_to + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)
        num_days = (date_to - date_from).days + 1
        return start, end, date_from, num_days

    if on_date is not None:
        start = datetime.combine(on_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        return start, end, on_date, 1

    if range_key == "today":
        start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        return start, end, today, 1

    if range_key == "yesterday":
        day = today - timedelta(days=1)
        start = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        return start, end, day, 1

    days = 30 if range_key == "30d" else 7
    first = today - timedelta(days=days - 1)
    start = datetime.combine(first, datetime.min.time()).replace(tzinfo=timezone.utc)
    end = datetime.combine(today + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)
    return start, end, first, days


def period_label(
    range_key: str = "7d",
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> str:
    start, end, first, num_days = resolve_period_bounds(
        range_key, date_from=date_from, date_to=date_to
    )
    last = (end - timedelta(days=1)).date()
    if num_days == 1:
        return first.isoformat()
    return f"{first.isoformat()} to {last.isoformat()}"
