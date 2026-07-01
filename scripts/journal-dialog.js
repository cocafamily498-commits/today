function openJournalDialog() {
  const dialog = document.getElementById("journalDialog");
  if (!dialog) return;
  document.body.classList.add("event-dialog-open");
  if (!dialog.open) dialog.showModal();
  if (shouldAvoidJournalVirtualKeyboard()) {
    requestAnimationFrame(blurActiveJournalEditableElement);
    return;
  }
  requestAnimationFrame(() => {
    const textInput = document.getElementById("journalText");
    if (textInput) textInput.focus({ preventScroll: true });
  });
}

function shouldAvoidJournalVirtualKeyboard() {
  if (typeof shouldAvoidOpeningVirtualKeyboard === "function") {
    return shouldAvoidOpeningVirtualKeyboard(document);
  }
  return window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
}

function blurActiveJournalEditableElement() {
  if (typeof blurEditableElementInDocument === "function") {
    blurEditableElementInDocument(document);
    return;
  }
  const active = document.activeElement;
  if (!active || !["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
  active.blur();
}

function closeJournalDialog() {
  const dialog = document.getElementById("journalDialog");
  if (dialog && dialog.open) dialog.close();
  document.body.classList.remove("event-dialog-open");
}

function getSelectedJournalCalendarDate() {
  if (!journalCalendarYear || !journalCalendarMonth || !journalCalendarSelectedDay) return null;
  return `${journalCalendarYear}-${String(journalCalendarMonth).padStart(2, "0")}-${String(journalCalendarSelectedDay).padStart(2, "0")}`;
}

async function setJournalCalendarDateFromDateValue(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date) return;
  journalCalendarYear = date.year;
  journalCalendarMonth = date.month;
  journalCalendarSelectedDay = date.day;
  renderJournalCalendar();
  await loadJournalCalendarEntries();
}

function setJournalDateInputValue(dateValue) {
  const input = document.getElementById("journalDate");
  if (input) input.value = formatEventDateInputValue(dateValue);
}

function getJournalDateInputValue() {
  const input = document.getElementById("journalDate");
  return input ? parseEventDateInputValue(input.value) : "";
}

function normalizeJournalDateInput() {
  const input = document.getElementById("journalDate");
  if (!input) return;
  const dateValue = parseEventDateInputValue(input.value);
  if (dateValue) input.value = formatEventDateInputValue(dateValue);
}

function updateJournalDateHint() {
  const hint = document.getElementById("journalDateHint");
  const leapBadge = document.getElementById("journalLunarLeapBadge");
  if (!hint) return;
  const lunarDate = getEventLunarDateValue(getJournalDateInputValue());
  hint.value = lunarDate ? lunarDate.value : "";
  if (leapBadge) leapBadge.hidden = !lunarDate || !lunarDate.leap;
}

async function renderJournalList() {
  const list = document.getElementById("journalList");
  const emptyState = document.getElementById("journalFilterEmptyState");
  const panel = document.getElementById("journalListPanel");
  if (!list || !emptyState || !panel || panel.hidden) return;

  const monthFilter = document.getElementById("journalMonthFilter").value;
  const contentFilter = normalizeJournalFilterText(document.getElementById("journalContentFilter").value);
  const journals = await window.LichVietData.getAllJournals();
  const filtered = journals
    .filter((journal) => {
      const journalMonth = String(journal.date || "").slice(5, 7);
      const matchesMonth = monthFilter === "" || journalMonth === monthFilter;
      const matchesContent = contentFilter === "" || normalizeJournalFilterText(journal.text).includes(contentFilter);
      return matchesMonth && matchesContent;
    })
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));

  list.innerHTML = filtered.map((journal) => `
    <button class="event-list-item journal-list-item" type="button" data-journal-date="${escapeHtml(journal.date)}">
      <strong>${escapeHtml(formatEventDate(journal.date))}${journal.imageIds && journal.imageIds.length ? ' <span class="journal-list-image-icon" aria-hidden="true">▣</span>' : ""}</strong>
      <span>${escapeHtml(formatLunarDateShort(journal.date))}</span>
      <span class="journal-list-text">${escapeHtml(journal.text || "")}</span>
    </button>
  `).join("");

  [...list.querySelectorAll("[data-journal-date]")].forEach((button) => {
    button.addEventListener("click", async () => {
      const journal = await window.LichVietData.getJournalByDate(button.dataset.journalDate);
      if (journal) await loadJournalIntoForm(journal);
    });
  });

  emptyState.hidden = filtered.length > 0;
}

function normalizeJournalFilterText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function showJournalHoverPreview(day, journal, anchor) {
  if (!journal || !journalHoverPreviewEnabled) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const preview = document.getElementById("journalHoverPreview");
  if (!preview) return;
  preview.innerHTML = `
    <strong>${escapeHtml(formatEventDate(journal.date))}</strong>
    <p>${escapeHtml(journal.text || "")}</p>
    ${journal.imageIds && journal.imageIds.length ? `<span>▣ ${journal.imageIds.length} hình ảnh</span>` : ""}
  `;
  preview.hidden = false;

  const anchorRect = anchor.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const left = Math.min(
    Math.max(12, anchorRect.left + anchorRect.width / 2 - previewRect.width / 2),
    window.innerWidth - previewRect.width - 12
  );
  const top = anchorRect.top > previewRect.height + 18
    ? anchorRect.top - previewRect.height - 10
    : anchorRect.bottom + 10;
  preview.style.left = `${left}px`;
  preview.style.top = `${Math.max(12, top)}px`;
}

function hideJournalHoverPreview() {
  const preview = document.getElementById("journalHoverPreview");
  if (!preview) return;
  preview.hidden = true;
}
