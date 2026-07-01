let deferredInstallPrompt = null;

function isStandalonePwa() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
}

function showInstallGuidance() {
  const existingDialog = document.getElementById("appInstallDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "appInstallDialog";
  dialog.className = "app-install-dialog";
  const ios = isIosDevice();
  dialog.innerHTML = `
    <div class="app-install-dialog-content">
      <h2>Cài đặt Sổ tay lịch Việt</h2>
      <p>${ios
        ? "Trên iPhone/iPad, bấm nút Chia sẻ của Safari rồi chọn Thêm vào Màn hình chính."
        : "Trình duyệt này chưa mở hộp cài đặt tự động. Hãy dùng menu trình duyệt và chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính."}</p>
      <button class="event-submit" type="button">Đã hiểu</button>
    </div>
  `;

  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.showModal();
}

async function handleInstallClick() {
  if (!deferredInstallPrompt) {
    showInstallGuidance();
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
}

function setupPwaInstall() {
  const installButton = document.getElementById("appInstallButton");
  if (!installButton) return;

  if (isStandalonePwa()) {
    installButton.hidden = true;
    return;
  }

  installButton.hidden = false;
  installButton.addEventListener("click", handleInstallClick);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("service worker registration failed", error);
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
