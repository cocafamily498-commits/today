const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const PUSH_JOB_STORE_NAME = "lichviet-push-reminder-jobs-v2";
const PUSH_JOB_SCHEMA_VERSION = 2;
const JOB_GRACE_MINUTES = 30;
const MAX_JOB_ATTEMPTS = 3;

function getPushJobStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || "";
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || "";

  if (siteID && token) {
    return getStore({ name: PUSH_JOB_STORE_NAME, siteID, token });
  }

  return getStore(PUSH_JOB_STORE_NAME);
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function getMinuteBucket(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid reminder due time.");
  return date.toISOString().slice(0, 16).replace(/[-:T]/g, "/");
}

function getJobKey(job) {
  const identity = [
    job.subscriptionKey,
    job.eventId,
    job.reminderId,
    job.occurrenceDate,
    job.dueAt,
    job.type
  ].join(":");
  return `due/${getMinuteBucket(job.dueAt)}/${job.subscriptionKey}/${hashValue(identity)}`;
}

function getManifestKey(subscriptionKey) {
  return `manifests/${subscriptionKey}`;
}

function getMigrationMarkerKey() {
  return `system/migrated-v${PUSH_JOB_SCHEMA_VERSION}`;
}

function getNextAutomaticReminderTime(scheduledAt, occurrenceAt) {
  const remainingMs = occurrenceAt.getTime() - scheduledAt.getTime();
  const oneHour = 60 * 60 * 1000;
  const twoHours = 2 * oneHour;
  const oneDay = 24 * oneHour;
  const twoDays = 2 * oneDay;

  if (remainingMs <= oneHour) return null;
  if (remainingMs <= twoHours) return new Date(occurrenceAt.getTime() - oneHour);
  if (remainingMs <= oneDay) {
    return new Date(Math.min(scheduledAt.getTime() + twoHours, occurrenceAt.getTime() - oneHour));
  }
  if (remainingMs <= twoDays) return new Date(occurrenceAt.getTime() - oneDay);
  return new Date(scheduledAt.getTime() + oneDay);
}

function createJob(subscriptionKey, reminder, dueAt, type, sequence, now = new Date()) {
  const dueMs = Date.parse(dueAt);
  const occurrenceMs = Date.parse(reminder.occurrenceAt);
  if (!Number.isFinite(dueMs) || !Number.isFinite(occurrenceMs) || dueMs >= occurrenceMs) return null;
  const expiresMs = Math.min(occurrenceMs, dueMs + JOB_GRACE_MINUTES * 60 * 1000);
  if (expiresMs <= now.getTime()) return null;

  const job = {
    schemaVersion: PUSH_JOB_SCHEMA_VERSION,
    subscriptionKey,
    eventId: reminder.eventId || "",
    reminderId: reminder.id || "default",
    occurrenceDate: reminder.occurrenceDate || "",
    occurrenceAt: reminder.occurrenceAt,
    dueAt: new Date(dueMs).toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
    type,
    sequence,
    status: "pending",
    attemptCount: 0,
    createdAt: now.toISOString(),
    payload: {
      title: reminder.title,
      body: reminder.body,
      tag: reminder.tag,
      url: reminder.url,
      icon: reminder.icon,
      badge: reminder.badge,
      eventId: reminder.eventId,
      occurrenceDate: reminder.occurrenceDate
    }
  };
  job.key = getJobKey(job);
  return job;
}

function createJobs(subscriptionKey, reminders, now = new Date()) {
  const jobs = [];
  for (const reminder of reminders || []) {
    const job = createJob(subscriptionKey, reminder, reminder.reminderAt, "configured", 0, now);
    if (job) jobs.push(job);
  }
  return jobs;
}

function createNextJob(job, now = new Date()) {
  const scheduledAt = new Date(job.dueAt);
  const occurrenceAt = new Date(job.occurrenceAt);
  const nextAt = getNextAutomaticReminderTime(scheduledAt, occurrenceAt);
  if (!nextAt || nextAt.getTime() <= scheduledAt.getTime()) return null;
  return createJob(job.subscriptionKey, {
    id: job.reminderId,
    eventId: job.eventId,
    occurrenceDate: job.occurrenceDate,
    occurrenceAt: job.occurrenceAt,
    ...job.payload
  }, nextAt.toISOString(), "automatic", (job.sequence || 0) + 1, now);
}

function getDueBucketPrefixes(now = new Date(), graceMinutes = JOB_GRACE_MINUTES) {
  const currentHour = Math.floor(now.getTime() / (60 * 60 * 1000)) * 60 * 60 * 1000;
  const earliest = now.getTime() - graceMinutes * 60 * 1000;
  const prefixes = [];
  for (let hour = Math.floor(earliest / (60 * 60 * 1000)) * 60 * 60 * 1000;
    hour <= currentHour;
    hour += 60 * 60 * 1000) {
    prefixes.push(`due/${getMinuteBucket(new Date(hour)).slice(0, 13)}/`);
  }
  return prefixes;
}

module.exports = {
  JOB_GRACE_MINUTES,
  MAX_JOB_ATTEMPTS,
  PUSH_JOB_SCHEMA_VERSION,
  createNextJob,
  createJobs,
  getDueBucketPrefixes,
  getJobKey,
  getManifestKey,
  getMigrationMarkerKey,
  getPushJobStore,
  getNextAutomaticReminderTime
};
