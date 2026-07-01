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
  const now = getVietnamToday();
  const todayKey = toDateInputValue(now);
  const today = parseDateValue(todayKey);

  for (const event of events) {
    const occurrenceDate = getNextEventOccurrenceDate(event);
    if (!occurrenceDate) continue;
    if (getDaysFromDateValue(today, occurrenceDate) < 0) continue;

    const reminders = Array.isArray(event.reminders) ? event.reminders : [];
    for (const reminder of reminders) {
      if (!reminder || reminder.enabled === false) continue;
      const reminderTime = getEventReminderDateTime(event, occurrenceDate, reminder);
      if (!shouldShowTodayEventReminder(event, todayKey, occurrenceDate, reminderTime, now)) continue;
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

function shouldShowTodayEventReminder(event, todayKey, occurrenceDate, reminderTime, now = getVietnamToday()) {
  if (!reminderTime) return false;

  const reminderDate = toDateInputValue(reminderTime);
  if (isCommemorativeEventType(event && event.eventType) && occurrenceDate === todayKey) {
    return getDaysFromDateValue(parseDateValue(todayKey), reminderDate) <= 0;
  }

  return reminderDate === todayKey && reminderTime.getTime() <= now.getTime();
}

function isCommemorativeEventType(eventType) {
  return eventType === "birthday" || eventType === "deathAnniversary";
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
