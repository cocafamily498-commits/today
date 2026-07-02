let eventListDialogReturnState = null;

async function openEventListWindow() {
  const dialog = ensureEventListDialog();
  const returnState = eventListDialogReturnState;
  eventListDialogReturnState = null;
  const sortEventsForList = (events) => events.slice().sort(compareEventsByNextOccurrence);
  const renderList = (events, emptyText) => {
    dialog.querySelector(".event-list-dialog-content").innerHTML = renderEventListDialogContent(events, emptyText);
    setupEventListDialogControls(dialog);
    restoreEventListDialogState(dialog, returnState);
  };

  renderList([], "Dang tai danh sach su kien...");
  document.body.classList.add("event-dialog-open");
  if (!dialog.open) dialog.showModal();

  try {
    const events = await window.LichVietData.getAllEvents();
    renderList(sortEventsForList(events));
  } catch (error) {
    setEventFormStatus("Chua mo duoc danh sach su kien.", true);
    renderList([], "Chua doc duoc du lieu su kien.");
  }
}

function ensureEventListDialog() {
  const existingDialog = document.getElementById("eventListDialog");
  if (existingDialog) return existingDialog;

  const dialog = document.createElement("dialog");
  dialog.id = "eventListDialog";
  dialog.className = "event-list-dialog";
  dialog.style.cssText = [
    "width:min(calc(100% - 28px), 980px)",
    "height:min(94vh, 900px)",
    "max-height:min(94vh, 900px)",
    "padding:0",
    "overflow:hidden",
    "border:1px solid #b8c7d8",
    "border-radius:12px",
    "background:#f6f8fb",
    "box-shadow:0 24px 70px rgba(15, 29, 45, .28)"
  ].join(";");
  dialog.innerHTML = `<div class="event-list-dialog-content"></div>`;
  dialog.addEventListener("close", () => {
    const keepBodyLocked = dialog.dataset.keepBodyLocked === "true";
    delete dialog.dataset.keepBodyLocked;
    if (!keepBodyLocked) document.body.classList.remove("event-dialog-open");
    dialog.remove();
  });
  document.body.append(dialog);
  return dialog;
}

function setupEventListDialogControls(dialog) {
  const closeButton = dialog.querySelector("#eventListDialogCloseButton");
  const addButton = dialog.querySelector("#eventAddButton");

  if (closeButton) closeButton.addEventListener("click", () => dialog.close());
  if (addButton) {
    addButton.addEventListener("click", () => {
      rememberEventListDialogState(dialog, null);
      dialog.dataset.keepBodyLocked = "true";
      dialog.close();
      resetEventForm(getSelectedEventCalendarDate());
      setEventFormStatus("Dang tao su kien moi.");
      openEventDialog();
    });
  }

  initializeEventListWindowFilters(window, async (eventId) => {
    rememberEventListDialogState(dialog, eventId);
    await loadEventIntoForm(eventId, null, { openDialog: false });
    dialog.dataset.keepBodyLocked = "true";
    dialog.close();
    openEventDialog();
  });
}

function rememberEventListDialogState(dialog, selectedEventId) {
  const list = dialog.querySelector("#eventList");
  eventListDialogReturnState = {
    selectedEventId,
    scrollTop: list ? list.scrollTop : 0,
    month: dialog.querySelector("#eventMonthFilter")?.value || "",
    name: dialog.querySelector("#eventNameFilter")?.value || "",
    types: Array.from(dialog.querySelectorAll("input[name='eventType']"))
      .filter((input) => input.checked)
      .map((input) => input.value)
  };
}

function restoreEventListDialogState(dialog, state) {
  if (!state) return;

  const monthInput = dialog.querySelector("#eventMonthFilter");
  const nameInput = dialog.querySelector("#eventNameFilter");
  if (monthInput) monthInput.value = state.month || "";
  if (nameInput) nameInput.value = state.name || "";
  const selectedTypes = new Set(state.types || []);
  dialog.querySelectorAll("input[name='eventType']").forEach((input) => {
    input.checked = selectedTypes.size === 0 ? true : selectedTypes.has(input.value);
  });
  monthInput?.dispatchEvent(new Event("change", { bubbles: true }));

  requestAnimationFrame(() => {
    const list = dialog.querySelector("#eventList");
    const selectedCard = state.selectedEventId
      ? Array.from(dialog.querySelectorAll(".event-card"))
        .find((card) => card.dataset.eventId === state.selectedEventId)
      : null;

    if (selectedCard) {
      selectedCard.scrollIntoView({ block: "center" });
      selectedCard.focus({ preventScroll: true });
      return;
    }

    if (list) list.scrollTop = state.scrollTop || 0;
  });
}

function returnToEventListDialogIfNeeded() {
  if (!eventListDialogReturnState) return;
  openEventListWindow();
}
