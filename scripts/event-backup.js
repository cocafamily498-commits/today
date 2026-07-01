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
    document.body.classList.remove("event-dialog-open");
    dialog.remove();
  });
  dialog.querySelector("#eventBackupCancelButton").addEventListener("click", () => dialog.close());
  dialog.querySelector("#eventBackupDownloadButton").addEventListener("click", async () => {
    await backupEventData();
    dialog.close();
  });
  dialog.showModal();
  dialog.querySelector("#eventBackupDownloadButton").focus();
}

async function backupEventData() {
  try {
    const backup = await window.LichVietData.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const today = toDateInputValue(getVietnamToday());
    link.href = URL.createObjectURL(blob);
    link.download = `Sotay-${today}.Lichviet`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    setEventFormStatus("Đã tạo file sao lưu dữ liệu.");
  } catch (error) {
    setEventFormStatus("Chưa sao lưu được dữ liệu.", true);
  }
}

async function restoreEventDataFromFile(file) {
  if (!window.confirm("Khôi phục dữ liệu sẽ thay thế dữ liệu hiện tại trên trình duyệt này. Tiếp tục?")) return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    await window.LichVietData.importBackup(backup);
    editingEventId = null;
    clearEventChoiceList();
    resetEventForm(toDateInputValue(getVietnamToday()));
    await loadEventCalendarOccurrences();
    await refreshJournalDataAfterRestore();
    await syncEventWebPushReminders();
    setEventFormStatus("Đã khôi phục dữ liệu sao lưu.");
  } catch (error) {
    setEventFormStatus("Chưa khôi phục được dữ liệu. Hãy kiểm tra file sao lưu.", true);
  }
}

async function refreshJournalDataAfterRestore() {
  if (typeof resetJournalForm === "function") {
    resetJournalForm(toDateInputValue(getVietnamToday()));
  }
  if (typeof loadJournalCalendarEntries === "function") {
    await loadJournalCalendarEntries();
  }
}
