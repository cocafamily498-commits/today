function setupCollapsiblePanels() {
  document.querySelectorAll("[data-collapse-key]").forEach((panel) => {
    // Deferred tabs are inserted after the first startup pass. This marker lets
    // us safely scan again without attaching duplicate click handlers.
    if (panel.dataset.collapseReady === "true") return;

    const storageKey = `homnay.${panel.dataset.collapseKey}PanelCollapsed`;
    const collapseButton = panel.querySelector(".market-collapse-button");
    const restoreButton = panel.querySelector(".market-restore-button");

    if (!collapseButton || !restoreButton) return;

    const setCollapsed = (collapsed) => {
      panel.classList.toggle("is-collapsed", collapsed);
      collapseButton.setAttribute("aria-expanded", String(!collapsed));
      restoreButton.setAttribute("aria-expanded", String(!collapsed));

      try {
        localStorage.setItem(storageKey, String(collapsed));
      } catch (error) {
        // The controls still work when browser storage is unavailable.
      }
    };

    let initiallyCollapsed = false;
    try {
      initiallyCollapsed = localStorage.getItem(storageKey) === "true";
    } catch (error) {
      // Keep the panel expanded when browser storage is unavailable.
    }

    setCollapsed(initiallyCollapsed);
    collapseButton.addEventListener("click", () => setCollapsed(true));
    restoreButton.addEventListener("click", () => setCollapsed(false));
    panel.dataset.collapseReady = "true";
  });
}

function runStartupTask(task, label) {
  try {
    const result = task();
    if (result && typeof result.catch === "function") {
      result.catch((error) => console.error(`${label} failed`, error));
    }
  } catch (error) {
    console.error(`${label} failed`, error);
  }
}

function scheduleBackgroundTask(task, label) {
  const run = () => runStartupTask(task, label);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
}

function waitForInitialPaint() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function setupLazyTabInitialization() {
  const initialized = new Set();
  const initializeTab = (tabId) => {
    if (!tabId || initialized.has(tabId)) return;
    if (tabId === "eventsTab") runStartupTask(setupEventForm, "setupEventForm");
    else if (tabId === "journalsTab") runStartupTask(setupJournalCalendar, "setupJournalCalendar");
    else if (tabId === "converterTab") runStartupTask(setupConversionTool, "setupConversionTool");
    else return;
    initialized.add(tabId);
  };

  document.addEventListener("app:tab-activated", (event) => initializeTab(event.detail && event.detail.tabId));
  initializeTab((location.hash || "#todayTab").slice(1));
}

async function startApplication() {
  if (window.LichVietVaultSessionPromise) {
    const vaultResult = await window.LichVietVaultSessionPromise;
    if (!vaultResult.ok) throw vaultResult.error;
  } else {
    await window.LichVietVault.requireSession();
  }
  await loadInitialAppPartials();

  [
    [window.render, "render"],
    [window.setupVietnameseValidationMessages, "setupVietnameseValidationMessages"],
    [window.setupCollapsiblePanels, "setupCollapsiblePanels"],
    [window.setupMarketDataRefresh, "setupMarketDataRefresh"],
    [window.setupWeatherDataRefresh, "setupWeatherDataRefresh"]
  ].forEach(([task, label]) => runStartupTask(task, label));

  // Give the browser a chance to display Today before fetching and building
  // tabs/dialogs that are not needed for the first screen.
  await waitForInitialPaint();

  let deferredUiReady = false;
  try {
    await loadDeferredAppPartials();
    deferredUiReady = true;
  } catch (error) {
    // Today remains usable even if a secondary partial temporarily fails.
    console.error("deferred application UI failed", error);
  }

  if (deferredUiReady) {
    [
      [window.setupCollapsiblePanels, "setupDeferredCollapsiblePanels"],
      [window.setupAppTabs, "setupAppTabs"],
      [window.setupApplicationInfo, "setupApplicationInfo"],
      [window.LichVietVault?.setupSystemControls, "setupSystemVaultControls"],
      [window.setupMonthlyCalendar, "setupMonthlyCalendar"],
      [window.setupEventSystemReminderControls, "setupEventSystemReminderControls"],
      [window.setupTodayEventReminderPrompt, "setupTodayEventReminderPrompt"],
      [window.setupLazyTabInitialization, "setupLazyTabInitialization"]
    ].forEach(([task, label]) => runStartupTask(task, label));
  }

  [
    [window.setupLocationPicker, "setupLocationPicker"],
    [window.setupPwaInstall, "setupPwaInstall"],
    [window.registerServiceWorker, "registerServiceWorker"],
    [window.loadWeather, "loadWeather"],
    [window.loadMarkets, "loadMarkets"],
    [window.loadAssets, "loadAssets"],
    [window.loadQuotes, "loadQuotes"]
  ].forEach(([task, label]) => scheduleBackgroundTask(task, label));

  if (deferredUiReady && typeof window.importSharedBackupFile === "function") {
    await window.importSharedBackupFile();
  }

}

startApplication().catch((error) => {
  console.error("startup failed", error);
  const root = document.getElementById("appRoot");
  if (root) {
    const message = error && error.name === "VersionError"
      ? "Dữ liệu local đang dùng phiên bản mới hơn ứng dụng. Hãy tải lại bản mới nhất."
      : error && error.message ? error.message : "Không tải được giao diện ứng dụng.";
    root.replaceChildren();
    const panel = document.createElement("section");
    panel.className = "vault-gate";
    const title = document.createElement("h1");
    title.textContent = "Chưa mở được dữ liệu local";
    const detail = document.createElement("p");
    detail.setAttribute("role", "alert");
    detail.textContent = message;
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "Tải lại ứng dụng";
    reload.addEventListener("click", () => location.reload());
    panel.append(title, detail, reload);
    root.append(panel);
  }
});
