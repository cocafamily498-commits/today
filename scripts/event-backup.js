function openBackupExplanationDialog() {
  const existingDialog = document.getElementById("eventBackupDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "eventBackupDialog";
  dialog.className = "event-backup-dialog";
  dialog.innerHTML = `
    <div class="event-backup-content">
      <h2>Sao lưu dữ liệu</h2>
      <p>Ứng dụng này không thu thập dữ liệu cá nhân của bạn. Mọi dữ liệu bạn tạo, như sự kiện, sinh nhật, ngày giỗ, ghi chú và thiết lập, đều được lưu cục bộ trên thiết bị của bạn, trong vùng lưu trữ của trình duyệt đang sử dụng.</p>
      <p>Khi sao lưu, ứng dụng sẽ tạo một file dữ liệu để bạn tải về. File này thường được lưu trong thư mục Tải xuống / Downloads của trình duyệt, trừ khi bạn chọn vị trí lưu khác.</p>
      <p>Bạn có thể giữ file này để khôi phục dữ liệu khi đổi máy, đổi trình duyệt hoặc sau khi xóa dữ liệu trình duyệt. Bạn cũng có thể chia sẻ file sao lưu cho người thân, bạn bè hoặc dùng trên thiết bị khác.</p>
      <p>Để nhập lại dữ liệu, hãy bấm Khôi phục dữ liệu và chọn file sao lưu đã lưu trước đó.</p>
      <div class="event-backup-dialog-actions">
        <button id="eventBackupCancelButton" class="event-secondary-button" type="button">Hủy</button>
        <button id="eventBackupDownloadButton" class="event-submit" type="button">Tạo file sao lưu</button>
      </div>
    </div>
  `;

  document.body.append(dialog);
  document.body.classList.add("event-dialog-open");
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (!document.querySelector("dialog.event-backup-dialog[open]")) {
      document.body.classList.remove("event-dialog-open");
    }
  });
  dialog.querySelector("#eventBackupCancelButton").addEventListener("click", () => dialog.close());
  dialog.querySelector("#eventBackupDownloadButton").addEventListener("click", async () => {
    dialog.close();
    await backupEventData();
  });
  dialog.showModal();
  dialog.querySelector("#eventBackupDownloadButton").focus();
}

function openEventBackupProgressDialog(title, message) {
  const existingDialog = document.getElementById("eventBackupProgressDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "eventBackupProgressDialog";
  dialog.className = "event-backup-dialog";
  dialog.innerHTML = `
    <div class="event-backup-content" style="min-width:min(420px, 80vw)">
      <h2 data-progress-title></h2>
      <p data-progress-message aria-live="polite"></p>
      <progress data-progress-bar max="100" value="0" style="width:100%"></progress>
      <p data-progress-percent style="margin-bottom:0;text-align:center">0%</p>
    </div>
  `;

  const titleElement = dialog.querySelector("[data-progress-title]");
  const messageElement = dialog.querySelector("[data-progress-message]");
  const progressBar = dialog.querySelector("[data-progress-bar]");
  const percentElement = dialog.querySelector("[data-progress-percent]");
  titleElement.textContent = title;
  messageElement.textContent = message;

  document.body.append(dialog);
  document.body.classList.add("event-dialog-open");
  dialog.addEventListener("cancel", (event) => event.preventDefault());
  dialog.showModal();

  return {
    update(value, nextMessage) {
      const progress = Math.max(0, Math.min(100, value));
      progressBar.value = progress;
      percentElement.textContent = `${Math.round(progress)}%`;
      if (nextMessage) messageElement.textContent = nextMessage;
    },
    close() {
      if (dialog.open) dialog.close();
      dialog.remove();
      if (!document.querySelector("dialog.event-backup-dialog[open]")) {
        document.body.classList.remove("event-dialog-open");
      }
    },
  };
}

function waitForEventBackupProgressPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

const EVENT_BACKUP_ZIP_MAX_ENTRIES = 10000;
const EVENT_BACKUP_ZIP_MAX_SIZE = 512 * 1024 * 1024;
const eventBackupTextEncoder = new TextEncoder();
const eventBackupTextDecoder = new TextDecoder("utf-8", { fatal: true });

function eventBackupCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function eventBackupWriteUint16(target, offset, value) {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint16(offset, value, true);
}

function eventBackupWriteUint32(target, offset, value) {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint32(offset, value >>> 0, true);
}

function createEventBackupZip(files) {
  if (!Array.isArray(files) || !files.length || files.length > EVENT_BACKUP_ZIP_MAX_ENTRIES) {
    throw new Error("Số lượng file trong ZIP không hợp lệ.");
  }
  const estimatedSize = files.reduce((total, file) => total + (file.bytes ? file.bytes.byteLength : 0) + 128, 22);
  if (estimatedSize > EVENT_BACKUP_ZIP_MAX_SIZE) throw new Error("File ZIP vượt quá giới hạn cho phép.");
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const seenNames = new Set();

  files.forEach(({ name, bytes }) => {
    if (!name || seenNames.has(name) || name.includes("..") || name.startsWith("/") || name.includes("\\")) {
      throw new Error("Tên file trong ZIP không hợp lệ.");
    }
    seenNames.add(name);
    const nameBytes = eventBackupTextEncoder.encode(name);
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const crc = eventBackupCrc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    eventBackupWriteUint32(local, 0, 0x04034b50);
    eventBackupWriteUint16(local, 4, 20);
    eventBackupWriteUint16(local, 6, 0x0800);
    eventBackupWriteUint16(local, 8, 0);
    eventBackupWriteUint32(local, 14, crc);
    eventBackupWriteUint32(local, 18, data.length);
    eventBackupWriteUint32(local, 22, data.length);
    eventBackupWriteUint16(local, 26, nameBytes.length);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    eventBackupWriteUint32(central, 0, 0x02014b50);
    eventBackupWriteUint16(central, 4, 20);
    eventBackupWriteUint16(central, 6, 20);
    eventBackupWriteUint16(central, 8, 0x0800);
    eventBackupWriteUint16(central, 10, 0);
    eventBackupWriteUint32(central, 16, crc);
    eventBackupWriteUint32(central, 20, data.length);
    eventBackupWriteUint32(central, 24, data.length);
    eventBackupWriteUint16(central, 28, nameBytes.length);
    eventBackupWriteUint32(central, 42, localOffset);
    central.set(nameBytes, 46);
    centralParts.push(central);
    localOffset += local.length + data.length;
  });

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  eventBackupWriteUint32(end, 0, 0x06054b50);
  eventBackupWriteUint16(end, 8, files.length);
  eventBackupWriteUint16(end, 10, files.length);
  eventBackupWriteUint32(end, 12, centralSize);
  eventBackupWriteUint32(end, 16, localOffset);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function eventBackupDataUrlToFile(dataUrl, index) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ""));
  if (!match) throw new Error("Ảnh sao lưu không đúng định dạng.");
  const mimeType = match[1].toLowerCase();
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const extension = extensions[mimeType] || "bin";
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let offset = 0; offset < binary.length; offset += 1) bytes[offset] = binary.charCodeAt(offset);
  return { name: `images/${String(index + 1).padStart(6, "0")}.${extension}`, mimeType, bytes };
}

function eventBackupBytesToDataUrl(bytes, mimeType) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function readEventBackupZip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 22 || bytes.length > EVENT_BACKUP_ZIP_MAX_SIZE) throw new Error("Kích thước ZIP không hợp lệ.");
  const view = new DataView(arrayBuffer);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { endOffset = offset; break; }
  }
  if (endOffset < 0) throw new Error("Không tìm thấy kết thúc ZIP.");
  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDisk = view.getUint16(endOffset + 6, true);
  const diskEntryCount = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  const commentLength = view.getUint16(endOffset + 20, true);
  if (diskNumber !== 0 || centralDisk !== 0 || diskEntryCount !== entryCount
    || endOffset + 22 + commentLength !== bytes.length || !entryCount
    || entryCount > EVENT_BACKUP_ZIP_MAX_ENTRIES || centralOffset + centralSize !== endOffset) {
    throw new Error("Danh mục ZIP không hợp lệ.");
  }

  const files = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Entry ZIP bị hỏng.");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (method !== 0 || compressedSize !== size || (flags & ~0x0800)) throw new Error("ZIP dùng kiểu nén hoặc cờ không được hỗ trợ.");
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd > bytes.length) throw new Error("Tên entry ZIP bị hỏng.");
    const name = eventBackupTextDecoder.decode(bytes.subarray(offset + 46, nameEnd));
    if (!name || files.has(name) || name.includes("..") || name.startsWith("/") || name.includes("\\")) {
      throw new Error("Đường dẫn entry ZIP không an toàn.");
    }
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("Header ZIP bị hỏng.");
    if (view.getUint16(localOffset + 6, true) !== flags || view.getUint16(localOffset + 8, true) !== method) {
      throw new Error("Header ZIP không nhất quán.");
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    if (localNameEnd > bytes.length || eventBackupTextDecoder.decode(bytes.subarray(localNameStart, localNameEnd)) !== name) {
      throw new Error("Tên entry trong header ZIP không khớp.");
    }
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + size > bytes.length) throw new Error("Dữ liệu entry ZIP bị thiếu.");
    const data = bytes.slice(dataOffset, dataOffset + size);
    if (eventBackupCrc32(data) !== crc) throw new Error("CRC của entry ZIP không đúng.");
    files.set(name, data);
    offset = nameEnd + extraLength + commentLength;
  }
  return files;
}

function parseEventBackupJson(files, name) {
  const bytes = files.get(name);
  if (!bytes) throw new Error(`ZIP thiếu ${name}.`);
  return JSON.parse(eventBackupTextDecoder.decode(bytes));
}

async function backupEventData() {
  const progress = openEventBackupProgressDialog(
    "\u0110ang xu\u1ea5t d\u1eef li\u1ec7u",
    "\u0110ang chu\u1ea9n b\u1ecb d\u1eef li\u1ec7u sao l\u01b0u..."
  );

  try {
    await waitForEventBackupProgressPaint();
    progress.update(20, "\u0110ang \u0111\u1ecdc d\u1eef li\u1ec7u...");
    const backup = await window.LichVietData.exportBackup();
    progress.update(50, "\u0110ang t\u00e1ch c\u00e1c file \u1ea3nh...");
    const zipFiles = [];
    const images = [];
    (backup.images || []).forEach((image, index) => {
      if (!image.blob) {
        images.push({ ...image, blob: null });
        return;
      }
      const imageFile = eventBackupDataUrlToFile(image.blob, index);
      zipFiles.push({ name: imageFile.name, bytes: imageFile.bytes });
      images.push({ ...image, blob: null, archiveFile: imageFile.name, mimeType: imageFile.mimeType });
    });
    const portableBackup = { ...backup, images };
    const groupSetting = (backup.settings || []).find((setting) => setting && setting.key === "eventGroups");
    const groupValue = groupSetting
      ? groupSetting.value
      : { version: 2, groups: typeof getEventGroups === "function" ? getEventGroups() : [] };
    const groupDocument = Array.isArray(groupValue) ? { version: 1, groups: groupValue } : groupValue;
    if (!groupDocument || !Array.isArray(groupDocument.groups)) throw new Error("Danh mục nhóm sự kiện không hợp lệ.");
    const zipManifest = {
      format: "lichviet-zip-backup",
      version: 1,
      createdAt: new Date().toISOString(),
      backupFile: "backup.json",
      eventGroupsFile: "event-groups.json",
      imageCount: zipFiles.length
    };
    zipFiles.unshift(
      { name: "zip-manifest.json", bytes: eventBackupTextEncoder.encode(JSON.stringify(zipManifest, null, 2)) },
      { name: "backup.json", bytes: eventBackupTextEncoder.encode(JSON.stringify(portableBackup, null, 2)) },
      { name: "event-groups.json", bytes: eventBackupTextEncoder.encode(JSON.stringify(groupDocument, null, 2)) }
    );
    progress.update(75, "\u0110ang \u0111\u00f3ng g\u00f3i file ZIP...");
    const blob = createEventBackupZip(zipFiles);
    const link = document.createElement("a");
    const today = toDateInputValue(getVietnamToday());
    link.href = URL.createObjectURL(blob);
    link.download = `Sotaylichviet-${today}.ZIP`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    progress.update(100, "Ho\u00e0n t\u1ea5t. File sao l\u01b0u \u0111\u00e3 \u0111\u01b0\u1ee3c t\u1ea1o.");
    await new Promise((resolve) => setTimeout(resolve, 400));
    setEventFormStatus("Đã tạo file sao lưu dữ liệu.");
  } catch (error) {
    setEventFormStatus("Chưa sao lưu được dữ liệu.", true);
  } finally {
    progress.close();
  }
}

async function importEventBackupFile(file) {
  if (!await showConfirmDialog({
    title: "Khôi phục dữ liệu?",
    message: "Khôi phục dữ liệu sẽ thay thế dữ liệu hiện tại trên trình duyệt này.",
    confirmLabel: "Khôi phục",
    cancelLabel: "Hủy",
    danger: true
  })) return;

  const progress = openEventBackupProgressDialog(
    "\u0110ang nh\u1eadp d\u1eef li\u1ec7u",
    "\u0110ang \u0111\u1ecdc file sao l\u01b0u..."
  );

  try {
    await waitForEventBackupProgressPaint();
    progress.update(10, "\u0110ang \u0111\u1ecdc file ZIP sao l\u01b0u...");
    if (!file || !/\.zip$/i.test(file.name || "")) throw new Error("Chỉ chấp nhận file ZIP sao lưu.");
    const buffer = await file.arrayBuffer();
    progress.update(22, "\u0110ang ki\u1ec3m tra c\u1ea5u tr\u00fac v\u00e0 CRC file ZIP...");
    const files = readEventBackupZip(buffer);
    const unexpectedFiles = [...files.keys()].filter((name) => ![
      "zip-manifest.json", "backup.json", "event-groups.json"
    ].includes(name) && !name.startsWith("images/"));
    if (unexpectedFiles.length) throw new Error("ZIP chứa file không được phép.");
    const zipManifest = parseEventBackupJson(files, "zip-manifest.json");
    if (!zipManifest || zipManifest.format !== "lichviet-zip-backup" || Number(zipManifest.version) !== 1
      || zipManifest.backupFile !== "backup.json" || zipManifest.eventGroupsFile !== "event-groups.json") {
      throw new Error("Manifest ZIP sao lưu không hợp lệ.");
    }
    const backup = parseEventBackupJson(files, zipManifest.backupFile);
    const groupDocument = parseEventBackupJson(files, zipManifest.eventGroupsFile);
    if (!backup || !backup.manifest || backup.manifest.format !== "lichviet-backup"
      || Number(backup.manifest.version) !== 1 || !Array.isArray(backup.images)
      || !Array.isArray(backup.events) || !Array.isArray(backup.settings)) {
      throw new Error("Dữ liệu backup.json không hợp lệ.");
    }
    if (!groupDocument || !Array.isArray(groupDocument.groups)) throw new Error("Danh mục nhóm sự kiện không hợp lệ.");
    const referencedImages = new Set();
    backup.images = backup.images.map((image) => {
      if (!image || typeof image !== "object") throw new Error("Thông tin ảnh không hợp lệ.");
      if (!image.archiveFile) return { ...image, blob: null };
      if (!/^images\/[0-9]{6}\.(jpg|png|webp|gif|bin)$/.test(image.archiveFile)
        || referencedImages.has(image.archiveFile)) throw new Error("Đường dẫn ảnh trong backup không hợp lệ.");
      const imageBytes = files.get(image.archiveFile);
      if (!imageBytes) throw new Error(`ZIP thiếu ảnh ${image.archiveFile}.`);
      referencedImages.add(image.archiveFile);
      const mimeType = /^image\/(jpeg|png|webp|gif)$/.test(image.mimeType || "")
        ? image.mimeType
        : "application/octet-stream";
      const restoredImage = { ...image, blob: eventBackupBytesToDataUrl(imageBytes, mimeType) };
      delete restoredImage.archiveFile;
      delete restoredImage.mimeType;
      return restoredImage;
    });
    const archivedImageFiles = [...files.keys()].filter((name) => name.startsWith("images/"));
    if (referencedImages.size !== Number(zipManifest.imageCount) || archivedImageFiles.length !== referencedImages.size
      || archivedImageFiles.some((name) => !referencedImages.has(name))) {
      throw new Error("Số lượng ảnh trong ZIP không khớp manifest.");
    }
    const groupSettingIndex = backup.settings.findIndex((setting) => setting && setting.key === "eventGroups");
    const restoredGroupSetting = { key: "eventGroups", value: groupDocument, updatedAt: new Date().toISOString() };
    if (groupSettingIndex >= 0) backup.settings[groupSettingIndex] = restoredGroupSetting;
    else backup.settings.push(restoredGroupSetting);
    progress.update(35, "\u0110\u00e3 ki\u1ec3m tra xong. \u0110ang chu\u1ea9n b\u1ecb kh\u00f4i ph\u1ee5c...");
    progress.update(40, "\u0110ang kh\u00f4i ph\u1ee5c d\u1eef li\u1ec7u...");
    await window.LichVietData.importBackup(backup);
    if (typeof reloadEventGroups === "function") await reloadEventGroups();
    editingEventId = null;
    clearEventChoiceList();
    resetEventForm(toDateInputValue(getVietnamToday()));
    progress.update(65, "\u0110ang l\u00e0m m\u1edbi l\u1ecbch v\u00e0 nh\u1eadt k\u00fd...");
    if (Number.isInteger(eventCalendarYear) && Number.isInteger(eventCalendarMonth)) {
      await loadEventCalendarOccurrences();
    }
    await refreshJournalDataAfterRestore();
    progress.update(85, "\u0110ang \u0111\u1ed3ng b\u1ed9 nh\u1eafc nh\u1edf...");
    await syncEventWebPushReminders();
    progress.update(100, "Ho\u00e0n t\u1ea5t. D\u1eef li\u1ec7u \u0111\u00e3 \u0111\u01b0\u1ee3c kh\u00f4i ph\u1ee5c.");
    await new Promise((resolve) => setTimeout(resolve, 400));
    setEventFormStatus("Đã khôi phục dữ liệu sao lưu.");
  } catch (error) {
    setEventFormStatus("Chưa khôi phục được dữ liệu. Hãy kiểm tra file sao lưu.", true);
  } finally {
    progress.close();
  }
}

async function refreshJournalDataAfterRestore() {
  if (Number.isInteger(journalCalendarYear) && typeof resetJournalForm === "function") {
    resetJournalForm(toDateInputValue(getVietnamToday()));
  }
  if (Number.isInteger(journalCalendarYear) && typeof loadJournalCalendarEntries === "function") {
    await loadJournalCalendarEntries();
  }
}
