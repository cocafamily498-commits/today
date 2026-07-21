(function () {
  "use strict";

  const parts = window.LichVietDataParts;
  const { withStore, requestToPromise, generateId, nowIso, assertDate, getMonthFromDate } = parts;

  function buildJournalRecord(input, existingJournal = null) {
    assertDate(input && input.date);
    const timestamp = nowIso();
    return {
      id: existingJournal ? existingJournal.id : input.id || generateId("journal"),
      date: input.date,
      month: getMonthFromDate(input.date),
      text: String(input.text || ""),
      eventTypeId: String(input.eventTypeId || "general"),
      imageIds: Array.isArray(input.imageIds) ? input.imageIds.slice() : [],
      createdAt: existingJournal ? existingJournal.createdAt : input.createdAt || timestamp,
      updatedAt: timestamp
    };
  }

  async function createJournal(input) {
    const journal = buildJournalRecord(input);
    await withStore("journals", "readwrite", (store) => store.add(journal));
    return journal;
  }

  async function updateJournal(id, input) {
    const existingJournal = await getJournal(id);
    if (!existingJournal) throw new Error("Journal not found.");
    const journal = buildJournalRecord({ ...existingJournal, ...input, id }, existingJournal);
    await withStore("journals", "readwrite", (store) => store.put(journal));
    return journal;
  }

  async function getJournal(id) {
    if (!id) return null;
    return withStore("journals", "readonly", (store) => requestToPromise(store.get(id)));
  }

  async function getJournalsByDate(date) {
    assertDate(date);
    return withStore("journals", "readonly", (store) => requestToPromise(store.index("byDate").getAll(date)));
  }

  async function deleteJournal(id) {
    if (!id) return false;
    const journal = await getJournal(id);
    if (!journal) return false;
    await withStore("journals", "readwrite", (store) => store.delete(id));
    return true;
  }

  async function upsertJournalByDate(input) {
    const journal = input && input.id ? await getJournal(input.id) : null;
    return journal ? updateJournal(journal.id, input) : createJournal(input);
  }

  async function getJournalByDate(date) {
    const journals = await getJournalsByDate(date);
    return journals[0] || null;
  }

  async function deleteJournalByDate(date) {
    const journals = await getJournalsByDate(date);
    if (!journals.length) return false;
    await withStore("journals", "readwrite", (store) => journals.forEach((journal) => store.delete(journal.id)));
    return true;
  }
  
  async function getAllJournals() {
    return withStore("journals", "readonly", (store) => requestToPromise(store.getAll()));
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
    createJournal, updateJournal, getJournal, getJournalsByDate, deleteJournal,
    upsertJournalByDate, getJournalByDate, getAllJournals, deleteJournalByDate,
    saveJournalImage, getImage, deleteImage, dismissReminderOccurrence, isReminderOccurrenceDismissed,
    getSetting, setSetting, getAppMeta, setAppMeta
  });
})();
