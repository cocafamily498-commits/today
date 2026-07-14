async function loadAppPartials() {
  const root = document.getElementById("appRoot");
  const partialVersion = "2026-07-14-astrology-year-control";
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
    const response = await fetch(`partials/${name}.html?v=${partialVersion}`);
    if (!response.ok) throw new Error(`Cannot load partial: ${name}`);
    return response.text();
  }));
  root.innerHTML = html.join("\n");
}
