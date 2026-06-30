function setupJournalCalendar() {
  const form = document.getElementById("journalForm");
  if (!form || !window.LichVietData) return;

  const today = getVietnamToday();
  journalCalendarYear = today.getFullYear();
  journalCalendarMonth = today.getMonth() + 1;
  journalCalendarSelectedDay = today.getDate();
  journalHoverPreviewEnabled = getStoredJournalHoverPreviewEnabled();

  setupCalendarNavigation({
    ...JOURNAL_CALENDAR_NAVIGATION,
    getState: () => ({
      year: journalCalendarYear,
      month: journalCalendarMonth,
      day: journalCalendarSelectedDay
    }),
    setDate: setJournalCalendarDate,
    render: renderJournalCalendar
  });

  setupJournalForm();
  setupJournalList();
  setupJournalHoverPreviewToggle();
  renderJournalCalendar();
  loadJournalCalendarEntries();
}

const JOURNAL_DUPLICATE_DATE_MESSAGE = "Ngày này đã có nội dung nhật ký.";
const JOURNAL_MAX_IMAGES = 3;
const JOURNAL_IMAGE_TARGET_BYTES = 100 * 1024;
const JOURNAL_IMAGE_MAX_SIDE = 1200;
const JOURNAL_IMAGE_MIN_SIDE = 180;

function setupJournalForm() {
  const form = document.getElementById("journalForm");
  const dateInput = document.getElementById("journalDate");
  const resetButton = document.getElementById("journalResetButton");
  const cancelButton = document.getElementById("journalCancelButton");
  const deleteButton = document.getElementById("journalDeleteButton");
  const closeButton = document.getElementById("journalDialogCloseButton");
  const dialog = document.getElementById("journalDialog");
  const imageInput = document.getElementById("journalImages");
  const addImageButton = document.getElementById("journalAddImageButton");

  setJournalDateInputValue(toDateInputValue(getVietnamToday()));
  updateJournalDateHint();
  updateJournalImageSummary(null);

  dateInput.addEventListener("input", () => {
    autoFormatEventDateInput(dateInput);
    updateJournalDateHint();
    validateJournalDateAvailability();
  });
  dateInput.addEventListener("change", () => {
    normalizeJournalDateInput();
    updateJournalDateHint();
    validateJournalDateAvailability();
  });
  dateInput.addEventListener("blur", () => {
    normalizeJournalDateInput();
    updateJournalDateHint();
    validateJournalDateAvailability();
  });
  resetButton.addEventListener("click", () => resetJournalForm(getSelectedJournalCalendarDate()));
  cancelButton.addEventListener("click", closeJournalDialog);
  closeButton.addEventListener("click", closeJournalDialog);
  deleteButton.addEventListener("click", deleteEditingJournal);
  dialog.addEventListener("close", () => document.body.classList.remove("event-dialog-open"));
  imageInput.addEventListener("change", () => handleJournalImageInputChange(imageInput));
  if (addImageButton) addImageButton.addEventListener("click", () => imageInput.click());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveJournalFromForm();
  });
}

function setupJournalList() {
  const toggleButton = document.getElementById("journalListToggleButton");
  const form = document.getElementById("journalFilterForm");
  const monthFilter = document.getElementById("journalMonthFilter");
  const contentFilter = document.getElementById("journalContentFilter");
  if (!toggleButton || !form || !monthFilter || !contentFilter) return;

  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.addEventListener("click", openJournalListPanel);
  form.addEventListener("submit", (event) => event.preventDefault());
  monthFilter.addEventListener("change", renderJournalList);
  contentFilter.addEventListener("input", renderJournalList);
}

async function openJournalListPanel() {
  const panel = document.getElementById("journalListPanel");
  const button = document.getElementById("journalListToggleButton");
  if (!panel) return;

  panel.hidden = false;
  if (button) button.setAttribute("aria-expanded", "true");
  await renderJournalList({ force: true });
  requestAnimationFrame(() => {
    panel.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    const firstItem = panel.querySelector("[data-journal-date]");
    const firstFilter = document.getElementById("journalMonthFilter");
    (firstItem || firstFilter || panel).focus({ preventScroll: true });
  });
}

function setupJournalHoverPreviewToggle() {
  const toggle = document.getElementById("journalHoverPreviewToggle");
  if (!toggle) return;
  toggle.checked = journalHoverPreviewEnabled;
  toggle.addEventListener("change", () => {
    journalHoverPreviewEnabled = toggle.checked;
    try {
      localStorage.setItem("homnay.journalHoverPreviewEnabled", String(journalHoverPreviewEnabled));
    } catch (error) {
      // The toggle still works for this session without persistent storage.
    }
    hideJournalHoverPreview();
  });
}

function getStoredJournalHoverPreviewEnabled() {
  try {
    const stored = localStorage.getItem("homnay.journalHoverPreviewEnabled");
    return stored === null ? true : stored === "true";
  } catch (error) {
    return true;
  }
}

function setJournalCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR) return;
  if (!Number.isInteger(month) || month < 1 || month > 12) return;
  journalCalendarYear = year;
  journalCalendarMonth = month;
  journalCalendarSelectedDay = Math.min(Math.max(Number(day) || 1, 1), getDaysInMonth(year, month));
  renderJournalCalendar();
  loadJournalCalendarEntries();
}

async function loadJournalCalendarEntries() {
  const key = `${journalCalendarYear}-${String(journalCalendarMonth).padStart(2, "0")}`;
  journalCalendarKey = key;

  try {
    const journals = await window.LichVietData.getAllJournals();
    if (journalCalendarKey !== key) return;
    journalCalendarEntries = buildJournalCalendarEntries(journals, journalCalendarYear, journalCalendarMonth);
    renderJournalCalendar();
    renderJournalList();
  } catch (error) {
    journalCalendarEntries = {};
  }
}

function buildJournalCalendarEntries(journals, year, month) {
  const entries = {};
  journals.forEach((journal) => {
    const date = parseDateValue(journal.date);
    if (!date || date.year !== year || date.month !== month) return;
    entries[date.day] = journal;
  });
  return entries;
}

function renderJournalCalendar() {
  syncCalendarNavigation(JOURNAL_CALENDAR_NAVIGATION, journalCalendarYear, journalCalendarMonth);
  document.getElementById("journalCalendarHeadingText").textContent = `Tháng ${journalCalendarMonth} năm ${journalCalendarYear}`;
  renderCalendarGrid({
    grid: document.getElementById("journalCalendarGrid"),
    year: journalCalendarYear,
    month: journalCalendarMonth,
    selectedDay: journalCalendarSelectedDay,
    ariaLabel: `Lịch nhật ký/ghi chú tháng ${journalCalendarMonth} năm ${journalCalendarYear}`,
    journalsByDay: journalCalendarEntries,
    showJournalContent: true,
    showAuspiciousDot: false,
    onDayClick: handleJournalCalendarDayClick,
    onDayHover: showJournalHoverPreview,
    onDayHoverEnd: hideJournalHoverPreview
  });
}

async function handleJournalCalendarDayClick(day) {
  journalCalendarSelectedDay = day;
  renderJournalCalendar();
  const date = getSelectedJournalCalendarDate();
  const journal = journalCalendarEntries[day] || await window.LichVietData.getJournalByDate(date);
  if (journal) {
    await loadJournalIntoForm(journal);
  } else {
    resetJournalForm(date);
    setJournalFormStatus("Ngày này chưa có nhật ký/ghi chú. Nhập nội dung để tạo mới.");
    openJournalDialog();
  }
}

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
  document.getElementById("journalCancelButton").hidden = false;
  document.getElementById("journalDeleteButton").hidden = !isEdit;
  document.querySelector("#journalForm .event-submit").textContent = isEdit ? "Lưu thay đổi" : "Lưu nhật ký";
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

async function compressJournalImageFile(file) {
  const bitmap = await createJournalImageBitmap(file);
  try {
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    const largestSide = Math.max(originalWidth, originalHeight);
    let maxSide = Math.min(JOURNAL_IMAGE_MAX_SIDE, largestSide);
    let bestBlob = null;
    let bestWidth = originalWidth;
    let bestHeight = originalHeight;

    while (maxSide >= JOURNAL_IMAGE_MIN_SIDE) {
      const scale = Math.min(1, maxSide / largestSide);
      const width = Math.max(1, Math.round(originalWidth * scale));
      const height = Math.max(1, Math.round(originalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await encodeJournalCanvasUnderTarget(canvas);
      bestBlob = blob;
      bestWidth = width;
      bestHeight = height;
      if (blob.size <= JOURNAL_IMAGE_TARGET_BYTES) break;
      maxSide = Math.floor(maxSide * 0.82);
    }

    if (!bestBlob) throw new Error("image compression failed");
    return {
      blob: bestBlob,
      mimeType: bestBlob.type || "image/jpeg",
      width: bestWidth,
      height: bestHeight,
      size: bestBlob.size
    };
  } finally {
    if (typeof bitmap.close === "function") bitmap.close();
  }
}

async function createJournalImageBitmap(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (error) {
      return createImageBitmap(file);
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function encodeJournalCanvasUnderTarget(canvas) {
  const mimeTypes = ["image/webp", "image/jpeg"];
  let best = null;

  for (const mimeType of mimeTypes) {
    let low = 0.24;
    let high = 0.86;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const quality = (low + high) / 2;
      const blob = await journalCanvasToBlob(canvas, mimeType, quality);
      if (!blob) break;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= JOURNAL_IMAGE_TARGET_BYTES) {
        best = blob;
        low = quality;
      } else {
        high = quality;
      }
    }
  }

  return best;
}

function journalCanvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

function openJournalImageViewer(url, label) {
  if (!url) return;
  const existingDialog = document.getElementById("journalImageViewerDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "journalImageViewerDialog";
  dialog.className = "journal-image-viewer-dialog";
  dialog.innerHTML = `
    <div class="journal-image-viewer">
      <div class="journal-image-viewer-toolbar">
        <strong>${escapeHtml(label || "Ảnh nhật ký")}</strong>
        <div class="journal-image-viewer-actions">
          <button class="journal-image-viewer-control" type="button" data-zoom="out" aria-label="Thu nhỏ">-</button>
          <button class="journal-image-viewer-control" type="button" data-zoom="reset" aria-label="Vừa màn hình">100%</button>
          <button class="journal-image-viewer-control" type="button" data-zoom="in" aria-label="Phóng to">+</button>
          <button class="journal-image-viewer-close" type="button" aria-label="Đóng">×</button>
        </div>
      </div>
      <div class="journal-image-viewer-stage">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(label || "Ảnh nhật ký")}">
      </div>
    </div>
  `;

  document.body.append(dialog);
  document.body.classList.add("event-dialog-open");
  const image = dialog.querySelector("img");
  let zoom = 1;
  const applyZoom = () => {
    image.style.transform = `scale(${zoom})`;
    image.style.cursor = zoom > 1 ? "grab" : "zoom-in";
  };
  dialog.addEventListener("close", () => {
    document.body.classList.remove("event-dialog-open");
    dialog.remove();
  });
  dialog.querySelector(".journal-image-viewer-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelectorAll("[data-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.zoom;
      if (action === "in") zoom = Math.min(4, zoom + 0.25);
      if (action === "out") zoom = Math.max(0.5, zoom - 0.25);
      if (action === "reset") zoom = 1;
      applyZoom();
    });
  });
  image.addEventListener("click", () => {
    zoom = zoom === 1 ? 2 : 1;
    applyZoom();
  });
  applyZoom();
  dialog.showModal();
  dialog.querySelector(".journal-image-viewer-close").focus();
}

function openJournalDialog() {
  const dialog = document.getElementById("journalDialog");
  if (!dialog) return;
  document.body.classList.add("event-dialog-open");
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => {
    const textInput = document.getElementById("journalText");
    if (textInput) textInput.focus({ preventScroll: true });
  });
}

function closeJournalDialog() {
  const dialog = document.getElementById("journalDialog");
  if (dialog && dialog.open) dialog.close();
  document.body.classList.remove("event-dialog-open");
}

function getSelectedJournalCalendarDate() {
  if (!journalCalendarYear || !journalCalendarMonth || !journalCalendarSelectedDay) return null;
  return `${journalCalendarYear}-${String(journalCalendarMonth).padStart(2, "0")}-${String(journalCalendarSelectedDay).padStart(2, "0")}`;
}

async function setJournalCalendarDateFromDateValue(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date) return;
  journalCalendarYear = date.year;
  journalCalendarMonth = date.month;
  journalCalendarSelectedDay = date.day;
  renderJournalCalendar();
  await loadJournalCalendarEntries();
}

function setJournalDateInputValue(dateValue) {
  const input = document.getElementById("journalDate");
  if (input) input.value = formatEventDateInputValue(dateValue);
}

function getJournalDateInputValue() {
  const input = document.getElementById("journalDate");
  return input ? parseEventDateInputValue(input.value) : "";
}

function normalizeJournalDateInput() {
  const input = document.getElementById("journalDate");
  if (!input) return;
  const dateValue = parseEventDateInputValue(input.value);
  if (dateValue) input.value = formatEventDateInputValue(dateValue);
}

function updateJournalDateHint() {
  const hint = document.getElementById("journalDateHint");
  const leapBadge = document.getElementById("journalLunarLeapBadge");
  if (!hint) return;
  const lunarDate = getEventLunarDateValue(getJournalDateInputValue());
  hint.value = lunarDate ? lunarDate.value : "";
  if (leapBadge) leapBadge.hidden = !lunarDate || !lunarDate.leap;
}

async function renderJournalList() {
  const list = document.getElementById("journalList");
  const emptyState = document.getElementById("journalFilterEmptyState");
  const panel = document.getElementById("journalListPanel");
  if (!list || !emptyState || !panel || panel.hidden) return;

  const monthFilter = document.getElementById("journalMonthFilter").value;
  const contentFilter = normalizeJournalFilterText(document.getElementById("journalContentFilter").value);
  const journals = await window.LichVietData.getAllJournals();
  const filtered = journals
    .filter((journal) => {
      const journalMonth = String(journal.date || "").slice(5, 7);
      const matchesMonth = monthFilter === "" || journalMonth === monthFilter;
      const matchesContent = contentFilter === "" || normalizeJournalFilterText(journal.text).includes(contentFilter);
      return matchesMonth && matchesContent;
    })
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));

  list.innerHTML = filtered.map((journal) => `
    <button class="event-list-item journal-list-item" type="button" data-journal-date="${escapeHtml(journal.date)}">
      <strong>${escapeHtml(formatEventDate(journal.date))}${journal.imageIds && journal.imageIds.length ? ' <span class="journal-list-image-icon" aria-hidden="true">▣</span>' : ""}</strong>
      <span>${escapeHtml(formatLunarDateShort(journal.date))}</span>
      <span class="journal-list-text">${escapeHtml(journal.text || "")}</span>
    </button>
  `).join("");

  [...list.querySelectorAll("[data-journal-date]")].forEach((button) => {
    button.addEventListener("click", async () => {
      const journal = await window.LichVietData.getJournalByDate(button.dataset.journalDate);
      if (journal) await loadJournalIntoForm(journal);
    });
  });

  emptyState.hidden = filtered.length > 0;
}

function normalizeJournalFilterText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function showJournalHoverPreview(day, journal, anchor) {
  if (!journal || !journalHoverPreviewEnabled) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const preview = document.getElementById("journalHoverPreview");
  if (!preview) return;
  preview.innerHTML = `
    <strong>${escapeHtml(formatEventDate(journal.date))}</strong>
    <p>${escapeHtml(journal.text || "")}</p>
    ${journal.imageIds && journal.imageIds.length ? `<span>▣ ${journal.imageIds.length} hình ảnh</span>` : ""}
  `;
  preview.hidden = false;

  const anchorRect = anchor.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const left = Math.min(
    Math.max(12, anchorRect.left + anchorRect.width / 2 - previewRect.width / 2),
    window.innerWidth - previewRect.width - 12
  );
  const top = anchorRect.top > previewRect.height + 18
    ? anchorRect.top - previewRect.height - 10
    : anchorRect.bottom + 10;
  preview.style.left = `${left}px`;
  preview.style.top = `${Math.max(12, top)}px`;
}

function hideJournalHoverPreview() {
  const preview = document.getElementById("journalHoverPreview");
  if (!preview) return;
  preview.hidden = true;
}
