(function () {
  "use strict";

  const parts = window.LichVietDataParts = {};
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
  

  Object.assign(parts, {
    DB_NAME, DB_VERSION, EVENT_TYPES, CALENDARS, REPEAT_FREQUENCIES, DEFAULT_REMINDER_TIME,
    openDatabase, withStore, requestToPromise, generateId, nowIso, assertDate, getMonthFromDate,
    getAllFromIndex, getAllFromStore, replaceStoreData, blobToDataUrl, dataUrlToBlob
  });
})();
