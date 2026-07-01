function renderEventListWindowDocument(events, emptyText = "Chưa có sự kiện nào.", eventDialogHtml = "") {
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
        <button class="event-card" type="button" data-event-id="${escapeHtml(item.id)}" data-event-type="${eventType}" data-event-month="${escapeHtml(eventMonth)}" data-event-title="${escapeHtml(item.title).toLowerCase()}">
          <h2>${getEventTypeIconMarkup(item.eventType, "event-type-icon")} ${escapeHtml(item.title)}</h2>
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
  <link rel="stylesheet" href="styles.css">
  <style>
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 24px;
  color: #111111;
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
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
  width: 100%;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
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
      <fieldset class="event-filter-group">
        <legend class="event-filter-label">Loại sự kiện</legend>
        <div class="event-type-filters">
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="birthday" checked> <span>${getEventTypeIconMarkup("birthday", "event-type-icon")} Sinh nhật</span></label>
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="deathAnniversary" checked> <span>${getEventTypeIconMarkup("deathAnniversary", "event-type-icon")} Đám giỗ</span></label>
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="other" checked> <span>${getEventTypeIconMarkup("other", "event-type-icon")} Sự kiện khác</span></label>
        </div>
      </fieldset>
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
const typeInputs = [...document.querySelectorAll("input[name='eventType']")];
const cards = [...document.querySelectorAll(".event-card")];
const emptyState = document.getElementById("eventFilterEmptyState");

function normalizeFilterText(value) {
  return String(value || "").trim().toLowerCase();
}

function applyEventFilters() {
  const selectedTypes = new Set(typeInputs.filter((input) => input.checked).map((input) => input.value));
  const selectedMonth = monthInput.value;
  const query = normalizeFilterText(nameInput.value);
  let visibleCount = 0;

  cards.forEach((card) => {
    const matchesType = selectedTypes.has(card.dataset.eventType);
    const matchesMonth = selectedMonth === "" || card.dataset.eventMonth === selectedMonth;
    const matchesName = query === "" || normalizeFilterText(card.dataset.eventTitle).includes(query);
    const visible = matchesType && matchesMonth && matchesName;
    card.hidden = !visible;
    card.style.display = visible ? "" : "none";
    if (visible) visibleCount += 1;
  });

  if (emptyState) emptyState.hidden = visibleCount > 0 || cards.length === 0;
}

typeInputs.forEach((input) => {
  input.addEventListener("change", applyEventFilters);
  input.addEventListener("click", applyEventFilters);
});
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
