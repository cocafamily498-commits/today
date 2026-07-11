const EVENT_GROUPS_SETTING_KEY = "eventGroups";
const EVENT_GROUPS_LEGACY_GENERAL_MIGRATION_KEY = "eventGroupsLegacyGeneralV1";
const GENERAL_EVENT_GROUP = {
  id: "general",
  name: "Nhóm chung",
  iconId: "group-family",
  color: "#64748b",
  readonly: true
};
const EVENT_GROUP_ICON_IDS = [
  "group-family", "group-birthday", "group-memorial", "group-work", "group-meeting", "group-study",
  "group-book", "group-health", "group-medicine", "group-finance", "group-shopping", "group-food",
  "group-travel", "group-car", "group-home", "group-pet", "group-baby", "group-faith", "group-photo",
  "group-music", "group-phone", "group-school", "group-hotel", "group-fitness"
];

let eventGroups = [];
let eventGroupsInitializationPromise = null;

async function initializeEventGroups() {
  if (eventGroups.length) return eventGroups;
  if (eventGroupsInitializationPromise) return eventGroupsInitializationPromise;

  eventGroupsInitializationPromise = (async () => {
    const saved = await window.LichVietData.getSetting(EVENT_GROUPS_SETTING_KEY);
    let defaults = [];
    try {
      const response = await fetch("data/event-groups.json?v=2");
      if (!response.ok) throw new Error("Không tải được danh mục nhóm sự kiện.");
      defaults = await response.json();
    } catch (error) {
      const hasSavedGroups = saved && !Array.isArray(saved) && Array.isArray(saved.groups);
      if (!hasSavedGroups) throw error;
      console.warn("default event groups unavailable; using saved groups", error);
    }
    const savedGroups = saved && !Array.isArray(saved) && Array.isArray(saved.groups)
      ? saved.groups
      : Array.isArray(saved) && saved.length > 1
        ? saved
        : defaults;
    eventGroups = normalizeEventGroups(savedGroups, defaults);
    document.dispatchEvent(new CustomEvent("eventgroupschange"));
    migrateLegacyEventGroupIds().catch((error) => {
      console.error("legacy event group migration failed", error);
    });
    return eventGroups;
  })();

  try {
    return await eventGroupsInitializationPromise;
  } finally {
    eventGroupsInitializationPromise = null;
  }
}

async function reloadEventGroups() {
  eventGroups = [];
  eventGroupsInitializationPromise = null;
  await initializeEventGroups();
  document.dispatchEvent(new CustomEvent("eventgroupschange"));
}

function normalizeEventGroups(groups, defaults = []) {
  const readonlyGeneral = defaults.find((group) => group.id === "general") || GENERAL_EVENT_GROUP;
  const normalized = groups
    .filter((group) => group && group.id && group.id !== "general")
    .map((group) => ({
      id: String(group.id),
      name: String(group.name || "Nhóm chưa đặt tên").trim(),
      iconId: EVENT_GROUP_ICON_IDS.includes(group.iconId) ? group.iconId : "group-family",
      color: /^#[0-9a-f]{6}$/i.test(group.color || "") ? group.color : "#64748b",
      readonly: false
    }));
  return [{ ...readonlyGeneral, readonly: true }, ...normalized];
}

async function saveEventGroups() {
  eventGroups = [
    { ...GENERAL_EVENT_GROUP },
    ...eventGroups.filter((group) => group.id !== "general")
  ];
  await window.LichVietData.setSetting(EVENT_GROUPS_SETTING_KEY, {
    version: 2,
    groups: eventGroups
  });
  document.dispatchEvent(new CustomEvent("eventgroupschange"));
  if (typeof renderEventCalendar === "function") renderEventCalendar();
  if (typeof renderMonthlyCalendar === "function") renderMonthlyCalendar();
}

function getEventGroups() {
  return eventGroups.slice();
}

function getEventGroup(groupId) {
  return eventGroups.find((group) => group.id === groupId) || eventGroups[0] || null;
}

function getDefaultEventGroupId(eventType = "other") {
  return "general";
}

async function migrateLegacyEventGroupIds() {
  const events = await window.LichVietData.getAllEvents();
  const migrationCompleted = await window.LichVietData.getSetting(EVENT_GROUPS_LEGACY_GENERAL_MIGRATION_KEY);
  const legacyEvents = events.filter((event) => !event.eventTypeId || (!migrationCompleted && (
    (event.eventType === "birthday" && event.eventTypeId === "birthday")
    || (event.eventType === "deathAnniversary" && event.eventTypeId === "memorial")
  )));
  await Promise.all(legacyEvents.map((event) => window.LichVietData.updateEvent(event.id, {
    eventTypeId: "general"
  })));
  if (!migrationCompleted) {
    await window.LichVietData.setSetting(EVENT_GROUPS_LEGACY_GENERAL_MIGRATION_KEY, true);
  }
}

function renderEventGroupIcon(group, className = "event-group-icon") {
  const safeGroup = group || getEventGroup("general");
  if (!safeGroup) return "";
  return `<svg class="${className}" viewBox="0 0 24 24" style="color:${safeGroup.color}" aria-hidden="true"><use href="icons/event-group-icons-sprite.svg#${safeGroup.iconId}"></use></svg>`;
}

function updateEventGroupPicker(groupId) {
  const input = document.getElementById("eventTypeId");
  const button = document.getElementById("eventGroupPickerButton");
  if (!input || !button) return;
  const group = getEventGroup(groupId);
  input.value = group ? group.id : "general";
  const selected = getEventGroup(input.value);
  if (!selected) {
    button.textContent = "Nhóm chung";
    return;
  }
  button.innerHTML = `${renderEventGroupIcon(selected)}<span>${escapeHtml(selected.name)}</span><span class="event-group-picker-arrow">⌄</span>`;
}

function renderEventGroupPickerList() {
  const list = document.getElementById("eventGroupPickerList");
  if (!list || !eventGroups.length) return;
  const selectedId = document.getElementById("eventTypeId")?.value || "general";
  list.innerHTML = eventGroups.map((group) => `
    <button type="button" role="option" aria-selected="${group.id === selectedId}" data-event-group-id="${escapeHtml(group.id)}">
      ${renderEventGroupIcon(group)}<span>${escapeHtml(group.name)}</span>
    </button>
  `).join("");
}

function setupEventGroupPicker() {
  const input = document.getElementById("eventTypeId");
  const button = document.getElementById("eventGroupPickerButton");
  const list = document.getElementById("eventGroupPickerList");
  const manageButton = document.getElementById("eventGroupManageButton");
  if (!input || !button || !list || !manageButton) return;

  renderEventGroupPickerList();
  updateEventGroupPicker(input.value || "general");
  button.addEventListener("click", () => {
    list.hidden = !list.hidden;
    button.setAttribute("aria-expanded", String(!list.hidden));
  });
  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-event-group-id]");
    if (!option) return;
    updateEventGroupPicker(option.dataset.eventGroupId);
    renderEventGroupPickerList();
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
  manageButton.addEventListener("click", async () => {
    try {
      await initializeEventGroups();
    } catch (error) {
      console.error("event groups initialization failed", error);
    }
    openEventGroupManagerDialog();
  });
  document.addEventListener("eventgroupschange", () => {
    renderEventGroupPickerList();
    updateEventGroupPicker(input.value);
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".event-group-picker")) return;
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
}

function openEventGroupManagerDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "event-group-dialog";
  dialog.innerHTML = `
    <div class="event-group-dialog-content">
      <header><h2>Nhóm sự kiện</h2><button type="button" data-close aria-label="Đóng">×</button></header>
      <div class="event-group-manager-list">
        ${eventGroups.map((group) => `
          <button type="button" data-edit-group="${escapeHtml(group.id)}">
            ${renderEventGroupIcon(group)}<span>${escapeHtml(group.name)}</span>${group.readonly ? "<small>Mặc định</small>" : ""}
          </button>
        `).join("")}
      </div>
      <div class="event-group-dialog-actions">
        <button class="event-secondary-button" type="button" data-close>Đóng</button>
        <button class="event-submit" type="button" data-add-group>Thêm nhóm</button>
      </div>
    </div>`;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-close]")) dialog.close();
    const groupButton = event.target.closest("[data-edit-group]");
    if (groupButton) {
      const groupId = groupButton.dataset.editGroup;
      dialog.close();
      openEventGroupEditorDialog(groupId);
    }
    if (event.target.closest("[data-add-group]")) {
      dialog.close();
      openEventGroupEditorDialog(null);
    }
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

function openEventGroupEditorDialog(groupId) {
  const existing = groupId ? getEventGroup(groupId) : null;
  const readonly = existing && existing.readonly;
  const dialog = document.createElement("dialog");
  dialog.className = "event-group-dialog";
  dialog.innerHTML = `
    <form class="event-group-dialog-content" data-event-group-form>
      <header><h2>${existing ? "Chi tiết nhóm sự kiện" : "Thêm nhóm sự kiện"}</h2><button type="button" data-close aria-label="Đóng">×</button></header>
      ${readonly ? "<p class=\"event-group-readonly-note\">Nhóm chung là nhóm hệ thống, không thể sửa hoặc xóa.</p>" : ""}
      <label class="event-group-name-field">Tên nhóm<input name="name" maxlength="60" required value="${escapeHtml(existing ? existing.name : "")}" ${readonly ? "disabled" : ""}></label>
      <label class="event-group-color-field">Màu icon<input name="color" type="color" value="${existing ? existing.color : "#2563eb"}" ${readonly ? "disabled" : ""}></label>
      <fieldset ${readonly ? "disabled" : ""}><legend>Chọn icon</legend><div class="event-group-icon-grid">
        ${EVENT_GROUP_ICON_IDS.map((iconId) => `<label><input type="radio" name="iconId" value="${iconId}" ${(existing ? existing.iconId : EVENT_GROUP_ICON_IDS[0]) === iconId ? "checked" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><use href="icons/event-group-icons-sprite.svg#${iconId}"></use></svg></label>`).join("")}
      </div></fieldset>
      <div class="event-group-dialog-actions">
        ${existing && !readonly ? "<button class=\"event-danger-button\" type=\"button\" data-delete-group>Xóa</button>" : ""}
        <button class="event-secondary-button" type="button" data-close>${readonly ? "Đóng" : "Hủy"}</button>
        ${readonly ? "" : "<button class=\"event-submit\" type=\"submit\">Lưu</button>"}
      </div>
    </form>`;
  dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.querySelector("[data-delete-group]")?.addEventListener("click", async () => {
    if (!window.confirm("Xóa nhóm này? Các sự kiện thuộc nhóm sẽ chuyển về Nhóm chung.")) return;
    await reassignDeletedEventGroup(existing.id);
    eventGroups = eventGroups.filter((group) => group.id !== existing.id);
    await saveEventGroups();
    updateEventGroupPicker("general");
    dialog.close();
  });
  dialog.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const group = {
      id: existing ? existing.id : `custom-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      name: String(data.get("name") || "").trim(),
      iconId: data.get("iconId"),
      color: data.get("color"),
      readonly: false
    };
    if (!group.name) return;
    if (existing) eventGroups = eventGroups.map((item) => item.id === existing.id ? group : item);
    else eventGroups.push(group);
    await saveEventGroups();
    updateEventGroupPicker(group.id);
    dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

async function reassignDeletedEventGroup(groupId) {
  const events = await window.LichVietData.getAllEvents();
  await Promise.all(events.filter((event) => event.eventTypeId === groupId)
    .map((event) => window.LichVietData.updateEvent(event.id, { eventTypeId: "general" })));
}
