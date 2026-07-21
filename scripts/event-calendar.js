function setupEventCalendar() {
  const today = getVietnamToday();
  eventCalendarYear = today.getFullYear();
  eventCalendarMonth = today.getMonth() + 1;
  eventCalendarSelectedDay = today.getDate();

  document.getElementById("eventChoiceAddButton")?.addEventListener("click", () => {
    const date = getSelectedEventCalendarDate();
    resetEventForm(date);
    setEventFormStatus("Đang tạo sự kiện mới.");
    openEventDialog();
  });

  setupCalendarNavigation({
    ...EVENT_CALENDAR_NAVIGATION,
    getState: () => ({
      year: eventCalendarYear,
      month: eventCalendarMonth,
      day: eventCalendarSelectedDay
    }),
    setDate: setEventCalendarDate,
    render: renderEventCalendar
  });

  renderEventCalendar();
  loadEventCalendarOccurrences();
}

function setEventCalendarDate(year, month, day) {
  eventCalendarYear = year;
  eventCalendarMonth = month;
  eventCalendarSelectedDay = Math.min(Math.max(Number(day) || 1, 1), getDaysInMonth(year, month));
  renderEventCalendar();
  loadEventCalendarOccurrences();
}

async function loadEventCalendarOccurrences() {
  if (!window.LichVietData) return;
  const key = `${eventCalendarYear}-${String(eventCalendarMonth).padStart(2, "0")}`;
  eventCalendarKey = key;

  try {
    const events = await window.LichVietData.getAllEvents();
    if (eventCalendarKey !== key) return;
    eventCalendarOccurrences = buildEventCalendarOccurrences(events, eventCalendarYear, eventCalendarMonth);
    renderEventCalendar();
  } catch (error) {
    eventCalendarOccurrences = {};
  }
}

function updateEventCalendarOccurrence(event) {
  if (!event || !event.id) return;
  removeEventCalendarOccurrence(event.id);

  const occurrenceDates = getEventOccurrenceDatesForMonth(event, eventCalendarYear, eventCalendarMonth);
  if (occurrenceDates.length === 0) {
    renderEventCalendar();
    return;
  }

  occurrenceDates.forEach((occurrenceDate) => {
    const day = Number(occurrenceDate.slice(8, 10));
    if (!eventCalendarOccurrences[day]) eventCalendarOccurrences[day] = [];
    eventCalendarOccurrences[day].push({ ...event, occurrenceDate });
    eventCalendarOccurrences[day].sort(compareCalendarDayEvents);
  });
  renderEventCalendar();
}

function removeEventCalendarOccurrence(eventId) {
  if (!eventId) return;
  Object.keys(eventCalendarOccurrences).forEach((day) => {
    eventCalendarOccurrences[day] = (eventCalendarOccurrences[day] || [])
      .filter((event) => event.id !== eventId);
    if (eventCalendarOccurrences[day].length === 0) delete eventCalendarOccurrences[day];
  });
}

function buildEventCalendarOccurrences(events, year, month) {
  const occurrences = {};
  events.forEach((event) => {
    getEventOccurrenceDatesForMonth(event, year, month).forEach((occurrenceDate) => {
      const day = Number(occurrenceDate.slice(8, 10));
      if (!occurrences[day]) occurrences[day] = [];
      occurrences[day].push({ ...event, occurrenceDate });
    });
  });
  Object.keys(occurrences).forEach((day) => {
    occurrences[day].sort(compareCalendarDayEvents);
  });
  return occurrences;
}

function compareCalendarDayEvents(left, right) {
  const timeCompare = getSortableEventStartTime(left).localeCompare(getSortableEventStartTime(right));
  if (timeCompare !== 0) return timeCompare;

  const createdCompare = String(left && left.createdAt || "").localeCompare(String(right && right.createdAt || ""));
  if (createdCompare !== 0) return createdCompare;

  const titleCompare = String(left && left.title || "").localeCompare(String(right && right.title || ""), "vi");
  if (titleCompare !== 0) return titleCompare;

  return String(left && left.id || "").localeCompare(String(right && right.id || ""));
}

function getSortableEventStartTime(event) {
  const time = event && /^\d{2}:\d{2}$/.test(event.time || "") ? event.time : "";
  return time || "99:99";
}

function getEventOccurrenceDatesForMonth(event, year, month) {
  const base = parseDateValue(event && event.date);
  if (!base) return [];

  const repeat = event.repeat || { frequency: "none", calendar: event.calendarLabel || "solar", interval: 1 };
  const interval = Math.max(1, Number.parseInt(repeat.interval, 10) || 1);
  const daysInMonth = getDaysInMonth(year, month);

  if (repeat.frequency === "none") {
    return base.year === year && base.month === month ? [event.date] : [];
  }

  if (repeat.frequency === "daily") {
    return getDailyEventOccurrenceDatesForMonth(base, year, month, daysInMonth, interval);
  }

  if (repeat.frequency === "weekly") {
    return getWeeklyEventOccurrenceDatesForMonth(base, year, month, daysInMonth, interval);
  }

  if (repeat.frequency === "monthly" && repeat.calendar === "lunar") {
    return getMonthlyLunarEventOccurrenceDatesForMonth(event, base, year, month, interval);
  }

  const occurrenceDate = getEventOccurrenceDateForMonth(event, year, month);
  return occurrenceDate ? [occurrenceDate] : [];
}

function getDailyEventOccurrenceDatesForMonth(base, year, month, daysInMonth, interval) {
  const dates = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateValue = formatDateValue(year, month, day);
    const daysFromBase = getDaysFromDateValue(base, dateValue);
    if (daysFromBase >= 0 && daysFromBase % interval === 0) dates.push(dateValue);
  }
  return dates;
}

function getWeeklyEventOccurrenceDatesForMonth(base, year, month, daysInMonth, interval) {
  const dates = [];
  const repeatDays = 7 * interval;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateValue = formatDateValue(year, month, day);
    const daysFromBase = getDaysFromDateValue(base, dateValue);
    if (daysFromBase >= 0 && daysFromBase % repeatDays === 0) dates.push(dateValue);
  }
  return dates;
}

function getClampedMonthlyEventDate(baseDay, year, month) {
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(baseDay, getDaysInMonth(year, month))).padStart(2, "0")}`;
}

function getMonthlyLunarEventOccurrenceDatesForMonth(event, base, year, month, interval = 1) {
  const target = getEventLunarTarget(event);
  if (!target) return [];

  const baseLunar = convertSolarToLunar(base.day, base.month, base.year, TIME_ZONE);
  const dates = [];
  const daysInMonth = getDaysInMonth(year, month);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateValue = formatDateValue(year, month, day);
    if (getDaysFromDateValue(base, dateValue) < 0) continue;

    const lunar = convertSolarToLunar(day, month, year, TIME_ZONE);
    const monthsFromBase = (lunar.year - baseLunar.year) * 12 + lunar.month - baseLunar.month;
    if (monthsFromBase < 0 || monthsFromBase % interval !== 0) continue;
    if (lunar.leap !== target.leap) continue;
    if (isMonthlyLunarEventTargetDay(lunar, target, day, month, year)) dates.push(dateValue);
  }

  return dates;
}

function isMonthlyLunarEventTargetDay(lunar, target, solarDay, solarMonth, solarYear) {
  if (lunar.day === target.day) return true;
  return target.day === 30 && lunar.day === 29 && isLastDayOfLunarMonth(solarDay, solarMonth, solarYear, lunar);
}

function getEventOccurrenceDateForMonth(event, year, month) {
  const base = parseDateValue(event && event.date);
  if (!base) return null;
  const { year: baseYear, month: baseMonth, day: baseDay } = base;
  const repeat = event.repeat || { frequency: "none", calendar: event.calendarLabel || "solar" };

  if (repeat.frequency === "yearly") {
    if (year < baseYear || (year === baseYear && month < baseMonth)) return null;
    if (baseYear === year && baseMonth === month) return event.date;
    if (repeat.calendar === "lunar" && event.lunar) {
      const occurrenceDate = getLunarEventOccurrenceDateForMonth(event, year, month);
      return occurrenceDate && getDaysFromDateValue(base, occurrenceDate) >= 0 ? occurrenceDate : null;
    }
    if (baseMonth !== month) return null;
    return getClampedMonthlyEventDate(baseDay, year, month);
  }

  if (repeat.frequency === "monthly") {
    const interval = Math.max(1, Number.parseInt(repeat.interval, 10) || 1);
    if (repeat.calendar === "lunar") {
      const occurrenceDates = getMonthlyLunarEventOccurrenceDatesForMonth(event, base, year, month, interval);
      return occurrenceDates[0] || null;
    }
    const months = (year - baseYear) * 12 + month - baseMonth;
    if (months < 0 || months % interval !== 0) return null;
    return getClampedMonthlyEventDate(baseDay, year, month);
  }

  if (repeat.frequency === "none") {
    return baseYear === year && baseMonth === month ? event.date : null;
  }

  return baseYear === year && baseMonth === month ? event.date : null;
}

function getLunarEventOccurrenceDateForMonth(event, year, month) {
  const target = getEventLunarTarget(event) || event.lunar;
  if (!target) return null;
  const daysInMonth = getDaysInMonth(year, month);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const lunar = convertSolarToLunar(day, month, year, TIME_ZONE);
    if (isLunarEventTargetDay(lunar, target, day, month, year)) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function isLunarEventTargetDay(lunar, target, solarDay, solarMonth, solarYear) {
  if (lunar.month !== target.month || lunar.leap !== target.leap) return false;
  if (lunar.day === target.day) return true;
  return target.day === 30 && lunar.day === 29 && isLastDayOfLunarMonth(solarDay, solarMonth, solarYear, lunar);
}

function isLastDayOfLunarMonth(solarDay, solarMonth, solarYear, lunar) {
  const nextDate = new Date(Date.UTC(solarYear, solarMonth - 1, solarDay + 1));
  const nextLunar = convertSolarToLunar(
    nextDate.getUTCDate(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCFullYear(),
    TIME_ZONE
  );
  return nextLunar.month !== lunar.month || nextLunar.leap !== lunar.leap;
}

function getEventTypeIcon(type) {
  if (type === "birthday") return "☀";
  if (type === "deathAnniversary") return "☾";
  return "★";
}

function getEventTypeIconMarkup(type, className = "month-event-icon", eventTypeId = null) {
  if (eventTypeId && typeof getEventGroup === "function") {
    return renderEventGroupIcon(getEventGroup(eventTypeId), `${className} event-group-icon`);
  }
  const eventType = ["birthday", "deathAnniversary", "other"].includes(type) ? type : "other";
  return `<span class="${className} ${eventType}" aria-hidden="true">${getEventTypeIcon(eventType)}</span>`;
}

function renderEventCalendar() {
  syncCalendarNavigation(EVENT_CALENDAR_NAVIGATION, eventCalendarYear, eventCalendarMonth);
  document.getElementById("eventCalendarHeadingText").textContent = `Tháng ${eventCalendarMonth} năm ${eventCalendarYear}`;
  renderCalendarGrid({
    grid: document.getElementById("eventCalendarGrid"),
    year: eventCalendarYear,
    month: eventCalendarMonth,
    selectedDay: eventCalendarSelectedDay,
    ariaLabel: `Lịch sự kiện tháng ${eventCalendarMonth} năm ${eventCalendarYear}`,
    eventsByDay: eventCalendarOccurrences,
    showEventIcons: true,
    showAuspiciousDot: false,
    onDayClick: handleEventCalendarDayClick
  });
}

async function handleEventCalendarDayClick(day) {
  eventCalendarSelectedDay = day;
  renderEventCalendar();
  const date = `${eventCalendarYear}-${String(eventCalendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dayEvents = getSelectedEventCalendarDayEvents();
  setEventDateInputValue(date);

  if (dayEvents.length === 0) {
    clearEventChoiceList();
    resetEventForm(date);
    setEventFormStatus("Ngày này chưa có sự kiện. Nhập thông tin để tạo mới.");
    openEventDialog();
    return;
  }

  if (dayEvents.length === 1) {
    clearEventChoiceList();
    await loadEventIntoForm(dayEvents[0].id, dayEvents[0]);
    return;
  }

  renderEventChoiceList(date, dayEvents);
}

function renderEventChoiceList(date, events) {
  const panel = document.getElementById("eventChoiceListPanel");
  const list = document.getElementById("eventChoiceList");
  const status = document.getElementById("eventChoiceListStatus");
  if (!panel || !list) return;
  const sortedEvents = events.slice().sort(compareCalendarDayEvents);
  panel.hidden = false;
  if (status) status.textContent = "Chọn sự kiện để sửa";
  list.innerHTML = sortedEvents.map((item) => `
    <button class="event-list-item" type="button" data-event-id="${item.id}">
      ${getEventTypeIconMarkup(item.eventType, "event-card-type-icon")}
      <strong>${getEventTypeIconMarkup(item.eventType, "month-event-icon", item.eventTypeId)}${escapeHtml(item.title)}</strong>
      <span>${getEventDateSummary(item)}</span>
      <span class="event-countdown">${getEventCountdownText(item)}</span>
      ${getEventNextSolarDateText(item) ? `<span class="event-next-solar">${getEventNextSolarDateText(item)}</span>` : ""}
    </button>
  `).join("");

  const eventButtons = [...list.querySelectorAll("[data-event-id]")];
  eventButtons.forEach((button) => {
    const event = sortedEvents.find((item) => item.id === button.dataset.eventId);
    button.addEventListener("click", () => loadEventIntoForm(button.dataset.eventId, event));
  });
  if (eventButtons[0]) {
    requestAnimationFrame(() => {
      eventButtons[0].focus({ preventScroll: true });
      eventButtons[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
  }
}

function refreshEventChoiceListForSelectedDay() {
  const date = getSelectedEventCalendarDate();
  const dayEvents = getSelectedEventCalendarDayEvents();
  if (date && dayEvents.length > 0) {
    renderEventChoiceList(date, dayEvents);
    return;
  }
  clearEventChoiceList();
}

function getSelectedEventCalendarDayEvents() {
  const events = eventCalendarOccurrences[eventCalendarSelectedDay] || [];
  return events.slice().sort(compareCalendarDayEvents);
}

function clearEventChoiceList() {
  const panel = document.getElementById("eventChoiceListPanel");
  const list = document.getElementById("eventChoiceList");
  const status = document.getElementById("eventChoiceListStatus");
  if (list) list.innerHTML = "";
  if (status) status.textContent = "";
  if (panel) panel.hidden = true;
}
