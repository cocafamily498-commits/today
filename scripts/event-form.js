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
  setupEventSystemReminderControls();
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
      await syncEventWebPushReminders();
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
    await syncEventWebPushReminders();
  });
}

const EVENT_SYSTEM_REMINDER_CHECK_INTERVAL = 60 * 1000;
const EVENT_SYSTEM_REMINDER_STORAGE_KEY = "lichviet.systemReminderNotifications";
const EVENT_PUSH_REMINDER_DAYS_AHEAD = 370;
let eventSystemReminderTimer = null;

function setupEventSystemReminderControls() {
  const buttons = Array.from(document.querySelectorAll(".event-system-reminder-trigger"));
  if (buttons.length === 0) return;

  refreshEventSystemReminderControls();
  buttons.forEach((button) => button.addEventListener("click", async () => {
    if ("Notification" in window && Notification.permission === "denied") {
      openNotificationBlockedDialog();
      return;
    }

    const permission = await requestEventSystemNotificationPermission();
    updateEventSystemReminderButtons(buttons);
    if (permission === "granted") {
      await showEventSystemTestNotification();
      const synced = await syncEventWebPushReminders();
      await showDueEventSystemNotifications();
      updateEventSystemReminderButtons(buttons, synced);
    }
  }));

  if (!eventSystemReminderTimer) {
    eventSystemReminderTimer = window.setInterval(showDueEventSystemNotifications, EVENT_SYSTEM_REMINDER_CHECK_INTERVAL);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshEventSystemReminderControls();
        showDueEventSystemNotifications();
      }
    });
    window.addEventListener("focus", () => {
      refreshEventSystemReminderControls();
      showDueEventSystemNotifications();
    });
  }

  showDueEventSystemNotifications();
  syncEventWebPushReminders();
}

function getEventSystemReminderButtons() {
  return Array.from(document.querySelectorAll(".event-system-reminder-trigger"));
}

function refreshEventSystemReminderControls(webPushSynced = true) {
  updateEventSystemReminderButtons(getEventSystemReminderButtons(), webPushSynced);
}

function updateEventSystemReminderButtons(buttons, webPushSynced = true) {
  buttons.forEach((button) => updateEventSystemReminderButton(button, webPushSynced));
}

function updateEventSystemReminderButton(button, webPushSynced = true) {
  if (!("Notification" in window)) {
    button.textContent = "Không hỗ trợ nhắc hệ thống";
    button.disabled = true;
    button.classList.remove("is-enabled", "is-warning");
    return;
  }

  const permission = Notification.permission;
  button.disabled = false;
  button.classList.toggle("is-enabled", permission === "granted");
  button.classList.toggle("is-warning", permission === "denied");
  if (permission === "granted") {
    button.textContent = webPushSynced ? "Đã bật nhắc hệ thống" : "Chưa cấu hình Web Push";
    button.classList.toggle("is-warning", !webPushSynced);
  } else if (permission === "denied") {
    button.textContent = "Thông báo bị chặn";
  } else {
    button.textContent = "Bật nhắc hệ thống";
  }
}

async function requestEventSystemNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error("notification permission failed", error);
    return Notification.permission;
  }
}

function openNotificationBlockedDialog() {
  const existingDialog = document.getElementById("notificationBlockedDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "notificationBlockedDialog";
  dialog.className = "app-install-dialog";
  const secureText = window.isSecureContext ? "Kết nối bảo mật: đạt." : "Kết nối chưa bảo mật, trình duyệt có thể chặn thông báo.";
  dialog.innerHTML = `
    <div class="app-install-dialog-content">
      <h2>Thông báo đang bị chặn</h2>
      <p>Android/Chrome đã chặn quyền thông báo cho app này, nên ứng dụng không thể tự bật lại bằng nút trong web.</p>
      <p>Trạng thái trình duyệt đang trả về: ${escapeHtml(Notification.permission)}. ${escapeHtml(secureText)}</p>
      <p>Trên Chrome Android: bấm biểu tượng ổ khóa hoặc chữ thông tin cạnh thanh địa chỉ, vào Quyền trang web, chọn Thông báo, rồi chuyển sang Cho phép.</p>
      <p>Nếu đang mở bằng app đã cài: nhấn giữ biểu tượng app, chọn Thông tin ứng dụng, vào Thông báo, rồi bật Cho phép thông báo.</p>
      <div class="event-backup-dialog-actions">
        <button class="event-secondary-button" type="button" data-action="close">Đóng</button>
        <button class="event-submit" type="button" data-action="recheck">Kiểm tra lại</button>
      </div>
    </div>
  `;

  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("[data-action='close']").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-action='recheck']").addEventListener("click", async () => {
    refreshEventSystemReminderControls();
    if (Notification.permission === "granted") {
      await showEventSystemTestNotification();
      const synced = await syncEventWebPushReminders();
      refreshEventSystemReminderControls(synced);
      dialog.close();
    }
  });
  dialog.showModal();
}

async function showDueEventSystemNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted" || !window.LichVietData) return;

  try {
    const reminders = await getTodayEventReminderItems();
    for (const item of reminders) {
      const key = getEventSystemReminderKey(item);
      if (hasEventSystemReminderNotification(key)) continue;
      await showEventSystemNotification(item);
      markEventSystemReminderNotification(key);
    }
  } catch (error) {
    console.error("system event reminders failed", error);
  }
}

function getEventSystemReminderKey({ event, reminder, occurrenceDate }) {
  const reminderId = reminder && reminder.id ? reminder.id : "default";
  return `${event.id}:${reminderId}:${occurrenceDate}`;
}

function getEventSystemReminderNotificationMap() {
  try {
    return JSON.parse(localStorage.getItem(EVENT_SYSTEM_REMINDER_STORAGE_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function hasEventSystemReminderNotification(key) {
  return Boolean(getEventSystemReminderNotificationMap()[key]);
}

function markEventSystemReminderNotification(key) {
  try {
    const map = getEventSystemReminderNotificationMap();
    map[key] = new Date().toISOString();
    localStorage.setItem(EVENT_SYSTEM_REMINDER_STORAGE_KEY, JSON.stringify(pruneEventSystemReminderNotificationMap(map)));
  } catch (error) {
    // Notification delivery should not depend on localStorage availability.
  }
}

function pruneEventSystemReminderNotificationMap(map) {
  const entries = Object.entries(map)
    .sort((left, right) => String(right[1]).localeCompare(String(left[1])))
    .slice(0, 200);
  return Object.fromEntries(entries);
}

async function showEventSystemNotification({ event, occurrenceDate }) {
  const title = event && event.title ? `Nhắc sự kiện: ${event.title}` : "Nhắc sự kiện";
  const body = [
    getEventReminderLeadText(event, occurrenceDate),
    getEventDateSummary(event, occurrenceDate)
  ].filter(Boolean).join("\n");
  const options = {
    body,
    tag: `lichviet-event-${event.id}-${occurrenceDate}`,
    renotify: true,
    icon: "/icons/app-icon-lichviet-transparent-192.png",
    badge: "/icons/app-icon-lichviet-transparent-192.png",
    data: {
      url: `${window.location.origin}${window.location.pathname}#eventsTab`,
      eventId: event.id,
      occurrenceDate
    }
  };

  const registration = await getReadyServiceWorkerRegistration();
  if (registration && registration.showNotification) {
    await registration.showNotification(title, options);
    return;
  }

  new Notification(title, options);
}

async function showEventSystemTestNotification() {
  const options = {
    body: "Thông báo hệ thống đã bật. Các nhắc sự kiện sẽ hiện ở đây khi đến giờ.",
    tag: "lichviet-event-reminder-test",
    renotify: true,
    icon: "/icons/app-icon-lichviet-transparent-192.png",
    badge: "/icons/app-icon-lichviet-transparent-192.png",
    data: {
      url: `${window.location.origin}${window.location.pathname}#eventsTab`
    }
  };

  try {
    const registration = await getReadyServiceWorkerRegistration();
    if (registration && registration.showNotification) {
      await registration.showNotification("Sổ tay lịch Việt", options);
      return;
    }
    new Notification("Sổ tay lịch Việt", options);
  } catch (error) {
    console.error("test notification failed", error);
  }
}

async function getReadyServiceWorkerRegistration(timeoutMs = 3000) {
  if (!navigator.serviceWorker || !navigator.serviceWorker.ready) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs))
  ]);
}

async function syncEventWebPushReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted" || !window.LichVietData) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  try {
    const publicKey = await getWebPushPublicKey();
    if (!publicKey) return false;
    const registration = await getReadyServiceWorkerRegistration();
    if (!registration || !registration.pushManager) return false;
    const subscription = await getOrCreateWebPushSubscription(registration, publicKey);
    const reminders = await buildEventPushReminderPayloads();
    const response = await fetch(getApiUrl("/api/push-subscription"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription, reminders })
    });
    return response.ok;
  } catch (error) {
    console.error("web push reminder sync failed", error);
    return false;
  }
}

async function getWebPushPublicKey() {
  const response = await fetch(getApiUrl("/api/push-vapid-public-key"), { cache: "no-store" });
  if (!response.ok) return "";
  const data = await response.json();
  return data && data.publicKey ? data.publicKey : "";
}

async function getOrCreateWebPushSubscription(registration, publicKey) {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

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
    await syncEventWebPushReminders();
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
      await syncEventWebPushReminders();
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
      await syncEventWebPushReminders();
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
  if (shouldAvoidOpeningVirtualKeyboard(doc)) {
    doc.defaultView.requestAnimationFrame(() => blurEditableElementInDocument(doc));
    return;
  }
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
