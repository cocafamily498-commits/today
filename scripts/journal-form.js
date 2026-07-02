async function saveJournalFromForm() {
  const date = getJournalDateInputValue();
  const text = String(document.getElementById("journalText").value || "").trim();
  const imageItems = getJournalImageItemsForSave();
  if (!date) {
    setJournalFormStatus("Vui lòng nhập ngày dương lịch hợp lệ.", true);
    return;
  }
  if (!await validateJournalDateAvailability({ showStatus: true })) {
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
    const existing = editingJournalDate
      ? await window.LichVietData.getJournalByDate(editingJournalDate)
      : await window.LichVietData.getJournalByDate(date);
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

    const saved = await window.LichVietData.upsertJournalByDate({ date, text, imageIds });
    if (editingJournalDate && editingJournalDate !== date) {
      await window.LichVietData.deleteJournalByDate(editingJournalDate);
    }
    editingJournalDate = saved.date;
    setJournalFormStatus("Đã lưu nhật ký/ghi chú.");
    setJournalFormMode("edit");
    await setJournalCalendarDateFromDateValue(saved.date);
    closeJournalDialog();
  } catch (error) {
    setJournalFormStatus("Chưa lưu được nhật ký/ghi chú. Vui lòng kiểm tra lại thông tin.", true);
  }
}

async function validateJournalDateAvailability(options = {}) {
  const { showStatus = false } = options;
  const input = document.getElementById("journalDate");
  if (!input || !window.LichVietData) return true;

  const date = getJournalDateInputValue();
  input.setCustomValidity("");
  input.removeAttribute("aria-invalid");
  if (!date) return true;

  try {
    const existing = await window.LichVietData.getJournalByDate(date);
    const isDuplicate = existing && existing.date !== editingJournalDate;
    if (!isDuplicate) {
      const status = document.getElementById("journalFormStatus");
      if (status && status.textContent === JOURNAL_DUPLICATE_DATE_MESSAGE) {
        setJournalFormStatus("");
      }
      return true;
    }

    input.setCustomValidity(JOURNAL_DUPLICATE_DATE_MESSAGE);
    input.setAttribute("aria-invalid", "true");
    if (showStatus || document.activeElement === input) {
      setJournalFormStatus(JOURNAL_DUPLICATE_DATE_MESSAGE, true);
    }
    if (showStatus && typeof input.reportValidity === "function") {
      input.reportValidity();
    }
    return false;
  } catch (error) {
    return true;
  }
}

async function deleteEditingJournal() {
  if (!editingJournalDate) return;
  if (!await confirmJournalDelete()) return;

  const journal = await window.LichVietData.getJournalByDate(editingJournalDate);
  await window.LichVietData.deleteJournalByDate(editingJournalDate);
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
  editingJournalDate = journal.date;
  setJournalDateInputValue(journal.date);
  const dateInput = document.getElementById("journalDate");
  dateInput.setCustomValidity("");
  dateInput.removeAttribute("aria-invalid");
  updateJournalDateHint();
  document.getElementById("journalText").value = journal.text || "";
  document.getElementById("journalImages").value = "";
  updateJournalImageSummary(journal);
  await renderStoredJournalImagePreviews(journal);
  setJournalFormMode("edit");
  setJournalFormStatus("Đang sửa nhật ký/ghi chú.");
  openJournalDialog();
}

function resetJournalForm(date = null) {
  const form = document.getElementById("journalForm");
  form.reset();
  editingJournalDate = null;
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
  document.getElementById("journalDialogHeading").textContent = isEdit ? "Sửa nhật ký/ghi chú" : "Tạo nhật ký/ghi chú";
  const cancelButton = document.getElementById("journalCancelButton");
  if (cancelButton) cancelButton.hidden = true;
  document.getElementById("journalDeleteButton").hidden = !isEdit;
  document.getElementById("journalResetButton").textContent = "Mới";
  document.querySelector("#journalForm .event-submit").textContent = "Lưu";
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
