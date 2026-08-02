const crypto = require("crypto");
const webPush = require("web-push");
const { schedule } = require("@netlify/functions");
const {
  configureWebPush,
  getPushStore,
  jsonResponse
} = require("./push-shared");
const {
  MAX_JOB_ATTEMPTS,
  PUSH_JOB_SCHEMA_VERSION,
  createJobs,
  createNextJob,
  getDueBucketPrefixes,
  getManifestKey,
  getMigrationMarkerKey,
  getPushJobStore
} = require("./push-jobs");

const MAX_SENDS_PER_RUN = 100;
const SEND_CONCURRENCY = 5;

async function sendPushReminders() {
  try {
    configureWebPush();
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  const startedAt = Date.now();
  const subscriptionStore = getPushStore();
  const jobStore = getPushJobStore();
  const migrated = await migrateLegacyRemindersOnce(subscriptionStore, jobStore);
  const now = new Date();
  const jobs = await listDueJobs(jobStore, now);
  const selectedJobs = jobs.slice(0, MAX_SENDS_PER_RUN);
  const results = await mapWithConcurrency(selectedJobs, SEND_CONCURRENCY, (job) => (
    processJob(jobStore, subscriptionStore, job, now)
  ));

  const counts = results.reduce((totals, result) => {
    totals[result] = (totals[result] || 0) + 1;
    return totals;
  }, {});

  return jsonResponse({
    ok: true,
    migrated,
    due: jobs.length,
    processed: selectedJobs.length,
    sent: counts.sent || 0,
    failed: counts.failed || 0,
    expired: counts.expired || 0,
    skipped: counts.skipped || 0,
    durationMs: Date.now() - startedAt
  });
}

async function migrateLegacyRemindersOnce(subscriptionStore, jobStore) {
  const markerKey = getMigrationMarkerKey();
  const marker = await jobStore.get(markerKey, { type: "json" }).catch(() => null);
  if (marker && marker.complete === true) return false;

  const list = await subscriptionStore.list();
  let subscriptions = 0;
  let jobsCreated = 0;

  for (const item of list.blobs || []) {
    const record = await subscriptionStore.get(item.key, { type: "json" }).catch(() => null);
    if (!record || !record.subscription) continue;
    const jobs = createJobs(item.key, record.reminders || []);
    await Promise.all(jobs.map((job) => jobStore.setJSON(job.key, job)));
    await jobStore.setJSON(getManifestKey(item.key), {
      schemaVersion: PUSH_JOB_SCHEMA_VERSION,
      subscriptionKey: item.key,
      jobs: jobs.map((job) => ({ key: job.key, eventId: job.eventId, dueAt: job.dueAt })),
      updatedAt: new Date().toISOString()
    });
    subscriptions += 1;
    jobsCreated += jobs.length;
  }

  await jobStore.setJSON(markerKey, {
    complete: true,
    schemaVersion: PUSH_JOB_SCHEMA_VERSION,
    subscriptions,
    jobsCreated,
    completedAt: new Date().toISOString()
  });
  return true;
}

async function listDueJobs(jobStore, now) {
  const entries = [];
  for (const prefix of getDueBucketPrefixes(now)) {
    const result = await jobStore.list({ prefix });
    entries.push(...(result.blobs || []));
  }

  const jobs = await mapWithConcurrency(entries, 10, (entry) => (
    jobStore.get(entry.key, { type: "json" }).catch(() => null)
  ));

  return jobs
    .filter((job) => job
      && job.status !== "sent"
      && (job.status !== "processing"
        || Date.parse(job.claimedAt || "") <= now.getTime() - 2 * 60 * 1000)
      && Date.parse(job.dueAt) <= now.getTime())
    .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt));
}

async function processJob(jobStore, subscriptionStore, job, now) {
  if (Date.parse(job.expiresAt) <= now.getTime()) {
    await jobStore.delete(job.key).catch(() => undefined);
    return "expired";
  }
  if ((job.attemptCount || 0) >= MAX_JOB_ATTEMPTS) {
    await jobStore.delete(job.key).catch(() => undefined);
    return "failed";
  }

  const runId = crypto.randomUUID();
  const claimedJob = {
    ...job,
    status: "processing",
    runId,
    claimedAt: now.toISOString(),
    attemptCount: (job.attemptCount || 0) + 1
  };
  await jobStore.setJSON(job.key, claimedJob);
  const confirmed = await jobStore.get(job.key, { type: "json" }).catch(() => null);
  if (!confirmed || confirmed.runId !== runId) return "skipped";

  const subscriptionRecord = await subscriptionStore.get(job.subscriptionKey, { type: "json" }).catch(() => null);
  if (!subscriptionRecord || !subscriptionRecord.subscription) {
    await jobStore.delete(job.key).catch(() => undefined);
    return "skipped";
  }

  try {
    await webPush.sendNotification(subscriptionRecord.subscription, JSON.stringify(job.payload));
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await removeSubscription(subscriptionStore, jobStore, job.subscriptionKey);
      return "failed";
    }

    if (claimedJob.attemptCount >= MAX_JOB_ATTEMPTS) {
      await jobStore.delete(job.key).catch(() => undefined);
    } else {
      await jobStore.setJSON(job.key, {
        ...claimedJob,
        status: "pending",
        runId: "",
        lastErrorAt: new Date().toISOString()
      });
    }
    return "failed";
  }

  const sentJob = { ...claimedJob, status: "sent", sentAt: new Date().toISOString() };
  await jobStore.setJSON(job.key, sentJob).catch(() => undefined);
  const nextJob = createNextJob(job);
  try {
    if (nextJob) await jobStore.setJSON(nextJob.key, nextJob);
    await replaceManifestJob(jobStore, job.subscriptionKey, job.key, nextJob);
  } catch (error) {
    if (nextJob) await jobStore.delete(nextJob.key).catch(() => undefined);
  }
  await jobStore.delete(job.key).catch(() => undefined);
  return "sent";
}

async function replaceManifestJob(jobStore, subscriptionKey, completedJobKey, nextJob) {
  const manifestKey = getManifestKey(subscriptionKey);
  const manifest = await jobStore.get(manifestKey, { type: "json" }).catch(() => null);
  if (!manifest) return;
  const jobs = (Array.isArray(manifest.jobs) ? manifest.jobs : [])
    .filter((item) => item.key !== completedJobKey);
  if (nextJob) jobs.push({ key: nextJob.key, eventId: nextJob.eventId, dueAt: nextJob.dueAt });
  await jobStore.setJSON(manifestKey, {
    ...manifest,
    jobs,
    updatedAt: new Date().toISOString()
  });
}

async function removeSubscription(subscriptionStore, jobStore, subscriptionKey) {
  const manifestKey = getManifestKey(subscriptionKey);
  const manifest = await jobStore.get(manifestKey, { type: "json" }).catch(() => null);
  const jobs = Array.isArray(manifest && manifest.jobs) ? manifest.jobs : [];
  await Promise.all(jobs.map((job) => jobStore.delete(job.key).catch(() => undefined)));
  await Promise.all([
    subscriptionStore.delete(subscriptionKey).catch(() => undefined),
    jobStore.delete(manifestKey).catch(() => undefined)
  ]);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

exports.handler = schedule("* * * * *", sendPushReminders);
exports.sendPushReminders = sendPushReminders;
