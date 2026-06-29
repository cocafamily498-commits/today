function renderEventEditorWindowScript(stateJson) {
  return `const initialState = ${stateJson};
const bridge = window.EventEditorBridge
  || (window.parent && window.parent !== window && window.parent.EventEditorBridge)
  || (window.opener && window.opener.EventEditorBridge);
const ids = {
  form: document.getElementById("eventForm"),
  type: document.getElementById("eventType"),
  typeIcon: document.getElementById("eventTypeIcon"),
  date: document.getElementById("eventDate"),
  lunar: document.getElementById("eventDateHint"),
  leap: document.getElementById("eventLunarLeapBadge"),
  title: document.getElementById("eventTitle"),
  calendar: document.getElementById("eventCalendar"),
  repeat: document.getElementById("eventRepeat"),
  days: document.getElementById("eventBeforeDays"),
  hours: document.getElementById("eventBeforeHours"),
  time: document.getElementById("eventTime"),
  note: document.getElementById("eventNote"),
  status: document.getElementById("eventFormStatus")
};

function setStatus(message, isError = false) {
  ids.status.textContent = message || "";
  ids.status.classList.toggle("error", isError);
}

function updateTypeIcon(type) {
  if (!ids.typeIcon) return;
  const eventType = ["birthday", "deathAnniversary", "other"].includes(type) ? type : "other";
  const icons = { birthday: "☀", deathAnniversary: "☾", other: "★" };
  ids.typeIcon.className = "event-type-selected-icon " + eventType;
  ids.typeIcon.textContent = icons[eventType];
}

function applyTypeDefaults() {
  const type = ids.type.value;
  updateTypeIcon(type);
  if (type === "birthday") {
    ids.calendar.value = "solar";
    ids.calendar.disabled = true;
    ids.repeat.value = "yearly";
    ids.repeat.disabled = true;
  } else if (type === "deathAnniversary") {
    ids.calendar.value = "lunar";
    ids.calendar.disabled = true;
    ids.repeat.value = "yearly";
    ids.repeat.disabled = true;
  } else {
    ids.calendar.disabled = false;
    ids.repeat.disabled = false;
  }
  updateLunarDate();
}

function updateLunarDate() {
  const value = bridge ? bridge.getLunarDateValue(ids.date.value) : null;
  ids.lunar.value = value ? value.value : "";
  ids.leap.hidden = !value || !value.leap;
}

function setValues(values) {
  ids.type.value = values.eventType || "other";
  ids.date.value = values.date || "";
  ids.title.value = values.title || "";
  ids.calendar.value = values.calendarLabel || "solar";
  ids.repeat.value = values.repeatFrequency || "none";
  ids.days.value = values.beforeDays || 0;
  ids.hours.value = values.beforeHours || 0;
  ids.time.value = values.eventTime || "${DEFAULT_EVENT_TIME}";
  ids.note.value = values.note || "";
  applyTypeDefaults();
  if (values.calendarLabel) ids.calendar.value = values.calendarLabel;
  if (values.repeatFrequency) ids.repeat.value = values.repeatFrequency;
  updateLunarDate();
}

function getValues() {
  return {
    eventType: ids.type.value,
    date: ids.date.value,
    title: ids.title.value,
    calendarLabel: ids.calendar.value,
    repeatFrequency: ids.repeat.value,
    beforeDays: ids.days.value,
    beforeHours: ids.hours.value,
    eventTime: ids.time.value,
    note: ids.note.value
  };
}

function confirmDelete() {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "event-confirm-dialog";
    dialog.innerHTML = \`
      <form method="dialog" class="event-confirm-content">
        <h2>Xóa sự kiện?</h2>
        <p>Sự kiện này sẽ bị xóa khỏi lịch. Bạn không thể hoàn tác thao tác này.</p>
        <div class="event-confirm-actions">
          <button class="event-secondary-button" value="cancel" type="submit">Hủy</button>
          <button class="event-danger-button" value="delete" type="submit">Xóa sự kiện</button>
        </div>
      </form>
    \`;

    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "delete");
      dialog.remove();
    }, { once: true });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });

    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector(".event-secondary-button").focus();
  });
}

ids.type.addEventListener("change", applyTypeDefaults);
ids.date.addEventListener("input", updateLunarDate);
ids.date.addEventListener("change", updateLunarDate);
document.getElementById("eventResetButton").addEventListener("click", () => {
  setValues(initialState.values);
  setStatus("");
});
document.getElementById("eventCancelButton").addEventListener("click", () => window.close());
const deleteButton = document.getElementById("eventDeleteButton");
if (deleteButton) {
  deleteButton.addEventListener("click", async () => {
    if (!await confirmDelete()) return;
    try {
      setStatus("Đang xóa...");
      await bridge.deleteCurrentEvent();
      window.close();
    } catch (error) {
      setStatus("Chưa xóa được sự kiện.", true);
    }
  });
}
ids.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setStatus("Đang lưu...");
    await bridge.saveValues(getValues());
    window.close();
  } catch (error) {
    setStatus("Chưa lưu được sự kiện. Vui lòng kiểm tra lại thông tin.", true);
  }
});
setValues(initialState.values);
requestAnimationFrame(() => ids.title.focus());`;
}
