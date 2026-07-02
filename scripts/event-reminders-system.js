const EVENT_SYSTEM_REMINDER_CHECK_INTERVAL = 60 * 1000;
const EVENT_PUSH_REMINDER_DAYS_AHEAD = 370;
let eventSystemReminderListenersReady = false;

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
      const synced = await syncEventWebPushReminders();
      updateEventSystemReminderButtons(buttons, synced);
    }
  }));

  if (!eventSystemReminderListenersReady) {
    eventSystemReminderListenersReady = true;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshEventSystemReminderControls();
        syncEventWebPushReminders().then((synced) => refreshEventSystemReminderControls(synced));
      }
    });
    window.addEventListener("focus", () => {
      refreshEventSystemReminderControls();
      syncEventWebPushReminders().then((synced) => refreshEventSystemReminderControls(synced));
    });
  }

  syncEventWebPushReminders().then((synced) => refreshEventSystemReminderControls(synced));
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
  const secureText = window.isSecureContext
    ? "Kết nối bảo mật: đạt."
    : "Kết nối chưa bảo mật, trình duyệt có thể chặn thông báo.";
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
    const publicKey = await getWebPushPublicKey();
    if (!publicKey) return { ok: false, error: "Missing VAPID public key." };

    const registration = await getReadyServiceWorkerRegistration();
    if (!registration || !registration.pushManager) {
      return { ok: false, error: "Service worker is not ready." };
    }

    const subscription = await getOrCreateWebPushSubscription(registration, publicKey);
    const response = await fetch(getApiUrl("/api/send-test-push"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription })
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok && data.ok === true, httpStatus: response.status, ...data };
  } catch (error) {
    console.error("test web push failed", error);
    return { ok: false, error: error.message || "Could not send test push." };
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
