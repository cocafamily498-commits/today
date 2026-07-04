async function buildEventPushReminderPayloads() {
  const events = await window.LichVietData.getAllEvents();
  return buildEventPushReminderPayloadsForEvents(events);
}

async function buildEventPushReminderPayloadsForEvents(events) {
  const now = Date.now();
  const reminders = [];

  for (const event of events) {
    const occurrenceDates = getUpcomingEventOccurrenceDates(event, EVENT_PUSH_REMINDER_DAYS_AHEAD);
    for (const occurrenceDate of occurrenceDates) {
      const eventReminders = Array.isArray(event.reminders) ? event.reminders : [];
      for (const reminder of eventReminders) {
        if (!reminder || reminder.enabled === false) continue;

        const reminderAt = getEventPushReminderDateTime(event, occurrenceDate, reminder);
        if (!reminderAt) continue;

        const reminderId = reminder.id || "default";
        const dismissed = await window.LichVietData.isReminderOccurrenceDismissed(event.id, reminderId, occurrenceDate);
        if (dismissed) continue;

        const occurrenceAt = getEventOccurrenceDateTimeInVietnamTimeZone(event, occurrenceDate);
        const activeReminderAt = getActiveEventPushReminderTime(event.id, reminderId, occurrenceDate, reminderAt, occurrenceAt, now);
        if (!activeReminderAt || activeReminderAt.getTime() < now - EVENT_SYSTEM_REMINDER_CHECK_INTERVAL) continue;

        const id = `${event.id}:${reminderId}:${occurrenceDate}`;
        reminders.push(buildEventPushReminderPayload(event, occurrenceDate, activeReminderAt, id));
      }
    }
  }

  return reminders
    .sort((left, right) => Date.parse(left.reminderAt) - Date.parse(right.reminderAt))
    .slice(0, 200);
}

function buildEventPushReminderPayload(event, occurrenceDate, reminderAt, id) {
  const occurrenceAt = getEventOccurrenceDateTimeInVietnamTimeZone(event, occurrenceDate);
  return {
    id,
    reminderAt: reminderAt.toISOString(),
    title: event && event.title ? `Sắp đến: ${event.title}` : "Sắp đến sự kiện",
    body: getEventPushReminderBody(occurrenceAt, reminderAt),
    tag: `lichviet-event-${event.id}-${occurrenceDate}`,
    url: `${window.location.origin}${window.location.pathname}#eventsTab`,
    icon: "/icons/app-icon-lichviet-calendar-192.png",
    badge: "/icons/app-icon-lichviet-calendar-192.png",
    eventId: event.id,
    occurrenceDate,
    occurrenceAt: occurrenceAt.toISOString()
  };
}

function getEventPushReminderBody(occurrenceAt, reminderAt) {
  const timeText = formatEventReminderTimeText(occurrenceAt);
  const dateText = toDateInputValue(reminderAt) === toDateInputValue(occurrenceAt)
    ? "hôm nay"
    : `ngày ${formatEventDate(toDateInputValue(occurrenceAt))}`;
  const remainingMs = occurrenceAt.getTime() - reminderAt.getTime();
  const oneHour = 60 * 60 * 1000;
  const actionText = remainingMs > oneHour
    ? "Chạm để xử lý nhắc lại."
    : "Chạm để mở nhắc sự kiện.";
  return `Diễn ra lúc ${timeText} ${dateText}. ${actionText}`;
}

function getActiveEventPushReminderTime(eventId, reminderId, occurrenceDate, configuredReminderAt, occurrenceAt, nowMs = Date.now()) {
  const snoozedUntil = typeof getEventReminderSnoozedUntil === "function"
    ? getEventReminderSnoozedUntil(eventId, reminderId, occurrenceDate)
    : null;
  if (snoozedUntil && snoozedUntil.getTime() > nowMs) return snoozedUntil;
  if (configuredReminderAt.getTime() >= nowMs - EVENT_SYSTEM_REMINDER_CHECK_INTERVAL) return configuredReminderAt;
  return getNextEventAutoReminderTime(new Date(nowMs), occurrenceAt);
}

function getNextEventAutoReminderTime(now, occurrenceAt) {
  const remainingMs = occurrenceAt.getTime() - now.getTime();
  const oneHour = 60 * 60 * 1000;
  const twoHours = 2 * oneHour;
  const oneDay = 24 * oneHour;
  const twoDays = 2 * oneDay;

  if (remainingMs <= oneHour) return null;
  if (remainingMs <= twoHours) return new Date(occurrenceAt.getTime() - oneHour);
  if (remainingMs <= oneDay) {
    return new Date(Math.min(now.getTime() + twoHours, occurrenceAt.getTime() - oneHour));
  }
  if (remainingMs <= twoDays) return new Date(occurrenceAt.getTime() - oneDay);
  return new Date(now.getTime() + oneDay);
}

function getUpcomingEventOccurrenceDates(event, daysAhead) {
  if (!event || !event.date) return [];
  const dates = [];
  const today = getVietnamToday();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const date = new Date(start + offset * 24 * 60 * 60 * 1000);
    const dateValue = toDateInputValue(date);
    if (isEventOccurrenceOnDate(event, dateValue)) dates.push(dateValue);
  }

  return dates;
}

function isEventOccurrenceOnDate(event, dateValue) {
  const base = parseDateValue(event.date);
  const target = parseDateValue(dateValue);
  if (!base || !target) return false;
  if (getDaysFromDateValue(base, dateValue) < 0) return false;

  const repeat = event.repeat || { frequency: "none", calendar: event.calendarLabel || "solar", interval: 1 };
  const interval = Math.max(1, Number.parseInt(repeat.interval, 10) || 1);

  if (repeat.frequency === "none") return event.date === dateValue;
  if (repeat.frequency === "daily") return getDaysFromDateValue(base, dateValue) % interval === 0;
  if (repeat.frequency === "weekly") return getDaysFromDateValue(base, dateValue) % (7 * interval) === 0;
  if (repeat.frequency === "monthly") {
    const months = (target.year - base.year) * 12 + target.month - base.month;
    return months >= 0 && months % interval === 0 && target.day === Math.min(base.day, getDaysInMonth(target.year, target.month));
  }
  if (repeat.frequency === "yearly" && repeat.calendar === "lunar") {
    const occurrence = getEventOccurrenceDateForMonth(event, target.year, target.month);
    return occurrence === dateValue;
  }
  if (repeat.frequency === "yearly") {
    return target.month === base.month && target.day === Math.min(base.day, getDaysInMonth(target.year, base.month));
  }

  return false;
}

function getEventPushReminderDateTime(event, occurrenceDate, reminder) {
  const occurrence = getEventOccurrenceDateTimeInVietnamTimeZone(event, occurrenceDate);
  if (!occurrence) return null;
  occurrence.setDate(occurrence.getDate() - (Number(reminder.beforeDays) || 0));
  occurrence.setHours(occurrence.getHours() - (Number(reminder.beforeHours) || 0));
  return occurrence;
}

function getEventOccurrenceDateTimeInVietnamTimeZone(event, occurrenceDate) {
  const [hour, minute] = getPushEventTimeParts(event && event.time);
  return getDateTimeInVietnamTimeZone(occurrenceDate, hour, minute);
}

function getDateTimeInVietnamTimeZone(dateValue, hour, minute) {
  const date = parseDateValue(dateValue);
  if (!date) return null;
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hour - TIME_ZONE, minute, 0, 0));
}

function getPushEventTimeParts(timeValue) {
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue || "");
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2])];
}

function formatEventReminderTimeText(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
