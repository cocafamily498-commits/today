const {
  getPushStore,
  getSubscriptionKey,
  normalizePushAppId,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  sanitizeReminders
} = require("./push-shared");
const {
  PUSH_JOB_SCHEMA_VERSION,
  createJobs,
  getManifestKey,
  getPushJobStore
} = require("./push-jobs");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return jsonResponse({ error: "Only POST is supported." }, 405);

  try {
    const input = parseJsonBody(event);
    const subscription = input.subscription;
    const appId = normalizePushAppId(input.appId);
    const reminders = sanitizeReminders(input.reminders);
    const key = getSubscriptionKey(subscription, appId);
    const legacyKey = appId ? getSubscriptionKey(subscription) : key;
    const store = getPushStore();
    const replaceEventIds = sanitizeReplaceEventIds(input.replaceEventIds);
    const existing = await store.get(key, { type: "json" }).catch(() => null);
    const storedReminders = mergeReminders(existing && existing.reminders, reminders, replaceEventIds);
    const record = {
      key,
      appId,
      subscription,
      reminders: storedReminders,
      schemaVersion: PUSH_JOB_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      userAgent: event.headers["user-agent"] || ""
    };

    await syncReminderJobs(key, storedReminders, replaceEventIds);
    await store.setJSON(key, record);
    await removeObsoleteSubscriptions(store, key, appId, legacyKey);
    return jsonResponse({ ok: true, reminders: storedReminders.length, schemaVersion: PUSH_JOB_SCHEMA_VERSION });
  } catch (error) {
    return jsonResponse({ error: error.message || "Could not save push subscription." }, 400);
  }
};

async function removeObsoleteSubscriptions(store, activeKey, appId, legacyKey) {
  const listed = await store.list().catch(() => ({ blobs: [] }));
  const obsoleteKeys = new Set();
  if (legacyKey !== activeKey) obsoleteKeys.add(legacyKey);

  await Promise.all((listed.blobs || []).map(async (item) => {
    if (!item.key || item.key === activeKey) return;
    const record = await store.get(item.key, { type: "json" }).catch(() => null);
    const recordAppId = normalizePushAppId(record && record.appId);
    if (!recordAppId || (appId && recordAppId === appId)) obsoleteKeys.add(item.key);
  }));

  await Promise.all([...obsoleteKeys].map((subscriptionKey) => removeSubscriptionAndJobs(store, subscriptionKey)));
}

async function removeSubscriptionAndJobs(store, subscriptionKey) {
  const jobStore = getPushJobStore();
  const manifestKey = getManifestKey(subscriptionKey);
  const manifest = await jobStore.get(manifestKey, { type: "json" }).catch(() => null);
  const jobs = Array.isArray(manifest && manifest.jobs) ? manifest.jobs : [];
  await Promise.all(jobs.map((job) => jobStore.delete(job.key).catch(() => undefined)));
  await jobStore.delete(manifestKey).catch(() => undefined);
  await store.delete(subscriptionKey).catch(() => undefined);
}

async function syncReminderJobs(subscriptionKey, reminders, replaceEventIds) {
  const jobStore = getPushJobStore();
  const manifestKey = getManifestKey(subscriptionKey);
  const manifest = await jobStore.get(manifestKey, { type: "json" }).catch(() => null);
  const replaceSet = new Set(replaceEventIds);
  const previousJobs = Array.isArray(manifest && manifest.jobs) ? manifest.jobs : [];
  const jobsToKeep = replaceSet.size === 0
    ? []
    : previousJobs.filter((job) => !replaceSet.has(job.eventId));
  const jobsToDelete = replaceSet.size === 0
    ? previousJobs
    : previousJobs.filter((job) => replaceSet.has(job.eventId));

  await Promise.all(jobsToDelete.map((job) => jobStore.delete(job.key).catch(() => undefined)));

  const remindersToSchedule = replaceSet.size === 0
    ? reminders
    : reminders.filter((reminder) => replaceSet.has(reminder.eventId));
  const newJobs = createJobs(subscriptionKey, remindersToSchedule);
  await Promise.all(newJobs.map((job) => jobStore.setJSON(job.key, job)));

  await jobStore.setJSON(manifestKey, {
    schemaVersion: PUSH_JOB_SCHEMA_VERSION,
    subscriptionKey,
    jobs: [...jobsToKeep, ...newJobs].map((job) => ({
      key: job.key,
      eventId: job.eventId,
      dueAt: job.dueAt
    })),
    updatedAt: new Date().toISOString()
  });
}

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
