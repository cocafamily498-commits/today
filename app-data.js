(function () {
  "use strict";

  const DB_NAME = "so-tay-lich-viet";
  const DB_VERSION = 1;
  const EVENT_TYPES = new Set(["birthday", "deathAnniversary", "other"]);
  const CALENDARS = new Set(["solar", "lunar"]);
  const REPEAT_FREQUENCIES = new Set(["none", "daily", "weekly", "monthly", "yearly"]);
  const DEFAULT_REMINDER_TIME = "08:00";

  let databasePromise = null;

  function openDatabase() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB is not available in this browser."));
    }

    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("events")) {
          const store = db.createObjectStore("events", { keyPath: "id" });
          store.createIndex("byDate", "date", { unique: false });
          store.createIndex("byMonth", "month", { unique: false });
        }

        if (!db.objectStoreNames.contains("journals")) {
          const store = db.createObjectStore("journals", { keyPath: "id" });
          store.createIndex("byDate", "date", { unique: true });
          store.createIndex("byMonth", "month", { unique: false });
        }

        if (!db.objectStoreNames.contains("images")) {
          const store = db.createObjectStore("images", { keyPath: "id" });
          store.createIndex("byCreatedAt", "createdAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("reminderDismissals")) {
          const store = db.createObjectStore("reminderDismissals", { keyPath: "id" });
          store.createIndex("byEventOccurrence", ["eventId", "occurrenceDate"], { unique: false });
        }

        if (!db.objectStoreNames.contains("appMeta")) {
          db.createObjectStore("appMeta", { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };

      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another tab."));
    });

    return databasePromise;
  }

  async function withStore(storeName, mode, callback) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let callbackResult;

      transaction.oncomplete = () => resolve(callbackResult);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));

      try {
        callbackResult = callback(store);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function generateId(prefix) {
    const id = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${prefix}-${id}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function assertDate(value, fieldName = "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
      throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
    }
  }

  function getMonthFromDate(date) {
    assertDate(date);
    return date.slice(0, 7);
  }

  function normalizeCalendar(value, fallback = "solar") {
    return CALENDARS.has(value) ? value : fallback;
  }

  function normalizeEventType(value) {
    return EVENT_TYPES.has(value) ? value : "other";
  }

  function normalizeRepeat(input, eventType, calendarLabel) {
    const source = input || {};
    const defaultCalendar = eventType === "birthday" ? "solar" : calendarLabel;
    let frequency = REPEAT_FREQUENCIES.has(source.frequency) ? source.frequency : "none";
    let calendar = normalizeCalendar(source.calendar, defaultCalendar);

    if (eventType === "birthday") {
      frequency = "yearly";
      calendar = "solar";
    } else if (eventType === "deathAnniversary") {
      frequency = "yearly";
      calendar = "lunar";
    }

    return {
      frequency,
      calendar,
      interval: Math.max(1, Number.parseInt(source.interval, 10) || 1),
      until: source.until || null
    };
  }

  function normalizeReminder(reminder, eventType) {
    const source = reminder || {};
    const beforeDays = Math.max(0, Number.parseInt(source.beforeDays, 10) || 0);
    const beforeHours = Math.max(0, Number.parseInt(source.beforeHours, 10) || 0);
    const time = /^\d{2}:\d{2}$/.test(source.time || "") ? source.time : DEFAULT_REMINDER_TIME;

    return {
      id: source.id || generateId("reminder"),
      enabled: source.enabled !== false,
      beforeDays,
      beforeHours,
      time,
      allowSnooze: source.allowSnooze !== false,
      defaultSnoozeMinutes: Math.max(1, Number.parseInt(source.defaultSnoozeMinutes, 10) || 10)
    };
  }

  function normalizeLunarSnapshot(lunar) {
    if (!lunar || typeof lunar !== "object") return null;
    const day = Number.parseInt(lunar.day, 10);
    const month = Number.parseInt(lunar.month, 10);
    if (!Number.isInteger(day) || day < 1 || day > 30) return null;
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;

    return {
      day,
      month,
      leap: lunar.leap === true
    };
  }

  function normalizeEvent(input, existingEvent) {
    const source = { ...(existingEvent || {}), ...(input || {}) };
    assertDate(source.date);

    const eventType = normalizeEventType(source.eventType);
    const defaultCalendarLabel = eventType === "birthday"
      ? "solar"
      : eventType === "deathAnniversary"
        ? "lunar"
        : "solar";
    const calendarLabel = eventType === "birthday"
      ? "solar"
      : eventType === "deathAnniversary"
        ? "lunar"
        : normalizeCalendar(source.calendarLabel, defaultCalendarLabel);
    const repeat = normalizeRepeat(source.repeat, eventType, calendarLabel);
    const needsLunarSnapshot = calendarLabel === "lunar" || repeat.calendar === "lunar";
    const lunar = needsLunarSnapshot ? normalizeLunarSnapshot(source.lunar) : null;
    const reminders = Array.isArray(source.reminders)
      ? source.reminders.map((reminder) => normalizeReminder(reminder, eventType))
      : [];
    const createdAt = existingEvent && existingEvent.createdAt ? existingEvent.createdAt : source.createdAt || nowIso();

    return {
      id: source.id || generateId("event"),
      date: source.date,
      month: getMonthFromDate(source.date),
      title: String(source.title || "").trim(),
      note: String(source.note || ""),
      eventType,
      calendarLabel,
      lunar,
      time: source.time || null,
      allDay: source.allDay !== false,
      color: source.color || defaultEventColor(eventType),
      repeat,
      reminders,
      createdAt,
      updatedAt: nowIso()
    };
  }

  function defaultEventColor(eventType) {
    if (eventType === "birthday") return "blue";
    if (eventType === "deathAnniversary") return "purple";
    return "red";
  }

  async function createEvent(input) {
    const event = normalizeEvent(input);
    await withStore("events", "readwrite", (store) => store.put(event));
    return event;
  }

  async function updateEvent(id, changes) {
    const existingEvent = await getEvent(id);
    if (!existingEvent) throw new Error("Event not found.");

    const event = normalizeEvent({ ...changes, id }, existingEvent);
    await withStore("events", "readwrite", (store) => store.put(event));
    return event;
  }

  async function deleteEvent(id) {
    await withStore("events", "readwrite", (store) => store.delete(id));
  }

  async function getEvent(id) {
    return withStore("events", "readonly", (store) => requestToPromise(store.get(id)));
  }

  async function getAllEvents() {
    return withStore("events", "readonly", (store) => requestToPromise(store.getAll()));
  }

  async function getEventsByDate(date) {
    assertDate(date);
    return getAllFromIndex("events", "byDate", date);
  }

  async function getEventsByMonth(month) {
    if (!/^\d{4}-\d{2}$/.test(month || "")) {
      throw new Error("month must use YYYY-MM format.");
    }
    return getAllFromIndex("events", "byMonth", month);
  }

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
    await replaceStoreData("journals", backup.journals || []);
    await replaceStoreData("images", images);
    await replaceStoreData("reminderDismissals", backup.reminderDismissals || []);
    await replaceStoreData("settings", backup.settings || []);
    await replaceStoreData("appMeta", backup.appMeta || []);
    await setAppMeta("lastRestoreAt", nowIso());
  }

  async function getAllFromIndex(storeName, indexName, query) {
    return withStore(storeName, "readonly", (store) => {
      const index = store.index(indexName);
      if (typeof index.getAll === "function") return requestToPromise(index.getAll(query));

      return new Promise((resolve, reject) => {
        const items = [];
        const request = index.openCursor(query);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async function getAllFromStore(storeName) {
    return withStore(storeName, "readonly", (store) => requestToPromise(store.getAll()));
  }

  async function replaceStoreData(storeName, records) {
    await withStore(storeName, "readwrite", (store) => {
      store.clear();
      records.forEach((record) => store.put(record));
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const [header, data] = String(dataUrl || "").split(",");
    const match = /^data:(.*?);base64$/.exec(header || "");
    const mimeType = match ? match[1] : "application/octet-stream";
    const binary = atob(data || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  }

  window.LichVietData = {
    DB_NAME,
    DB_VERSION,
    openDatabase,
    createEvent,
    updateEvent,
    deleteEvent,
    getEvent,
    getAllEvents,
    getEventsByDate,
    getEventsByMonth,
    upsertJournalByDate,
    getJournalByDate,
    deleteJournalByDate,
    saveJournalImage,
    getImage,
    deleteImage,
    dismissReminderOccurrence,
    isReminderOccurrenceDismissed,
    getSetting,
    setSetting,
    getAppMeta,
    setAppMeta,
    exportBackup,
    importBackup
  };
})();
