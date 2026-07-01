const webPush = require("web-push");
const { schedule } = require("@netlify/functions");
const {
  configureWebPush,
  getPushStore,
  jsonResponse
} = require("./push-shared");

const MAX_SENDS_PER_RUN = 100;
const SENT_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;

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

    record.sent = pruneSentMap(record.sent || {}, now);
    let changed = false;

    for (const reminder of record.reminders || []) {
      if (sentCount >= MAX_SENDS_PER_RUN) break;
      if (record.sent[reminder.id]) continue;
      if (Date.parse(reminder.reminderAt) > now) continue;

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
        record.sent[reminder.id] = new Date(now).toISOString();
        sentCount += 1;
        changed = true;
      } catch (error) {
        failedCount += 1;
        if (error.statusCode === 404 || error.statusCode === 410) {
          await store.delete(item.key);
          changed = false;
          break;
        }
      }
    }

    if (changed) {
      record.updatedAt = new Date(now).toISOString();
      await store.setJSON(item.key, record);
    }
  }

  return jsonResponse({ ok: true, sent: sentCount, failed: failedCount });
}

exports.handler = schedule("* * * * *", sendPushReminders);

function pruneSentMap(sent, now) {
  return Object.fromEntries(Object.entries(sent).filter((entry) => {
    const sentAt = Date.parse(entry[1]);
    return Number.isFinite(sentAt) && now - sentAt < SENT_RETENTION_MS;
  }));
}
