(function () {
  "use strict";

  const parts = window.LichVietDataParts;
  const {
    EVENT_TYPES, CALENDARS, REPEAT_FREQUENCIES, DEFAULT_REMINDER_TIME,
    withStore, requestToPromise, generateId, nowIso, assertDate, getMonthFromDate, getAllFromIndex
  } = parts;

  function normalizeCalendar(value, fallback = "solar") {
    return CALENDARS.has(value) ? value : fallback;
  }
  
  function normalizeEventType(value) {
    return EVENT_TYPES.has(value) ? value : "other";
  }
  
  function normalizeRepeat(input, eventType, calendarLabel) {
    const source = input || {};
    const defaultCalendar = eventType === "birthday" ? "solar" : calendarLabel;
    let frequency = REPEAT_FREQUENCIES.has(source.frequency) ? source.frequency : "none";
    let calendar = normalizeCalendar(source.calendar, defaultCalendar);
  
    if (eventType === "birthday") {
      frequency = "yearly";
      calendar = "solar";
    } else if (eventType === "deathAnniversary") {
      frequency = "yearly";
      calendar = "lunar";
    }
  
    return {
      frequency,
      calendar,
      interval: Math.max(1, Number.parseInt(source.interval, 10) || 1),
      until: source.until || null
    };
  }
  
  function normalizeReminder(reminder, eventType) {
    const source = reminder || {};
    const beforeDays = Math.max(0, Number.parseInt(source.beforeDays, 10) || 0);
    const beforeHours = Math.max(0, Number.parseInt(source.beforeHours, 10) || 0);
    const time = /^\d{2}:\d{2}$/.test(source.time || "") ? source.time : DEFAULT_REMINDER_TIME;
  
    return {
      id: source.id || generateId("reminder"),
      enabled: source.enabled !== false,
      beforeDays,
      beforeHours,
      time,
      allowSnooze: source.allowSnooze !== false,
      defaultSnoozeMinutes: Math.max(1, Number.parseInt(source.defaultSnoozeMinutes, 10) || 10)
    };
  }
  
  function normalizeLunarSnapshot(lunar) {
    if (!lunar || typeof lunar !== "object") return null;
    const day = Number.parseInt(lunar.day, 10);
    const month = Number.parseInt(lunar.month, 10);
    if (!Number.isInteger(day) || day < 1 || day > 30) return null;
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  
    return {
      day,
      month,
      leap: lunar.leap === true
    };
  }
  
  function normalizeEvent(input, existingEvent) {
    const source = { ...(existingEvent || {}), ...(input || {}) };
    assertDate(source.date);
  
    const eventType = normalizeEventType(source.eventType);
    const eventTypeId = String(source.eventTypeId || "general");
    const defaultCalendarLabel = eventType === "birthday"
      ? "solar"
      : eventType === "deathAnniversary"
        ? "lunar"
        : "solar";
    const calendarLabel = eventType === "birthday"
      ? "solar"
      : eventType === "deathAnniversary"
        ? "lunar"
        : normalizeCalendar(source.calendarLabel, defaultCalendarLabel);
    const repeat = normalizeRepeat(source.repeat, eventType, calendarLabel);
    const needsLunarSnapshot = calendarLabel === "lunar" || repeat.calendar === "lunar";
    const lunar = needsLunarSnapshot ? normalizeLunarSnapshot(source.lunar) : null;
    const reminders = Array.isArray(source.reminders)
      ? source.reminders.map((reminder) => normalizeReminder(reminder, eventType))
      : [];
    const createdAt = existingEvent && existingEvent.createdAt ? existingEvent.createdAt : source.createdAt || nowIso();
  
    return {
      id: source.id || generateId("event"),
      date: source.date,
      month: getMonthFromDate(source.date),
      title: String(source.title || "").trim(),
      note: String(source.note || ""),
      eventType,
      eventTypeId,
      calendarLabel,
      lunar,
      time: source.time || null,
      allDay: source.allDay !== false,
      color: source.color || defaultEventColor(eventType),
      repeat,
      reminders,
      createdAt,
      updatedAt: nowIso()
    };
  }
  
  function defaultEventColor(eventType) {
    if (eventType === "birthday") return "blue";
    if (eventType === "deathAnniversary") return "purple";
    return "red";
  }
  
  async function createEvent(input) {
    const event = normalizeEvent(input);
    await withStore("events", "readwrite", (store) => store.put(event));
    clearEventsReadCache();
    return event;
  }
  
  async function updateEvent(id, changes) {
    const existingEvent = await getEvent(id);
    if (!existingEvent) throw new Error("Event not found.");
  
    const event = normalizeEvent({ ...changes, id }, existingEvent);
    await withStore("events", "readwrite", (store) => store.put(event));
    clearEventsReadCache();
    return event;
  }
  
  async function deleteEvent(id) {
    await withStore("events", "readwrite", (store) => store.delete(id));
    clearEventsReadCache();
  }
  
  async function getEvent(id) {
    return withStore("events", "readonly", (store) => requestToPromise(store.get(id)));
  }
  
  let eventsReadPromise = null;

  function clearEventsReadCache() {
    eventsReadPromise = null;
  }

  async function getAllEvents() {
    if (!eventsReadPromise) {
      eventsReadPromise = withStore("events", "readonly", (store) => requestToPromise(store.getAll()))
        .catch((error) => {
          eventsReadPromise = null;
          throw error;
        });
    }
    return eventsReadPromise;
  }
  
  async function getEventsByDate(date) {
    assertDate(date);
    return getAllFromIndex("events", "byDate", date);
  }
  
  async function getEventsByMonth(month) {
    if (!/^\d{4}-\d{2}$/.test(month || "")) {
      throw new Error("month must use YYYY-MM format.");
    }
    return getAllFromIndex("events", "byMonth", month);
  }
  

  Object.assign(parts, {
    createEvent, updateEvent, deleteEvent, getEvent, getAllEvents, getEventsByDate, getEventsByMonth,
    clearEventsReadCache
  });
})();
