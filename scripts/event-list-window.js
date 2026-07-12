function renderEventListWindowDocument(events, emptyText = "Chưa có sự kiện nào.", eventDialogHtml = "") {
  const eventTypeOptions = `
    <option value="">Tất cả</option>
    <option value="birthday">Sinh nhật</option>
    <option value="deathAnniversary">Đám giỗ</option>
    <option value="other">Sự kiện khác</option>`;
  const eventGroupOptions = [
    `<option value="">Tất cả</option>`,
    ...(typeof getEventGroups === "function" ? getEventGroups() : []).map((group) =>
      `<option value="${escapeHtml(group.id)}" data-icon-id="${escapeHtml(group.iconId)}" data-icon-color="${escapeHtml(group.color)}">${escapeHtml(group.name)}</option>`
    )
  ].join("");
  const eventMonthOptions = [
    `<option value="">Tất cả</option>`,
    ...Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return `<option value="${month}">Tháng ${index + 1}</option>`;
    })
  ].join("");
  const eventItems = events.length
    ? events.map((item) => {
      const countdownText = getEventCountdownText(item);
      const nextSolarText = getEventNextSolarDateText(item);
      const nextSolarLine = nextSolarText ? `<p class="event-next-solar">${nextSolarText}</p>` : "";
      const eventMonth = String(item.date || "").slice(5, 7);
      const dateSummary = getEventListDateSummary(item);
      const eventType = escapeHtml(item.eventType);
      return `
        <button class="event-card" type="button" data-event-id="${escapeHtml(item.id)}" data-event-type="${eventType}" data-event-group="${escapeHtml(item.eventTypeId || "general")}" data-event-month="${escapeHtml(eventMonth)}" data-event-title="${escapeHtml(item.title).toLowerCase()}">
          ${getEventTypeIconMarkup(item.eventType, "event-card-type-icon")}
          <h2>${getEventTypeIconMarkup(item.eventType, "event-type-icon", item.eventTypeId)} ${escapeHtml(item.title)}</h2>
          <p>${dateSummary}</p>
          <p class="event-countdown">${countdownText}</p>
          ${nextSolarLine}
        </button>
      `;
    }).join("")
    : `<p class="empty-state">${escapeHtml(emptyText)}</p>`;

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Danh sách sự kiện</title>
  <base href="${escapeHtml(document.baseURI)}">
  <link rel="stylesheet" href="styles.css?v=45">
  <style>
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 24px;
  color: #111111;
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f6f8fb;
}
main {
  width: min(100%, 760px);
  margin: 0 auto;
}
h1 {
  margin: 0;
  color: #12345a;
  font-size: 1.45rem;
}
.event-list-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.event-add-button {
  position: relative;
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: #fff;
  font: inherit;
  font-size: 2rem;
  font-weight: 900;
  line-height: 1;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #0b8958 0%, #05643f 100%);
  box-shadow: 0 6px 14px rgba(8, 122, 77, .26);
  cursor: pointer;
}
.event-add-button::before,
.event-add-button::after {
  position: absolute;
  width: 18px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
  content: "";
}
.event-add-button::after {
  transform: rotate(90deg);
}
.event-add-button:hover,
.event-add-button:focus-visible {
  transform: translateY(-1px);
  outline: 3px solid rgba(8, 122, 77, .18);
}
.event-filter-form {
  display: grid;
  gap: 14px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
  background: #ffffff;
}
.event-filter-group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.event-classification-filter-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.event-filter-select-wrap { position: relative; display: block; min-width: 0; }
.event-filter-leading-icon {
  position: absolute; z-index: 2; top: 50%; left: 12px; display: grid; width: 22px; height: 22px;
  place-items: center; color: #64748b; font-size: .9rem; font-weight: 900; line-height: 1;
  pointer-events: none; transform: translateY(-50%);
}
.event-filter-leading-icon svg { display: block; width: 21px; height: 21px; fill: none; }
.event-type-filter-leading-icon[data-event-type="birthday"] { color: #b45309; }
.event-type-filter-leading-icon[data-event-type="deathAnniversary"] { color: #9a6700; }
.event-type-filter-leading-icon[data-event-type="other"] { color: #00796b; }
.event-filter-select-wrap select {
  padding-left: 44px; padding-inline-start: 44px; padding-right: 34px; padding-inline-end: 34px;
}
.event-filter-label {
  display: block;
  margin-bottom: 8px;
  color: #33475e;
  font-size: .74rem;
  font-weight: 800;
  letter-spacing: .035em;
  text-transform: uppercase;
}
.event-type-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.event-type-filter {
  display: flex;
  min-width: 0;
  min-height: 42px;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  color: #33475e;
  font-size: .86rem;
  font-weight: 800;
  border: 1px solid #d7e0ea;
  border-radius: 6px;
  background: #fff;
}
.event-type-filter input {
  flex: 0 0 auto;
}
.event-type-filter span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-type-icon {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: .88rem;
  font-weight: 900;
  line-height: 1;
}
.event-type-icon.birthday {
  color: #b45309;
  background: #fff7cf;
}
.event-type-icon.deathAnniversary {
  color: #9a6700;
  background: #fff7cf;
}
.event-type-icon.other {
  color: #00796b;
  background: #dff7ec;
}
.event-month-filter,
.event-type-filter-select,
.event-group-filter-select,
.event-name-filter {
  width: 100%;
  min-height: 44px;
  padding: 9px 10px;
  color: #111;
  font: inherit;
  font-size: .95rem;
  font-weight: 600;
  border: 1px solid #8fa3b9;
  border-radius: 5px;
  background: #fff;
  outline: none;
}
.event-month-filter:focus,
.event-name-filter:focus {
  border-color: #1e3a5f;
  box-shadow: 0 0 0 3px rgba(30, 58, 95, .12);
}
.event-list {
  display: grid;
  gap: 10px;
}
.event-card,
.empty-state {
  margin: 0;
  padding: 14px;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
  background: #ffffff;
}
.event-card {
  position: relative;
  width: 100%;
  padding-right: 52px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.event-card-type-icon {
  position: absolute; top: 12px; right: 14px; display: inline-flex; width: 28px; height: 28px;
  align-items: center; justify-content: center; border-radius: 999px; font-size: .95rem;
  font-weight: 900; line-height: 1; pointer-events: none;
}
.event-card-type-icon.birthday { color: #b45309; background: #fff7cf; }
.event-card-type-icon.deathAnniversary { color: #9a6700; background: #fff7cf; }
.event-card-type-icon.other { color: #00796b; background: #dff7ec; }
.event-card:hover,
.event-card:focus-visible {
  border-color: #8fa3b9;
  box-shadow: 0 8px 20px rgba(18, 52, 90, .10);
  outline: none;
}
.event-card[hidden],
.empty-state[hidden] {
  display: none;
}
.event-card h2 {
  margin: 0 0 8px;
  color: #12345a;
  font-size: 1rem;
}
.event-card p {
  margin: 5px 0;
  color: #45586d;
  font-size: .9rem;
  line-height: 1.45;
}
.event-countdown {
  color: #05643f !important;
  font-weight: 800;
}
.event-next-solar {
  color: #33475e !important;
  font-weight: 700;
}
@media (max-width: 560px) {
  .event-type-filters {
    grid-template-columns: 1fr;
  }
}
  </style>
</head>
<body>
  <main>
    <header class="event-list-header">
      <h1>Danh sách sự kiện</h1>
      <button id="eventAddButton" class="event-add-button" type="button" aria-label="Thêm sự kiện mới"></button>
    </header>
    <form id="eventFilterForm" class="event-filter-form" autocomplete="off">
      <div class="event-classification-filter-row">
        <label class="event-filter-group">
          <span class="event-filter-label">Loại sự kiện</span>
          <span class="event-filter-select-wrap">
            <span id="eventTypeFilterIcon" class="event-filter-leading-icon event-type-filter-leading-icon" aria-hidden="true">◆</span>
            <select id="eventTypeFilter" class="event-type-filter-select">${eventTypeOptions}</select>
          </span>
        </label>
        <label class="event-filter-group">
          <span class="event-filter-label">Nhóm sự kiện</span>
          <span class="event-filter-select-wrap">
            <span id="eventGroupFilterIcon" class="event-filter-leading-icon" aria-hidden="true">◆</span>
            <select id="eventGroupFilter" class="event-group-filter-select">${eventGroupOptions}</select>
          </span>
        </label>
      </div>
      <label class="event-filter-group">
        <span class="event-filter-label">Tháng sự kiện</span>
        <select id="eventMonthFilter" class="event-month-filter">
          ${eventMonthOptions}
        </select>
      </label>
      <label class="event-filter-group">
        <span class="event-filter-label">Tên sự kiện</span>
        <input id="eventNameFilter" class="event-name-filter" type="search" placeholder="Nhập tên sự kiện...">
      </label>
    </form>
    <section id="eventList" class="event-list" aria-label="Danh sách sự kiện">
      ${eventItems}
      <p id="eventFilterEmptyState" class="empty-state" hidden>Không có sự kiện phù hợp với bộ lọc.</p>
    </section>
  </main>
  ${eventDialogHtml}
  <script>
const form = document.getElementById("eventFilterForm");
const monthInput = document.getElementById("eventMonthFilter");
const nameInput = document.getElementById("eventNameFilter");
const typeInput = document.getElementById("eventTypeFilter");
const groupInput = document.getElementById("eventGroupFilter");
const typeIcon = document.getElementById("eventTypeFilterIcon");
const groupIcon = document.getElementById("eventGroupFilterIcon");
const cards = [...document.querySelectorAll(".event-card")];
const emptyState = document.getElementById("eventFilterEmptyState");

function normalizeFilterText(value) {
  return String(value || "").trim().toLowerCase();
}

function applyEventFilters() {
  const typeIcons = { birthday: "☀", deathAnniversary: "☾", other: "★" };
  typeIcon.textContent = typeIcons[typeInput.value] || "◆";
  typeIcon.dataset.eventType = typeInput.value || "all";
  const groupOption = groupInput.selectedOptions && groupInput.selectedOptions[0];
  const groupIconId = groupOption && groupOption.dataset.iconId;
  const groupIconColor = groupOption && groupOption.dataset.iconColor;
  groupIcon.innerHTML = groupIconId
    ? '<svg viewBox="0 0 24 24" style="color:' + (groupIconColor || "#64748b") + '" aria-hidden="true"><use href="icons/event-group-icons-sprite.svg#' + groupIconId + '"></use></svg>'
    : "◆";
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
}

typeInput.addEventListener("change", applyEventFilters);
groupInput.addEventListener("change", applyEventFilters);
monthInput.addEventListener("change", applyEventFilters);
nameInput.addEventListener("input", applyEventFilters);
form.addEventListener("reset", () => setTimeout(applyEventFilters, 0));
applyEventFilters();
  </script>
</body>
</html>`;
}

function getEventListDateSummary(event) {
  if (!event || !event.date) return "";
  return [
    formatEventDate(event.date),
    formatLunarDateShort(event.date)
  ].filter(Boolean).join(" · ");
}
