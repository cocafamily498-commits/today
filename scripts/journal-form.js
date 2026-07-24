async function saveJournalFromForm() {
  const date = getJournalDateInputValue();
  const text = String(document.getElementById("journalText").value || "").trim();
  const imageItems = getJournalImageItemsForSave();
  if (!date) {
    setJournalFormStatus("Vui lòng nhập ngày dương lịch hợp lệ.", true);
    return;
  }
  if (!text) {
    setJournalFormStatus("Vui lòng nhập nội dung nhật ký/ghi chú.", true);
    return;
  }
  if (imageItems.length > JOURNAL_MAX_IMAGES) {
    setJournalFormStatus(`Chỉ được chọn tối đa ${JOURNAL_MAX_IMAGES} hình ảnh cho mỗi ngày nhật ký.`, true);
    return;
  }

  setJournalFormStatus("Đang lưu...");
  try {
    const shouldUpdate = Boolean(editingJournalId);
    const existing = editingJournalId
      ? await window.LichVietData.getJournal(editingJournalId)
      : null;
    const existingImageIds = existing && Array.isArray(existing.imageIds) ? existing.imageIds : [];
    let imageIds = imageItems.filter((item) => item.kind === "stored" && item.id).map((item) => item.id);
    const newImageItems = imageItems.filter((item) => item.kind === "file" && item.file);
    if (newImageItems.length > 0) {
      const compressedImages = await Promise.all(newImageItems.map((item) => compressJournalImageFile(item.file)));
      const savedImages = await Promise.all(compressedImages.map((image) => window.LichVietData.saveJournalImage(image)));
      imageIds = imageIds.concat(savedImages.map((image) => image.id));
    }
    const removedImageIds = existingImageIds.filter((id) => !imageIds.includes(id));
    if (removedImageIds.length > 0) {
      await Promise.all(removedImageIds.map((id) => window.LichVietData.deleteImage(id)));
    }

    const eventTypeId = document.getElementById("journalTypeId")?.value || "general";
    const saved = editingJournalId
      ? await window.LichVietData.updateJournal(editingJournalId, { date, text, imageIds, eventTypeId })
      : await window.LichVietData.createJournal({ date, text, imageIds, eventTypeId });
    editingJournalId = null;
    editingJournalDate = null;
    setJournalFormStatus(shouldUpdate ? "Đã lưu thay đổi." : "Đã lưu nhật ký/ghi chú.");
    await setJournalCalendarDateFromDateValue(saved.date);
    setJournalFormSavedState();
  } catch (error) {
    setJournalFormStatus("Chưa lưu được nhật ký/ghi chú. Vui lòng kiểm tra lại thông tin.", true);
  }
}

async function validateJournalDateAvailability(options = {}) {
  const input = document.getElementById("journalDate");
  if (!input) return true;
  input.setCustomValidity("");
  input.removeAttribute("aria-invalid");
  return true;
}

async function deleteEditingJournal() {
  if (!editingJournalId) return;
  if (!await confirmJournalDelete()) return;

  const journal = await window.LichVietData.getJournal(editingJournalId);
  await window.LichVietData.deleteJournal(editingJournalId);
  if (journal && Array.isArray(journal.imageIds)) {
    await Promise.all(journal.imageIds.map((id) => window.LichVietData.deleteImage(id)));
  }
  resetJournalForm(getSelectedJournalCalendarDate());
  await loadJournalCalendarEntries();
  setJournalFormStatus("Đã xóa nhật ký/ghi chú.");
  closeJournalDialog();
}

function confirmJournalDelete() {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "event-confirm-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="event-confirm-content">
        <h2>Xóa nhật ký?</h2>
        <p>Nhật ký/ghi chú ngày này và hình ảnh đính kèm sẽ bị xóa. Bạn không thể hoàn tác thao tác này.</p>
        <div class="event-confirm-actions">
          <button class="event-secondary-button" value="cancel" type="submit">Hủy</button>
          <button class="event-danger-button" value="delete" type="submit">Xóa nhật ký</button>
        </div>
      </form>
    `;

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

async function loadJournalIntoForm(journal) {
  if (typeof initializeEventGroups === "function") {
    try {
      await initializeEventGroups();
    } catch (error) {
      console.error("journal groups initialization failed", error);
    }
  }
  editingJournalId = journal.id;
  editingJournalDate = journal.date;
  setJournalDateInputValue(journal.date);
  const dateInput = document.getElementById("journalDate");
  dateInput.setCustomValidity("");
  dateInput.removeAttribute("aria-invalid");
  updateJournalDateHint();
  document.getElementById("journalText").value = journal.text || "";
  if (typeof updateJournalGroupPicker === "function") updateJournalGroupPicker(journal.eventTypeId || "general");
  document.getElementById("journalImages").value = "";
  updateJournalImageSummary(journal);
  await renderStoredJournalImagePreviews(journal);
  setJournalFormMode("edit");
  setJournalFormStatus("Đang sửa nhật ký/ghi chú.");
  openJournalDialog();
}

function resetJournalForm(date = null, options = {}) {
  const form = document.getElementById("journalForm");
  const preservedGroupId = options.preserveGroup
    ? document.getElementById("journalTypeId")?.value || "general"
    : "general";
  form.reset();
  editingJournalId = null;
  editingJournalDate = null;
  if (typeof updateJournalGroupPicker === "function") updateJournalGroupPicker(preservedGroupId);
  setJournalDateInputValue(date || toDateInputValue(getVietnamToday()));
  const dateInput = document.getElementById("journalDate");
  dateInput.setCustomValidity("");
  dateInput.removeAttribute("aria-invalid");
  updateJournalDateHint();
  updateJournalImageSummary(null);
  clearJournalImagePreviews();
  setJournalFormMode("create");
  setJournalFormStatus("");
}

function setJournalFormMode(mode) {
  const isEdit = mode === "edit";
  const form = document.getElementById("journalForm");
  if (form) {
    form.dataset.mode = isEdit ? "edit" : "create";
    form.dataset.saved = "false";
  }
  setJournalFormControlsLocked(false);
  document.getElementById("journalDialogHeading").textContent = isEdit ? "Sửa nhật ký/ghi chú" : "Tạo nhật ký/ghi chú";
  const cancelButton = document.getElementById("journalCancelButton");
  if (cancelButton) cancelButton.hidden = true;
  document.getElementById("journalDeleteButton").hidden = !isEdit;
  const exportImageButton = document.getElementById("journalExportImageButton");
  if (exportImageButton) exportImageButton.hidden = !isEdit;
  document.getElementById("journalResetButton").textContent = "Mới";
  document.querySelector("#journalForm .event-submit").textContent = "Lưu";
}

function setJournalFormControlsLocked(locked) {
  const form = document.getElementById("journalForm");
  if (!form) return;
  form.querySelectorAll("input, select, textarea, button").forEach((control) => {
    const remainsActive = control.id === "journalResetButton" || control.matches(".event-submit");
    if (remainsActive) return;
    if (locked) {
      control.dataset.journalSavedWasDisabled = String(control.disabled);
      control.disabled = true;
      return;
    }
    if (!("journalSavedWasDisabled" in control.dataset)) return;
    control.disabled = control.dataset.journalSavedWasDisabled === "true";
    delete control.dataset.journalSavedWasDisabled;
  });
}

function setJournalFormSavedState() {
  const form = document.getElementById("journalForm");
  const resetButton = document.getElementById("journalResetButton");
  const submitButton = document.querySelector("#journalForm .event-submit");
  if (!form || !resetButton || !submitButton) return;
  form.dataset.saved = "true";
  document.getElementById("journalDialogHeading").textContent = "Tạo nhật ký/ghi chú";
  document.getElementById("journalDeleteButton").hidden = true;
  const exportImageButton = document.getElementById("journalExportImageButton");
  if (exportImageButton) exportImageButton.hidden = true;
  setJournalFormControlsLocked(true);
  submitButton.textContent = "Đóng";
  requestAnimationFrame(() => resetButton.focus({ preventScroll: true }));
}

function setJournalFormStatus(message, isError = false) {
  const status = document.getElementById("journalFormStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function updateJournalImageSummary(journal) {
  const summary = document.getElementById("journalImageSummary");
  if (!summary) return;
  const count = journal && Array.isArray(journal.imageIds) ? journal.imageIds.length : 0;
  summary.textContent = count > 0 ? `Đang có ${count} hình ảnh. Có thể thêm đến tối đa ${JOURNAL_MAX_IMAGES} ảnh.` : `Tối đa ${JOURNAL_MAX_IMAGES} hình ảnh, ảnh sẽ được nén dưới 100 KB khi lưu.`;
}

async function renderStoredJournalImagePreviews(journal) {
  clearJournalImagePreviews();
  const list = document.getElementById("journalImagePreviewList");
  if (!list || !journal || !Array.isArray(journal.imageIds) || journal.imageIds.length === 0) return;

  const images = await Promise.all(journal.imageIds.map(async (id, index) => {
    try {
      const image = await window.LichVietData.getImage(id);
      return image && image.blob ? {
        kind: "stored",
        id,
        url: URL.createObjectURL(image.blob),
        label: `Ảnh ${index + 1}`
      } : null;
    } catch (error) {
      return null;
    }
  }));
  journalImageItems = images.filter(Boolean);
  renderJournalImagePreviewItems();
}

function handleJournalImageInputChange(input) {
  const files = input && input.files ? [...input.files] : [];
  input.value = "";
  if (files.length === 0) return;
  const remainingSlots = JOURNAL_MAX_IMAGES - journalImageItems.length;
  if (remainingSlots <= 0) {
    setJournalFormStatus(`Chỉ được chọn tối đa ${JOURNAL_MAX_IMAGES} hình ảnh cho mỗi ngày nhật ký.`, true);
    return;
  }
  const acceptedFiles = files.slice(0, remainingSlots);
  journalImageItems = journalImageItems.concat(acceptedFiles.map((file) => ({
    kind: "file",
    file,
    url: URL.createObjectURL(file),
    label: file.name || "Ảnh mới"
  })));
  setJournalFormStatus(files.length > acceptedFiles.length ? `Đã thêm ${acceptedFiles.length} ảnh. Tối đa ${JOURNAL_MAX_IMAGES} hình ảnh cho mỗi ngày nhật ký.` : "");
  renderJournalImagePreviewItems();
}

function renderJournalImagePreviewItems() {
  const list = document.getElementById("journalImagePreviewList");
  if (!list) return;
  journalImagePreviewUrls = journalImageItems.map((item) => item.url);
  list.innerHTML = journalImageItems.map((item, index) => `
    <figure class="journal-image-preview-item">
      <button class="journal-image-preview-button" type="button" data-image-url="${escapeHtml(item.url)}" data-image-label="${escapeHtml(item.label)}" aria-label="Xem ${escapeHtml(item.label)}">
        <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}">
      </button>
      <span>${escapeHtml(item.label)}</span>
      <button class="journal-image-remove-button" type="button" data-image-index="${index}" aria-label="Xóa ${escapeHtml(item.label)}">×</button>
    </figure>
  `).join("");
  [...list.querySelectorAll(".journal-image-preview-button")].forEach((button) => {
    button.addEventListener("click", () => openJournalImageViewer(button.dataset.imageUrl, button.dataset.imageLabel));
  });
  [...list.querySelectorAll(".journal-image-remove-button")].forEach((button) => {
    button.addEventListener("click", () => removeJournalImageItem(Number(button.dataset.imageIndex)));
  });
  updateJournalImageSelectionSummary();
  updateJournalAddImageControl();
}

function removeJournalImageItem(index) {
  if (!Number.isInteger(index) || index < 0 || index >= journalImageItems.length) return;
  const [removed] = journalImageItems.splice(index, 1);
  if (removed && removed.url) URL.revokeObjectURL(removed.url);
  renderJournalImagePreviewItems();
}

function clearJournalImagePreviews() {
  journalImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  journalImagePreviewUrls = [];
  journalImageItems = [];
  const list = document.getElementById("journalImagePreviewList");
  if (list) list.replaceChildren();
  updateJournalAddImageControl();
}

function getJournalImageItemsForSave() {
  return journalImageItems.slice(0, JOURNAL_MAX_IMAGES);
}

function updateJournalImageSelectionSummary() {
  const summary = document.getElementById("journalImageSummary");
  if (!summary) return;
  const count = journalImageItems.length;
  if (count === 0) {
    summary.textContent = `Tối đa ${JOURNAL_MAX_IMAGES} hình ảnh, ảnh sẽ được nén dưới 100 KB khi lưu.`;
    return;
  }
  summary.textContent = `Đang có ${count}/${JOURNAL_MAX_IMAGES} hình ảnh. Ảnh mới sẽ được nén dưới 100 KB khi lưu.`;
}

function updateJournalAddImageControl() {
  const button = document.getElementById("journalAddImageButton");
  const input = document.getElementById("journalImages");
  const isFull = journalImageItems.length >= JOURNAL_MAX_IMAGES;
  if (button) {
    button.disabled = isFull;
    button.textContent = isFull ? "Đã đủ 3 ảnh" : "Thêm ảnh";
  }
  if (input) input.disabled = isFull;
}
