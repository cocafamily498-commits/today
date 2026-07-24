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
  stopJournalReading();
  const dialog = document.getElementById("journalDialog");
  if (dialog && dialog.open) dialog.close();
  document.body.classList.remove("event-dialog-open");
}

async function toggleJournalReading() {
  const button = document.getElementById("journalReadButton");
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    setJournalFormStatus("Trình duyệt này chưa hỗ trợ đọc nội dung.", true);
    return;
  }
  if (button?.classList.contains("is-reading") || window.speechSynthesis.speaking) {
    stopJournalReading();
    return;
  }
  const text = String(document.getElementById("journalText")?.value || "").trim();
  if (!text) {
    setJournalFormStatus("Chưa có nội dung để đọc.", true);
    return;
  }
  const vietnameseVoice = await getVietnameseSpeechVoice();
  if (!vietnameseVoice) {
    setJournalFormStatus("Windows chưa cung cấp giọng tiếng Việt cho trình duyệt. Hãy thêm giọng nói Tiếng Việt trong Settings > Time & language > Speech, sau đó mở lại trình duyệt.", true);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = vietnameseVoice.lang || "vi-VN";
  utterance.voice = vietnameseVoice;
  utterance.onend = utterance.onerror = () => setJournalReadButtonState(false);
  setJournalReadButtonState(true);
  window.speechSynthesis.speak(utterance);
}

function setJournalReadButtonState(isReading) {
  const button = document.getElementById("journalReadButton");
  if (!button) return;
  button.classList.toggle("is-reading", isReading);
  button.setAttribute("aria-label", isReading ? "Dừng đọc nội dung nhật ký" : "Đọc nội dung nhật ký");
  button.title = isReading ? "Dừng đọc" : "Đọc nội dung nhật ký";
  button.innerHTML = isReading
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.1-3.8v7.6a4.5 4.5 0 0 0 2.1-3.8Zm-2.1-8.7v2.1a7.5 7.5 0 0 1 0 13.2v2.1a9.5 9.5 0 0 0 0-17.4Z"/></svg>`;
}

function getVietnameseSpeechVoice() {
  const findVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => /^vi(?:-|_)/i.test(String(voice.lang || "")))
      || voices.find((voice) => /vietnam|việt nam|tiếng việt/i.test(String(voice.name || "")))
      || null;
  };
  const availableVoice = findVoice();
  if (availableVoice) return Promise.resolve(availableVoice);

  return new Promise((resolve) => {
    const startedAt = Date.now();
    let pollTimer = 0;
    const finish = (voice = null) => {
      window.clearTimeout(pollTimer);
      window.speechSynthesis.removeEventListener("voiceschanged", checkVoices);
      resolve(voice);
    };
    const checkVoices = () => {
      const voice = findVoice();
      if (voice) {
        finish(voice);
        return;
      }
      if (Date.now() - startedAt >= 5000) {
        finish(null);
        return;
      }
      window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(checkVoices, 200);
    };
    window.speechSynthesis.addEventListener("voiceschanged", checkVoices);
    checkVoices();
  });
}

function stopJournalReading() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  setJournalReadButtonState(false);
}

function openJournalExpandedEditor() {
  const dialog = document.getElementById("journalExpandedDialog");
  const source = document.getElementById("journalText");
  const editor = document.getElementById("journalExpandedText");
  if (!dialog || !source || !editor) return;
  stopJournalReading();
  editor.value = source.value;
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => editor.focus({ preventScroll: true }));
}

function closeJournalExpandedEditor() {
  const dialog = document.getElementById("journalExpandedDialog");
  const source = document.getElementById("journalText");
  const editor = document.getElementById("journalExpandedText");
  if (source && editor) {
    source.value = editor.value;
    source.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (dialog?.open) dialog.close();
  requestAnimationFrame(() => document.getElementById("journalExpandButton")?.focus({ preventScroll: true }));
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

  const journals = await window.LichVietData.getAllJournals();
  populateJournalYearFilter(journals);
  const yearFilter = document.getElementById("journalYearFilter")?.value || "";
  const monthFilter = document.getElementById("journalMonthFilter").value;
  const contentFilter = normalizeJournalFilterText(document.getElementById("journalContentFilter").value);
  const groupFilter = document.getElementById("journalGroupFilter")?.value || "";
  const filtered = journals
    .filter((journal) => {
      const journalYear = String(journal.date || "").slice(0, 4);
      const journalMonth = String(journal.date || "").slice(5, 7);
      const matchesYear = yearFilter === "" || journalYear === yearFilter;
      const matchesMonth = monthFilter === "" || journalMonth === monthFilter;
      const matchesContent = contentFilter === "" || normalizeJournalFilterText(journal.text).includes(contentFilter);
      const matchesGroup = groupFilter === "" || (journal.eventTypeId || "general") === groupFilter;
      return matchesYear && matchesMonth && matchesContent && matchesGroup;
    })
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || ""))
      || String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  journalFilteredEntries = filtered;
  const printButton = document.getElementById("journalFilterPrintButton");
  if (printButton) printButton.disabled = filtered.length === 0;

  list.innerHTML = filtered.map(renderJournalListCardMarkup).join("");

  [...list.querySelectorAll("[data-journal-id]")].forEach((button) => {
    button.addEventListener("click", async () => {
      const journal = await window.LichVietData.getJournal(button.dataset.journalId);
      if (journal) await loadJournalIntoForm(journal);
    });
  });

  emptyState.hidden = filtered.length > 0;
}

function renderJournalListCardMarkup(journal) {
  const group = typeof getEventGroup === "function" ? getEventGroup(journal.eventTypeId || "general") : null;
  const groupName = group ? group.name : "Nhóm chung";
  const lunarDate = formatLunarDateShort(journal.date).replace(/^Âm lịch\s*/, "Âm lịch: ");
  return `
    <button class="event-list-item journal-list-item" type="button" data-journal-id="${escapeHtml(journal.id)}">
      <span class="journal-card-meta">
        <strong>${escapeHtml(formatEventDate(journal.date))}</strong>
        <span>${escapeHtml(lunarDate)}</span>
        <span class="journal-card-group-icon" title="${escapeHtml(groupName)}" aria-label="Nhóm: ${escapeHtml(groupName)}">${group ? renderEventGroupIcon(group, "journal-list-group-icon") : ""}<span class="journal-card-group-name">${escapeHtml(groupName)}</span></span>
      </span>
      <span class="journal-list-text">${escapeHtml(journal.text || "")}</span>
    </button>
  `;
}

function populateJournalYearFilter(journals) {
  const select = document.getElementById("journalYearFilter");
  if (!select) return;
  const selectedValue = select.value;
  const years = [...new Set((journals || [])
    .map((journal) => String(journal.date || "").slice(0, 4))
    .filter((year) => /^\d{4}$/.test(year)))]
    .sort((left, right) => right.localeCompare(left));
  select.innerHTML = `<option value="">Tất cả</option>${years.map((year) =>
    `<option value="${year}">${year}</option>`).join("")}`;
  select.value = years.includes(selectedValue) ? selectedValue : "";
}

function normalizeJournalFilterText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function showJournalHoverPreview(day, journals, anchor) {
  const journalList = Array.isArray(journals) ? journals : journals ? [journals] : [];
  const journal = journalList[0];
  if (!journal || !journalHoverPreviewEnabled) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const preview = document.getElementById("journalHoverPreview");
  if (!preview) return;
  preview.innerHTML = `
    <strong>${escapeHtml(formatEventDate(journal.date))}</strong>
    <p>${escapeHtml(journal.text || "")}</p>
    ${journalList.length > 1 ? `<span>+ ${journalList.length - 1} nhật ký/ghi chú khác</span>` : ""}
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
