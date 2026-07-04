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
    const record = {
      key,
      subscription,
      reminders,
      updatedAt: new Date().toISOString(),
      userAgent: event.headers["user-agent"] || ""
    };

    await store.setJSON(key, record);
    return jsonResponse({ ok: true, reminders: reminders.length });
  } catch (error) {
    return jsonResponse({ error: error.message || "Could not save push subscription." }, 400);
  }
};
