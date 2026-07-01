let deferredInstallPrompt = null;
let appUpdateDialogShown = false;
const APP_VERSION = "homnay-pwa-v31";
const APP_VERSION_STORAGE_KEY = "homnay.appVersion";

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
      <h2>C\u00e0i \u0111\u1eb7t S\u1ed5 tay l\u1ecbch Vi\u1ec7t</h2>
      <p>${ios
        ? "Tr\u00ean iPhone/iPad, b\u1ea5m n\u00fat Chia s\u1ebb c\u1ee7a Safari r\u1ed3i ch\u1ecdn Th\u00eam v\u00e0o M\u00e0n h\u00ecnh ch\u00ednh."
        : "Tr\u00ecnh duy\u1ec7t n\u00e0y ch\u01b0a m\u1edf h\u1ed9p c\u00e0i \u0111\u1eb7t t\u1ef1 \u0111\u1ed9ng. H\u00e3y d\u00f9ng menu tr\u00ecnh duy\u1ec7t v\u00e0 ch\u1ecdn C\u00e0i \u0111\u1eb7t \u1ee9ng d\u1ee5ng ho\u1eb7c Th\u00eam v\u00e0o m\u00e0n h\u00ecnh ch\u00ednh."}</p>
      <button class="event-submit" type="button">\u0110\u00e3 hi\u1ec3u</button>
    </div>
  `;

  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.showModal();
}

function showAppUpdatedDialog() {
  if (appUpdateDialogShown) return;
  appUpdateDialogShown = true;

  const existingDialog = document.getElementById("appUpdatedDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "appUpdatedDialog";
  dialog.className = "app-install-dialog";
  dialog.innerHTML = `
    <div class="app-install-dialog-content">
      <h2>\u0110\u00e3 c\u1eadp nh\u1eadt phi\u00ean b\u1ea3n m\u1edbi</h2>
      <p>\u1ee8ng d\u1ee5ng \u0111\u00e3 t\u1ea3i v\u00e0 \u0111ang ch\u1ea1y phi\u00ean b\u1ea3n m\u1edbi nh\u1ea5t.</p>
      <p>N\u1ebfu bi\u1ec3u t\u01b0\u1ee3ng ngo\u00e0i m\u00e0n h\u00ecnh ch\u00ednh v\u1eabn l\u00e0 icon c\u0169, Android \u0111ang gi\u1eef cache shortcut. H\u00e3y g\u1ee1 app/shortcut r\u1ed3i c\u00e0i l\u1ea1i \u0111\u1ec3 \u0111\u1ed5i icon ngay.</p>
      <button class="event-submit" type="button">\u0110\u00e3 hi\u1ec3u</button>
    </div>
  `;

  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.showModal();
}

function checkAppVersionNotice() {
  let previousVersion = "";
  try {
    previousVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY) || "";
    if (previousVersion === APP_VERSION) return;
    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
  } catch (error) {
    return;
  }

  if (previousVersion || isStandalonePwa()) {
    window.setTimeout(showAppUpdatedDialog, 600);
  }
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
  checkAppVersionNotice();

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
    const hadController = Boolean(navigator.serviceWorker.controller);
    let updateDialogHandled = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || updateDialogHandled) return;
      updateDialogHandled = true;
      showAppUpdatedDialog();
    });

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
