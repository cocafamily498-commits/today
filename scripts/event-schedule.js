function getNextEventOccurrenceDate(event) {
  if (!event || !event.date) return "";
  const today = getVietnamToday();
  const base = parseDateValue(event.date);
  const from = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate()
  };
  const repeat = event.repeat || { frequency: "none", calendar: event.calendarLabel || "solar" };

  if (!base) return "";
  if (repeat.frequency === "none") return event.date;
  if (repeat.calendar !== "lunar" && isDateBefore(from, base)) return event.date;
  if (repeat.frequency === "daily") return formatDateValue(from.year, from.month, from.day);
  if (repeat.frequency === "weekly") return getNextWeeklyEventDate(base, from);
  if (repeat.frequency === "monthly") {
    return repeat.calendar === "lunar"
      ? getNextLunarMonthlyEventDate(event, base, from)
      : getNextMonthlyEventDate(base, from);
  }
  if (repeat.frequency === "yearly") {
    return repeat.calendar === "lunar"
      ? getNextLunarYearlyEventDate(event, from)
      : getNextSolarYearlyEventDate(base, from);
  }

  return event.date;
}

function getNextWeeklyEventDate(base, from) {
  const baseUtc = Date.UTC(base.year, base.month - 1, base.day);
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max(0, Math.ceil((fromUtc - baseUtc) / weekMs));
  return dateValueFromUtc(baseUtc + weeks * weekMs);
}

function getNextMonthlyEventDate(base, from) {
  let year = from.year;
  let month = from.month;
  let candidate = formatDateValue(year, month, Math.min(base.day, getDaysInMonth(year, month)));
  if (getDaysFromDateValue(from, candidate) >= 0) return candidate;

  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return formatDateValue(year, month, Math.min(base.day, getDaysInMonth(year, month)));
}

function getNextLunarMonthlyEventDate(event, base, from) {
  const repeat = event.repeat || {};
  const interval = Math.max(1, Number.parseInt(repeat.interval, 10) || 1);
  let year = from.year;
  let month = from.month;

  for (let offset = 0; offset < 240; offset += 1) {
    const candidates = getMonthlyLunarEventOccurrenceDatesForMonth(event, base, year, month, interval);
    const next = candidates.find((candidate) => getDaysFromDateValue(from, candidate) >= 0);
    if (next) return next;

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return "";
}

function getNextSolarYearlyEventDate(base, from) {
  let year = from.year;
  let day = Math.min(base.day, getDaysInMonth(year, base.month));
  let candidate = formatDateValue(year, base.month, day);
  if (getDaysFromDateValue(from, candidate) >= 0) return candidate;

  year += 1;
  day = Math.min(base.day, getDaysInMonth(year, base.month));
  return formatDateValue(year, base.month, day);
}

function getNextLunarYearlyEventDate(event, from) {
  const target = getEventLunarTarget(event);
  if (!target) return "";
  let year = from.year;
  let month = from.month;
  for (let offset = 0; offset < 120; offset += 1) {
    const candidate = getLunarEventOccurrenceDateForMonth({ ...event, lunar: target }, year, month);
    if (candidate && getDaysFromDateValue(from, candidate) >= 0) return candidate;

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return "";
}

function getEventLunarTarget(event) {
  const repeat = event.repeat || {};
  const usesLunarCalendar = event.calendarLabel === "lunar" || repeat.calendar === "lunar";
  if (!usesLunarCalendar) return null;

  if (event.lunar) {
    return {
      day: Number(event.lunar.day),
      month: Number(event.lunar.month),
      leap: false
    };
  }

  const base = parseDateValue(event.date);
  if (base) {
    const lunar = convertSolarToLunar(base.day, base.month, base.year, TIME_ZONE);
    return {
      day: lunar.day,
      month: lunar.month,
      leap: lunar.leap
    };
  }

  return null;
}

function getDaysFromToday(dateValue) {
  const today = getVietnamToday();
  return getDaysFromDateValue({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate()
  }, dateValue);
}

function getDaysFromDateValue(from, dateValue) {
  const target = parseDateValue(dateValue);
  if (!target) return 0;
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  return Math.round((targetUtc - fromUtc) / (24 * 60 * 60 * 1000));
}

function parseDateValue(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || "");
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function formatDateValue(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateValueFromUtc(timestamp) {
  const date = new Date(timestamp);
  return formatDateValue(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function isDateBefore(left, right) {
  return Date.UTC(left.year, left.month - 1, left.day) < Date.UTC(right.year, right.month - 1, right.day);
}

function getEventTypeLabel(type) {
  if (type === "birthday") return "Sinh nhật";
  if (type === "deathAnniversary") return "Đám giỗ";
  return "Sự kiện khác";
}

function getCalendarLabel(calendar) {
  return calendar === "lunar" ? "Âm lịch" : "Dương lịch";
}

function getRepeatLabel(frequency) {
  const labels = {
    none: "Không lặp",
    daily: "Hàng ngày",
    weekly: "Hàng tuần",
    monthly: "Hàng tháng",
    yearly: "Hàng năm"
  };
  return labels[frequency] || labels.none;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}
