async function loadAppPartials() {
  const root = document.getElementById("appRoot");
  const partialVersion = "2026-07-26-app-version-3";
  const partialVersions = {
    "events-tab": "2026-08-02-event-calendar-preview",
    "journals-tab": "2026-08-02-journal-filter-count"
  };
  const partials = [
    "tabs",
    "today-tab",
    "converter-tab",
    "events-tab",
    "journals-tab",
    "app-info-tab",
    "event-dialog",
    "journal-dialog",
    "app-info-dialog"
  ];
  const html = await Promise.all(partials.map(async (name) => {
    const response = await fetch(`partials/${name}.html?v=${partialVersions[name] || partialVersion}`);
    if (!response.ok) throw new Error(`Cannot load partial: ${name}`);
    return response.text();
  }));
  root.innerHTML = html.join("\n");
}
