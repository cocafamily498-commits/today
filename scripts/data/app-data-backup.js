(function () {
  "use strict";

  const parts = window.LichVietDataParts;
  const { getAllFromStore, replaceStoreData, blobToDataUrl, dataUrlToBlob, nowIso, setAppMeta,
    clearEventsReadCache } = parts;

  async function exportBackup() {
    const [events, journals, images, reminderDismissals, settings, appMeta] = await Promise.all([
      getAllFromStore("events"),
      getAllFromStore("journals"),
      getAllFromStore("images"),
      getAllFromStore("reminderDismissals"),
      getAllFromStore("settings"),
      getAllFromStore("appMeta")
    ]);
    const portableImages = await Promise.all(images.map(async (image) => ({
      ...image,
      blob: image.blob ? await blobToDataUrl(image.blob) : null
    })));
  
    return {
      manifest: {
        format: "lichviet-backup",
        version: 1,
        exportedAt: nowIso()
      },
      events,
      journals,
      images: portableImages,
      reminderDismissals,
      settings,
      appMeta
    };
  }
  
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
    await replaceStoreData("journals", backup.journals || []);
    await replaceStoreData("images", images);
    await replaceStoreData("reminderDismissals", backup.reminderDismissals || []);
    await replaceStoreData("settings", backup.settings || []);
    await replaceStoreData("appMeta", backup.appMeta || []);
    await setAppMeta("lastRestoreAt", nowIso());
  }
  

  Object.assign(parts, { exportBackup, importBackup });
})();
