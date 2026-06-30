function renderMonthlyCalendar() {
  syncCalendarNavigation(MONTHLY_CALENDAR_NAVIGATION, calendarViewYear, calendarViewMonth);
  renderCalendarGrid({
    grid: document.getElementById("monthCalendarGrid"),
    year: calendarViewYear,
    month: calendarViewMonth,
    selectedDay: calendarSelectedDay,
    ariaLabel: `Lịch tháng ${calendarViewMonth} năm ${calendarViewYear}`,
    eventsByDay: null,
    showEventIcons: false,
    showAuspiciousDot: true,
    onDayClick: (day) => setMonthlyCalendarDate(calendarViewYear, calendarViewMonth, day)
  });
  renderSelectedCalendarDate();
}

function renderCalendarGrid(options) {
  const {
    grid,
    year,
    month,
    selectedDay,
    ariaLabel,
    eventsByDay = null,
    journalsByDay = null,
    showEventIcons = false,
    showJournalContent = false,
    showAuspiciousDot = false,
    onDayClick,
    onDayHover,
    onDayHoverEnd
  } = options;
  const today = getVietnamToday();
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlanks = (firstWeekday + 6) % 7;
  const cellCount = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  grid.setAttribute("aria-label", ariaLabel);
  grid.replaceChildren();

  for (let index = 0; index < cellCount; index += 1) {
    const day = index - leadingBlanks + 1;
    if (day < 1 || day > daysInMonth) {
      const empty = document.createElement("div");
      empty.className = "month-day-empty";
      empty.setAttribute("aria-hidden", "true");
      grid.appendChild(empty);
      continue;
    }

    const lunar = convertSolarToLunar(day, month, year, TIME_ZONE);
    const dayType = getLunarDayType(lunar.jd, lunar.month);
    const isAuspicious = dayType === "Ngày Hoàng đạo";
    const column = index % 7;
    const isWeekend = column >= 5;
    const isToday = day === today.getDate()
      && month === today.getMonth() + 1
      && year === today.getFullYear();
    const isSelected = day === selectedDay;
    const dayEvents = eventsByDay && eventsByDay[day] ? eventsByDay[day] : [];
    const dayJournal = journalsByDay && journalsByDay[day] ? journalsByDay[day] : null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "month-day-button",
      isWeekend ? "weekend" : "",
      isToday ? "today" : "",
      isSelected ? "selected" : "",
      showJournalContent ? "journal-day-button" : "",
      dayJournal ? "has-journal" : ""
    ]
      .filter(Boolean).join(" ");
    button.setAttribute("role", "gridcell");
    button.dataset.calendarDay = String(day);
    button.setAttribute("aria-selected", isSelected ? "true" : "false");
    button.setAttribute(
      "aria-label",
      `${day}/${month}/${year}, âm lịch ${lunar.day}/${lunar.month}/${lunar.year}${lunar.leap ? " nhuận" : ""}${showAuspiciousDot && isAuspicious ? `, ${dayType}` : ""}${dayEvents.length ? `, ${dayEvents.length} sự kiện` : ""}${dayJournal ? ", có nhật ký/ghi chú" : ""}`
    );

    const dayTypeDot = showAuspiciousDot && isAuspicious ? document.createElement("span") : null;
    if (dayTypeDot) {
      dayTypeDot.className = "month-day-type-dot auspicious";
      dayTypeDot.title = dayType;
      dayTypeDot.setAttribute("aria-hidden", "true");
    }
    const solarDay = document.createElement("span");
    solarDay.className = "month-solar-day";
    solarDay.textContent = day;
    const lunarDay = document.createElement("span");
    lunarDay.className = [
      "month-lunar-day",
      lunar.day === 1 ? "month-start" : "",
      lunar.day === 15 ? "full-moon" : "",
      lunar.leap ? "leap-month" : ""
    ].filter(Boolean).join(" ");
    if (lunar.day === 1) {
      lunarDay.textContent = `1/${lunar.month}${lunar.leap ? "N" : ""}`;
    } else if (lunar.day === 15) {
      lunarDay.textContent = `● 15${lunar.leap ? "N" : ""}`;
    } else {
      lunarDay.textContent = `${lunar.day}${lunar.leap ? "N" : ""}`;
    }
    const children = [...(dayTypeDot ? [dayTypeDot] : []), solarDay, lunarDay];
    if (showEventIcons) {
      const eventTypes = [...new Set(dayEvents.map((item) => item.eventType))];
      const eventIcons = document.createElement("span");
      eventIcons.className = "month-event-icons";
      eventIcons.setAttribute("aria-hidden", "true");
      eventTypes.forEach((type) => {
        const icon = document.createElement("span");
        icon.className = `month-event-icon ${type}`;
        icon.textContent = getEventTypeIcon(type);
        eventIcons.appendChild(icon);
      });
      children.push(eventIcons);
    }
    if (showJournalContent && dayJournal) {
      const journalPreview = document.createElement("span");
      journalPreview.className = "month-journal-preview";

      const journalText = document.createElement("span");
      journalText.className = "month-journal-text";
      journalText.textContent = dayJournal.text || "(Không có nội dung)";
      journalPreview.appendChild(journalText);

      if (Array.isArray(dayJournal.imageIds) && dayJournal.imageIds.length > 0) {
        const imageIcon = document.createElement("span");
        imageIcon.className = "month-journal-image-icon";
        imageIcon.setAttribute("aria-hidden", "true");
        imageIcon.textContent = "▣";
        journalPreview.appendChild(imageIcon);
      }

      children.push(journalPreview);
    }
    button.append(...children);
    button.addEventListener("click", () => onDayClick(day));
    if (typeof onDayHover === "function") {
      button.addEventListener("mouseenter", () => onDayHover(day, dayJournal, button));
      button.addEventListener("focus", () => onDayHover(day, dayJournal, button));
    }
    if (typeof onDayHoverEnd === "function") {
      button.addEventListener("mouseleave", onDayHoverEnd);
      button.addEventListener("blur", onDayHoverEnd);
    }
    grid.appendChild(button);
  }
}

function renderSelectedCalendarDate() {
  const lunar = convertSolarToLunar(calendarSelectedDay, calendarViewMonth, calendarViewYear, TIME_ZONE);
  const date = new Date(Date.UTC(calendarViewYear, calendarViewMonth - 1, calendarSelectedDay));
  const weekday = titleCaseWords(WEEKDAYS[date.getUTCDay()]);
  const lunarMonth = lunar.leap ? `${lunar.month} nhuận` : lunar.month;
  const dayType = getLunarDayType(lunar.jd, lunar.month);
  const dayOfficer = getDayOfficer(lunar.jd, TIME_ZONE);
  const solarTerm = getSolarTermForDate(lunar.jd, TIME_ZONE);
  document.getElementById("selectedSolarFullDate").textContent = `${weekday}, ngày ${calendarSelectedDay} tháng ${calendarViewMonth} năm ${calendarViewYear}`;
  document.getElementById("selectedLunarFullDate").textContent = `${lunar.day} tháng ${lunarMonth} năm ${lunar.year}`;
  const lunarMonthCanChi = `${canChiMonth(lunar.year, lunar.month)}${lunar.leap ? " nhuận" : ""}`;
  document.getElementById("monthLunarHeading").textContent = `Tháng ${lunarMonthCanChi} năm ${canChiYear(lunar.year)}`;
  document.getElementById("selectedLunarCanChi").textContent = `Năm ${canChiYear(lunar.year)}-Tháng ${lunarMonthCanChi}-Ngày ${canChiDay(lunar.jd)}-Trực ${dayOfficer}`;
  const guidance = getDayOfficerGuidance(dayOfficer);
  document.getElementById("selectedLunarShouldDo").textContent = guidance.shouldDo;
  document.getElementById("selectedLunarShouldAvoid").textContent = guidance.shouldAvoid;
  const dayTypeElement = document.getElementById("selectedLunarDayType");
  const isAuspicious = dayType === "Ngày Hoàng đạo";
  dayTypeElement.textContent = isAuspicious ? dayType : "";
  dayTypeElement.classList.toggle("is-auspicious", isAuspicious);
  dayTypeElement.hidden = !isAuspicious;
  const solarTermElement = document.getElementById("selectedLunarSolarTerm");
  solarTermElement.textContent = solarTerm ? `Tiết khí: ${solarTerm}` : "";
  solarTermElement.hidden = !solarTerm;
}

function updateMonthlyCalendarUrl() {
  if (location.protocol === "file:") return;
  const url = new URL(location.href);
  url.searchParams.set("year", calendarViewYear);
  url.searchParams.set("month", calendarViewMonth);
  url.searchParams.set("day", calendarSelectedDay);
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
