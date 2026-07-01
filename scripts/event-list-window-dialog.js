async function openEventListWindow() {
  const dialog = ensureEventListDialog();
  const sortEventsForList = (events) => events.slice().sort(compareEventsByNextOccurrence);
  const renderList = (events, emptyText) => {
    dialog.querySelector(".event-list-dialog-content").innerHTML = renderEventListDialogContent(events, emptyText);
    setupEventListDialogControls(dialog);
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
    "height:min(88vh, 820px)",
    "max-height:min(88vh, 820px)",
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
      dialog.dataset.keepBodyLocked = "true";
      dialog.close();
      resetEventForm(getSelectedEventCalendarDate());
      setEventFormStatus("Dang tao su kien moi.");
      openEventDialog();
    });
  }

  initializeEventListWindowFilters(window, async (eventId) => {
    dialog.dataset.keepBodyLocked = "true";
    dialog.close();
    await loadEventIntoForm(eventId);
  });
}
