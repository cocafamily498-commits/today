(function () {
  "use strict";
  let db = null;
  let session = null;
  let active = false;

  const requestValue = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transactionDone = (tx) => new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Giao dịch dữ liệu mã hóa bị hủy."));
  });
  async function get(storeName, id) {
    return requestValue(db.transaction(storeName, "readonly").objectStore(storeName).get(id));
  }
  async function all(storeName) {
    return requestValue(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
  }
  async function byIndex(storeName, indexName, query) {
    return requestValue(db.transaction(storeName, "readonly").objectStore(storeName).index(indexName).getAll(query));
  }
  async function put(storeName, record) {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    await transactionDone(tx);
    return record;
  }
  async function remove(storeName, id) {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    await transactionDone(tx);
  }
  const cryptoApi = () => window.LichVietZkCrypto;
  const decryptEvent = (record) => cryptoApi().decryptEvent(session.dek, session.meta.vaultId, record);
  const decryptJournal = (record) => cryptoApi().decryptJournal(session.dek, session.meta.vaultId, record);
  async function decryptMany(records, decrypt) {
    return Promise.all(records.filter((record) => record.deleted !== true).map(decrypt));
  }
  function id(prefix) {
    return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  }

  async function createEvent(input) {
    const source = { ...input, id: input.id || id("event"), createdAt: input.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const record = await cryptoApi().encryptEvent(session.dek, session.meta.vaultId, source, 1);
    await put("zk_events_v1", record);
    return decryptEvent(record);
  }
  async function updateEvent(eventId, changes) {
    const current = await get("zk_events_v1", eventId);
    if (!current) throw new Error("Không tìm thấy sự kiện.");
    const plaintext = await decryptEvent(current);
    const source = { ...plaintext, ...changes, id: eventId, updatedAt: new Date().toISOString() };
    const record = await cryptoApi().encryptEvent(session.dek, session.meta.vaultId, source, current.revision + 1);
    await put("zk_events_v1", record);
    return decryptEvent(record);
  }
  async function getEvent(eventId) { const record = await get("zk_events_v1", eventId); return record && record.deleted !== true ? decryptEvent(record) : null; }
  async function getAllEvents() { return decryptMany(await all("zk_events_v1"), decryptEvent); }
  async function getEventsByDate(date) { return decryptMany(await byIndex("zk_events_v1", "byDate", date), decryptEvent); }
  async function getEventsByMonth(month) { return decryptMany(await byIndex("zk_events_v1", "byMonth", month), decryptEvent); }
  async function deleteEvent(eventId) { await remove("zk_events_v1", eventId); }

  async function createJournal(input) {
    const source = { ...input, id: input.id || id("journal"), createdAt: input.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const record = await cryptoApi().encryptJournal(session.dek, session.meta.vaultId, source, 1);
    await put("zk_journals_v1", record);
    return decryptJournal(record);
  }
  async function updateJournal(journalId, changes) {
    const current = await get("zk_journals_v1", journalId);
    if (!current) throw new Error("Không tìm thấy nhật ký.");
    const plaintext = await decryptJournal(current);
    const source = { ...plaintext, ...changes, id: journalId, updatedAt: new Date().toISOString() };
    const record = await cryptoApi().encryptJournal(session.dek, session.meta.vaultId, source, current.revision + 1);
    await put("zk_journals_v1", record);
    return decryptJournal(record);
  }
  async function getJournal(journalId) { const record = await get("zk_journals_v1", journalId); return record && record.deleted !== true ? decryptJournal(record) : null; }
  async function getAllJournals() { return decryptMany(await all("zk_journals_v1"), decryptJournal); }
  async function getJournalsByDate(date) { return decryptMany(await byIndex("zk_journals_v1", "byDate", date), decryptJournal); }
  async function getJournalByDate(date) { return (await getJournalsByDate(date))[0] || null; }
  async function deleteJournal(journalId) { const exists = await get("zk_journals_v1", journalId); if (!exists) return false; await remove("zk_journals_v1", journalId); return true; }
  async function deleteJournalByDate(date) { const records = await byIndex("zk_journals_v1", "byDate", date); if (!records.length) return false; const tx = db.transaction("zk_journals_v1", "readwrite"); records.forEach((record) => tx.objectStore("zk_journals_v1").delete(record.id)); await transactionDone(tx); return true; }
  async function upsertJournalByDate(input) { return input?.id && await get("zk_journals_v1", input.id) ? updateJournal(input.id, input) : createJournal(input); }

  async function saveJournalImage(input) {
    const source = { ...input, id: input?.id || id("image"), createdAt: input?.createdAt || new Date().toISOString() };
    const current = await get("zk_attachments_v1", source.id);
    const record = await cryptoApi().encryptAttachment(session.dek, session.meta.vaultId, source, current ? current.revision + 1 : 1);
    await put("zk_attachments_v1", record);
    return { id: source.id, mimeType: source.mimeType || source.blob?.type || "application/octet-stream", width: source.width ?? null, height: source.height ?? null, size: record.size, createdAt: source.createdAt };
  }
  async function getImage(imageId) {
    const record = await get("zk_attachments_v1", imageId);
    if (!record) return null;
    const opened = await cryptoApi().decryptAttachment(session.dek, session.meta.vaultId, record);
    const blob = new Blob([opened.bytes], { type: opened.mimeType });
    opened.bytes.fill(0);
    return { id: imageId, blob, mimeType: opened.mimeType, width: opened.width, height: opened.height, size: record.size, createdAt: opened.createdAt };
  }
  async function deleteImage(imageId) { await remove("zk_attachments_v1", imageId); }

  async function importBackup(backup) {
    if (!backup?.manifest || backup.manifest.format !== "lichviet-backup" || Number(backup.manifest.version) !== 1) {
      throw new Error("File sao lưu plaintext không đúng định dạng được hỗ trợ.");
    }
    const groups = [
      { kind: "events", target: "zk_events_v1", encrypt: "encryptEvent", decrypt: "decryptEvent", records: backup.events || [] },
      { kind: "journals", target: "zk_journals_v1", encrypt: "encryptJournal", decrypt: "decryptJournal", records: backup.journals || [] },
      { kind: "images", target: "zk_attachments_v1", encrypt: "encryptAttachment", decrypt: "decryptAttachment", records: backup.images || [] }
    ];
    const encryptedGroups = [];
    for (const group of groups) {
      const encrypted = [];
      for (const item of group.records) {
        const source = { ...item };
        if (!source.id) source.id = id(group.kind === "images" ? "image" : group.kind === "events" ? "event" : "journal");
        if (group.kind === "images" && typeof source.blob === "string") source.blob = window.LichVietDataParts.dataUrlToBlob(source.blob);
        const record = await cryptoApi()[group.encrypt](session.dek, session.meta.vaultId, source, 1);
        const opened = await cryptoApi()[group.decrypt](session.dek, session.meta.vaultId, record);
        try {
          if (cryptoApi().canonicalize(window.LichVietZkMigration.comparable(group.kind, source)) !== cryptoApi().canonicalize(window.LichVietZkMigration.comparable(group.kind, opened))) {
            throw new Error(`Không xác minh được bản ghi plaintext ${source.id}.`);
          }
        } finally {
          if (opened.bytes) opened.bytes.fill(0);
        }
        encrypted.push(record);
      }
      encryptedGroups.push({ ...group, records: encrypted });
    }

    const storeNames = [
      "zk_events_v1", "zk_journals_v1", "zk_attachments_v1",
      "events", "journals", "images", "reminderDismissals", "settings", "appMeta"
    ];
    const tx = db.transaction(storeNames, "readwrite");
    encryptedGroups.forEach((group) => {
      const store = tx.objectStore(group.target);
      store.clear();
      group.records.forEach((record) => store.put(record));
    });
    ["events", "journals", "images"].forEach((storeName) => tx.objectStore(storeName).clear());
    [
      ["reminderDismissals", backup.reminderDismissals || []],
      ["settings", backup.settings || []],
      ["appMeta", backup.appMeta || []]
    ].forEach(([storeName, records]) => {
      const store = tx.objectStore(storeName);
      store.clear();
      records.forEach((record) => store.put(record));
    });
    tx.objectStore("appMeta").put({ key: "lastRestoreAt", value: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await transactionDone(tx);
  }

  async function importEncryptedBackup(backup, sourceDek) {
    if (!backup || typeof backup.vaultId !== "string" || !Array.isArray(backup.records)) {
      throw new Error("File backup két mã hóa không hợp lệ.");
    }
    await window.LichVietZkBackup.verifyBackup(backup, sourceDek);
    const plaintext = {
      manifest: { format: "lichviet-backup", version: 1, exportedAt: backup.exportedAt || new Date().toISOString() },
      events: [], journals: [], images: [], reminderDismissals: [], appMeta: [],
      settings: backup.eventGroups == null ? [] : [{ key: "eventGroups", value: backup.eventGroups, updatedAt: new Date().toISOString() }]
    };
    const attachmentBytes = [];
    try {
      for (const record of backup.records) {
        if (record.deleted === true) continue;
        if (record.kind === "event") plaintext.events.push(await cryptoApi().decryptEvent(sourceDek, backup.vaultId, record));
        else if (record.kind === "journal") plaintext.journals.push(await cryptoApi().decryptJournal(sourceDek, backup.vaultId, record));
        else if (record.kind === "attachment") {
          const opened = await cryptoApi().decryptAttachment(sourceDek, backup.vaultId, record);
          attachmentBytes.push(opened.bytes);
          plaintext.images.push({ ...opened, bytes: undefined, blob: new Blob([opened.bytes], { type: opened.mimeType }) });
        } else throw new Error(`Backup chứa loại bản ghi không được hỗ trợ: ${record.kind}.`);
      }
      await importBackup(plaintext);
    } finally {
      attachmentBytes.forEach((bytes) => bytes.fill(0));
    }
  }

  function activate(database, vaultSession) {
    db = database;
    session = vaultSession;
    if (active) return;
    Object.assign(window.LichVietData, {
      createEvent, updateEvent, deleteEvent, getEvent, getAllEvents, getEventsByDate, getEventsByMonth, clearEventsReadCache() {},
      createJournal, updateJournal, getJournal, getJournalsByDate, deleteJournal, upsertJournalByDate, getJournalByDate, getAllJournals, deleteJournalByDate,
      saveJournalImage, getImage, deleteImage, importBackup, importEncryptedBackup
    });
    active = true;
  }
  window.LichVietZkRepository = Object.freeze({ activate, isActive: () => active });
})();
