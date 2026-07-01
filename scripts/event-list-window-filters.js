function initializeEventListWindowFilters(targetWindow, openEventCallback = null) {
  const doc = targetWindow && targetWindow.document;
  if (!doc) return;

  const form = doc.getElementById("eventFilterForm");
  const monthInput = doc.getElementById("eventMonthFilter");
  const nameInput = doc.getElementById("eventNameFilter");
  const typeInputs = [...doc.querySelectorAll("input[name='eventType']")];
  const cards = [...doc.querySelectorAll(".event-card")];
  const emptyState = doc.getElementById("eventFilterEmptyState");
  if (!form || !monthInput || !nameInput) return;
  if (form.dataset.filtersReady === "true") return;
  form.dataset.filtersReady = "true";

  const normalizeFilterText = (value) => String(value || "").trim().toLowerCase();

  const applyEventFilters = () => {
    const selectedTypes = new Set(typeInputs.filter((input) => input.checked).map((input) => input.value));
    const selectedMonth = monthInput.value;
    const query = normalizeFilterText(nameInput.value);
    let visibleCount = 0;

    cards.forEach((card) => {
      const matchesType = selectedTypes.has(card.dataset.eventType);
      const matchesMonth = selectedMonth === "" || card.dataset.eventMonth === selectedMonth;
      const matchesName = query === "" || normalizeFilterText(card.dataset.eventTitle).includes(query);
      const visible = matchesType && matchesMonth && matchesName;
      card.hidden = !visible;
      card.style.display = visible ? "" : "none";
      if (visible) visibleCount += 1;
    });

    if (emptyState) emptyState.hidden = visibleCount > 0 || cards.length === 0;
  };

  const openEventCard = (card) => {
    if (typeof openEventCallback === "function") {
      openEventCallback(card.dataset.eventId);
      return;
    }
    const bridge = targetWindow.opener && targetWindow.opener.EventEditorBridge;
    if (!bridge || typeof bridge.openEvent !== "function") return;
    targetWindow.opener.focus();
    bridge.openEvent(card.dataset.eventId);
  };

  typeInputs.forEach((input) => {
    input.addEventListener("change", applyEventFilters);
    input.addEventListener("input", applyEventFilters);
  });
  cards.forEach((card) => {
    card.addEventListener("click", () => openEventCard(card));
  });
  monthInput.addEventListener("change", applyEventFilters);
  nameInput.addEventListener("input", applyEventFilters);
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("reset", () => targetWindow.setTimeout(applyEventFilters, 0));
  targetWindow.applyEventFilters = applyEventFilters;
  applyEventFilters();
}
