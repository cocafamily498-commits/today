function setupEventForm() {
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
    resetEventForm(getSelectedEventCalendarDate());
  });
  cancelButton.addEventListener("click", closeEventDialog);
  deleteButton.addEventListener("click", deleteEditingEvent);
  listWindowButton.addEventListener("click", openEventListWindow);
  closeButton.addEventListener("click", closeEventDialog);
  setupEventBackupControls();
  dialog.addEventListener("close", () => {
    document.body.classList.remove("event-dialog-open");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setEventFormStatus("Đang lưu...");

    try {
      const eventData = buildEventFromForm(form);
      const savedEvent = editingEventId
        ? await window.LichVietData.updateEvent(editingEventId, eventData)
        : await window.LichVietData.createEvent(eventData);
      setEventFormStatus(editingEventId ? "Đã lưu thay đổi." : "Đã lưu sự kiện.");
      editingEventId = null;
      form.reset();
      setEventDateInputValue(savedEvent.date);
      document.getElementById("eventTime").value = DEFAULT_EVENT_TIME;
      applyTypeDefaults();
      setEventFormMode("create");
      clearEventChoiceList();
      await loadEventCalendarOccurrences();
      closeEventDialog();
    } catch (error) {
      setEventFormStatus("Chưa lưu được sự kiện. Vui lòng kiểm tra lại thông tin.", true);
    }
  });

  applyTypeDefaults();
  setupEventCalendar();
  setupTodayEventReminderPrompt();
}

function updateEventTypeIcon(type) {
  const icon = document.getElementById("eventTypeIcon");
  if (!icon) return;
  icon.className = `event-type-selected-icon ${type}`;
  icon.textContent = getEventTypeIcon(type);
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

function setupEventBackupControls() {
  const backupButton = document.getElementById("eventBackupButton");
  const restoreButton = document.getElementById("eventRestoreButton");
  const restoreInput = document.getElementById("eventRestoreInput");
  if (!backupButton || !restoreButton || !restoreInput || !window.LichVietData) return;

  backupButton.addEventListener("click", openBackupExplanationDialog);
  restoreButton.addEventListener("click", () => restoreInput.click());
  restoreInput.addEventListener("change", async () => {
    const file = restoreInput.files && restoreInput.files[0];
    restoreInput.value = "";
    if (!file) return;
    await restoreEventDataFromFile(file);
  });
}

function openBackupExplanationDialog() {
  const existingDialog = document.getElementById("eventBackupDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "eventBackupDialog";
  dialog.className = "event-backup-dialog";
  dialog.innerHTML = `
    <div class="event-backup-content">
      <h2>Sao lưu dữ liệu</h2>
      <p>Ứng dụng này không thu thập dữ liệu cá nhân của bạn. Mọi dữ liệu bạn tạo, như sự kiện, sinh nhật, ngày giỗ, ghi chú và thiết lập, đều được lưu cục bộ trên thiết bị của bạn, trong vùng lưu trữ của trình duyệt đang sử dụng.</p>
      <p>Khi sao lưu, ứng dụng sẽ tạo một file dữ liệu để bạn tải về. File này thường được lưu trong thư mục Tải xuống / Downloads của trình duyệt, trừ khi bạn chọn vị trí lưu khác.</p>
      <p>Bạn có thể giữ file này để khôi phục dữ liệu khi đổi máy, đổi trình duyệt hoặc sau khi xóa dữ liệu trình duyệt. Bạn cũng có thể chia sẻ file sao lưu cho người thân, bạn bè hoặc dùng trên thiết bị khác.</p>
      <p>Để nhập lại dữ liệu, hãy bấm Khôi phục dữ liệu và chọn file sao lưu đã lưu trước đó.</p>
      <div class="event-backup-dialog-actions">
        <button id="eventBackupCancelButton" class="event-secondary-button" type="button">Hủy</button>
        <button id="eventBackupDownloadButton" class="event-submit" type="button">Tạo file sao lưu</button>
      </div>
    </div>
  `;

  document.body.append(dialog);
  document.body.classList.add("event-dialog-open");
  dialog.addEventListener("close", () => {
    document.body.classList.remove("event-dialog-open");
    dialog.remove();
  });
  dialog.querySelector("#eventBackupCancelButton").addEventListener("click", () => dialog.close());
  dialog.querySelector("#eventBackupDownloadButton").addEventListener("click", async () => {
    await backupEventData();
    dialog.close();
  });
  dialog.showModal();
  dialog.querySelector("#eventBackupDownloadButton").focus();
}

async function backupEventData() {
  try {
    const backup = await window.LichVietData.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const today = toDateInputValue(getVietnamToday());
    link.href = URL.createObjectURL(blob);
    link.download = `Sotay-${today}.Lichviet`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    setEventFormStatus("Đã tạo file sao lưu dữ liệu.");
  } catch (error) {
    setEventFormStatus("Chưa sao lưu được dữ liệu.", true);
  }
}

async function restoreEventDataFromFile(file) {
  if (!window.confirm("Khôi phục dữ liệu sẽ thay thế dữ liệu hiện tại trên trình duyệt này. Tiếp tục?")) return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    await window.LichVietData.importBackup(backup);
    editingEventId = null;
    clearEventChoiceList();
    resetEventForm(toDateInputValue(getVietnamToday()));
    await loadEventCalendarOccurrences();
    await refreshJournalDataAfterRestore();
    setEventFormStatus("Đã khôi phục dữ liệu sao lưu.");
  } catch (error) {
    setEventFormStatus("Chưa khôi phục được dữ liệu. Hãy kiểm tra file sao lưu.", true);
  }
}

async function refreshJournalDataAfterRestore() {
  if (typeof resetJournalForm === "function") {
    resetJournalForm(toDateInputValue(getVietnamToday()));
  }
  if (typeof loadJournalCalendarEntries === "function") {
    await loadJournalCalendarEntries();
  }
}

function setupTodayEventReminderPrompt() {
  requestAnimationFrame(() => showTodayEventRemindersIfNeeded());
}

async function showTodayEventRemindersIfNeeded() {
  if (eventReminderDialogShownThisSession || !window.LichVietData) return;
  eventReminderDialogShownThisSession = true;

  try {
    const reminders = await getTodayEventReminderItems();
    if (reminders.length === 0) return;
    openTodayEventReminderDialog(reminders);
  } catch (error) {
    console.error("today event reminders failed", error);
  }
}

async function getTodayEventReminderItems() {
  const events = await window.LichVietData.getAllEvents();
  const items = [];
  const todayKey = toDateInputValue(getVietnamToday());
  const today = parseDateValue(todayKey);

  for (const event of events) {
    const occurrenceDate = getNextEventOccurrenceDate(event);
    if (!occurrenceDate) continue;
    if (getDaysFromDateValue(today, occurrenceDate) < 0) continue;

    const reminders = Array.isArray(event.reminders) ? event.reminders : [];
    for (const reminder of reminders) {
      if (!reminder || reminder.enabled === false) continue;
      const reminderDate = getEventReminderDate(event, occurrenceDate, reminder);
      if (getDaysFromDateValue(today, reminderDate) > 0) continue;
      const dismissed = await window.LichVietData.isReminderOccurrenceDismissed(event.id, reminder.id, occurrenceDate);
      if (dismissed) continue;
      items.push({ event, reminder, occurrenceDate });
    }
  }

  return items.sort((left, right) => {
    const leftHours = getHoursUntilEventOccurrence(left.event, left.occurrenceDate);
    const rightHours = getHoursUntilEventOccurrence(right.event, right.occurrenceDate);
    if (leftHours !== rightHours) return leftHours - rightHours;
    return String(left.event.title || "").localeCompare(String(right.event.title || ""), "vi");
  });
}

function getEventReminderDate(event, occurrenceDate, reminder) {
  const occurrence = getEventOccurrenceDateTime(event, occurrenceDate);
  const reminderTime = new Date(occurrence.getTime());
  reminderTime.setDate(reminderTime.getDate() - (Number(reminder.beforeDays) || 0));
  reminderTime.setHours(reminderTime.getHours() - (Number(reminder.beforeHours) || 0));
  return toDateInputValue(reminderTime);
}

function getEventOccurrenceDateTime(event, occurrenceDate) {
  const date = parseDateValue(occurrenceDate);
  const [hour, minute] = getEventTimeParts(event && event.time);
  return new Date(date.year, date.month - 1, date.day, hour, minute, 0, 0);
}

function getEventTimeParts(timeValue) {
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue || "");
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2])];
}

function getHoursUntilEventOccurrence(event, occurrenceDate) {
  const now = getVietnamToday();
  const occurrence = getEventOccurrenceDateTime(event, occurrenceDate);
  return Math.max(0, Math.ceil((occurrence.getTime() - now.getTime()) / (60 * 60 * 1000)));
}

function getEventReminderLeadText(event, occurrenceDate) {
  const now = getVietnamToday();
  const occurrence = getEventOccurrenceDateTime(event, occurrenceDate);
  if (toDateInputValue(now) === occurrenceDate && occurrence.getTime() <= now.getTime()) {
    return "Sự kiện đã bắt đầu trong hôm nay";
  }
  const totalHours = getHoursUntilEventOccurrence(event, occurrenceDate);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `Còn ${days} ngày ${hours} giờ nữa sẽ diễn ra`;
}

function formatOriginalLunarEventDate(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date) return "";
  const lunar = convertSolarToLunar(date.day, date.month, date.year, TIME_ZONE);
  const lunarMonth = lunar.leap ? `${lunar.month} nhuận` : lunar.month;
  return `${lunar.day}/${lunarMonth}/${lunar.year}`;
}

function openTodayEventReminderDialog(items) {
  const existingDialog = document.getElementById("todayEventReminderDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "todayEventReminderDialog";
  dialog.className = "event-reminder-dialog";
  dialog.innerHTML = `
    <div class="event-reminder-content">
      <h2 class="event-reminder-heading" aria-label="Nhắc sự kiện hôm nay">
        <span class="event-reminder-bell" aria-hidden="true">🔔</span>
      </h2>
      <div class="event-reminder-list">
        ${items.map(({ event, occurrenceDate }) => `
          <article class="event-reminder-item">
            <h3 class="event-reminder-item-title">${getEventTypeIconMarkup(event.eventType)}${escapeHtml(event.title)}</h3>
            <p class="event-reminder-lead">${escapeHtml(getEventReminderLeadText(event, occurrenceDate))}</p>
            <p>Ngày dương lịch gốc: ${escapeHtml(formatEventDate(event.date))}</p>
            <p>Ngày âm lịch gốc: ${escapeHtml(formatOriginalLunarEventDate(event.date))}</p>
          </article>
        `).join("")}
      </div>
      <div class="event-reminder-actions">
        <button id="eventReminderLaterButton" class="event-secondary-button" type="button">Nhắc lại lần sau</button>
        <button id="eventReminderDismissButton" class="event-submit" type="button">Không nhắc lại nữa</button>
      </div>
    </div>
  `;

  document.body.append(dialog);
  document.body.classList.add("event-dialog-open");
  dialog.addEventListener("close", () => {
    document.body.classList.remove("event-dialog-open");
    dialog.remove();
  });
  dialog.querySelector("#eventReminderLaterButton").addEventListener("click", () => dialog.close());
  dialog.querySelector("#eventReminderDismissButton").addEventListener("click", async () => {
    await Promise.all(items.map(({ event, reminder, occurrenceDate }) => window.LichVietData.dismissReminderOccurrence({
      eventId: event.id,
      reminderId: reminder.id,
      occurrenceDate
    })));
    dialog.close();
  });
  dialog.showModal();
  dialog.querySelector("#eventReminderLaterButton").focus();
}

async function openEventListWindow() {
  const targetWindow = window.open("", "_blank");
  if (!targetWindow) {
    setEventFormStatus("Trình duyệt đang chặn cửa sổ mới. Hãy cho phép popup để xem danh sách.", true);
    return;
  }

  const sortEventsForList = (events) => events.slice().sort(compareEventsByNextOccurrence);
  const eventDialogHtml = document.getElementById("eventDialog").outerHTML;
  const refreshEventListWindow = async () => {
    const events = await window.LichVietData.getAllEvents();
    renderListWindow(sortEventsForList(events));
  };
  const openEventFromList = async (eventId) => {
    await loadEventIntoListWindowDialog(targetWindow, eventId);
  };
  const renderListWindow = (events, emptyText) => {
    targetWindow.document.open();
    targetWindow.document.write(renderEventListWindowDocument(events, emptyText, eventDialogHtml));
    targetWindow.document.close();
    initializeEventListWindowFilters(targetWindow, openEventFromList);
    setupEventListWindowDialog(targetWindow, refreshEventListWindow);
  };
  renderListWindow([], "Đang tải danh sách sự kiện...");

  try {
    const events = await window.LichVietData.getAllEvents();
    const sortedEvents = sortEventsForList(events);

    renderListWindow(sortedEvents);
  } catch (error) {
    setEventFormStatus("Chưa mở được danh sách sự kiện.", true);
    renderListWindow([], "Chưa đọc được dữ liệu sự kiện.");
  }
}

function setupEventListWindowDialog(listWindow, onChange) {
  const doc = listWindow.document;
  const dialog = doc.getElementById("eventDialog");
  const form = doc.getElementById("eventForm");
  if (!dialog || !form || form.dataset.listDialogReady === "true") return;

  form.dataset.listDialogReady = "true";
  doc.body.classList.remove("event-dialog-open");
  dialog.addEventListener("close", () => {
    doc.body.classList.remove("event-dialog-open");
  });
  doc.getElementById("eventDialogCloseButton").addEventListener("click", () => closeEventDialogInDocument(doc));
  doc.getElementById("eventCancelButton").addEventListener("click", () => closeEventDialogInDocument(doc));
  const addButton = doc.getElementById("eventAddButton");
  if (addButton) {
    addButton.addEventListener("click", () => openCreateEventInListWindowDialog(listWindow));
  }
  doc.getElementById("eventResetButton").addEventListener("click", () => {
    if (listWindow.editingEventId) {
      openCreateEventInListWindowDialog(listWindow);
    } else {
      resetEventFormInDocument(doc);
    }
  });
  doc.getElementById("eventDeleteButton").addEventListener("click", async () => {
    if (!listWindow.editingEventId || !listWindow.confirm("Xóa sự kiện này?")) return;
    try {
      await window.LichVietData.deleteEvent(listWindow.editingEventId);
      listWindow.editingEventId = null;
      await loadEventCalendarOccurrences();
      closeEventDialogInDocument(doc);
      if (typeof onChange === "function") await onChange();
    } catch (error) {
      setEventFormStatusInDocument(doc, "Chưa xóa được sự kiện.", true);
    }
  });

  doc.getElementById("eventType").addEventListener("change", () => applyEventTypeDefaultsInDocument(doc));
  doc.getElementById("eventDate").addEventListener("input", () => {
    autoFormatEventDateInput(doc.getElementById("eventDate"));
    updateEventDateHintInDocument(doc);
  });
  doc.getElementById("eventDate").addEventListener("change", () => {
    normalizeEventDateInputInDocument(doc);
    updateEventDateHintInDocument(doc);
  });
  doc.getElementById("eventDate").addEventListener("blur", () => {
    normalizeEventDateInputInDocument(doc);
    updateEventDateHintInDocument(doc);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setEventFormStatusInDocument(doc, "Đang lưu...");
    try {
      if (listWindow.editingEventId) {
        await window.LichVietData.updateEvent(listWindow.editingEventId, buildEventFromForm(form));
      } else {
        await window.LichVietData.createEvent(buildEventFromForm(form));
      }
      await loadEventCalendarOccurrences();
      closeEventDialogInDocument(doc);
      if (typeof onChange === "function") await onChange();
    } catch (error) {
      setEventFormStatusInDocument(doc, "Chưa lưu được sự kiện. Vui lòng kiểm tra lại thông tin.", true);
    }
  });
}

function openCreateEventInListWindowDialog(listWindow) {
  if (!listWindow || listWindow.closed) return;
  const doc = listWindow.document;
  listWindow.editingEventId = null;
  resetEventFormInDocument(doc);
  setEventFormModeInDocument(doc, "create");
  setEventFormStatusInDocument(doc, "Đang tạo sự kiện mới.");
  openEventDialogInDocument(doc);
}

async function loadEventIntoListWindowDialog(listWindow, eventId) {
  if (!listWindow || listWindow.closed) return;
  const event = await window.LichVietData.getEvent(eventId);
  if (!event) return;
  const doc = listWindow.document;
  listWindow.editingEventId = event.id;

  doc.getElementById("eventType").value = event.eventType;
  setEventDateInputValueInDocument(doc, event.date);
  doc.getElementById("eventTitle").value = event.title;
  doc.getElementById("eventCalendar").value = event.calendarLabel;
  doc.getElementById("eventRepeat").value = event.repeat && event.repeat.frequency ? event.repeat.frequency : "none";
  const reminder = event.reminders && event.reminders[0] ? event.reminders[0] : {};
  doc.getElementById("eventBeforeDays").value = reminder.beforeDays || 0;
  doc.getElementById("eventBeforeHours").value = reminder.beforeHours || 0;
  doc.getElementById("eventTime").value = event.time || DEFAULT_EVENT_TIME;
  doc.getElementById("eventNote").value = event.note || "";
  applyEventTypeDefaultsInDocument(doc);
  doc.getElementById("eventCalendar").value = event.calendarLabel;
  doc.getElementById("eventRepeat").value = event.repeat && event.repeat.frequency ? event.repeat.frequency : "none";
  setEventFormModeInDocument(doc, "edit");
  setEventFormStatusInDocument(doc, "Đang sửa sự kiện.");
  openEventDialogInDocument(doc);
}

function resetEventFormInDocument(doc, date = null) {
  const form = doc.getElementById("eventForm");
  if (!form) return;
  form.reset();
  setEventDateInputValueInDocument(doc, date || toDateInputValue(getVietnamToday()));
  doc.getElementById("eventTime").value = DEFAULT_EVENT_TIME;
  applyEventTypeDefaultsInDocument(doc);
  setEventFormStatusInDocument(doc, "");
}

function applyEventTypeDefaultsInDocument(doc) {
  const type = doc.getElementById("eventType").value;
  const calendarInput = doc.getElementById("eventCalendar");
  const repeatInput = doc.getElementById("eventRepeat");
  updateEventTypeIconInDocument(doc, type);
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
  updateEventDateHintInDocument(doc);
}

function updateEventTypeIconInDocument(doc, type) {
  const icon = doc.getElementById("eventTypeIcon");
  if (!icon) return;
  icon.className = `event-type-selected-icon ${type}`;
  icon.textContent = getEventTypeIcon(type);
}

function setEventDateInputValueInDocument(doc, dateValue) {
  const input = doc.getElementById("eventDate");
  if (input) input.value = formatEventDateInputValue(dateValue);
}

function getEventDateInputValueFromDocument(doc) {
  const input = doc.getElementById("eventDate");
  return input ? parseEventDateInputValue(input.value) : "";
}

function normalizeEventDateInputInDocument(doc) {
  const input = doc.getElementById("eventDate");
  if (!input) return;
  const dateValue = parseEventDateInputValue(input.value);
  if (dateValue) input.value = formatEventDateInputValue(dateValue);
}

function updateEventDateHintInDocument(doc) {
  const hint = doc.getElementById("eventDateHint");
  const leapBadge = doc.getElementById("eventLunarLeapBadge");
  if (!hint) return;
  const lunarDate = getEventLunarDateValue(getEventDateInputValueFromDocument(doc));
  hint.value = lunarDate ? lunarDate.value : "";
  if (leapBadge) leapBadge.hidden = !lunarDate || !lunarDate.leap;
}

function setEventFormStatusInDocument(doc, message, isError = false) {
  const status = doc.getElementById("eventFormStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setEventFormModeInDocument(doc, mode) {
  const isEdit = mode === "edit";
  doc.getElementById("eventDialogHeading").textContent = isEdit ? "Sửa sự kiện" : "Tạo sự kiện";
  doc.getElementById("eventCancelButton").hidden = false;
  doc.getElementById("eventDeleteButton").hidden = !isEdit;
  doc.getElementById("eventResetButton").textContent = "Thêm mới";
  doc.querySelector("#eventForm .event-submit").textContent = isEdit ? "Lưu thay đổi" : "Lưu sự kiện";
}

function openEventDialogInDocument(doc) {
  const dialog = doc.getElementById("eventDialog");
  if (!dialog) return;
  doc.body.classList.add("event-dialog-open");
  if (!dialog.open) dialog.showModal();
  doc.defaultView.requestAnimationFrame(() => {
    const titleInput = doc.getElementById("eventTitle");
    if (titleInput) titleInput.focus({ preventScroll: true });
  });
}

function closeEventDialogInDocument(doc) {
  const dialog = doc.getElementById("eventDialog");
  if (dialog && dialog.open) dialog.close();
  doc.body.classList.remove("event-dialog-open");
}

function resetEventForm(date = null) {
  const form = document.getElementById("eventForm");
  form.reset();
  editingEventId = null;
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
  document.getElementById("eventDialogHeading").textContent = isEdit ? "Sửa sự kiện" : "Tạo sự kiện";
  document.getElementById("eventCancelButton").hidden = false;
  document.getElementById("eventDeleteButton").hidden = !isEdit;
  document.getElementById("eventResetButton").textContent = "Thêm mới";
  document.querySelector("#eventForm .event-submit").textContent = isEdit ? "Lưu thay đổi" : "Lưu sự kiện";
}

function getEventFormValues() {
  return {
    eventType: document.getElementById("eventType").value,
    date: getEventDateInputValue(),
    title: document.getElementById("eventTitle").value,
    calendarLabel: document.getElementById("eventCalendar").value,
    repeatFrequency: document.getElementById("eventRepeat").value,
    beforeDays: document.getElementById("eventBeforeDays").value,
    beforeHours: document.getElementById("eventBeforeHours").value,
    eventTime: document.getElementById("eventTime").value,
    note: document.getElementById("eventNote").value
  };
}

function openEventDialog() {
  const dialog = document.getElementById("eventDialog");
  if (!dialog) return;
  document.body.classList.add("event-dialog-open");
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => {
    const titleInput = document.getElementById("eventTitle");
    if (titleInput) titleInput.focus({ preventScroll: true });
  });
}

function closeEventDialog() {
  const dialog = document.getElementById("eventDialog");
  if (dialog && dialog.open) dialog.close();
  document.body.classList.remove("event-dialog-open");
}
