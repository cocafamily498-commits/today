const EVENT_SYSTEM_REMINDER_CHECK_INTERVAL = 60 * 1000;
const EVENT_SYSTEM_REMINDER_STORAGE_KEY = "lichviet.systemReminderNotifications";
const EVENT_PUSH_REMINDER_DAYS_AHEAD = 370;
let eventSystemReminderTimer = null;

function setupEventSystemReminderControls() {
  const buttons = Array.from(document.querySelectorAll(".event-system-reminder-trigger"));
  if (buttons.length === 0) return;

  refreshEventSystemReminderControls();
  buttons.forEach((button) => button.addEventListener("click", async () => {
    if ("Notification" in window && Notification.permission === "denied") {
      openNotificationBlockedDialog();
      return;
    }

    const permission = await requestEventSystemNotificationPermission();
    updateEventSystemReminderButtons(buttons);
    if (permission === "granted") {
      await showEventSystemTestNotification();
      const synced = await syncEventWebPushReminders();
      await showDueEventSystemNotifications();
      updateEventSystemReminderButtons(buttons, synced);
    }
  }));

  if (!eventSystemReminderTimer) {
    eventSystemReminderTimer = window.setInterval(showDueEventSystemNotifications, EVENT_SYSTEM_REMINDER_CHECK_INTERVAL);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshEventSystemReminderControls();
        showDueEventSystemNotifications();
      }
    });
    window.addEventListener("focus", () => {
      refreshEventSystemReminderControls();
      showDueEventSystemNotifications();
    });
  }

  showDueEventSystemNotifications();
  syncEventWebPushReminders();
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
  if (!("Notification" in window)) {
    button.textContent = "Không hỗ trợ nhắc hệ thống";
    button.disabled = true;
    button.classList.remove("is-enabled", "is-warning");
    return;
  }

  const permission = Notification.permission;
  button.disabled = false;
  button.classList.toggle("is-enabled", permission === "granted");
  button.classList.toggle("is-warning", permission === "denied");
  if (permission === "granted") {
    button.textContent = webPushSynced ? "Đã bật nhắc hệ thống" : "Chưa cấu hình Web Push";
    button.classList.toggle("is-warning", !webPushSynced);
  } else if (permission === "denied") {
    button.textContent = "Thông báo bị chặn";
  } else {
    button.textContent = "Bật nhắc hệ thống";
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
  const secureText = window.isSecureContext ? "Kết nối bảo mật: đạt." : "Kết nối chưa bảo mật, trình duyệt có thể chặn thông báo.";
  dialog.innerHTML = `
    <div class="app-install-dialog-content">
      <h2>Thông báo đang bị chặn</h2>
      <p>Android/Chrome đã chặn quyền thông báo cho app này, nên ứng dụng không thể tự bật lại bằng nút trong web.</p>
      <p>Trạng thái trình duyệt đang trả về: ${escapeHtml(Notification.permission)}. ${escapeHtml(secureText)}</p>
      <p>Trên Chrome Android: bấm biểu tượng ổ khóa hoặc chữ thông tin cạnh thanh địa chỉ, vào Quyền trang web, chọn Thông báo, rồi chuyển sang Cho phép.</p>
      <p>Nếu đang mở bằng app đã cài: nhấn giữ biểu tượng app, chọn Thông tin ứng dụng, vào Thông báo, rồi bật Cho phép thông báo.</p>
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
      await showEventSystemTestNotification();
      const synced = await syncEventWebPushReminders();
      refreshEventSystemReminderControls(synced);
      dialog.close();
    }
  });
  dialog.showModal();
}

async function showDueEventSystemNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted" || !window.LichVietData) return;

  try {
    const reminders = await getTodayEventReminderItems();
    for (const item of reminders) {
      const key = getEventSystemReminderKey(item);
      if (hasEventSystemReminderNotification(key)) continue;
      await showEventSystemNotification(item);
      markEventSystemReminderNotification(key);
    }
  } catch (error) {
    console.error("system event reminders failed", error);
  }
}

function getEventSystemReminderKey({ event, reminder, occurrenceDate }) {
  const reminderId = reminder && reminder.id ? reminder.id : "default";
  return `${event.id}:${reminderId}:${occurrenceDate}`;
}

function getEventSystemReminderNotificationMap() {
  try {
    return JSON.parse(localStorage.getItem(EVENT_SYSTEM_REMINDER_STORAGE_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function hasEventSystemReminderNotification(key) {
  return Boolean(getEventSystemReminderNotificationMap()[key]);
}

function markEventSystemReminderNotification(key) {
  try {
    const map = getEventSystemReminderNotificationMap();
    map[key] = new Date().toISOString();
    localStorage.setItem(EVENT_SYSTEM_REMINDER_STORAGE_KEY, JSON.stringify(pruneEventSystemReminderNotificationMap(map)));
  } catch (error) {
    // Notification delivery should not depend on localStorage availability.
  }
}

function pruneEventSystemReminderNotificationMap(map) {
  const entries = Object.entries(map)
    .sort((left, right) => String(right[1]).localeCompare(String(left[1])))
    .slice(0, 200);
  return Object.fromEntries(entries);
}

async function showEventSystemNotification({ event, occurrenceDate }) {
  const title = event && event.title ? `Nhắc sự kiện: ${event.title}` : "Nhắc sự kiện";
  const body = [
    getEventReminderLeadText(event, occurrenceDate),
    getEventDateSummary(event, occurrenceDate)
  ].filter(Boolean).join("\n");
  const options = {
    body,
    tag: `lichviet-event-${event.id}-${occurrenceDate}`,
    renotify: true,
    icon: "/icons/app-icon-lichviet-transparent-192.png",
    badge: "/icons/app-icon-lichviet-transparent-192.png",
    data: {
      url: `${window.location.origin}${window.location.pathname}#eventsTab`,
      eventId: event.id,
      occurrenceDate
    }
  };

  const registration = await getReadyServiceWorkerRegistration();
  if (registration && registration.showNotification) {
    await registration.showNotification(title, options);
    return;
  }

  new Notification(title, options);
}

async function showEventSystemTestNotification() {
  const options = {
    body: "Thông báo hệ thống đã bật. Các nhắc sự kiện sẽ hiện ở đây khi đến giờ.",
    tag: "lichviet-event-reminder-test",
    renotify: true,
    icon: "/icons/app-icon-lichviet-transparent-192.png",
    badge: "/icons/app-icon-lichviet-transparent-192.png",
    data: {
      url: `${window.location.origin}${window.location.pathname}#eventsTab`
    }
  };

  try {
    const registration = await getReadyServiceWorkerRegistration();
    if (registration && registration.showNotification) {
      await registration.showNotification("Sổ tay lịch Việt", options);
      return;
    }
    new Notification("Sổ tay lịch Việt", options);
  } catch (error) {
    console.error("test notification failed", error);
  }
}

async function getReadyServiceWorkerRegistration(timeoutMs = 3000) {
  if (!navigator.serviceWorker || !navigator.serviceWorker.ready) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs))
  ]);
}

async function syncEventWebPushReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted" || !window.LichVietData) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  try {
    const publicKey = await getWebPushPublicKey();
    if (!publicKey) return false;
    const registration = await getReadyServiceWorkerRegistration();
    if (!registration || !registration.pushManager) return false;
    const subscription = await getOrCreateWebPushSubscription(registration, publicKey);
    const reminders = await buildEventPushReminderPayloads();
    const response = await fetch(getApiUrl("/api/push-subscription"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription, reminders })
    });
    return response.ok;
  } catch (error) {
    console.error("web push reminder sync failed", error);
    return false;
  }
}

async function getWebPushPublicKey() {
  const response = await fetch(getApiUrl("/api/push-vapid-public-key"), { cache: "no-store" });
  if (!response.ok) return "";
  const data = await response.json();
  return data && data.publicKey ? data.publicKey : "";
}

async function getOrCreateWebPushSubscription(registration, publicKey) {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
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
