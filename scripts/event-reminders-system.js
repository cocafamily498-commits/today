const EVENT_SYSTEM_REMINDER_CHECK_INTERVAL = 60 * 1000;
const EVENT_PUSH_REMINDER_DAYS_AHEAD = 370;
// Version 11 forces existing preview installations to register their current
// reminders again against the production push backend.
const EVENT_PUSH_SYNC_SCHEMA_VERSION = "11";
const EVENT_PUSH_SYNC_DIRTY_KEY = "homnay.eventPushSyncDirty";
const EVENT_PUSH_SYNC_SCHEMA_KEY = "homnay.eventPushSyncSchema";
const EVENT_PUSH_VAPID_CACHE_KEY = "homnay.eventPushVapidPublicKey";
const EVENT_SYSTEM_REMINDER_ENABLED_KEY = "homnay.eventSystemReminderEnabled";
const EVENT_PUSH_VAPID_CACHE_TTL = 24 * 60 * 60 * 1000;
const EVENT_PUSH_PRODUCTION_ORIGIN = "https://sotaylichviet.netlify.app";
let eventSystemReminderListenersReady = false;
let eventWebPushRecoveryPromise = null;
let eventWebPushRecoveryTimer = null;
let eventWebPushMutationPromise = Promise.resolve();
let eventWebPushMutationVersion = 0;
let eventWebPushMutationFailed = false;
let eventWebPushPublicKey = "";

function getEventPushApiUrl(path) {
  const hostname = window.location.hostname.toLowerCase();
  const isNetlifyPreview = hostname.endsWith("--sotaylichviet.netlify.app");
  return isNetlifyPreview ? `${EVENT_PUSH_PRODUCTION_ORIGIN}${path}` : getApiUrl(path);
}

function getEventPushApiOrigin() {
  return new URL(getEventPushApiUrl("/"), window.location.origin).origin;
}

function setupEventSystemReminderControls() {
  const buttons = Array.from(document.querySelectorAll(".event-system-reminder-trigger"));
  if (buttons.length === 0) return;

  refreshEventSystemReminderControls();
  buttons.filter((button) => button.dataset.eventSystemReminderReady !== "true").forEach((button) => {
    button.dataset.eventSystemReminderReady = "true";
    button.addEventListener("click", async () => {
      if (eventSystemRemindersAreEnabled()) {
        await disableEventSystemReminders();
        refreshEventSystemReminderControls();
        return;
      }
      if ("Notification" in window && Notification.permission === "denied") {
        openNotificationBlockedDialog();
        return;
      }

      const permission = await requestEventSystemNotificationPermission();
      if (permission === "granted") setEventSystemRemindersEnabled(true);
      updateEventSystemReminderButtons(buttons);
      if (permission === "granted") {
        const synced = await syncEventWebPushReminders();
        updateEventSystemReminderButtons(buttons, synced);
      }
    });
  });

  if (!eventSystemReminderListenersReady) {
    eventSystemReminderListenersReady = true;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshEventSystemReminderControls();
        scheduleEventWebPushRecovery();
      }
    });
    window.addEventListener("focus", () => {
      refreshEventSystemReminderControls();
      scheduleEventWebPushRecovery();
    });
    window.addEventListener("online", () => {
      scheduleEventWebPushRecovery();
    });
  }

  recoverEventWebPushReminders().then((synced) => refreshEventSystemReminderControls(synced));
}

function getEventSystemReminderButtons() {
  return Array.from(document.querySelectorAll(".event-system-reminder-trigger"));
}

function refreshEventSystemReminderControls(webPushSynced = true) {
  updateEventSystemReminderButtons(getEventSystemReminderButtons(), webPushSynced);
}

function updateEventSystemReminderButtons(buttons, webPushSynced = true) {
  buttons.forEach((button) => updateEventSystemReminderButton(button, webPushSynced));
}

function updateEventSystemReminderButton(button, webPushSynced = true) {
  const status = document.getElementById("systemReminderStatus");
  const action = button.querySelector("[data-reminder-action]") || button;
  if (!("Notification" in window)) {
    action.textContent = "Không hỗ trợ";
    if (status) status.textContent = "Không được hỗ trợ";
    button.disabled = true;
    button.classList.remove("is-enabled", "is-warning");
    return;
  }

  const permission = Notification.permission;
  const enabled = eventSystemRemindersAreEnabled();
  button.disabled = false;
  button.classList.toggle("is-enabled", enabled);
  button.classList.toggle("is-warning", permission === "denied");
  if (permission === "granted" && enabled) {
    action.textContent = "Tắt";
    if (status) status.textContent = webPushSynced ? "Đang bật" : "Cần đồng bộ lại";
    button.classList.toggle("is-warning", !webPushSynced);
  } else if (permission === "denied") {
    action.textContent = "Mở";
    if (status) status.textContent = "Đang bị trình duyệt chặn";
  } else {
    action.textContent = "Bật";
    if (status) status.textContent = "Đang tắt";
  }
}

function eventSystemRemindersAreEnabled() {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(EVENT_SYSTEM_REMINDER_ENABLED_KEY) !== "false";
  } catch (error) {
    return true;
  }
}

function setEventSystemRemindersEnabled(enabled) {
  try {
    localStorage.setItem(EVENT_SYSTEM_REMINDER_ENABLED_KEY, enabled ? "true" : "false");
  } catch (error) {
    // The current browser session can still continue when storage is unavailable.
  }
}

async function disableEventSystemReminders() {
  setEventSystemRemindersEnabled(false);
  try {
    const registration = await getReadyServiceWorkerRegistration();
    if (!registration || !registration.pushManager) return;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch (error) {
    console.error("disable web push reminders failed", error);
  }
}

async function requestEventSystemNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error("notification permission failed", error);
    return Notification.permission;
  }
}

function openNotificationBlockedDialog() {
  const existingDialog = document.getElementById("notificationBlockedDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "notificationBlockedDialog";
  dialog.className = "app-install-dialog";
  const secureText = window.isSecureContext
    ? "Kết nối bảo mật: đạt."
    : "Kết nối chưa bảo mật, trình duyệt có thể chặn thông báo.";
  dialog.innerHTML = `
    <div class="app-install-dialog-content">
      <h2>Thông báo đang bị chặn</h2>
      <p>Trình duyệt hoặc hệ điều hành đã chặn quyền thông báo cho ứng dụng, nên ứng dụng không thể tự bật lại quyền này.</p>
      <p>Trạng thái trình duyệt đang trả về: ${escapeHtml(Notification.permission)}. ${escapeHtml(secureText)}</p>
      <p>Hãy mở phần thông tin hoặc cài đặt quyền của trang web trong trình duyệt, chọn Thông báo rồi chuyển sang Cho phép.</p>
      <p>Nếu đang mở bằng ứng dụng đã cài, hãy vào cài đặt thông báo của ứng dụng trên thiết bị và bật quyền thông báo.</p>
      <div class="event-backup-dialog-actions">
        <button class="event-secondary-button" type="button" data-action="close">Đóng</button>
        <button class="event-submit" type="button" data-action="recheck">Kiểm tra lại</button>
      </div>
    </div>
  `;

  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("[data-action='close']").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-action='recheck']").addEventListener("click", async () => {
    refreshEventSystemReminderControls();
    if (Notification.permission === "granted") {
      const synced = await syncEventWebPushReminders();
      refreshEventSystemReminderControls(synced);
      dialog.close();
    }
  });
  dialog.showModal();
}

async function getReadyServiceWorkerRegistration(timeoutMs = 3000) {
  if (!navigator.serviceWorker || !navigator.serviceWorker.ready) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs))
  ]);
}

async function syncEventWebPushReminders() {
  markEventWebPushSyncDirty();
  const synced = await syncEventWebPushReminderPayloads();
  if (synced) markEventWebPushSyncComplete();
  return synced;
}

function markEventWebPushSyncDirty() {
  try {
    localStorage.setItem(EVENT_PUSH_SYNC_DIRTY_KEY, "true");
  } catch (error) {
    // A later explicit sync still works when localStorage is unavailable.
  }
}

function markEventWebPushSyncComplete() {
  eventWebPushMutationFailed = false;
  try {
    localStorage.removeItem(EVENT_PUSH_SYNC_DIRTY_KEY);
    localStorage.setItem(EVENT_PUSH_SYNC_SCHEMA_KEY, EVENT_PUSH_SYNC_SCHEMA_VERSION);
  } catch (error) {
    // Sync completion does not depend on local bookkeeping.
  }
}

function needsEventWebPushRecovery() {
  try {
    return localStorage.getItem(EVENT_PUSH_SYNC_DIRTY_KEY) === "true"
      || localStorage.getItem(EVENT_PUSH_SYNC_SCHEMA_KEY) !== EVENT_PUSH_SYNC_SCHEMA_VERSION;
  } catch (error) {
    return true;
  }
}

function recoverEventWebPushReminders() {
  if (!eventSystemRemindersAreEnabled()) return Promise.resolve(true);
  if (!needsEventWebPushRecovery()) return Promise.resolve(true);
  if (eventWebPushRecoveryPromise) return eventWebPushRecoveryPromise;
  eventWebPushRecoveryPromise = syncEventWebPushReminders()
    .finally(() => {
      eventWebPushRecoveryPromise = null;
    });
  return eventWebPushRecoveryPromise;
}

function scheduleEventWebPushRecovery() {
  if (eventWebPushRecoveryTimer !== null) window.clearTimeout(eventWebPushRecoveryTimer);
  eventWebPushRecoveryTimer = window.setTimeout(() => {
    eventWebPushRecoveryTimer = null;
    recoverEventWebPushReminders().then((synced) => refreshEventSystemReminderControls(synced));
  }, 250);
}

async function syncEventWebPushRemindersForEvent(event) {
  if (!event || !event.id) return false;
  if (!canUseEventWebPushReminderSync()) return false;
  const reminders = await buildEventPushReminderPayloadsForEvents([event]);
  return syncEventWebPushReminderPayloads({
    reminders,
    replaceEventIds: [event.id]
  });
}

async function removeEventWebPushReminders(eventId) {
  if (!eventId) return false;
  if (!canUseEventWebPushReminderSync()) return false;
  return syncEventWebPushReminderPayloads({
    reminders: [],
    replaceEventIds: [eventId]
  });
}

function queueEventWebPushReminderSync(promiseFactory) {
  markEventWebPushSyncDirty();
  eventWebPushMutationVersion += 1;
  const mutationVersion = eventWebPushMutationVersion;
  eventWebPushMutationPromise = eventWebPushMutationPromise
    .catch(() => false)
    .then(() => promiseFactory())
    .then((synced) => {
      if (!synced) {
        eventWebPushMutationFailed = true;
        markEventWebPushSyncDirty();
      } else if (!eventWebPushMutationFailed && mutationVersion === eventWebPushMutationVersion) {
        markEventWebPushSyncComplete();
      }
      refreshEventSystemReminderControls(synced);
      return synced;
    })
    .catch((error) => {
      eventWebPushMutationFailed = true;
      markEventWebPushSyncDirty();
      console.error("queued web push reminder sync failed", error);
      refreshEventSystemReminderControls(false);
      return false;
    });
}

function queueEventWebPushReminderSyncForEvent(event) {
  queueEventWebPushReminderSync(() => syncEventWebPushRemindersForEvent(event));
}

function queueRemoveEventWebPushReminders(eventId) {
  queueEventWebPushReminderSync(() => removeEventWebPushReminders(eventId));
}

async function syncEventWebPushReminderPayloads(options = {}) {
  if (!canUseEventWebPushReminderSync()) return false;

  try {
    const registration = await getReadyServiceWorkerRegistration();
    if (!registration || !registration.pushManager) return false;
    const subscription = await getOrCreateWebPushSubscription(registration);
    const reminders = Array.isArray(options.reminders)
      ? options.reminders
      : await buildEventPushReminderPayloads();
    const payload = { appId: location.origin, subscription, reminders };
    if (Array.isArray(options.replaceEventIds)) {
      payload.replaceEventIds = options.replaceEventIds;
    }
    const response = await fetch(getEventPushApiUrl("/api/push-subscription"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (error) {
    console.error("web push reminder sync failed", error);
    return false;
  }
}

function canUseEventWebPushReminderSync() {
  return ("Notification" in window)
    && Notification.permission === "granted"
    && eventSystemRemindersAreEnabled()
    && Boolean(window.LichVietData)
    && ("serviceWorker" in navigator)
    && ("PushManager" in window);
}

async function sendEventWebPushTestNotification() {
  if (!("Notification" in window)) {
    return { ok: false, error: "Notification is not supported." };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Web Push is not supported." };
  }

  const permission = await requestEventSystemNotificationPermission();
  if (permission !== "granted") {
    return { ok: false, error: `Notification permission is ${permission}.` };
  }

  try {
    const registration = await getReadyServiceWorkerRegistration();
    if (!registration || !registration.pushManager) {
      return { ok: false, error: "Service worker is not ready." };
    }

    const subscription = await getOrCreateWebPushSubscription(registration);
    const response = await fetch(getEventPushApiUrl("/api/send-test-push"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId: location.origin, subscription })
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok && data.ok === true, httpStatus: response.status, ...data };
  } catch (error) {
    console.error("test web push failed", error);
    return { ok: false, error: error.message || "Could not send test push." };
  }
}

async function getWebPushPublicKey() {
  if (eventWebPushPublicKey) return eventWebPushPublicKey;

  const apiOrigin = getEventPushApiOrigin();
  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(EVENT_PUSH_VAPID_CACHE_KEY) || "null");
    if (cached && cached.publicKey && cached.apiOrigin === apiOrigin && Date.now() - Number(cached.cachedAt) < EVENT_PUSH_VAPID_CACHE_TTL) {
      eventWebPushPublicKey = cached.publicKey;
      return eventWebPushPublicKey;
    }
  } catch (error) {
    cached = null;
  }

  try {
    const response = await fetch(getEventPushApiUrl("/api/push-vapid-public-key"), { cache: "no-store" });
    if (!response.ok) throw new Error("VAPID public key is unavailable.");
    const data = await response.json();
    eventWebPushPublicKey = data && data.publicKey ? data.publicKey : "";
    if (eventWebPushPublicKey) {
      try {
        localStorage.setItem(EVENT_PUSH_VAPID_CACHE_KEY, JSON.stringify({
          publicKey: eventWebPushPublicKey,
          apiOrigin,
          cachedAt: Date.now()
        }));
      } catch (error) {
        // The in-memory cache remains available when localStorage is blocked.
      }
    }
    return eventWebPushPublicKey;
  } catch (error) {
    return cached && cached.publicKey && cached.apiOrigin === apiOrigin ? cached.publicKey : "";
  }
}

async function getOrCreateWebPushSubscription(registration) {
  const existing = await registration.pushManager.getSubscription();
  const publicKey = await getWebPushPublicKey();
  if (!publicKey) {
    if (existing) return existing;
    throw new Error("Missing VAPID public key.");
  }

  if (existing && pushSubscriptionUsesPublicKey(existing, publicKey)) return existing;
  if (existing) await existing.unsubscribe();

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
}

function pushSubscriptionUsesPublicKey(subscription, publicKey) {
  const existingKey = subscription && subscription.options && subscription.options.applicationServerKey;
  if (!existingKey) return true;
  const expected = urlBase64ToUint8Array(publicKey);
  const actual = new Uint8Array(existingKey);
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}
