async function saveEventEditorValues(values, mode = null) {
  const eventData = buildEventFromValues(values);
  const shouldUpdate = editingEventId && mode !== "create";
  const savedEvent = shouldUpdate
    ? await window.LichVietData.updateEvent(editingEventId, eventData)
    : await window.LichVietData.createEvent(eventData);
  editingEventId = null;
  resetEventForm(savedEvent.date);
  updateEventCalendarOccurrence(savedEvent);
  refreshEventChoiceListForSelectedDay();
  queueEventWebPushReminderSyncForEvent(savedEvent);
  setEventFormStatus("");
  return savedEvent;
}

async function deleteCurrentEditingEvent() {
  if (!editingEventId) return;
  const deletedEventId = editingEventId;
  await window.LichVietData.deleteEvent(editingEventId);
  resetEventForm(getSelectedEventCalendarDate());
  await loadEventCalendarOccurrences();
  refreshEventChoiceListForSelectedDay();
  queueRemoveEventWebPushReminders(deletedEventId);
  setEventFormStatus("");
}

window.EventEditorBridge = {
  getLunarDateValue: getEventLunarDateValue,
  saveValues: saveEventEditorValues,
  deleteCurrentEvent: deleteCurrentEditingEvent,
  openGroupManager: () => {
    if (typeof openEventGroupManagerDialog === "function") openEventGroupManagerDialog();
  },
  openEvent: (eventId) => loadEventIntoForm(eventId)
};

async function loadEventIntoForm(eventId, renderedEvent = null, options = {}) {
  const event = await window.LichVietData.getEvent(eventId);
  if (!event) return;
  const shouldOpenDialog = options.openDialog !== false;
  const originalDate = renderedEvent && renderedEvent.date ? renderedEvent.date : event.date;

  editingEventId = event.id;
  document.getElementById("eventType").value = event.eventType;
  try {
    if (typeof updateEventGroupPicker === "function") {
      const fallbackGroupId = typeof getDefaultEventGroupId === "function"
        ? getDefaultEventGroupId(event.eventType)
        : "general";
      updateEventGroupPicker(event.eventTypeId || fallbackGroupId);
    }
  } catch (error) {
    console.error("event group picker update failed", error);
  }
  setEventDateInputValue(originalDate);
  document.getElementById("eventType").dispatchEvent(new Event("change", { bubbles: true }));
  updateEventDateHint();
  document.getElementById("eventTitle").value = event.title;
  document.getElementById("eventCalendar").value = event.calendarLabel;
  document.getElementById("eventRepeat").value = event.repeat && event.repeat.frequency ? event.repeat.frequency : "none";
  const reminder = event.reminders && event.reminders[0] ? event.reminders[0] : {};
  document.getElementById("eventBeforeDays").value = reminder.beforeDays || 0;
  document.getElementById("eventBeforeHours").value = reminder.beforeHours || 0;
  document.getElementById("eventTime").value = event.time || DEFAULT_EVENT_TIME;
  setEventFormMode("edit");
  setEventFormStatus("Đang sửa sự kiện.");
  if (shouldOpenDialog) openEventDialog();
}

async function deleteEditingEvent() {
  if (!editingEventId) return;
  if (!await confirmEventDelete()) return;

  const deletedEventId = editingEventId;
  await window.LichVietData.deleteEvent(editingEventId);
  resetEventForm(`${eventCalendarYear}-${String(eventCalendarMonth).padStart(2, "0")}-${String(eventCalendarSelectedDay).padStart(2, "0")}`);
  await loadEventCalendarOccurrences();
  refreshEventChoiceListForSelectedDay();
  queueRemoveEventWebPushReminders(deletedEventId);
  setEventFormStatus("Đã xóa sự kiện.");
  closeEventDialog();
}

function confirmEventDelete() {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "event-confirm-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="event-confirm-content">
        <h2>Xóa sự kiện?</h2>
        <p>Sự kiện này sẽ bị xóa khỏi lịch. Bạn không thể hoàn tác thao tác này.</p>
        <div class="event-confirm-actions">
          <button class="event-secondary-button" value="cancel" type="submit">Hủy</button>
          <button class="event-danger-button" value="delete" type="submit">Xóa sự kiện</button>
        </div>
      </form>
    `;

    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "delete");
      dialog.remove();
    }, { once: true });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });

    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector(".event-secondary-button").focus();
  });
}

function buildEventFromForm(form) {
  const formData = new FormData(form);
  return buildEventFromValues({
    eventType: formData.get("eventType"),
    eventTypeId: formData.get("eventTypeId"),
    date: parseEventDateInputValue(formData.get("date")),
    title: formData.get("title"),
    calendarLabel: formData.get("calendarLabel"),
    repeatFrequency: formData.get("repeatFrequency"),
    beforeDays: formData.get("beforeDays"),
    beforeHours: formData.get("beforeHours"),
    eventTime: formData.get("eventTime")
  });
}

function buildEventFromValues(values) {
  const eventType = values.eventType;
  const date = values.date;
  const title = String(values.title || "").trim();
  const calendarLabel = eventType === "birthday"
    ? "solar"
    : eventType === "deathAnniversary"
      ? "lunar"
      : values.calendarLabel || "solar";
  const repeatFrequency = eventType === "birthday" || eventType === "deathAnniversary"
    ? "yearly"
    : values.repeatFrequency;
  const beforeDays = Number.parseInt(values.beforeDays, 10) || 0;
  const beforeHours = Number.parseInt(values.beforeHours, 10) || 0;
  const eventTime = values.eventTime || DEFAULT_EVENT_TIME;
  const lunar = getEventLunarSnapshot(date, calendarLabel, repeatFrequency === "yearly" ? calendarLabel : null);

  if (!date) throw new Error("Event date is required.");
  if (!title) throw new Error("Event title is required.");

  return {
    date,
    title,
    note: values.note || "",
    eventType,
    eventTypeId: values.eventTypeId || (typeof getDefaultEventGroupId === "function" ? getDefaultEventGroupId(eventType) : "general"),
    calendarLabel,
    lunar,
    time: eventTime,
    allDay: !eventTime,
    repeat: {
      frequency: repeatFrequency,
      calendar: calendarLabel,
      interval: 1,
      until: null
    },
    reminders: [
      {
        enabled: true,
        beforeDays,
        beforeHours,
        time: getDerivedReminderTime(eventTime),
        allowSnooze: true,
        defaultSnoozeMinutes: 10
      }
    ]
  };
}

function getEventLunarSnapshot(date, calendarLabel, repeatCalendar) {
  if (calendarLabel !== "lunar" && repeatCalendar !== "lunar") return null;
  const [year, month, day] = date.split("-").map(Number);
  const lunar = convertSolarToLunar(day, month, year, TIME_ZONE);
  return {
    day: lunar.day,
    month: lunar.month,
    leap: false
  };
}

function getDerivedReminderTime(eventTime) {
  return /^\d{2}:\d{2}$/.test(eventTime || "") ? eventTime : DEFAULT_EVENT_TIME;
}

function setEventFormStatus(message, isError = false) {
  const status = document.getElementById("eventFormStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEventDate(date) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function parseEventDateInputValue(value) {
  const raw = String(value || "").trim();
  let year;
  let month;
  let day;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (displayMatch) {
    day = Number(displayMatch[1]);
    month = Number(displayMatch[2]);
    year = Number(displayMatch[3]);
  } else {
    return "";
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return "";
  return formatDateValue(year, month, day);
}

function formatEventDateInputValue(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date) return "";
  return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}`;
}

function setEventDateInputValue(dateValue) {
  const input = document.getElementById("eventDate");
  if (input) input.value = formatEventDateInputValue(dateValue);
}

function getEventDateInputValue() {
  const input = document.getElementById("eventDate");
  return input ? parseEventDateInputValue(input.value) : "";
}

function normalizeEventDateInput() {
  const input = document.getElementById("eventDate");
  if (!input) return;
  const dateValue = parseEventDateInputValue(input.value);
  if (dateValue) input.value = formatEventDateInputValue(dateValue);
}

function autoFormatEventDateInput(input) {
  const raw = String(input.value || "");
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (!digits) {
    input.value = "";
    return;
  }
  if (digits.length <= 2) {
    input.value = digits;
  } else if (digits.length <= 4) {
    input.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  } else {
    input.value = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
}

function getEventDateSummary(event, dateValue = event && event.date) {
  return [
    formatEventDate(dateValue),
    formatLunarDateShort(dateValue),
    getEventTypeLabel(event && event.eventType),
    getCalendarLabel(event && event.calendarLabel)
  ].filter(Boolean).join(" · ");
}

function formatLunarDateShort(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date) return "";

  const lunar = convertSolarToLunar(date.day, date.month, date.year, TIME_ZONE);
  const lunarMonth = lunar.leap ? `${lunar.month} nhuận` : lunar.month;
  return `Âm lịch ${lunar.day}/${lunarMonth}/${lunar.year}`;
}

function updateEventDateHint() {
  const hint = document.getElementById("eventDateHint");
  const leapBadge = document.getElementById("eventLunarLeapBadge");
  const dateInput = document.getElementById("eventDate");
  if (!hint || !dateInput) return;
  const lunarDate = getEventLunarDateValue(getEventDateInputValue());
  hint.value = lunarDate ? lunarDate.value : "";
  if (leapBadge) leapBadge.hidden = !lunarDate || !lunarDate.leap;
}

function getEventLunarDateValue(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date) return null;

  const lunar = convertSolarToLunar(date.day, date.month, date.year, TIME_ZONE);
  return {
    value: `${String(lunar.day).padStart(2, "0")}/${String(lunar.month).padStart(2, "0")}/${lunar.year}`,
    leap: lunar.leap
  };
}

function getEventCountdownText(event) {
  const occurrenceDate = getNextEventOccurrenceDate(event);
  if (!occurrenceDate) return "";
  const days = getDaysFromToday(occurrenceDate);

  if (days === 0) return "Diễn ra hôm nay";
  if (days === 1) return "Còn 1 ngày nữa";
  if (days > 1) return `Còn ${days} ngày nữa`;
  if (days === -1) return "Đã diễn ra hôm qua";
  return `Đã diễn ra ${Math.abs(days)} ngày trước`;
}

function getEventNextSolarDateText(event) {
  if (!isLunarEvent(event)) return "";

  const occurrenceDate = getNextEventOccurrenceDate(event);
  if (!occurrenceDate) return "";

  return `Dương lịch lần tới: ${formatEventDate(occurrenceDate)}`;
}

function isLunarEvent(event) {
  const repeat = event && event.repeat ? event.repeat : {};
  return event && (event.calendarLabel === "lunar" || repeat.calendar === "lunar");
}
