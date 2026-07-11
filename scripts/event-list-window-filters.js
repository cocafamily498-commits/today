function initializeEventListWindowFilters(targetWindow, openEventCallback = null) {
  const doc = targetWindow && targetWindow.document;
  if (!doc) return;

  const form = doc.getElementById("eventFilterForm");
  const monthInput = doc.getElementById("eventMonthFilter");
  const nameInput = doc.getElementById("eventNameFilter");
  const typeInput = doc.getElementById("eventTypeFilter");
  const groupInput = doc.getElementById("eventGroupFilter");
  const typeIcon = doc.getElementById("eventTypeFilterIcon");
  const groupIcon = doc.getElementById("eventGroupFilterIcon");
  const cards = [...doc.querySelectorAll(".event-card")];
  const emptyState = doc.getElementById("eventFilterEmptyState");
  if (!form || !monthInput || !nameInput || !typeInput || !groupInput) return;
  if (form.dataset.filtersReady === "true") return;
  form.dataset.filtersReady = "true";

  const normalizeFilterText = (value) => String(value || "").trim().toLowerCase();

  const setupFilterCombobox = (select) => {
    const root = select.closest("[data-filter-combobox]");
    const button = root && root.querySelector(".event-filter-combobox-button");
    const list = root && root.querySelector(".event-filter-combobox-list");
    if (!root || !button || !list) return () => {};

    const sync = () => {
      const options = Array.from(list.querySelectorAll("[data-value]"));
      const option = options.find((item) => item.dataset.value === select.value)
        || options.find((item) => item.dataset.value === "");
      if (!option) return;
      button.innerHTML = option.innerHTML;
      list.querySelectorAll("[data-value]").forEach((item) => {
        item.setAttribute("aria-selected", String(item === option));
      });
    };

    button.addEventListener("click", () => {
      doc.querySelectorAll(".event-filter-combobox-list").forEach((otherList) => {
        if (otherList !== list) otherList.hidden = true;
      });
      list.hidden = !list.hidden;
      button.setAttribute("aria-expanded", String(!list.hidden));
    });
    list.addEventListener("click", (event) => {
      const option = event.target.closest("[data-value]");
      if (!option) return;
      select.value = option.dataset.value;
      sync();
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    doc.addEventListener("click", (event) => {
      if (event.target.closest("[data-filter-combobox]") === root) return;
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
    });
    sync();
    return sync;
  };

  const syncTypeCombobox = setupFilterCombobox(typeInput);
  const syncGroupCombobox = setupFilterCombobox(groupInput);

  const updateFilterIcons = () => {
    if (typeIcon) {
      const typeIcons = { birthday: "☀", deathAnniversary: "☾", other: "★" };
      typeIcon.textContent = typeIcons[typeInput.value] || "◆";
      typeIcon.dataset.eventType = typeInput.value || "all";
    }
    if (groupIcon) {
      const option = groupInput.selectedOptions && groupInput.selectedOptions[0];
      const iconId = option && option.dataset.iconId;
      const color = option && option.dataset.iconColor;
      groupIcon.innerHTML = iconId
        ? `<svg viewBox="0 0 24 24" style="color:${color || "#64748b"}" aria-hidden="true"><use href="icons/event-group-icons-sprite.svg#${iconId}"></use></svg>`
        : "◆";
    }
  };

  const applyEventFilters = () => {
    syncTypeCombobox();
    syncGroupCombobox();
    updateFilterIcons();
    const selectedType = typeInput.value;
    const selectedGroup = groupInput.value;
    const selectedMonth = monthInput.value;
    const query = normalizeFilterText(nameInput.value);
    let visibleCount = 0;

    cards.forEach((card) => {
      const matchesType = selectedType === "" || card.dataset.eventType === selectedType;
      const matchesGroup = selectedGroup === "" || card.dataset.eventGroup === selectedGroup;
      const matchesMonth = selectedMonth === "" || card.dataset.eventMonth === selectedMonth;
      const matchesName = query === "" || normalizeFilterText(card.dataset.eventTitle).includes(query);
      const visible = matchesType && matchesGroup && matchesMonth && matchesName;
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

  typeInput.addEventListener("change", applyEventFilters);
  groupInput.addEventListener("change", applyEventFilters);
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
