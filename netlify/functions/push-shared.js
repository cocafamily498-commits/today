const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const webPush = require("web-push");
const { getStore } = require("@netlify/blobs");

const PUSH_STORE_NAME = "lichviet-push-reminders";
const MAX_REMINDERS_PER_SUBSCRIPTION = 200;

loadEnvFile(path.join(__dirname, "..", "..", ".env"));

function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    },
    body: JSON.stringify(body)
  };
}

function optionsResponse() {
  return {
    statusCode: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    },
    body: ""
  };
}

function parseJsonBody(event) {
  if (!event.body) return {};
  const text = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(text || "{}");
}

function getVapidConfig() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "mailto:admin@example.com"
  };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function configureWebPush() {
  const config = getVapidConfig();
  if (!config.publicKey || !config.privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY.");
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

function getPushStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || "";
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || "";

  if (siteID && token) {
    return getStore({
      name: PUSH_STORE_NAME,
      siteID,
      token
    });
  }

  return getStore(PUSH_STORE_NAME);
}

function getSubscriptionKey(subscription) {
  const endpoint = subscription && subscription.endpoint;
  if (!endpoint) throw new Error("Subscription endpoint is required.");
  return crypto.createHash("sha256").update(endpoint).digest("hex");
}

function sanitizeReminder(reminder) {
  const source = reminder || {};
  if (!source.id || !source.reminderAt || !source.title) return null;
  const reminderAtMs = Date.parse(source.reminderAt);
  if (!Number.isFinite(reminderAtMs)) return null;
  const occurrenceAtMs = Date.parse(source.occurrenceAt || "");

  return {
    id: String(source.id).slice(0, 240),
    reminderAt: new Date(reminderAtMs).toISOString(),
    title: String(source.title).slice(0, 120),
    body: String(source.body || "").slice(0, 400),
    tag: String(source.tag || source.id).slice(0, 240),
    url: String(source.url || "/").slice(0, 500),
    icon: String(source.icon || "/icons/app-icon-lichviet-calendar-192.png").slice(0, 200),
    badge: String(source.badge || "/icons/app-icon-lichviet-calendar-192.png").slice(0, 200),
    eventId: source.eventId ? String(source.eventId).slice(0, 120) : "",
    occurrenceDate: source.occurrenceDate ? String(source.occurrenceDate).slice(0, 20) : "",
    occurrenceAt: Number.isFinite(occurrenceAtMs) ? new Date(occurrenceAtMs).toISOString() : ""
  };
}

function sanitizeReminders(reminders) {
  if (!Array.isArray(reminders)) return [];
  return reminders
    .map(sanitizeReminder)
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.reminderAt) - Date.parse(right.reminderAt))
    .slice(0, MAX_REMINDERS_PER_SUBSCRIPTION);
}

module.exports = {
  configureWebPush,
  getPushStore,
  getSubscriptionKey,
  getVapidConfig,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  sanitizeReminders
};
