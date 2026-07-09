function renderEventEditorWindowStyles() {
  return `* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 18px;
  color: #111;
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background: linear-gradient(180deg, #ffffff 0%, #f6f8fb 100%);
}
h1 {
  margin: 0 0 18px;
  color: #12345a;
  font-size: 1.35rem;
  line-height: 1.25;
}
.event-form { display: grid; gap: 16px; }
.event-form-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.event-field { grid-column: span 3; min-width: 0; }
.event-type-field, .event-date-field, .event-time-field { grid-column: span 2; }
.event-field.full { grid-column: 1 / -1; }
label, .event-reminder-offset-label, .event-lunar-date-label {
  color: #33475e;
  font-size: .74rem;
  font-weight: 800;
  letter-spacing: .035em;
  text-transform: uppercase;
}
label { display: block; margin-bottom: 6px; }
input, select, textarea {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  color: #111;
  font: inherit;
  font-size: .95rem;
  font-weight: 600;
  border: 1px solid #8fa3b9;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(18, 52, 90, .06);
  outline: none;
}
input, select { height: 44px; }
.event-time-field input[type="time"] {
  padding-top: 0;
  padding-bottom: 0;
  line-height: 42px;
}
.event-time-field input[type="time"]::-webkit-date-and-time-value,
.event-time-field input[type="time"]::-webkit-datetime-edit {
  min-height: 42px;
  display: flex;
  align-items: center;
}
textarea { min-height: 92px; resize: vertical; line-height: 1.45; }
input:focus, select:focus, textarea:focus {
  border-color: #1e3a5f;
  box-shadow: 0 0 0 3px rgba(30, 58, 95, .12);
}
.event-type-select-wrap {
  position: relative;
  display: block;
}
.event-type-select-wrap::after {
  content: "";
  position: absolute;
  top: 50%;
  right: 14px;
  width: 8px;
  height: 8px;
  border-right: 2px solid #111;
  border-bottom: 2px solid #111;
  pointer-events: none;
  transform: translateY(-65%) rotate(45deg);
}
.event-type-select-wrap select {
  -webkit-appearance: none;
  appearance: none;
  padding-left: 43px;
  padding-right: 38px;
  padding-inline-start: 43px;
  padding-inline-end: 38px;
}
.event-type-selected-icon {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 11px;
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: .88rem;
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
  transform: translateY(-50%);
}
.event-type-selected-icon.birthday {
  color: #b45309;
  background: #fff7cf;
}
.event-type-selected-icon.deathAnniversary {
  color: #9a6700;
  background: #fff7cf;
}
.event-type-selected-icon.other {
  color: #00796b;
  background: #dff7ec;
}
.event-lunar-date-row {
  position: relative;
  display: block;
  width: 100%;
  margin-top: 8px;
}
.event-lunar-date-label {
  position: absolute;
  top: 50%;
  right: calc(100% + 8px);
  display: flex;
  align-items: center;
  white-space: nowrap;
  transform: translateY(-50%);
}
.event-lunar-date-display {
  color: #45586d !important;
  background: #fff !important;
}
.event-lunar-leap-badge {
  position: absolute;
  top: 50%;
  left: calc(100% + 8px);
  color: #33475e;
  font-size: .82rem;
  font-weight: 800;
  white-space: nowrap;
  transform: translateY(-50%);
}
.event-reminder-offset {
  grid-column: 1 / -1;
  display: grid;
  gap: 6px;
}
.event-reminder-offset-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.event-reminder-unit-control { position: relative; min-width: 0; }
.event-reminder-unit-control input { padding-right: 58px; text-align: center; }
.event-reminder-unit-control span {
  position: absolute;
  top: 50%;
  right: 14px;
  color: #33475e;
  font-size: .76rem;
  font-weight: 800;
  pointer-events: none;
  transform: translateY(-50%);
}
.event-form-status {
  min-height: 20px;
  margin: 0;
  color: #05643f;
  font-size: .82rem;
  font-weight: 700;
  text-align: right;
}
.event-form-status.error { color: #a12622; }
.event-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  align-items: center;
}
button {
  min-height: 44px;
  padding: 9px 12px;
  font: inherit;
  font-size: .84rem;
  font-weight: 800;
  border-radius: 5px;
  cursor: pointer;
}
.event-form-actions button {
  width: 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.event-submit {
  color: #fff;
  border: 0;
  background: linear-gradient(135deg, #0b8958 0%, #05643f 100%);
  box-shadow: 0 5px 12px rgba(8, 122, 77, .24);
}
.event-secondary-button {
  color: #33475e;
  border: 1px solid #b8c7d8;
  background: #fff;
}
.event-danger-button {
  color: #a12622;
  border: 1px solid #f0b8b5;
  background: #fff5f4;
}
.event-confirm-dialog {
  width: min(calc(100% - 32px), 430px);
  padding: 0;
  color: #111;
  font: inherit;
  border: 1px solid #b8c7d8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 29, 45, .32);
}
.event-confirm-dialog::backdrop {
  background: rgba(15, 29, 45, .58);
}
.event-confirm-content {
  padding: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f6f8fb 100%);
}
.event-confirm-content h2 {
  margin: 0 0 10px;
  color: #12345a;
  font-size: 1.25rem;
  line-height: 1.25;
}
.event-confirm-content p {
  margin: 0;
  color: #45586d;
  font-size: .92rem;
  font-weight: 600;
  line-height: 1.5;
}
.event-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
}
@media (max-width: 640px) {
  .event-form-grid { grid-template-columns: 1fr; }
  .event-field, .event-time-field, .event-reminder-offset { grid-column: 1 / -1; }
  .event-lunar-date-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
  }
  .event-lunar-date-label, .event-lunar-leap-badge {
    position: static;
    transform: none;
  }
}`;
}
