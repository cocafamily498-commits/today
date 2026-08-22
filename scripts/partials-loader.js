const APP_PARTIAL_VERSION = "2026-08-21-fast-start-v1";
const APP_PARTIAL_VERSIONS = {
  "events-tab": "2026-08-22-remove-calendar-heading",
  "journals-tab": "2026-08-02-journal-filter-count"
};
const INITIAL_APP_PARTIALS = ["tabs", "today-tab"];
const DEFERRED_APP_PARTIALS = [
  "converter-tab",
  "events-tab",
  "journals-tab",
  "app-info-tab",
  "event-dialog",
  "journal-dialog",
  "app-info-dialog"
];
let initialAppPartialsPromise = null;

async function fetchAppPartials(names) {
  return Promise.all(names.map(async (name) => {
    const version = APP_PARTIAL_VERSIONS[name] || APP_PARTIAL_VERSION;
    const response = await fetch(`partials/${name}.html?v=${version}`);
    if (!response.ok) throw new Error(`Cannot load partial: ${name}`);
    return response.text();
  }));
}

function setDeferredTabsDisabled(disabled) {
  document.querySelectorAll(".app-tab:not(#todayTabButton)").forEach((button) => {
    button.disabled = disabled;
    button.setAttribute("aria-disabled", String(disabled));
  });
}

function preloadInitialAppPartials() {
  if (!initialAppPartialsPromise) {
    initialAppPartialsPromise = fetchAppPartials(INITIAL_APP_PARTIALS).catch((error) => {
      // Allow a normal retry after unlock when a speculative preload failed.
      initialAppPartialsPromise = null;
      throw error;
    });
  }
  return initialAppPartialsPromise;
}

async function loadInitialAppPartials() {
  const root = document.getElementById("appRoot");
  const html = await preloadInitialAppPartials();
  root.innerHTML = html.join("\n");
  setDeferredTabsDisabled(true);
}

async function loadDeferredAppPartials() {
  const root = document.getElementById("appRoot");
  const html = await fetchAppPartials(DEFERRED_APP_PARTIALS);
  root.insertAdjacentHTML("beforeend", html.join("\n"));
  setDeferredTabsDisabled(false);
}

// Kept for callers that need the complete application DOM in one operation.
async function loadAppPartials() {
  await loadInitialAppPartials();
  await loadDeferredAppPartials();
}
