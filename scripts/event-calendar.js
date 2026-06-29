function setupEventCalendar() {
  const today = getVietnamToday();
  eventCalendarYear = today.getFullYear();
  eventCalendarMonth = today.getMonth() + 1;
  eventCalendarSelectedDay = today.getDate();

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

function buildEventCalendarOccurrences(events, year, month) {
  const occurrences = {};
  events.forEach((event) => {
    const occurrenceDate = getEventOccurrenceDateForMonth(event, year, month);
    if (!occurrenceDate) return;
    const day = Number(occurrenceDate.slice(8, 10));
    if (!occurrences[day]) occurrences[day] = [];
    occurrences[day].push({ ...event, occurrenceDate });
  });
  return occurrences;
}

function getEventOccurrenceDateForMonth(event, year, month) {
  const [baseYear, baseMonth, baseDay] = event.date.split("-").map(Number);
  const repeat = event.repeat || { frequency: "none", calendar: event.calendarLabel || "solar" };

  if (repeat.frequency === "yearly") {
    if (baseYear === year && baseMonth === month) return event.date;
    if (repeat.calendar === "lunar" && event.lunar) {
      return getLunarEventOccurrenceDateForMonth(event, year, month);
    }
    if (baseMonth !== month) return null;
    const day = Math.min(baseDay, getDaysInMonth(year, month));
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  if (repeat.frequency === "monthly") {
    const day = Math.min(baseDay, getDaysInMonth(year, month));
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

function getEventTypeIconMarkup(type, className = "month-event-icon") {
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
  const dayEvents = eventCalendarOccurrences[day] || [];
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
  panel.hidden = false;
  if (status) status.textContent = "Chọn sự kiện để sửa";
  list.innerHTML = events.map((item) => `
    <button class="event-list-item" type="button" data-event-id="${item.id}">
      <strong>${getEventTypeIconMarkup(item.eventType)}${escapeHtml(item.title)}</strong>
      <span>${getEventDateSummary(item)}</span>
      <span class="event-countdown">${getEventCountdownText(item)}</span>
      ${getEventNextSolarDateText(item) ? `<span class="event-next-solar">${getEventNextSolarDateText(item)}</span>` : ""}
    </button>
  `).join("");

  const eventButtons = [...list.querySelectorAll("[data-event-id]")];
  eventButtons.forEach((button) => {
    const event = events.find((item) => item.id === button.dataset.eventId);
    button.addEventListener("click", () => loadEventIntoForm(button.dataset.eventId, event));
  });
  if (eventButtons[0]) {
    requestAnimationFrame(() => {
      eventButtons[0].focus({ preventScroll: true });
      eventButtons[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
  }
}

function clearEventChoiceList() {
  const panel = document.getElementById("eventChoiceListPanel");
  const list = document.getElementById("eventChoiceList");
  const status = document.getElementById("eventChoiceListStatus");
  if (list) list.innerHTML = "";
  if (status) status.textContent = "";
  if (panel) panel.hidden = true;
}
