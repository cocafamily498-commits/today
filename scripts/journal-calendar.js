function setupJournalCalendar() {
  const form = document.getElementById("journalForm");
  if (!form || !window.LichVietData) return;

  const today = getVietnamToday();
  journalCalendarYear = today.getFullYear();
  journalCalendarMonth = today.getMonth() + 1;
  journalCalendarSelectedDay = today.getDate();
  journalHoverPreviewEnabled = getStoredJournalHoverPreviewEnabled();

  setupCalendarNavigation({
    ...JOURNAL_CALENDAR_NAVIGATION,
    getState: () => ({
      year: journalCalendarYear,
      month: journalCalendarMonth,
      day: journalCalendarSelectedDay
    }),
    setDate: setJournalCalendarDate,
    render: renderJournalCalendar
  });

  setupJournalForm();
  setupJournalList();
  setupJournalHoverPreviewToggle();
  renderJournalCalendar();
  loadJournalCalendarEntries();
}

const JOURNAL_DUPLICATE_DATE_MESSAGE = "Ngày này đã có nội dung nhật ký.";
const JOURNAL_MAX_IMAGES = 3;
const JOURNAL_IMAGE_TARGET_BYTES = 100 * 1024;
const JOURNAL_IMAGE_MAX_SIDE = 1200;
const JOURNAL_IMAGE_MIN_SIDE = 180;

function setupJournalForm() {
  const form = document.getElementById("journalForm");
  const dateInput = document.getElementById("journalDate");
  const resetButton = document.getElementById("journalResetButton");
  const cancelButton = document.getElementById("journalCancelButton");
  const deleteButton = document.getElementById("journalDeleteButton");
  const closeButton = document.getElementById("journalDialogCloseButton");
  const dialog = document.getElementById("journalDialog");
  const imageInput = document.getElementById("journalImages");
  const addImageButton = document.getElementById("journalAddImageButton");
  const readButton = document.getElementById("journalReadButton");
  const exportImageButton = document.getElementById("journalExportImageButton");
  const expandButton = document.getElementById("journalExpandButton");
  const expandedDialog = document.getElementById("journalExpandedDialog");
  const expandedCloseButton = document.getElementById("journalExpandedCloseButton");
  const choiceAddButton = document.getElementById("journalChoiceAddButton");

  setJournalDateInputValue(toDateInputValue(getVietnamToday()));
  updateJournalDateHint();
  updateJournalImageSummary(null);
  if (typeof setupJournalGroupPicker === "function") setupJournalGroupPicker();
  if (typeof initializeEventGroups === "function") {
    initializeEventGroups().then(() => updateJournalGroupPicker("general"))
      .catch((error) => console.error("journal groups initialization failed", error));
  }

  dateInput.addEventListener("input", () => {
    autoFormatEventDateInput(dateInput);
    updateJournalDateHint();
    validateJournalDateAvailability();
  });
  dateInput.addEventListener("change", () => {
    normalizeJournalDateInput();
    updateJournalDateHint();
    validateJournalDateAvailability();
  });
  dateInput.addEventListener("blur", () => {
    normalizeJournalDateInput();
    updateJournalDateHint();
    validateJournalDateAvailability();
  });
  resetButton.addEventListener("click", () => {
    resetJournalForm(getSelectedJournalCalendarDate(), { preserveGroup: true });
    document.getElementById("journalText")?.focus();
  });
  if (cancelButton) cancelButton.addEventListener("click", closeJournalDialog);
  closeButton.addEventListener("click", closeJournalDialog);
  deleteButton.addEventListener("click", deleteEditingJournal);
  if (typeof trapEventDialogFocus === "function") dialog.addEventListener("keydown", trapEventDialogFocus);
  dialog.addEventListener("close", () => document.body.classList.remove("event-dialog-open"));
  imageInput.addEventListener("change", () => handleJournalImageInputChange(imageInput));
  if (addImageButton) addImageButton.addEventListener("click", () => imageInput.click());
  if (readButton) readButton.addEventListener("click", toggleJournalReading);
  if (exportImageButton) exportImageButton.addEventListener("click", openJournalExportTemplateMenu);
  if (expandButton) expandButton.addEventListener("click", openJournalExpandedEditor);
  if (expandedCloseButton) expandedCloseButton.addEventListener("click", closeJournalExpandedEditor);
  if (choiceAddButton) choiceAddButton.addEventListener("click", () => {
    resetJournalForm(getSelectedJournalCalendarDate());
    setJournalFormStatus("Đang tạo nhật ký/ghi chú mới.");
    openJournalDialog();
  });
  if (expandedDialog) {
    expandedDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeJournalExpandedEditor();
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.saved === "true") {
      closeJournalDialog();
      return;
    }
    await saveJournalFromForm();
  });
}

function setupJournalList() {
  const toggleButton = document.getElementById("journalListToggleButton");
  const form = document.getElementById("journalFilterForm");
  const yearFilter = document.getElementById("journalYearFilter");
  const monthFilter = document.getElementById("journalMonthFilter");
  const contentFilter = document.getElementById("journalContentFilter");
  const groupFilter = document.getElementById("journalGroupFilter");
  const printButton = document.getElementById("journalFilterPrintButton");
  if (!toggleButton || !form || !yearFilter || !monthFilter || !contentFilter || !groupFilter) return;

  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.addEventListener("click", openJournalListPanel);
  form.addEventListener("submit", (event) => event.preventDefault());
  yearFilter.addEventListener("change", renderJournalList);
  monthFilter.addEventListener("change", renderJournalList);
  contentFilter.addEventListener("input", renderJournalList);
  groupFilter.addEventListener("change", renderJournalList);
  printButton?.addEventListener("click", () => openJournalExportTemplateMenu("filtered"));
  setupJournalGroupFilterPicker();
  document.addEventListener("eventgroupschange", populateJournalGroupFilter);
}

function populateJournalGroupFilter() {
  const input = document.getElementById("journalGroupFilter");
  const button = document.getElementById("journalGroupFilterButton");
  const list = document.getElementById("journalGroupFilterList");
  if (!input || !button || !list || typeof getEventGroups !== "function") return;
  const groups = getEventGroups();
  const selectedGroup = groups.find((group) => group.id === input.value) || null;
  if (!selectedGroup) input.value = "";
  button.innerHTML = selectedGroup
    ? `${renderEventGroupIcon(selectedGroup, "journal-list-group-icon")}<span>${escapeHtml(selectedGroup.name)}</span><span class="event-group-picker-arrow">⌄</span>`
    : `<span>Tất cả</span><span class="event-group-picker-arrow">⌄</span>`;
  list.innerHTML = `<button type="button" role="option" aria-selected="${input.value === ""}" data-journal-group-filter=""><span class="journal-filter-all-icon" aria-hidden="true">●</span><span>Tất cả</span></button>${groups.map((group) => `
    <button type="button" role="option" aria-selected="${group.id === input.value}" data-journal-group-filter="${escapeHtml(group.id)}">
      ${renderEventGroupIcon(group, "journal-list-group-icon")}<span>${escapeHtml(group.name)}</span>
    </button>`).join("")}`;
}

function setupJournalGroupFilterPicker() {
  const input = document.getElementById("journalGroupFilter");
  const button = document.getElementById("journalGroupFilterButton");
  const list = document.getElementById("journalGroupFilterList");
  if (!input || !button || !list || button.dataset.ready === "true") return;
  const closeGroupFilter = () => {
    list.hidden = true;
    list.style.display = "none";
    button.setAttribute("aria-expanded", "false");
  };
  const openGroupFilter = () => {
    list.style.removeProperty("display");
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    list.querySelector("[aria-selected='true']")?.focus();
  };
  button.dataset.ready = "true";
  populateJournalGroupFilter();
  button.addEventListener("click", () => {
    if (list.hidden) openGroupFilter();
    else closeGroupFilter();
  });
  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-journal-group-filter]");
    if (!option) return;
    input.value = option.dataset.journalGroupFilter || "";
    closeGroupFilter();
    populateJournalGroupFilter();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    button.focus();
  });
  list.addEventListener("keydown", (event) => {
    const options = [...list.querySelectorAll("[data-journal-group-filter]")];
    const currentIndex = options.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeGroupFilter();
      button.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    options[(currentIndex + direction + options.length) % options.length]?.focus();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".journal-group-filter-picker")) return;
    closeGroupFilter();
  });
}

async function openJournalListPanel() {
  const panel = document.getElementById("journalListPanel");
  const button = document.getElementById("journalListToggleButton");
  if (!panel) return;

  clearJournalChoiceList();
  panel.hidden = false;
  if (button) button.setAttribute("aria-expanded", "true");
  await renderJournalList({ force: true });
  requestAnimationFrame(() => {
    panel.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    const firstItem = panel.querySelector("[data-journal-id]");
    const firstFilter = document.getElementById("journalMonthFilter");
    (firstItem || firstFilter || panel).focus({ preventScroll: true });
  });
}

function setupJournalHoverPreviewToggle() {
  const toggle = document.getElementById("journalHoverPreviewToggle");
  if (!toggle) return;
  toggle.checked = journalHoverPreviewEnabled;
  toggle.addEventListener("change", () => {
    journalHoverPreviewEnabled = toggle.checked;
    try {
      localStorage.setItem("homnay.journalHoverPreviewEnabled", String(journalHoverPreviewEnabled));
    } catch (error) {
      // The toggle still works for this session without persistent storage.
    }
    hideJournalHoverPreview();
  });
}

function getStoredJournalHoverPreviewEnabled() {
  try {
    const stored = localStorage.getItem("homnay.journalHoverPreviewEnabled");
    return stored === null ? true : stored === "true";
  } catch (error) {
    return true;
  }
}

function setJournalCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR) return;
  if (!Number.isInteger(month) || month < 1 || month > 12) return;
  journalCalendarYear = year;
  journalCalendarMonth = month;
  journalCalendarSelectedDay = Math.min(Math.max(Number(day) || 1, 1), getDaysInMonth(year, month));
  renderJournalCalendar();
  loadJournalCalendarEntries();
}

async function loadJournalCalendarEntries() {
  const key = `${journalCalendarYear}-${String(journalCalendarMonth).padStart(2, "0")}`;
  journalCalendarKey = key;

  try {
    const journals = await window.LichVietData.getAllJournals();
    if (journalCalendarKey !== key) return;
    journalCalendarEntries = buildJournalCalendarEntries(journals, journalCalendarYear, journalCalendarMonth);
    renderJournalCalendar();
    const choicePanel = document.getElementById("journalChoiceListPanel");
    if (choicePanel && !choicePanel.hidden) {
      const selectedJournals = journalCalendarEntries[journalCalendarSelectedDay] || [];
      if (selectedJournals.length > 1) renderJournalChoiceList(selectedJournals);
      else clearJournalChoiceList();
    }
    renderJournalList();
  } catch (error) {
    journalCalendarEntries = {};
  }
}

function buildJournalCalendarEntries(journals, year, month) {
  const entries = {};
  journals.forEach((journal) => {
    const date = parseDateValue(journal.date);
    if (!date || date.year !== year || date.month !== month) return;
    if (!entries[date.day]) entries[date.day] = [];
    entries[date.day].push(journal);
  });
  Object.values(entries).forEach((dayJournals) => dayJournals.sort(compareJournals));
  return entries;
}

function compareJournals(left, right) {
  return String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
}

function renderJournalCalendar() {
  syncCalendarNavigation(JOURNAL_CALENDAR_NAVIGATION, journalCalendarYear, journalCalendarMonth);
  document.getElementById("journalCalendarHeadingText").textContent = `Tháng ${journalCalendarMonth} năm ${journalCalendarYear}`;
  renderCalendarGrid({
    grid: document.getElementById("journalCalendarGrid"),
    year: journalCalendarYear,
    month: journalCalendarMonth,
    selectedDay: journalCalendarSelectedDay,
    ariaLabel: `Lịch nhật ký/ghi chú tháng ${journalCalendarMonth} năm ${journalCalendarYear}`,
    journalsByDay: journalCalendarEntries,
    showJournalContent: true,
    showAuspiciousDot: false,
    onDayClick: handleJournalCalendarDayClick,
    onDayHover: showJournalHoverPreview,
    onDayHoverEnd: hideJournalHoverPreview
  });
}

async function handleJournalCalendarDayClick(day) {
  journalCalendarSelectedDay = day;
  renderJournalCalendar();
  const date = getSelectedJournalCalendarDate();
  const journals = journalCalendarEntries[day] || await window.LichVietData.getJournalsByDate(date);
  if (journals.length === 1) {
    clearJournalChoiceList();
    await loadJournalIntoForm(journals[0]);
  } else if (journals.length > 1) {
    renderJournalChoiceList(journals);
  } else {
    clearJournalChoiceList();
    const journalListPanel = document.getElementById("journalListPanel");
    if (journalListPanel) journalListPanel.hidden = true;
    document.getElementById("journalListToggleButton")?.setAttribute("aria-expanded", "false");
    resetJournalForm(date);
    setJournalFormStatus("Ngày này chưa có nhật ký/ghi chú. Nhập nội dung để tạo mới.");
    openJournalDialog();
  }
}

function renderJournalChoiceList(journals) {
  const panel = document.getElementById("journalChoiceListPanel");
  const list = document.getElementById("journalChoiceList");
  if (!panel || !list) return;
  const journalListPanel = document.getElementById("journalListPanel");
  if (journalListPanel) journalListPanel.hidden = true;
  document.getElementById("journalListToggleButton")?.setAttribute("aria-expanded", "false");
  panel.hidden = false;
  list.innerHTML = journals.slice().sort(compareJournals).map(renderJournalListCardMarkup).join("");
  [...list.querySelectorAll("[data-journal-id]")].forEach((button) => {
    button.addEventListener("click", async () => {
      const journal = await window.LichVietData.getJournal(button.dataset.journalId);
      if (journal) await loadJournalIntoForm(journal);
    });
  });
  requestAnimationFrame(() => {
    const firstCard = list.querySelector("[data-journal-id]");
    if (!firstCard) return;
    firstCard.focus({ preventScroll: true });
    firstCard.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });
}

function clearJournalChoiceList() {
  const panel = document.getElementById("journalChoiceListPanel");
  const list = document.getElementById("journalChoiceList");
  if (list) list.replaceChildren();
  if (panel) panel.hidden = true;
}
