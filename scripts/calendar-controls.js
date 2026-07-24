const CALENDAR_MIN_YEAR = 1900;
const CALENDAR_MAX_YEAR = 2100;
let calendarViewYear;
let calendarViewMonth;
let calendarSelectedDay;
let eventCalendarYear;
let eventCalendarMonth;
let eventCalendarSelectedDay;
let eventCalendarOccurrences = {};
let eventCalendarKey = "";
let editingEventId = null;
let eventReminderDialogShownThisSession = false;
let journalCalendarYear;
let journalCalendarMonth;
let journalCalendarSelectedDay;
let journalCalendarEntries = {};
let journalCalendarKey = "";
let editingJournalDate = null;
let editingJournalId = null;
let journalHoverPreviewEnabled = true;
let journalImagePreviewUrls = [];
let journalImageItems = [];
let journalFilteredEntries = [];
const MONTHLY_CALENDAR_NAVIGATION = {
  monthInputId: "calendarMonthInput",
  monthSelectId: "calendarMonthSelect",
  yearInputId: "calendarYearInput",
  yearSelectId: "calendarYearSelect",
  previousButtonId: "previousMonthButton",
  nextButtonId: "nextMonthButton",
  todayButtonId: "calendarTodayButton"
};
const EVENT_CALENDAR_NAVIGATION = {
  monthInputId: "eventCalendarMonthInput",
  monthSelectId: "eventCalendarMonthSelect",
  yearInputId: "eventCalendarYearInput",
  yearSelectId: "eventCalendarYearSelect",
  previousButtonId: "eventPreviousMonthButton",
  nextButtonId: "eventNextMonthButton",
  todayButtonId: "eventCalendarTodayButton"
};
const JOURNAL_CALENDAR_NAVIGATION = {
  monthInputId: "journalCalendarMonthInput",
  monthSelectId: "journalCalendarMonthSelect",
  yearInputId: "journalCalendarYearInput",
  yearSelectId: "journalCalendarYearSelect",
  previousButtonId: "journalPreviousMonthButton",
  nextButtonId: "journalNextMonthButton",
  todayButtonId: "journalCalendarTodayButton"
};

function setupMonthlyCalendar() {
  const today = getVietnamToday();
  const params = new URLSearchParams(location.search);
  const queryYear = Number(params.get("year"));
  const queryMonth = Number(params.get("month"));
  const queryDay = Number(params.get("day"));
  const validQueryMonth = Number.isInteger(queryYear)
    && queryYear >= CALENDAR_MIN_YEAR
    && queryYear <= CALENDAR_MAX_YEAR
    && Number.isInteger(queryMonth)
    && queryMonth >= 1
    && queryMonth <= 12;

  calendarViewYear = validQueryMonth ? queryYear : today.getFullYear();
  calendarViewMonth = validQueryMonth ? queryMonth : today.getMonth() + 1;
  const daysInMonth = getDaysInMonth(calendarViewYear, calendarViewMonth);
  calendarSelectedDay = validQueryMonth && Number.isInteger(queryDay) && queryDay >= 1 && queryDay <= daysInMonth
    ? queryDay
    : validQueryMonth ? 1 : today.getDate();

  setupCalendarNavigation({
    ...MONTHLY_CALENDAR_NAVIGATION,
    getState: () => ({
      year: calendarViewYear,
      month: calendarViewMonth,
      day: calendarSelectedDay
    }),
    setDate: setMonthlyCalendarDate,
    render: renderMonthlyCalendar
  });

  renderMonthlyCalendar();
}

function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function setMonthlyCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR) return;
  if (!Number.isInteger(month) || month < 1 || month > 12) return;
  calendarViewYear = year;
  calendarViewMonth = month;
  calendarSelectedDay = Math.min(Math.max(Number(day) || 1, 1), getDaysInMonth(year, month));
  renderMonthlyCalendar();
  updateMonthlyCalendarUrl();
}

function openDateInMonthlyCalendar(date) {
  if (!date) return;
  setMonthlyCalendarDate(date.year, date.month, date.day);
  requestAnimationFrame(() => {
    const selectedDay = document.querySelector("#monthCalendarGrid .month-day-button.selected");
    if (!selectedDay) return;
    selectedDay.focus({ preventScroll: true });
    selectedDay.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });
}

function setupNumberEntryControl(inputId, pickerId, minimum, maximum, formatOption = String) {
  const input = document.getElementById(inputId);
  const picker = document.getElementById(pickerId);
  for (let value = minimum; value <= maximum; value += 1) {
    picker.add(new Option(formatOption(value), String(value)));
  }
  const syncPicker = () => {
    const value = Number(input.value);
    if (Number.isInteger(value) && value >= minimum && value <= maximum) picker.value = String(value);
  };
  input.addEventListener("input", syncPicker);
  picker.addEventListener("change", () => {
    input.value = picker.value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  setupCalendarPickerMenu(picker, input, formatOption);
  syncPicker();
}

function setupCalendarPickerMenu(picker, input, formatOption) {
  if (picker.dataset.customPickerReady) return;
  picker.dataset.customPickerReady = "true";
  picker.hidden = true;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "calendar-picker-button";
  button.setAttribute("aria-label", picker.getAttribute("aria-label") || "Mở danh sách");
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const list = document.createElement("div");
  list.className = "calendar-picker-list";
  list.role = "listbox";
  list.hidden = true;
  [...picker.options].forEach((sourceOption) => {
    const option = document.createElement("button");
    option.type = "button";
    option.role = "option";
    option.dataset.value = sourceOption.value;
    option.textContent = sourceOption.textContent;
    list.append(option);
  });
  picker.after(button, list);
  const containingCard = picker.closest(".converter-card");

  const close = () => {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    containingCard?.classList.remove("has-open-picker");
  };
  button.addEventListener("click", () => {
    const opening = list.hidden;
    document.querySelectorAll(".calendar-picker-list:not([hidden])").forEach((menu) => { menu.hidden = true; });
    document.querySelectorAll(".calendar-picker-button[aria-expanded='true']").forEach((control) => control.setAttribute("aria-expanded", "false"));
    list.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (opening) {
      containingCard?.classList.add("has-open-picker");
      list.querySelectorAll("[data-value]").forEach((option) => {
        option.setAttribute("aria-selected", String(option.dataset.value === picker.value));
      });
      const selected = list.querySelector(`[data-value="${picker.value}"]`);
      if (selected) {
        // Keep the selected option visible without scrolling the whole page on mobile.
        list.scrollTop = selected.offsetTop - (list.clientHeight - selected.offsetHeight) / 2;
        selected.focus({ preventScroll: true });
      }
    }
  });
  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-value]");
    if (!option) return;
    picker.value = option.dataset.value;
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    button.focus();
  });
  list.addEventListener("keydown", (event) => {
    const options = [...list.querySelectorAll("[data-value]")];
    const index = options.indexOf(document.activeElement);
    if (event.key === "Escape") { close(); button.focus(); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length].focus();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".calendar-number-control, .number-entry-control")) close();
  });
}

function setupCalendarNavigation(options) {
  const {
    monthInputId,
    monthSelectId,
    yearInputId,
    yearSelectId,
    previousButtonId,
    nextButtonId,
    todayButtonId,
    getState,
    setDate,
    render
  } = options;
  const monthInput = document.getElementById(monthInputId);
  const monthSelect = document.getElementById(monthSelectId);
  const yearInput = document.getElementById(yearInputId);
  const yearSelect = document.getElementById(yearSelectId);

  setupNumberEntryControl(monthInputId, monthSelectId, 1, 12, (month) => `Tháng ${month}`);
  setupNumberEntryControl(yearInputId, yearSelectId, CALENDAR_MIN_YEAR, CALENDAR_MAX_YEAR);

  document.getElementById(previousButtonId).addEventListener("click", () => {
    const state = getState();
    const { year, month } = getCalendarMonthWithOffset(state.year, state.month, -1);
    if (year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR) return;
    setDate(year, month, state.day);
  });
  document.getElementById(nextButtonId).addEventListener("click", () => {
    const state = getState();
    const { year, month } = getCalendarMonthWithOffset(state.year, state.month, 1);
    if (year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR) return;
    setDate(year, month, state.day);
  });
  document.getElementById(todayButtonId).addEventListener("click", () => {
    const vietnamToday = getVietnamToday();
    setDate(vietnamToday.getFullYear(), vietnamToday.getMonth() + 1, vietnamToday.getDate());
  });
  monthSelect.addEventListener("change", () => {
    const state = getState();
    setDate(state.year, Number(monthSelect.value), state.day);
  });
  yearSelect.addEventListener("change", () => {
    const state = getState();
    setDate(Number(yearSelect.value), state.month, state.day);
  });
  monthInput.addEventListener("change", () => {
    const month = Number(monthInput.value);
    const state = getState();
    if (Number.isInteger(month) && month >= 1 && month <= 12) {
      setDate(state.year, month, state.day);
    } else {
      render();
    }
  });
  yearInput.addEventListener("change", () => {
    const year = Number(yearInput.value);
    const state = getState();
    if (Number.isInteger(year) && year >= CALENDAR_MIN_YEAR && year <= CALENDAR_MAX_YEAR) {
      setDate(year, state.month, state.day);
    } else {
      render();
    }
  });
}

function syncCalendarNavigation(options, year, month) {
  const monthInput = document.getElementById(options.monthInputId);
  const yearInput = document.getElementById(options.yearInputId);
  const monthSelect = document.getElementById(options.monthSelectId);
  const yearSelect = document.getElementById(options.yearSelectId);
  const previousButton = document.getElementById(options.previousButtonId);
  const nextButton = document.getElementById(options.nextButtonId);
  monthInput.value = String(month);
  yearInput.value = String(year);
  monthSelect.value = String(month);
  yearSelect.value = String(year);
  previousButton.disabled = year === CALENDAR_MIN_YEAR && month === 1;
  nextButton.disabled = year === CALENDAR_MAX_YEAR && month === 12;
}

function getCalendarMonthWithOffset(year, month, offset) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1
  };
}
