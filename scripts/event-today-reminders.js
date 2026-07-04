function setupTodayEventReminderPrompt() {
  requestAnimationFrame(() => showTodayEventRemindersIfNeeded());
  if (navigator.serviceWorker && !window.eventReminderServiceWorkerListenerReady) {
    window.eventReminderServiceWorkerListenerReady = true;
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (!event.data || event.data.type !== "lichviet-event-reminder-open") return;
      eventReminderDialogShownThisSession = false;
      showTodayEventRemindersIfNeeded();
    });
  }
}

async function showTodayEventRemindersIfNeeded() {
  if (eventReminderDialogShownThisSession || !window.LichVietData) return;
  eventReminderDialogShownThisSession = true;

  try {
    const reminders = await getTodayEventReminderItems();
    if (reminders.length === 0) return;
    const dialogItems = getEventReminderDialogItems(reminders);
    openTodayEventReminderDialog(dialogItems, reminders.length > dialogItems.length);
  } catch (error) {
    console.error("today event reminders failed", error);
  }
}

async function getTodayEventReminderItems() {
  const events = await window.LichVietData.getAllEvents();
  const items = [];
  const now = getVietnamToday();

  for (const event of events) {
    const occurrenceDate = getNextEventOccurrenceDate(event);
    if (!occurrenceDate) continue;

    const occurrenceAt = getEventOccurrenceDateTime(event, occurrenceDate);
    if (occurrenceAt.getTime() <= now.getTime()) continue;

    const reminders = Array.isArray(event.reminders) ? event.reminders : [];
    for (const reminder of reminders) {
      if (!reminder || reminder.enabled === false) continue;

      const reminderId = reminder.id || "default";
      const reminderTime = getEventReminderDateTime(event, occurrenceDate, reminder);
      if (!shouldShowTodayEventReminder(event, occurrenceDate, reminderId, reminderTime, now)) continue;

      const dismissed = await window.LichVietData.isReminderOccurrenceDismissed(event.id, reminderId, occurrenceDate);
      if (dismissed) continue;

      items.push({
        event,
        reminder: { ...reminder, id: reminderId },
        occurrenceDate,
        occurrenceAt,
        nextReminderAt: getNextEventReminderTime(now, occurrenceAt)
      });
    }
  }

  return items.sort((left, right) => {
    const leftMs = left.occurrenceAt.getTime() - now.getTime();
    const rightMs = right.occurrenceAt.getTime() - now.getTime();
    if (leftMs !== rightMs) return leftMs - rightMs;
    return String(left.event.title || "").localeCompare(String(right.event.title || ""), "vi");
  });
}

function shouldShowTodayEventReminder(event, occurrenceDate, reminderId, reminderTime, now = getVietnamToday()) {
  if (!reminderTime || reminderTime.getTime() > now.getTime()) return false;
  const remainingMs = getEventOccurrenceDateTime(event, occurrenceDate).getTime() - now.getTime();
  if (remainingMs <= 0) return false;
  const snoozedUntil = getEventReminderSnoozedUntil(event.id, reminderId, occurrenceDate);
  return !snoozedUntil || snoozedUntil.getTime() <= now.getTime();
}

function getEventReminderDateTime(event, occurrenceDate, reminder) {
  const occurrence = getEventOccurrenceDateTime(event, occurrenceDate);
  const reminderTime = new Date(occurrence.getTime());
  reminderTime.setDate(reminderTime.getDate() - (Number(reminder.beforeDays) || 0));
  reminderTime.setHours(reminderTime.getHours() - (Number(reminder.beforeHours) || 0));
  return reminderTime;
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
  const remainingMs = occurrence.getTime() - now.getTime();
  if (remainingMs <= 0) return "Sự kiện đã bắt đầu trong hôm nay";
  return `Còn ${formatEventRemainingTime(remainingMs)} nữa sẽ diễn ra`;
}

function getNextEventReminderTime(now, occurrenceAt) {
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

function formatEventRemainingTime(remainingMs) {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days} ngày`);
  if (hours) parts.push(`${hours} giờ`);
  if (minutes || parts.length === 0) parts.push(`${minutes} phút`);
  return parts.join(" ");
}

function formatOriginalLunarEventDate(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date) return "";
  const lunar = convertSolarToLunar(date.day, date.month, date.year, TIME_ZONE);
  const lunarMonth = lunar.leap ? `${lunar.month} nhuận` : lunar.month;
  return `${lunar.day}/${lunarMonth}/${lunar.year}`;
}

function getEventReminderDialogItems(items) {
  if (items.length <= 1) return items;
  const firstKey = getEventReminderDialogGroupKey(items[0]);
  return items.filter((item) => getEventReminderDialogGroupKey(item) === firstKey);
}

function getEventReminderDialogGroupKey(item) {
  return item.nextReminderAt ? `snooze:${item.nextReminderAt.getTime()}` : "final";
}

function openTodayEventReminderDialog(items, hasMoreReminders = false) {
  const existingDialog = document.getElementById("todayEventReminderDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "todayEventReminderDialog";
  dialog.className = "event-reminder-dialog";
  const canSnoozeAll = items.length > 0 && items.every((item) => item.nextReminderAt);
  const snoozeLabel = canSnoozeAll ? getEventReminderSnoozeButtonLabel(items) : "";

  dialog.innerHTML = `
    <div class="event-reminder-content">
      <h2 class="event-reminder-heading" aria-label="Nhắc sự kiện">
        <span class="event-reminder-bell" aria-hidden="true">🔔</span>
      </h2>
      <div class="event-reminder-list">
        ${items.map((item) => renderEventReminderItem(item)).join("")}
      </div>
      <div class="event-reminder-actions">
        ${canSnoozeAll ? `<button id="eventReminderLaterButton" class="event-secondary-button" type="button">${escapeHtml(snoozeLabel)}</button>` : ""}
        ${canSnoozeAll ? `<button id="eventReminderDismissButton" class="event-submit" type="button">Không nhắc lại nữa</button>` : `<button id="eventReminderSeenButton" class="event-submit" type="button">Đã xem</button>`}
      </div>
    </div>
  `;

  document.body.append(dialog);
  document.body.classList.add("event-dialog-open");
  let reminderActionHandled = false;
  dialog.addEventListener("close", () => {
    document.body.classList.remove("event-dialog-open");
    dialog.remove();
    if (reminderActionHandled && hasMoreReminders) {
      eventReminderDialogShownThisSession = false;
      requestAnimationFrame(() => showTodayEventRemindersIfNeeded());
    }
  });

  dialog.querySelector("#eventReminderLaterButton")?.addEventListener("click", async () => {
    items.forEach((item) => setEventReminderSnoozedUntil(item, item.nextReminderAt));
    reminderActionHandled = true;
    dialog.close();
    queueEventReminderItemsWebPushSync(items);
  });

  dialog.querySelector("#eventReminderDismissButton")?.addEventListener("click", async () => {
    await dismissEventReminderItems(items);
    reminderActionHandled = true;
    dialog.close();
    queueEventReminderItemsWebPushSync(items);
  });

  dialog.querySelector("#eventReminderSeenButton")?.addEventListener("click", async () => {
    await dismissEventReminderItems(items);
    reminderActionHandled = true;
    dialog.close();
    queueEventReminderItemsWebPushSync(items);
  });

  dialog.showModal();
  (dialog.querySelector("#eventReminderLaterButton")
    || dialog.querySelector("#eventReminderSeenButton")
    || dialog.querySelector("#eventReminderDismissButton"))?.focus();
}

function getEventReminderSnoozeButtonLabel(items) {
  const times = items.map((item) => item.nextReminderAt.getTime());
  const sameTime = times.every((time) => time === times[0]);
  if (!sameTime) return "Nhắc lại lần sau";

  const nextReminderAt = items[0].nextReminderAt;
  const now = getVietnamToday();
  const nextDate = toDateInputValue(nextReminderAt);
  const today = toDateInputValue(now);
  const tomorrow = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  if (nextDate === today) return `Nhắc lại lúc ${formatEventReminderClock(nextReminderAt)}`;
  if (nextDate === tomorrow) return `Nhắc lại ngày mai lúc ${formatEventReminderClock(nextReminderAt)}`;
  return `Nhắc lại ngày ${formatEventDate(nextDate)} lúc ${formatEventReminderClock(nextReminderAt)}`;
}

function renderEventReminderItem({ event, occurrenceDate, occurrenceAt, nextReminderAt }) {
  const remainingMs = occurrenceAt.getTime() - getVietnamToday().getTime();
  return `
    <article class="event-reminder-item">
      <h3 class="event-reminder-item-title">${getEventTypeIconMarkup(event.eventType)}${escapeHtml(event.title)}</h3>
      <p class="event-reminder-lead">${escapeHtml(getEventReminderLeadText(event, occurrenceDate))}</p>
      <p>Diễn ra lúc ${escapeHtml(formatEventReminderClock(occurrenceAt))} ngày ${escapeHtml(formatEventDate(occurrenceDate))}</p>
      <p>Ngày dương lịch gốc: ${escapeHtml(formatEventDate(event.date))}</p>
      <p>Ngày âm lịch gốc: ${escapeHtml(formatOriginalLunarEventDate(event.date))}</p>
      <p>${escapeHtml(getEventReminderActionText(remainingMs, nextReminderAt))}</p>
    </article>
  `;
}

function getEventReminderActionText(remainingMs, nextReminderAt) {
  const oneHour = 60 * 60 * 1000;
  if (remainingMs <= oneHour) {
    return "Sự kiện sắp diễn ra. Đây là lời nhắc cuối cùng cho sự kiện này.";
  }
  if (nextReminderAt) {
    return `Ứng dụng có thể nhắc lại sự kiện này lúc ${formatEventReminderTime(nextReminderAt)}.`;
  }
  return "";
}

async function dismissEventReminderItems(items) {
  await Promise.all(items.map(({ event, reminder, occurrenceDate }) => window.LichVietData.dismissReminderOccurrence({
    eventId: event.id,
    reminderId: reminder.id || "default",
    occurrenceDate
  })));
}

function queueEventReminderItemsWebPushSync(items) {
  const eventsById = new Map();
  items.forEach((item) => {
    if (item && item.event && item.event.id) eventsById.set(item.event.id, item.event);
  });
  eventsById.forEach((event) => queueEventWebPushReminderSyncForEvent(event));
}

function getEventReminderSnoozeKey(eventId, reminderId, occurrenceDate) {
  return `homnay.eventReminderSnooze.${eventId}.${reminderId}.${occurrenceDate}`;
}

function getEventReminderSnoozedUntil(eventId, reminderId, occurrenceDate) {
  try {
    const value = localStorage.getItem(getEventReminderSnoozeKey(eventId, reminderId, occurrenceDate));
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? new Date(time) : null;
  } catch (error) {
    return null;
  }
}

function setEventReminderSnoozedUntil(item, nextReminderAt) {
  if (!nextReminderAt) return;
  try {
    localStorage.setItem(
      getEventReminderSnoozeKey(item.event.id, item.reminder.id || "default", item.occurrenceDate),
      nextReminderAt.toISOString()
    );
  } catch (error) {
    // The next Web Push reminder is already scheduled; this only avoids reopening the in-app dialog too early.
  }
}

function formatEventReminderTime(date) {
  const now = getVietnamToday();
  const dateValue = toDateInputValue(date);
  if (dateValue === toDateInputValue(now)) return formatEventReminderClock(date);
  return `${formatEventReminderClock(date)} ngày ${formatEventDate(dateValue)}`;
}

function formatEventReminderClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
