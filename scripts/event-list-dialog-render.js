function renderEventListDialogContent(events, emptyText = "Chưa có sự kiện nào.") {
  const eventMonthOptions = [
    `<option value="">Tất cả</option>`,
    ...Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return `<option value="${month}">Tháng ${index + 1}</option>`;
    })
  ].join("");
  const eventItems = events.length
    ? events.map((item) => {
      const nextSolarText = getEventNextSolarDateText(item);
      const dateSummary = getEventListDateSummary(item);
      const countdownText = getEventCountdownText(item);
      const eventMonth = String(item.date || "").slice(5, 7);
      return `
        <button class="event-card" type="button" data-event-id="${escapeHtml(item.id)}" data-event-type="${escapeHtml(item.eventType)}" data-event-month="${escapeHtml(eventMonth)}" data-event-title="${escapeHtml(item.title).toLowerCase()}">
          <h2>${getEventTypeIconMarkup(item.eventType)} ${escapeHtml(item.title)}</h2>
          <p class="event-card-date-line">
            <span>${escapeHtml(dateSummary)}</span>
            <span class="event-countdown">${escapeHtml(countdownText)}</span>
          </p>
          ${nextSolarText ? `<p class="event-next-solar">${nextSolarText}</p>` : ""}
        </button>
      `;
    }).join("")
    : `<p class="empty-state">${escapeHtml(emptyText)}</p>`;

  return `
    <header class="event-list-dialog-header">
      <h2 class="event-list-dialog-title">Danh sách sự kiện</h2>
      <div class="event-list-dialog-actions">
        <button id="eventListDialogCloseButton" class="event-list-dialog-close" type="button" aria-label="Đóng">&times;</button>
      </div>
    </header>
    <form id="eventFilterForm" class="event-filter-form" autocomplete="off">
      <fieldset class="event-filter-group">
        <legend class="event-filter-label sr-only">Loại sự kiện</legend>
        <div class="event-type-filters">
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="birthday" checked> <span>${getEventTypeIconMarkup("birthday")} <span class="event-type-label-long">Sinh nhật</span><span class="event-type-label-short" aria-hidden="true">SN</span></span></label>
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="deathAnniversary" checked> <span>${getEventTypeIconMarkup("deathAnniversary")} <span class="event-type-label-long">Đám giỗ</span><span class="event-type-label-short" aria-hidden="true">ĐG</span></span></label>
          <label class="event-type-filter"><input type="checkbox" name="eventType" value="other" checked> <span>${getEventTypeIconMarkup("other")} <span class="event-type-label-long">Sự kiện khác</span><span class="event-type-label-short" aria-hidden="true">KH</span></span></label>
        </div>
      </fieldset>
      <div class="event-filter-row">
        <label class="event-filter-group event-month-filter-group">
          <span class="event-filter-label">Tháng</span>
          <select id="eventMonthFilter" class="event-month-filter">${eventMonthOptions}</select>
        </label>
        <div class="event-filter-group event-name-filter-group">
          <div class="event-name-filter-heading">
            <label class="event-filter-label" for="eventNameFilter">Tên sự kiện</label>
            <button id="eventAddButton" class="event-list-add-button" type="button" aria-label="Thêm sự kiện mới"></button>
          </div>
          <input id="eventNameFilter" class="event-name-filter" type="search" placeholder="Nhập tên sự kiện để lọc">
        </div>
      </div>
    </form>
    <section id="eventList" class="event-list-window-list" aria-label="Danh sách sự kiện" style="display:grid;align-content:start;gap:10px;min-height:0;height:100%;max-height:100%;padding-right:4px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain">
      ${eventItems}
      <p id="eventFilterEmptyState" class="empty-state" hidden>Không có sự kiện phù hợp với bộ lọc.</p>
    </section>
  `;
}
