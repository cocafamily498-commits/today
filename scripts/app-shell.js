function setupAppTabs() {
  const buttons = [
    document.getElementById("todayTabButton"),
    document.getElementById("converterTabButton"),
    document.getElementById("eventsTabButton"),
    document.getElementById("journalsTabButton"),
    document.getElementById("appInfoTabButton")
  ].filter(Boolean);
  const panels = buttons.map((button) => document.getElementById(button.getAttribute("aria-controls")));
  const stage = document.createElement("div");
  stage.className = "tab-panels-stage";
  panels[0].before(stage);
  panels.forEach((panel) => stage.append(panel));
  const desktopQuery = window.matchMedia("(min-width: 521px)");
  const HOVER_DELAY = 300;
  const FADE_DURATION = 550;
  let hoverTimer = 0;
  let transitionTimer = 0;
  let transitionVersion = 0;

  const syncPanels = (selectedButton) => {
    const desktop = desktopQuery.matches;
    buttons.forEach((item, index) => {
      const selected = item === selectedButton;
      const panel = panels[index];
      item.setAttribute("aria-selected", selected ? "true" : "false");
      panel.classList.toggle("is-active", selected);
      panel.hidden = desktop ? false : !selected;
      panel.setAttribute("aria-hidden", selected ? "false" : "true");
      panel.inert = !selected;
    });
  };

  const commitActivation = (button, updateHash) => {
    if (button.getAttribute("aria-selected") === "true") return;
    syncPanels(button);
    if (updateHash) history.replaceState(null, "", `#${button.getAttribute("aria-controls")}`);
    document.dispatchEvent(new CustomEvent("app:tab-activated", {
      detail: { tabId: button.getAttribute("aria-controls") }
    }));
  };

  const activate = (button, updateHash) => {
    window.clearTimeout(hoverTimer);
    if (button.getAttribute("aria-selected") === "true") return;
    if (!desktopQuery.matches) {
      commitActivation(button, updateHash);
      return;
    }

    const version = ++transitionVersion;
    window.clearTimeout(transitionTimer);
    // Flush the fully visible state so the browser always paints the fade-out.
    void stage.offsetWidth;
    stage.classList.add("is-switching");
    transitionTimer = window.setTimeout(() => {
      if (version !== transitionVersion) return;
      commitActivation(button, updateHash);
      // Keep the new panel at the dimmed opacity for one complete frame before fading in.
      void stage.offsetWidth;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (version === transitionVersion) stage.classList.remove("is-switching");
        });
      });
    }, FADE_DURATION);
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => activate(button, true));
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch" && desktopQuery.matches) {
        window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => activate(button, false), HOVER_DELAY);
      }
    });
    button.addEventListener("pointerleave", () => window.clearTimeout(hoverTimer));
    button.addEventListener("focus", () => {
      if (desktopQuery.matches) activate(button, false);
    });
  });
  const hashedButton = buttons.find((button) => location.hash === `#${button.getAttribute("aria-controls")}`);
  const initialButton = hashedButton || buttons.find((button) => button.getAttribute("aria-selected") === "true") || buttons[0];
  syncPanels(initialButton);
  window.addEventListener("resize", () => {
    window.clearTimeout(hoverTimer);
    window.clearTimeout(transitionTimer);
    transitionVersion += 1;
    stage.classList.remove("is-switching");
    const selectedButton = buttons.find((button) => button.getAttribute("aria-selected") === "true") || buttons[0];
    syncPanels(selectedButton);
  });
}

function setupApplicationInfo() {
  const button = document.getElementById("appInfoButton");
  const dialog = document.getElementById("appInfoDialog");
  if (!button || !dialog) return;
  button.addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  const installButton = document.getElementById("systemInstallButton");
  const exportButton = document.getElementById("systemExportButton");
  const importButton = document.getElementById("systemImportButton");
  const importInput = document.getElementById("systemImportInput");

  if (installButton) installButton.addEventListener("click", handleInstallClick);
  if (exportButton) exportButton.addEventListener("click", openBackupExplanationDialog);
  if (importButton && importInput) {
    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = "";
      if (!file) return;
      await importEventBackupFile(file);
    });
  }

  setupDesktopZipDropImport();
  setupPwaZipFileHandling();
}

let desktopZipDropSetupReady = false;
let pwaZipFileHandlingReady = false;

function setupDesktopZipDropImport() {
  if (desktopZipDropSetupReady) return;
  desktopZipDropSetupReady = true;
  let dragDepth = 0;
  const overlay = document.createElement("div");
  overlay.className = "zip-import-drop-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="zip-import-drop-card" role="status" aria-live="polite">
      <span class="zip-import-drop-icon" aria-hidden="true">ZIP</span>
      <strong>Thả file sao lưu vào đây</strong>
      <span>Chỉ chấp nhận một file .zip của Sổ tay lịch Việt</span>
    </div>
  `;
  document.body.append(overlay);

  const isFileDrag = (event) => Array.from(event.dataTransfer && event.dataTransfer.types || []).includes("Files");
  window.addEventListener("dragenter", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth += 1;
    overlay.hidden = false;
    document.body.classList.add("zip-import-dragging");
  });
  window.addEventListener("dragover", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  window.addEventListener("dragleave", (event) => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) hideZipImportDropOverlay(overlay);
  });
  window.addEventListener("dragend", () => {
    dragDepth = 0;
    hideZipImportDropOverlay(overlay);
  });
  window.addEventListener("drop", async (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth = 0;
    hideZipImportDropOverlay(overlay);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length !== 1 || !isZipImportFile(files[0])) {
      showZipImportFileError();
      return;
    }
    await importEventBackupFile(files[0]);
  });
}

function hideZipImportDropOverlay(overlay) {
  overlay.hidden = true;
  document.body.classList.remove("zip-import-dragging");
}

function isZipImportFile(file) {
  return Boolean(file && /\.zip$/i.test(file.name || ""));
}

function showZipImportFileError() {
  const message = "Hãy chọn hoặc kéo thả đúng một file sao lưu có đuôi .zip.";
  if (typeof openEventBackupMessageDialog === "function") {
    openEventBackupMessageDialog("Không thể nhập file", message, "Đóng");
  } else if (typeof setEventFormStatus === "function") {
    setEventFormStatus(message, true);
  }
}

function setupPwaZipFileHandling() {
  if (pwaZipFileHandlingReady || !("launchQueue" in window)) return;
  pwaZipFileHandlingReady = true;
  window.launchQueue.setConsumer(async (launchParams) => {
    const handles = Array.from(launchParams.files || []);
    if (handles.length !== 1) return;
    try {
      const file = await handles[0].getFile();
      if (!isZipImportFile(file)) {
        showZipImportFileError();
        return;
      }
      await importEventBackupFile(file);
    } catch (error) {
      console.error("PWA ZIP file import failed", error);
      showZipImportFileError();
    }
  });
}

async function importSharedBackupFile() {
  const params = new URLSearchParams(location.search);
  const shareId = params.get("share-target");
  if (!shareId) return;

  history.replaceState(null, "", `${location.pathname}${location.hash}`);
  try {
    const response = await fetch(`/share-target-file?id=${encodeURIComponent(shareId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Không đọc được file được chia sẻ.");
    const blob = await response.blob();
    const fileName = decodeURIComponent(response.headers.get("x-share-file-name") || "Sotaylichviet-backup.zip");
    const file = new File([blob], fileName, { type: blob.type || "application/zip" });
    await importEventBackupFile(file);
  } catch (error) {
    console.error("shared backup import failed", error);
    if (typeof setEventFormStatus === "function") {
      setEventFormStatus("Không thể nhập file sao lưu được chia sẻ.", true);
    }
  }
}
