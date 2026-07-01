async function buildEventPushReminderPayloads() {
  const events = await window.LichVietData.getAllEvents();
  const now = Date.now();
  const reminders = [];

  for (const event of events) {
    const occurrenceDates = getUpcomingEventOccurrenceDates(event, EVENT_PUSH_REMINDER_DAYS_AHEAD);
    for (const occurrenceDate of occurrenceDates) {
      const eventReminders = Array.isArray(event.reminders) ? event.reminders : [];
      for (const reminder of eventReminders) {
        if (!reminder || reminder.enabled === false) continue;
        const reminderAt = getEventPushReminderDateTime(event, occurrenceDate, reminder);
        if (!reminderAt || reminderAt.getTime() < now - EVENT_SYSTEM_REMINDER_CHECK_INTERVAL) continue;
        const reminderId = reminder.id || "default";
        const id = `${event.id}:${reminderId}:${occurrenceDate}`;
        reminders.push({
          id,
          reminderAt: reminderAt.toISOString(),
          title: event && event.title ? `Nhắc sự kiện: ${event.title}` : "Nhắc sự kiện",
          body: [
            getEventReminderLeadText(event, occurrenceDate),
            getEventDateSummary(event, occurrenceDate)
          ].filter(Boolean).join("\n"),
          tag: `lichviet-event-${event.id}-${occurrenceDate}`,
          url: `${window.location.origin}${window.location.pathname}#eventsTab`,
          icon: "/icons/app-icon-lichviet-transparent-192.png",
          badge: "/icons/app-icon-lichviet-transparent-192.png",
          eventId: event.id,
          occurrenceDate
        });
      }
    }
  }

  return reminders
    .sort((left, right) => Date.parse(left.reminderAt) - Date.parse(right.reminderAt))
    .slice(0, 200);
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
  const [hour, minute] = getEventTimeParts(event && event.time);
  const occurrence = getDateTimeInVietnamTimeZone(occurrenceDate, hour, minute);
  if (!occurrence) return null;
  occurrence.setDate(occurrence.getDate() - (Number(reminder.beforeDays) || 0));
  occurrence.setHours(occurrence.getHours() - (Number(reminder.beforeHours) || 0));
  return occurrence;
}

function getDateTimeInVietnamTimeZone(dateValue, hour, minute) {
  const date = parseDateValue(dateValue);
  if (!date) return null;
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hour - TIME_ZONE, minute, 0, 0));
}
