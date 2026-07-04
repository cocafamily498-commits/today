const webPush = require("web-push");
const { schedule } = require("@netlify/functions");
const {
  configureWebPush,
  getPushStore,
  jsonResponse
} = require("./push-shared");

const MAX_SENDS_PER_RUN = 100;

async function sendPushReminders() {
  try {
    configureWebPush();
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  const store = getPushStore();
  const now = Date.now();
  let sentCount = 0;
  let failedCount = 0;

  const list = await store.list();
  for (const item of list.blobs || []) {
    if (sentCount >= MAX_SENDS_PER_RUN) break;

    const record = await store.get(item.key, { type: "json" }).catch(() => null);
    if (!record || !record.subscription) continue;

    let changed = false;
    const activeReminders = [];

    for (const reminder of record.reminders || []) {
      if (sentCount >= MAX_SENDS_PER_RUN) {
        activeReminders.push(reminder);
        continue;
      }
      if (Date.parse(reminder.reminderAt) > now) {
        activeReminders.push(reminder);
        continue;
      }

      try {
        await webPush.sendNotification(record.subscription, JSON.stringify({
          title: reminder.title,
          body: reminder.body,
          tag: reminder.tag,
          url: reminder.url,
          icon: reminder.icon,
          badge: reminder.badge,
          eventId: reminder.eventId,
          occurrenceDate: reminder.occurrenceDate
        }));
        sentCount += 1;
        changed = true;

        const nextReminderAt = getNextEventReminderTime(new Date(now), reminder.occurrenceAt);
        if (nextReminderAt) {
          activeReminders.push({
            ...reminder,
            reminderAt: nextReminderAt.toISOString(),
            lastSentAt: new Date(now).toISOString()
          });
        }
      } catch (error) {
        failedCount += 1;
        if (error.statusCode === 404 || error.statusCode === 410) {
          await store.delete(item.key);
          changed = false;
          break;
        }
        activeReminders.push(reminder);
      }
    }

    if (changed) {
      record.reminders = activeReminders
        .filter((reminder) => Date.parse(reminder.reminderAt) > now)
        .sort((left, right) => Date.parse(left.reminderAt) - Date.parse(right.reminderAt));
      record.updatedAt = new Date(now).toISOString();
      await store.setJSON(item.key, record);
    }
  }

  return jsonResponse({ ok: true, sent: sentCount, failed: failedCount });
}

exports.handler = schedule("* * * * *", sendPushReminders);

function getNextEventReminderTime(now, occurrenceAtValue) {
  const occurrenceMs = Date.parse(occurrenceAtValue || "");
  if (!Number.isFinite(occurrenceMs)) return null;

  const occurrenceAt = new Date(occurrenceMs);
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
