(function () {
  "use strict";

  const parts = window.LichVietDataParts;
  const { withStore, requestToPromise, generateId, nowIso, assertDate, getMonthFromDate } = parts;

  async function upsertJournalByDate(input) {
    assertDate(input && input.date);
    const existingJournal = await getJournalByDate(input.date);
    const timestamp = nowIso();
    const journal = {
      id: existingJournal ? existingJournal.id : input.id || generateId("journal"),
      date: input.date,
      month: getMonthFromDate(input.date),
      text: String(input.text || ""),
      imageIds: Array.isArray(input.imageIds) ? input.imageIds.slice() : [],
      createdAt: existingJournal ? existingJournal.createdAt : input.createdAt || timestamp,
      updatedAt: timestamp
    };
  
    await withStore("journals", "readwrite", (store) => store.put(journal));
    return journal;
  }
  
  async function getJournalByDate(date) {
    assertDate(date);
    return withStore("journals", "readonly", (store) => {
      const index = store.index("byDate");
      return requestToPromise(index.get(date));
    });
  }
  
  async function getAllJournals() {
    return withStore("journals", "readonly", (store) => requestToPromise(store.getAll()));
  }
  
  async function deleteJournalByDate(date) {
    const journal = await getJournalByDate(date);
    if (!journal) return false;
  
    await withStore("journals", "readwrite", (store) => store.delete(journal.id));
    return true;
  }
  
  async function saveJournalImage(input) {
    const source = input || {};
    const image = {
      id: source.id || generateId("image"),
      blob: source.blob,
      mimeType: source.mimeType || (source.blob && source.blob.type) || "application/octet-stream",
      width: Number.isFinite(source.width) ? source.width : null,
      height: Number.isFinite(source.height) ? source.height : null,
      size: Number.isFinite(source.size) ? source.size : source.blob && Number.isFinite(source.blob.size) ? source.blob.size : null,
      createdAt: source.createdAt || nowIso()
    };
  
    await withStore("images", "readwrite", (store) => store.put(image));
    return image;
  }
  
  async function getImage(id) {
    return withStore("images", "readonly", (store) => requestToPromise(store.get(id)));
  }
  
  async function deleteImage(id) {
    await withStore("images", "readwrite", (store) => store.delete(id));
  }
  
  async function dismissReminderOccurrence(input) {
    const source = input || {};
    if (!source.eventId) throw new Error("eventId is required.");
    if (!source.reminderId) throw new Error("reminderId is required.");
    assertDate(source.occurrenceDate, "occurrenceDate");
  
    const dismissal = {
      id: source.id || getReminderDismissalId(source.eventId, source.reminderId, source.occurrenceDate),
      eventId: source.eventId,
      reminderId: source.reminderId,
      occurrenceDate: source.occurrenceDate,
      dismissedAt: source.dismissedAt || nowIso()
    };
  
    await withStore("reminderDismissals", "readwrite", (store) => store.put(dismissal));
    return dismissal;
  }
  
  function getReminderDismissalId(eventId, reminderId, occurrenceDate) {
    return `dismissal-${eventId}-${reminderId}-${occurrenceDate}`;
  }
  
  async function isReminderOccurrenceDismissed(eventId, reminderId, occurrenceDate) {
    if (!eventId) throw new Error("eventId is required.");
    if (!reminderId) throw new Error("reminderId is required.");
    assertDate(occurrenceDate, "occurrenceDate");
    const id = getReminderDismissalId(eventId, reminderId, occurrenceDate);
    const dismissal = await withStore("reminderDismissals", "readonly", (store) => requestToPromise(store.get(id)));
  
    return Boolean(dismissal);
  }
  
  async function getSetting(key) {
    const record = await withStore("settings", "readonly", (store) => requestToPromise(store.get(key)));
    return record ? record.value : undefined;
  }
  
  async function setSetting(key, value) {
    const record = { key, value, updatedAt: nowIso() };
    await withStore("settings", "readwrite", (store) => store.put(record));
    return record;
  }
  
  async function getAppMeta(key) {
    const record = await withStore("appMeta", "readonly", (store) => requestToPromise(store.get(key)));
    return record ? record.value : undefined;
  }
  
  async function setAppMeta(key, value) {
    const record = { key, value, updatedAt: nowIso() };
    await withStore("appMeta", "readwrite", (store) => store.put(record));
    return record;
  }
  

  Object.assign(parts, {
    upsertJournalByDate, getJournalByDate, getAllJournals, deleteJournalByDate,
    saveJournalImage, getImage, deleteImage, dismissReminderOccurrence, isReminderOccurrenceDismissed,
    getSetting, setSetting, getAppMeta, setAppMeta
  });
})();
