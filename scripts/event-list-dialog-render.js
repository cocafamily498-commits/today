function renderEventListDialogContent(events, emptyText = "Chua co su kien nao.") {
  const eventMonthOptions = [
    `<option value="">Tat ca</option>`,
    ...Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return `<option value="${month}">Thang ${index + 1}</option>`;
    })
  ].join("");
  const eventItems = events.length
    ? events.map((item) => {
      const nextSolarText = getEventNextSolarDateText(item);
      const eventMonth = String(item.date || "").slice(5, 7);
      return `
        <button class="event-card" type="button" data-event-id="${escapeHtml(item.id)}" data-event-type="${escapeHtml(item.eventType)}" data-event-month="${escapeHtml(eventMonth)}" data-event-title="${escapeHtml(item.title).toLowerCase()}">
          <h2>${getEventTypeIconMarkup(item.eventType)} ${escapeHtml(item.title)}</h2>
          <p>${getEventListDateSummary(item)}</p>
          <p class="event-countdown">${getEventCountdownText(item)}</p>
          ${nextSolarText ? `<p class="event-next-solar">${nextSolarText}</p>` : ""}
        </button>
      `;
    }).join("")
    : `<p class="empty-state">${escapeHtml(emptyText)}</p>`;

  return `
    <header class="event-list-dialog-header">
      <h2 class="event-list-dialog-title">Danh sach su kien</h2>
      <div class="event-list-dialog-actions">
        <button id="eventListDialogCloseButton" class="event-list-dialog-close" type="button" aria-label="Dong">&times;</button>
      </div>
    </header>
    <form id="eventFilterForm" class="event-filter-form" autocomplete="off">
      <fieldset class="event-filter-group">
        <legend class="event-filter-label">Loai su kien</legend>
        <div class="event-type-filters">
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="birthday" checked> <span>${getEventTypeIconMarkup("birthday")} Sinh nhat</span></label>
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="deathAnniversary" checked> <span>${getEventTypeIconMarkup("deathAnniversary")} Dam gio</span></label>
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="other" checked> <span>${getEventTypeIconMarkup("other")} Su kien khac</span></label>
        </div>
      </fieldset>
      <label class="event-filter-group">
        <span class="event-filter-label">Thang su kien</span>
        <select id="eventMonthFilter" class="event-month-filter">${eventMonthOptions}</select>
      </label>
      <label class="event-filter-group">
        <span class="event-filter-label">Ten su kien</span>
        <input id="eventNameFilter" class="event-name-filter" type="search" placeholder="Nhap ten su kien...">
      </label>
    </form>
    <section id="eventList" class="event-list-window-list" aria-label="Danh sach su kien" style="display:grid;align-content:start;gap:10px;min-height:0;height:100%;max-height:100%;padding-right:4px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain">
      ${eventItems}
      <p id="eventFilterEmptyState" class="empty-state" hidden>Khong co su kien phu hop voi bo loc.</p>
    </section>
  `;
}
