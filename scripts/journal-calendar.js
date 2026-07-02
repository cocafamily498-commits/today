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

  setJournalDateInputValue(toDateInputValue(getVietnamToday()));
  updateJournalDateHint();
  updateJournalImageSummary(null);

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
  resetButton.addEventListener("click", () => resetJournalForm(getSelectedJournalCalendarDate()));
  if (cancelButton) cancelButton.addEventListener("click", closeJournalDialog);
  closeButton.addEventListener("click", closeJournalDialog);
  deleteButton.addEventListener("click", deleteEditingJournal);
  dialog.addEventListener("close", () => document.body.classList.remove("event-dialog-open"));
  imageInput.addEventListener("change", () => handleJournalImageInputChange(imageInput));
  if (addImageButton) addImageButton.addEventListener("click", () => imageInput.click());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveJournalFromForm();
  });
}

function setupJournalList() {
  const toggleButton = document.getElementById("journalListToggleButton");
  const form = document.getElementById("journalFilterForm");
  const monthFilter = document.getElementById("journalMonthFilter");
  const contentFilter = document.getElementById("journalContentFilter");
  if (!toggleButton || !form || !monthFilter || !contentFilter) return;

  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.addEventListener("click", openJournalListPanel);
  form.addEventListener("submit", (event) => event.preventDefault());
  monthFilter.addEventListener("change", renderJournalList);
  contentFilter.addEventListener("input", renderJournalList);
}

async function openJournalListPanel() {
  const panel = document.getElementById("journalListPanel");
  const button = document.getElementById("journalListToggleButton");
  if (!panel) return;

  panel.hidden = false;
  if (button) button.setAttribute("aria-expanded", "true");
  await renderJournalList({ force: true });
  requestAnimationFrame(() => {
    panel.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    const firstItem = panel.querySelector("[data-journal-date]");
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
    entries[date.day] = journal;
  });
  return entries;
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
  const journal = journalCalendarEntries[day] || await window.LichVietData.getJournalByDate(date);
  if (journal) {
    await loadJournalIntoForm(journal);
  } else {
    resetJournalForm(date);
    setJournalFormStatus("Ngày này chưa có nhật ký/ghi chú. Nhập nội dung để tạo mới.");
    openJournalDialog();
  }
}
