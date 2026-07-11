function renderEventListDialogContent(events, emptyText = "Chưa có sự kiện nào.") {
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
      const nextSolarText = getEventNextSolarDateText(item);
      const dateSummary = getEventListDateSummary(item);
      const countdownText = getEventCountdownText(item);
      const eventMonth = String(item.date || "").slice(5, 7);
      return `
        <button class="event-card" type="button" data-event-id="${escapeHtml(item.id)}" data-event-type="${escapeHtml(item.eventType)}" data-event-group="${escapeHtml(item.eventTypeId || "general")}" data-event-month="${escapeHtml(eventMonth)}" data-event-title="${escapeHtml(item.title).toLowerCase()}">
          ${getEventTypeIconMarkup(item.eventType, "event-card-type-icon")}
          <h2>${getEventTypeIconMarkup(item.eventType, "month-event-icon", item.eventTypeId)} ${escapeHtml(item.title)}</h2>
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
      <div class="event-classification-filter-row">
        <div class="event-filter-group">
          <span class="event-filter-label">Loại sự kiện</span>
          <span class="event-filter-combobox" data-filter-combobox="type">
            <select id="eventTypeFilter" hidden>${eventTypeOptions}</select>
            <button class="event-filter-combobox-button" type="button" aria-haspopup="listbox" aria-expanded="false"></button>
            <span class="event-filter-combobox-list" role="listbox" hidden>
              <button type="button" role="option" data-value=""><span class="event-filter-neutral-icon">◆</span><span>Tất cả</span></button>
              <button type="button" role="option" data-value="birthday">${getEventTypeIconMarkup("birthday")}<span>Sinh nhật</span></button>
              <button type="button" role="option" data-value="deathAnniversary">${getEventTypeIconMarkup("deathAnniversary")}<span>Đám giỗ</span></button>
              <button type="button" role="option" data-value="other">${getEventTypeIconMarkup("other")}<span>Sự kiện khác</span></button>
            </span>
          </span>
        </div>
        <div class="event-filter-group">
          <span class="event-filter-label">Nhóm sự kiện</span>
          <span class="event-filter-combobox" data-filter-combobox="group">
            <select id="eventGroupFilter" hidden>${eventGroupOptions}</select>
            <button class="event-filter-combobox-button" type="button" aria-haspopup="listbox" aria-expanded="false"></button>
            <span class="event-filter-combobox-list" role="listbox" hidden>
              <button type="button" role="option" data-value=""><span class="event-filter-neutral-icon">◆</span><span>Tất cả</span></button>
              ${(typeof getEventGroups === "function" ? getEventGroups() : []).map((group) => `
                <button type="button" role="option" data-value="${escapeHtml(group.id)}">${renderEventGroupIcon(group)}<span>${escapeHtml(group.name)}</span></button>
              `).join("")}
            </span>
          </span>
        </div>
      </div>
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
