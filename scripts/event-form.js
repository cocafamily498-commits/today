async function setupEventForm() {
  const form = document.getElementById("eventForm");
  const typeInput = document.getElementById("eventType");
  const dateInput = document.getElementById("eventDate");
  const calendarInput = document.getElementById("eventCalendar");
  const repeatInput = document.getElementById("eventRepeat");
  const resetButton = document.getElementById("eventResetButton");
  const cancelButton = document.getElementById("eventCancelButton");
  const deleteButton = document.getElementById("eventDeleteButton");
  const listWindowButton = document.getElementById("eventListWindowButton");
  const dialog = document.getElementById("eventDialog");
  const closeButton = document.getElementById("eventDialogCloseButton");

  if (!form || !window.LichVietData) return;

  setupEventTypePicker();
  if (typeof setupEventGroupPicker === "function") setupEventGroupPicker();
  try {
    if (typeof initializeEventGroups === "function") {
      initializeEventGroups()
        .catch((error) => console.error("event groups initialization failed", error));
    }
  } catch (error) {
    console.error("event groups initialization failed", error);
  }

  setEventDateInputValue(toDateInputValue(getVietnamToday()));

  const applyTypeDefaults = () => {
    const type = typeInput.value;
    updateEventTypeIcon(type);
    if (type === "birthday") {
      calendarInput.value = "solar";
      calendarInput.disabled = true;
      repeatInput.value = "yearly";
      repeatInput.disabled = true;
    } else if (type === "deathAnniversary") {
      calendarInput.value = "lunar";
      calendarInput.disabled = true;
      repeatInput.value = "yearly";
      repeatInput.disabled = true;
    } else {
      calendarInput.disabled = false;
      repeatInput.disabled = false;
    }
    updateEventDateHint();
  };

  typeInput.addEventListener("change", applyTypeDefaults);
  dateInput.addEventListener("input", () => {
    autoFormatEventDateInput(dateInput);
    updateEventDateHint();
  });
  dateInput.addEventListener("change", () => {
    normalizeEventDateInput();
    updateEventDateHint();
  });
  dateInput.addEventListener("blur", () => {
    normalizeEventDateInput();
    updateEventDateHint();
  });
  resetButton.addEventListener("click", () => {
    editingEventId = null;
    document.getElementById("eventTitle").value = "";
    setEventFormMode("create");
    setEventFormStatus("");
    document.getElementById("eventTitle").focus();
  });
  if (cancelButton) cancelButton.addEventListener("click", closeEventDialog);
  deleteButton.addEventListener("click", deleteEditingEvent);
  listWindowButton.addEventListener("click", openEventListWindow);
  closeButton.addEventListener("click", closeEventDialog);
  dialog.addEventListener("close", () => {
    document.body.classList.remove("event-dialog-open");
    if (typeof returnToEventListDialogIfNeeded === "function") {
      returnToEventListDialogIfNeeded();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setEventFormStatus("Đang lưu...");

    try {
      const eventData = buildEventFromForm(form);
      const shouldUpdate = form.dataset.mode === "edit" && editingEventId;
      const savedEvent = shouldUpdate
        ? await window.LichVietData.updateEvent(editingEventId, eventData)
        : await window.LichVietData.createEvent(eventData);
      setEventFormStatus(shouldUpdate ? "Đã lưu thay đổi." : "Đã lưu sự kiện.");
      editingEventId = null;
      form.reset();
      if (typeof updateEventGroupPicker === "function") {
        updateEventGroupPicker(getDefaultEventGroupId(savedEvent.eventType));
      }
      setEventDateInputValue(savedEvent.date);
      document.getElementById("eventTime").value = DEFAULT_EVENT_TIME;
      applyTypeDefaults();
      setEventFormMode("create");
      updateEventCalendarOccurrence(savedEvent);
      queueEventWebPushReminderSyncForEvent(savedEvent);
      closeEventDialog();
      refreshEventChoiceListForSelectedDay();
    } catch (error) {
      setEventFormStatus("Chưa lưu được sự kiện. Vui lòng kiểm tra lại thông tin.", true);
    }
  });

  applyTypeDefaults();
  setupEventCalendar();
}

function updateEventTypeIcon(type) {
  const icon = document.getElementById("eventTypeIcon");
  if (!icon) return;
  icon.className = `event-type-selected-icon ${type}`;
  icon.textContent = getEventTypeIcon(type);
  const labels = { birthday: "Sinh nhật", deathAnniversary: "Đám giỗ", other: "Sự kiện khác" };
  const label = document.getElementById("eventTypePickerLabel");
  if (label) label.textContent = labels[type] || labels.other;
  document.querySelectorAll("#eventTypePickerList [role='option']").forEach((option) => {
    option.setAttribute("aria-selected", String(option.dataset.value === type));
  });
}

function setupEventTypePicker() {
  const input = document.getElementById("eventType");
  const button = document.getElementById("eventTypePickerButton");
  const list = document.getElementById("eventTypePickerList");
  if (!input || !button || !list || button.dataset.ready) return;
  button.dataset.ready = "true";

  const close = () => {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", () => {
    const opening = list.hidden;
    list.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (opening) list.querySelector(`[data-value="${input.value}"]`)?.focus();
  });
  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-value]");
    if (!option) return;
    input.value = option.dataset.value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    button.focus();
  });
  list.addEventListener("keydown", (event) => {
    const options = [...list.querySelectorAll("[data-value]")];
    const index = options.indexOf(document.activeElement);
    if (event.key === "Escape") { close(); button.focus(); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length].focus();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".event-type-select-wrap")) close();
  });
}

function compareEventsByNextOccurrence(left, right) {
  const leftDate = getNextEventOccurrenceDate(left);
  const rightDate = getNextEventOccurrenceDate(right);
  const leftDays = leftDate ? getDaysFromToday(leftDate) : Number.POSITIVE_INFINITY;
  const rightDays = rightDate ? getDaysFromToday(rightDate) : Number.POSITIVE_INFINITY;
  if (leftDays !== rightDays) return leftDays - rightDays;
  if (leftDate !== rightDate) return String(leftDate || "").localeCompare(String(rightDate || ""));
  const titleCompare = String(left.title || "").localeCompare(String(right.title || ""), "vi");
  if (titleCompare !== 0) return titleCompare;
  return String(left.id || "").localeCompare(String(right.id || ""));
}

function resetEventForm(date = null) {
  const form = document.getElementById("eventForm");
  form.reset();
  editingEventId = null;
  if (typeof updateEventGroupPicker === "function") updateEventGroupPicker("general");
  setEventDateInputValue(date || toDateInputValue(getVietnamToday()));
  document.getElementById("eventTime").value = DEFAULT_EVENT_TIME;
  document.getElementById("eventType").dispatchEvent(new Event("change", { bubbles: true }));
  setEventFormMode("create");
  setEventFormStatus("");
}

function getSelectedEventCalendarDate() {
  if (!eventCalendarYear || !eventCalendarMonth || !eventCalendarSelectedDay) return null;
  return `${eventCalendarYear}-${String(eventCalendarMonth).padStart(2, "0")}-${String(eventCalendarSelectedDay).padStart(2, "0")}`;
}

function setEventFormMode(mode) {
  const isEdit = mode === "edit";
  const form = document.getElementById("eventForm");
  if (form) form.dataset.mode = isEdit ? "edit" : "create";
  document.getElementById("eventDialogHeading").textContent = isEdit ? "Sửa sự kiện" : "Tạo sự kiện";
  const cancelButton = document.getElementById("eventCancelButton");
  if (cancelButton) cancelButton.hidden = true;
  document.getElementById("eventDeleteButton").hidden = !isEdit;
  document.getElementById("eventResetButton").textContent = "Mới";
  document.querySelector("#eventForm .event-submit").textContent = "Lưu";
}

function getEventFormValues() {
  return {
    eventType: document.getElementById("eventType").value,
    eventTypeId: document.getElementById("eventTypeId").value,
    date: getEventDateInputValue(),
    title: document.getElementById("eventTitle").value,
    calendarLabel: document.getElementById("eventCalendar").value,
    repeatFrequency: document.getElementById("eventRepeat").value,
    beforeDays: document.getElementById("eventBeforeDays").value,
    beforeHours: document.getElementById("eventBeforeHours").value,
    eventTime: document.getElementById("eventTime").value
  };
}

function openEventDialog() {
  const dialog = document.getElementById("eventDialog");
  if (!dialog) return;
  document.body.classList.add("event-dialog-open");
  if (!dialog.open) dialog.showModal();
  if (shouldAvoidOpeningVirtualKeyboard(document)) {
    requestAnimationFrame(() => blurEditableElementInDocument(document));
    return;
  }
  requestAnimationFrame(() => {
    const titleInput = document.getElementById("eventTitle");
    if (titleInput) titleInput.focus({ preventScroll: true });
  });
}

function shouldAvoidOpeningVirtualKeyboard(doc = document) {
  const view = doc.defaultView || window;
  return view.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
}

function blurEditableElementInDocument(doc = document) {
  const active = doc.activeElement;
  if (!active || !["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
  active.blur();
}

function closeEventDialog() {
  const dialog = document.getElementById("eventDialog");
  if (dialog && dialog.open) dialog.close();
  document.body.classList.remove("event-dialog-open");
}
