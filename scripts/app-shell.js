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

  const syncPanels = (selectedButton) => {
    const desktop = window.matchMedia("(min-width: 521px)").matches;
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

  const activate = (button, updateHash) => {
    if (button.getAttribute("aria-selected") === "true") return;
    syncPanels(button);
    if (updateHash) history.replaceState(null, "", `#${button.getAttribute("aria-controls")}`);
    document.dispatchEvent(new CustomEvent("app:tab-activated", {
      detail: { tabId: button.getAttribute("aria-controls") }
    }));
  };
  buttons.forEach((button) => {
    button.addEventListener("click", () => activate(button, true));
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch" && window.matchMedia("(min-width: 521px)").matches) {
        activate(button, false);
      }
    });
    button.addEventListener("focus", () => {
      if (window.matchMedia("(min-width: 521px)").matches) activate(button, false);
    });
  });
  const hashedButton = buttons.find((button) => location.hash === `#${button.getAttribute("aria-controls")}`);
  const initialButton = hashedButton || buttons.find((button) => button.getAttribute("aria-selected") === "true") || buttons[0];
  syncPanels(initialButton);
  window.addEventListener("resize", () => {
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
      if (typeof syncEventWebPushReminders === "function") await syncEventWebPushReminders();
    });
  }
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
