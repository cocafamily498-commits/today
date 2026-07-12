const EVENT_GROUPS_SETTING_KEY = "eventGroups";
const EVENT_GROUPS_LEGACY_GENERAL_MIGRATION_KEY = "eventGroupsLegacyGeneralV1";
const EVENT_GROUPS_VERSION = 3;
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
const EVENT_GROUP_TEMPLATES = [
  { name: "Gia đình", iconId: "group-family", color: "#d97706" },
  { name: "Sinh nhật / tiệc", iconId: "group-birthday", color: "#e11d48" },
  { name: "Tưởng niệm / đám giỗ", iconId: "group-memorial", color: "#7c3aed" },
  { name: "Công việc", iconId: "group-work", color: "#2563eb" },
  { name: "Họp / lịch hẹn", iconId: "group-meeting", color: "#0891b2" },
  { name: "Học tập", iconId: "group-study", color: "#4f46e5" },
  { name: "Đọc sách / khóa học", iconId: "group-book", color: "#0284c7" },
  { name: "Sức khỏe", iconId: "group-health", color: "#dc2626" },
  { name: "Thuốc men", iconId: "group-medicine", color: "#db2777" },
  { name: "Tài chính", iconId: "group-finance", color: "#059669" },
  { name: "Mua sắm", iconId: "group-shopping", color: "#c026d3" },
  { name: "Ăn uống", iconId: "group-food", color: "#ea580c" },
  { name: "Du lịch", iconId: "group-travel", color: "#0d9488" },
  { name: "Di chuyển", iconId: "group-car", color: "#475569" },
  { name: "Nhà cửa", iconId: "group-home", color: "#b45309" },
  { name: "Thú cưng", iconId: "group-pet", color: "#9333ea" },
  { name: "Em bé", iconId: "group-baby", color: "#f97316" },
  { name: "Tâm linh", iconId: "group-faith", color: "#6366f1" },
  { name: "Chụp ảnh", iconId: "group-photo", color: "#334155" },
  { name: "Âm nhạc", iconId: "group-music", color: "#be123c" },
  { name: "Điện thoại", iconId: "group-phone", color: "#0369a1" },
  { name: "Trường học", iconId: "group-school", color: "#1d4ed8" },
  { name: "Lưu trú", iconId: "group-hotel", color: "#7e22ce" },
  { name: "Thể thao", iconId: "group-fitness", color: "#16a34a" }
];
const LEGACY_TEMPLATE_GROUP_IDS = new Set([
  "family", "birthday", "memorial", "work", "meeting", "study", "book", "health",
  "medicine", "finance", "shopping", "food", "travel", "car", "home", "pet", "baby",
  "faith", "photo", "music", "phone", "school", "hotel", "fitness"
]);

let eventGroups = [];
let eventGroupsInitializationPromise = null;

async function initializeEventGroups() {
  if (eventGroups.length) return eventGroups;
  if (eventGroupsInitializationPromise) return eventGroupsInitializationPromise;

  eventGroupsInitializationPromise = (async () => {
    const saved = await window.LichVietData.getSetting(EVENT_GROUPS_SETTING_KEY);
    let defaults = [];
    try {
      const response = await fetch("data/event-groups.json?v=3");
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
    if (saved && (Array.isArray(saved) || Number(saved.version || 0) < EVENT_GROUPS_VERSION)) {
      await migrateLegacyTemplateGroups();
    }
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
    version: EVENT_GROUPS_VERSION,
    groups: eventGroups
  });
  document.dispatchEvent(new CustomEvent("eventgroupschange"));
  if (typeof renderEventCalendar === "function") renderEventCalendar();
  if (typeof renderMonthlyCalendar === "function") renderMonthlyCalendar();
}

async function migrateLegacyTemplateGroups() {
  const removedIds = new Set(eventGroups
    .filter((group) => LEGACY_TEMPLATE_GROUP_IDS.has(group.id))
    .map((group) => group.id));
  eventGroups = eventGroups.filter((group) => !removedIds.has(group.id));

  if (removedIds.size) {
    const events = await window.LichVietData.getAllEvents();
    await Promise.all(events
      .filter((event) => removedIds.has(event.eventTypeId))
      .map((event) => window.LichVietData.updateEvent(event.id, { eventTypeId: "general" })));
  }

  await window.LichVietData.setSetting(EVENT_GROUPS_SETTING_KEY, {
    version: EVENT_GROUPS_VERSION,
    groups: eventGroups
  });
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
      <header><h2>Danh mục nhóm sự kiện</h2><button type="button" data-close aria-label="Đóng">×</button></header>
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
    if (event.target.closest("[data-close]")) dialog.close();
    const groupButton = event.target.closest("[data-edit-group]");
    if (groupButton) {
      const groupId = groupButton.dataset.editGroup;
      dialog.close();
      openEventGroupEditorDialog(groupId);
    }
    if (event.target.closest("[data-add-group]")) {
      dialog.close();
      openEventGroupTemplateDialog();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

function openEventGroupTemplateDialog(existingGroupId = null, returnDraft = null) {
  const dialog = document.createElement("dialog");
  let continueToEditor = false;
  dialog.className = "event-group-dialog event-group-template-dialog";
  dialog.innerHTML = `
    <div class="event-group-dialog-content">
      <header><h2>Chọn mẫu nhóm sự kiện</h2><button type="button" data-close aria-label="Đóng">×</button></header>
      <p class="event-group-template-hint">Chọn một mẫu để điền sẵn tên, icon và màu. Bạn có thể chỉnh lại trước khi lưu.</p>
      <div class="event-group-template-list">
        ${EVENT_GROUP_TEMPLATES.map((template, index) => `
          <button type="button" data-template-index="${index}">
            ${renderEventGroupIcon(template)}<span>${escapeHtml(template.name)}</span>
          </button>
        `).join("")}
      </div>
      <div class="event-group-dialog-actions"><button class="event-secondary-button" type="button" data-close>Đóng</button></div>
    </div>`;
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) dialog.close();
    const button = event.target.closest("[data-template-index]");
    if (!button) return;
    const template = EVENT_GROUP_TEMPLATES[Number(button.dataset.templateIndex)];
    continueToEditor = true;
    dialog.close();
    openEventGroupEditorDialog(existingGroupId, template);
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (!continueToEditor) {
      if (returnDraft) openEventGroupEditorDialog(existingGroupId, returnDraft);
      else openEventGroupManagerDialog();
    }
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

function openEventGroupEditorDialog(groupId, selectedTemplate = null) {
  const existing = groupId ? getEventGroup(groupId) : null;
  const readonly = existing && existing.readonly;
  const draft = selectedTemplate || existing || EVENT_GROUP_TEMPLATES[0];
  const dialog = document.createElement("dialog");
  let continueToAnotherDialog = false;
  dialog.className = "event-group-dialog";
  dialog.innerHTML = `
    <form class="event-group-dialog-content" data-event-group-form>
      <header><h2>${existing ? "Chi tiết nhóm sự kiện" : "Thêm nhóm sự kiện"}</h2><button type="button" data-close aria-label="Đóng">×</button></header>
      ${readonly ? "<p class=\"event-group-readonly-note\">Nhóm chung là nhóm hệ thống, không thể sửa hoặc xóa.</p>" : ""}
      ${!readonly ? "<button class=\"event-group-template-picker\" type=\"button\" data-choose-template>Chọn mẫu gợi ý khác</button>" : ""}
      <div class="event-group-fields-row">
        <label class="event-group-name-field">Tên nhóm<input name="name" maxlength="60" required value="${escapeHtml(draft.name)}" ${readonly ? "disabled" : ""}></label>
        <label class="event-group-color-field">Màu icon<input name="color" type="color" value="${draft.color}" ${readonly ? "disabled" : ""}></label>
      </div>
      ${readonly ? "" : `<input type="hidden" name="iconId" value="${draft.iconId}">`}
      ${readonly ? "" : `
        <section class="event-group-preview" aria-label="Xem trước nhóm sự kiện">
          <div class="event-group-preview-card" data-group-preview>
            ${renderEventGroupIcon(draft, "event-group-preview-icon")}
            <span data-group-preview-name>${escapeHtml(draft.name)}</span>
          </div>
        </section>`}
      <div class="event-group-dialog-actions">
        ${existing && !readonly ? "<button class=\"event-danger-button\" type=\"button\" data-delete-group>Xóa</button>" : ""}
        <button class="event-secondary-button" type="button" data-close>${readonly ? "Đóng" : "Hủy"}</button>
        ${readonly ? "" : "<button class=\"event-submit\" type=\"submit\">Lưu</button>"}
      </div>
    </form>`;
  dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.querySelector("[data-choose-template]")?.addEventListener("click", () => {
    const currentDraft = {
      name: dialog.querySelector("input[name='name']")?.value.trim() || draft.name,
      iconId: dialog.querySelector("input[name='iconId']")?.value || draft.iconId,
      color: dialog.querySelector("input[name='color']")?.value || draft.color
    };
    continueToAnotherDialog = true;
    dialog.close();
    openEventGroupTemplateDialog(existing ? existing.id : null, currentDraft);
  });
  const nameInput = dialog.querySelector("input[name='name']");
  const colorInput = dialog.querySelector("input[name='color']");
  const previewName = dialog.querySelector("[data-group-preview-name]");
  const previewIcon = dialog.querySelector(".event-group-preview-icon");
  const updatePreview = () => {
    if (previewName) previewName.textContent = nameInput.value.trim() || "Tên nhóm sự kiện";
    if (previewIcon) previewIcon.style.color = colorInput.value;
  };
  nameInput?.addEventListener("input", updatePreview);
  colorInput?.addEventListener("input", updatePreview);
  dialog.querySelector("[data-delete-group]")?.addEventListener("click", async () => {
    if (!await confirmEventGroupDelete(existing.name)) return;
    await reassignDeletedEventGroup(existing.id);
    eventGroups = eventGroups.filter((group) => group.id !== existing.id);
    await saveEventGroups();
    updateEventGroupPicker("general");
    continueToAnotherDialog = true;
    dialog.close();
    openEventGroupManagerDialog();
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
    continueToAnotherDialog = true;
    dialog.close();
    openEventGroupManagerDialog();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    dialog.close();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (!continueToAnotherDialog) openEventGroupManagerDialog();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

function confirmEventGroupDelete(groupName) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "event-confirm-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="event-confirm-content">
        <h2>Xóa nhóm sự kiện?</h2>
        <p>Nhóm “${escapeHtml(groupName)}” sẽ bị xóa. Các sự kiện thuộc nhóm này sẽ được chuyển về Nhóm chung. Bạn không thể hoàn tác thao tác này.</p>
        <div class="event-confirm-actions">
          <button class="event-secondary-button" value="cancel" type="submit">Hủy</button>
          <button class="event-danger-button" value="delete" type="submit">Xóa nhóm</button>
        </div>
      </form>`;

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

async function reassignDeletedEventGroup(groupId) {
  const events = await window.LichVietData.getAllEvents();
  await Promise.all(events.filter((event) => event.eventTypeId === groupId)
    .map((event) => window.LichVietData.updateEvent(event.id, { eventTypeId: "general" })));
}
