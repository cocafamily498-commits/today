function setupConversionTool() {
  const solarDirectionButton = document.getElementById("solarDirectionButton");
  const lunarDirectionButton = document.getElementById("lunarDirectionButton");
  const solarForm = document.getElementById("solarToLunarForm");
  const lunarForm = document.getElementById("lunarToSolarForm");
  const viewSolarMonthButton = document.getElementById("viewSolarMonthButton");
  const viewLunarMonthButton = document.getElementById("viewLunarMonthButton");
  const today = getVietnamToday();
  const todayLunar = convertSolarToLunar(today.getDate(), today.getMonth() + 1, today.getFullYear(), TIME_ZONE);
  let solarCalendarTarget = null;
  let lunarCalendarTarget = null;

  setupAstrologyTool();

  document.getElementById("solarInputDay").value = today.getDate();
  document.getElementById("solarInputMonth").value = today.getMonth() + 1;
  document.getElementById("solarInputYear").value = today.getFullYear();
  document.getElementById("lunarInputDay").value = todayLunar.day;
  document.getElementById("lunarInputMonth").value = todayLunar.month;
  document.getElementById("lunarInputYear").value = todayLunar.year;
  document.getElementById("lunarInputLeap").checked = todayLunar.leap;
  setupNumberEntryControl("solarInputDay", "solarDayPicker", 1, 31);
  setupNumberEntryControl("solarInputMonth", "solarMonthPicker", 1, 12);
  setupNumberEntryControl("solarInputYear", "solarYearPicker", CALENDAR_MIN_YEAR, CALENDAR_MAX_YEAR);
  setupNumberEntryControl("lunarInputDay", "lunarDayPicker", 1, 30);
  setupNumberEntryControl("lunarInputMonth", "lunarMonthPicker", 1, 12);
  setupNumberEntryControl("lunarInputYear", "lunarYearPicker", CALENDAR_MIN_YEAR, CALENDAR_MAX_YEAR);

  solarForm.addEventListener("input", () => {
    solarCalendarTarget = null;
    viewSolarMonthButton.disabled = true;
    clearConversionOutput();
  });
  lunarForm.addEventListener("input", () => {
    lunarCalendarTarget = null;
    viewLunarMonthButton.disabled = true;
    clearConversionOutput();
  });
  viewSolarMonthButton.addEventListener("click", () => openDateInMonthlyCalendar(solarCalendarTarget));
  viewLunarMonthButton.addEventListener("click", () => openDateInMonthlyCalendar(lunarCalendarTarget));

  [solarDirectionButton, lunarDirectionButton].forEach((button) => {
    button.addEventListener("click", () => {
      const solarSelected = button === solarDirectionButton;
      solarDirectionButton.setAttribute("aria-selected", solarSelected ? "true" : "false");
      lunarDirectionButton.setAttribute("aria-selected", solarSelected ? "false" : "true");
      solarForm.hidden = !solarSelected;
      lunarForm.hidden = solarSelected;
      clearConversionOutput();
    });
  });

  solarForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearConversionOutput();
    solarCalendarTarget = null;
    viewSolarMonthButton.disabled = true;
    const day = Number(document.getElementById("solarInputDay").value);
    const month = Number(document.getElementById("solarInputMonth").value);
    const year = Number(document.getElementById("solarInputYear").value);
    if (!isValidSolarDate(day, month, year)) {
      showConversionError("Ngày dương lịch không hợp lệ.");
      return;
    }
    const lunar = convertSolarToLunar(day, month, year, TIME_ZONE);
    const lunarMonth = lunar.leap ? `${lunar.month} nhuận` : lunar.month;
    showConversionResult(`Ngày ${lunar.day} tháng ${lunarMonth} năm ${canChiYear(lunar.year)} (${lunar.year})`);
    solarCalendarTarget = { day, month, year };
    viewSolarMonthButton.disabled = false;
  });

  lunarForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearConversionOutput();
    lunarCalendarTarget = null;
    viewLunarMonthButton.disabled = true;
    const submit = lunarForm.querySelector("button[type='submit']");
    const day = Number(document.getElementById("lunarInputDay").value);
    const month = Number(document.getElementById("lunarInputMonth").value);
    const year = Number(document.getElementById("lunarInputYear").value);
    const leap = document.getElementById("lunarInputLeap").checked;
    submit.disabled = true;
    submit.textContent = "Đang chuyển đổi...";
    try {
      const solar = await convertLunarToSolar(day, month, year, leap, TIME_ZONE);
      const date = new Date(Date.UTC(solar.year, solar.month - 1, solar.day));
      const weekday = titleCaseWords(WEEKDAYS[date.getUTCDay()]);
      showConversionResult(`${weekday}, ngày ${solar.day} tháng ${solar.month} năm ${solar.year}`);
      lunarCalendarTarget = { day: solar.day, month: solar.month, year: solar.year };
      viewLunarMonthButton.disabled = false;
    } catch (error) {
      showConversionError(error.message || "Chưa thể chuyển đổi ngày này.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Đổi sang dương lịch";
    }
  });
}

function isValidSolarDate(day, month, year) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR || month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function clearConversionOutput() {
  document.getElementById("conversionMessage").textContent = "";
  document.getElementById("conversionResult").hidden = true;
  document.getElementById("conversionResultValue").textContent = "";
}

function showConversionError(message) {
  document.getElementById("conversionMessage").textContent = message;
  document.getElementById("conversionResult").hidden = true;
}

function showConversionResult(message) {
  document.getElementById("conversionMessage").textContent = "";
  document.getElementById("conversionResultValue").textContent = message;
  document.getElementById("conversionResult").hidden = false;
}
