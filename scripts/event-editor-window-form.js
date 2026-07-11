function renderEventEditorWindowForm(state, title) {
  return `<h1 id="eventEditorWindowTitle">${escapeHtml(title)}</h1>
<form id="eventForm" class="event-form" autocomplete="off">
  <div class="event-form-grid">
    <div class="event-field event-type-field">
      <label for="eventType">Loại sự kiện</label>
      <span class="event-type-select-wrap">
        <span id="eventTypeIcon" class="event-type-selected-icon birthday" aria-hidden="true">☀</span>
        <select id="eventType" name="eventType">
          <option value="birthday">Sinh nhật</option>
          <option value="deathAnniversary">Đám giỗ</option>
          <option value="other">Sự kiện khác</option>
        </select>
      </span>
    </div>
    <div class="event-field event-date-field">
      <label for="eventDate">Ngày</label>
      <input id="eventDate" name="date" type="text" autocomplete="off" placeholder="dd/mm/yyyy" pattern="\\d{1,2}/\\d{1,2}/\\d{4}" required>
      <span class="event-lunar-date-row">
        <span class="event-lunar-date-label">Âm lịch</span>
        <input id="eventDateHint" class="event-lunar-date-display" type="text" readonly aria-label="Ngày âm được đổi từ ngày dương">
        <span id="eventLunarLeapBadge" class="event-lunar-leap-badge" hidden>nhuận</span>
      </span>
    </div>
    <div class="event-field event-time-field">
      <label for="eventTime">Giờ sự kiện</label>
      <input id="eventTime" name="eventTime" type="time" value="${DEFAULT_EVENT_TIME}">
    </div>
    <div class="event-field full">
      <label for="eventTitle">Tên sự kiện</label>
      <input id="eventTitle" name="title" type="text" maxlength="90" required>
    </div>
    <div class="event-field">
      <label for="eventCalendar">Lịch</label>
      <select id="eventCalendar" name="calendarLabel">
        <option value="solar">Dương lịch</option>
        <option value="lunar">Âm lịch</option>
      </select>
    </div>
    <div class="event-field">
      <label for="eventRepeat">Lặp lại</label>
      <select id="eventRepeat" name="repeatFrequency">
        <option value="none">Không lặp</option>
        <option value="daily">Hàng ngày</option>
        <option value="weekly">Hàng tuần</option>
        <option value="monthly">Hàng tháng</option>
        <option value="yearly">Hàng năm</option>
      </select>
    </div>
    <div class="event-field event-reminder-offset">
      <span class="event-reminder-offset-label">Nhắc trước</span>
      <div class="event-reminder-offset-controls">
        <div class="event-reminder-unit-control">
          <label class="sr-only" for="eventBeforeDays">Số ngày nhắc trước</label>
          <input id="eventBeforeDays" name="beforeDays" type="number" min="0" max="365" inputmode="numeric" value="0">
          <span>ngày</span>
        </div>
        <div class="event-reminder-unit-control">
          <label class="sr-only" for="eventBeforeHours">Số giờ nhắc trước</label>
          <input id="eventBeforeHours" name="beforeHours" type="number" min="0" max="23" inputmode="numeric" value="0">
          <span>giờ</span>
        </div>
      </div>
    </div>
    <div class="event-field full">
      <label for="eventTypeId">Nhóm sự kiện</label>
      <div class="event-editor-group-row">
        <select id="eventTypeId" name="eventTypeId">
          ${(state.groups || []).map((group) => `<option value="${escapeHtml(group.id)}">● ${escapeHtml(group.name)}</option>`).join("")}
        </select>
        <button id="eventGroupManageButton" class="event-secondary-button" type="button" aria-label="Thêm hoặc quản lý nhóm">+</button>
      </div>
    </div>
  </div>
  <p id="eventFormStatus" class="event-form-status" aria-live="polite"></p>
  <div class="event-form-actions">
    <button id="eventResetButton" class="event-secondary-button" type="button">Mới</button>
    <button id="eventDeleteButton" class="event-danger-button" type="button" hidden>Xóa</button>
    <button id="eventSubmitButton" class="event-submit" type="submit">Lưu</button>
  </div>
</form>`;
}
