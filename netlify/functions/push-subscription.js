const {
  getPushStore,
  getSubscriptionKey,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  sanitizeReminders
} = require("./push-shared");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return jsonResponse({ error: "Only POST is supported." }, 405);

  try {
    const input = parseJsonBody(event);
    const subscription = input.subscription;
    const reminders = sanitizeReminders(input.reminders);
    const key = getSubscriptionKey(subscription);
    const store = getPushStore();
    const replaceEventIds = sanitizeReplaceEventIds(input.replaceEventIds);
    const existing = replaceEventIds.length > 0
      ? await store.get(key, { type: "json" }).catch(() => null)
      : null;
    const storedReminders = mergeReminders(existing && existing.reminders, reminders, replaceEventIds);
    const record = {
      key,
      subscription,
      reminders: storedReminders,
      updatedAt: new Date().toISOString(),
      userAgent: event.headers["user-agent"] || ""
    };

    await store.setJSON(key, record);
    return jsonResponse({ ok: true, reminders: storedReminders.length });
  } catch (error) {
    return jsonResponse({ error: error.message || "Could not save push subscription." }, 400);
  }
};

function sanitizeReplaceEventIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => String(item || "").slice(0, 120))
    .filter(Boolean))];
}

function mergeReminders(existingReminders, reminders, replaceEventIds) {
  if (replaceEventIds.length === 0) return reminders;
  const replaceSet = new Set(replaceEventIds);
  const keptReminders = Array.isArray(existingReminders)
    ? sanitizeReminders(existingReminders).filter((reminder) => !replaceSet.has(reminder.eventId))
    : [];
  return [...keptReminders, ...reminders]
    .sort((left, right) => Date.parse(left.reminderAt) - Date.parse(right.reminderAt))
    .slice(0, 200);
}
