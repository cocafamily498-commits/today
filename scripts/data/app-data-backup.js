(function () {
  "use strict";

  const parts = window.LichVietDataParts;
  const { replaceStoreData, dataUrlToBlob, nowIso, generateId, getMonthFromDate, setAppMeta,
    clearEventsReadCache } = parts;
  
  async function importBackup(backup) {
    if (!backup || !backup.manifest || backup.manifest.format !== "lichviet-backup") {
      throw new Error("File sao lưu không đúng định dạng.");
    }
    if (Number(backup.manifest.version) !== 1) {
      throw new Error("Phiên bản file sao lưu chưa được hỗ trợ.");
    }
  
    const images = await Promise.all((backup.images || []).map(async (image) => ({
      ...image,
      blob: typeof image.blob === "string" ? dataUrlToBlob(image.blob) : image.blob || null
    })));
  
    await replaceStoreData("events", backup.events || []);
    if (clearEventsReadCache) clearEventsReadCache();
    const journals = (backup.journals || []).map((journal) => ({
      ...journal,
      id: journal.id || generateId("journal"),
      month: journal.month || getMonthFromDate(journal.date),
      eventTypeId: journal.eventTypeId || "general",
      title: String(journal.title || "")
    }));
    await replaceStoreData("journals", journals);
    await replaceStoreData("images", images);
    await replaceStoreData("reminderDismissals", backup.reminderDismissals || []);
    await replaceStoreData("settings", backup.settings || []);
    await replaceStoreData("appMeta", backup.appMeta || []);
    await setAppMeta("lastRestoreAt", nowIso());
  }
  

  Object.assign(parts, { importBackup });
})();
