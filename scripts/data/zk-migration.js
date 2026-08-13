(function (root, factory) {
  const api = factory(root.LichVietZkCrypto);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LichVietZkMigration = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function (zk) {
  "use strict";

  const MIGRATION_KEY = "plaintext-v3-to-zk-v1";
  const STORE_MAP = [
    { source: "events", target: "zk_events_v1", encrypt: "encryptEvent", decrypt: "decryptEvent" },
    { source: "journals", target: "zk_journals_v1", encrypt: "encryptJournal", decrypt: "decryptJournal" },
    { source: "images", target: "zk_attachments_v1", encrypt: "encryptAttachment", decrypt: "decryptAttachment" }
  ];

  function request(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readState(db) {
    const tx = db.transaction("zk_migrations_v1", "readonly");
    return (await request(tx.objectStore("zk_migrations_v1").get(MIGRATION_KEY))) || {
      key: MIGRATION_KEY, version: 1, status: "pending", stores: {}, startedAt: new Date().toISOString()
    };
  }

  async function getBatch(db, storeName, afterId, limit) {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const values = [];
      const range = afterId ? IDBKeyRange.lowerBound(afterId, true) : null;
      const cursorRequest = store.openCursor(range);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || values.length >= limit) { resolve(values); return; }
        values.push(cursor.value);
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  function comparable(kind, value) {
    if (kind === "events") return {
      id: value.id, date: value.date, month: value.month, title: value.title || "", note: value.note || "",
      eventType: value.eventType || "other", eventTypeId: value.eventTypeId || "general", calendarLabel: value.calendarLabel || "solar",
      lunar: value.lunar || null, time: value.time || null, allDay: value.allDay !== false, color: value.color || "red",
      repeat: value.repeat, reminders: value.reminders || [], createdAt: value.createdAt || null, updatedAt: value.updatedAt
    };
    if (kind === "journals") return {
      id: value.id, date: value.date, month: value.month, title: value.title || "", text: value.text || "",
      eventTypeId: value.eventTypeId || "general", imageIds: value.imageIds || [], createdAt: value.createdAt || null, updatedAt: value.updatedAt
    };
    return { id: value.id, size: value.size ?? value.blob?.size ?? value.bytes?.byteLength ?? 0, mimeType: value.mimeType || value.blob?.type || "application/octet-stream", width: value.width ?? null, height: value.height ?? null, createdAt: value.createdAt || null };
  }

  async function migrateBatch(db, dek, vaultId, batchSize = 25) {
    if (!zk) throw new Error("Zero Knowledge crypto module is not loaded.");
    const state = await readState(db);
    if (state.status === "verified") return state;
    const config = STORE_MAP.find((item) => !state.stores[item.source]?.complete);
    if (!config) return verifyMigration(db, dek, vaultId);
    const progress = state.stores[config.source] || { migrated: 0, afterId: null, complete: false };
    const sourceRecords = await getBatch(db, config.source, progress.afterId, batchSize);
    if (!sourceRecords.length) {
      state.stores[config.source] = { ...progress, complete: true };
      await writeState(db, state);
      return state;
    }

    const encrypted = [];
    for (const source of sourceRecords) {
      const target = await zk[config.encrypt](dek, vaultId, source, 1);
      const roundTrip = await zk[config.decrypt](dek, vaultId, target);
      if (config.source === "images") {
        try {
          if (zk.canonicalize(comparable(config.source, source)) !== zk.canonicalize(comparable(config.source, roundTrip))) throw new Error("Attachment metadata parity failed.");
        } finally { roundTrip.bytes.fill(0); }
      } else if (zk.canonicalize(comparable(config.source, source)) !== zk.canonicalize(comparable(config.source, roundTrip))) {
        throw new Error(`${config.source} parity failed for ${source.id}.`);
      }
      encrypted.push(target);
    }

    const nextState = structuredClone(state);
    nextState.status = "running";
    nextState.updatedAt = new Date().toISOString();
    nextState.stores[config.source] = {
      migrated: progress.migrated + encrypted.length,
      afterId: sourceRecords[sourceRecords.length - 1].id,
      complete: false
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction([config.target, "zk_migrations_v1"], "readwrite");
      encrypted.forEach((record) => tx.objectStore(config.target).put(record));
      tx.objectStore("zk_migrations_v1").put(nextState);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Migration transaction aborted."));
    });
    return nextState;
  }

  async function writeState(db, state) {
    const tx = db.transaction("zk_migrations_v1", "readwrite");
    await request(tx.objectStore("zk_migrations_v1").put(state));
  }

  async function count(db, storeName) {
    const tx = db.transaction(storeName, "readonly");
    return request(tx.objectStore(storeName).count());
  }

  async function verifyMigration(db, dek, vaultId) {
    const state = await readState(db);
    for (const config of STORE_MAP) {
      const [sourceCount, targetCount] = await Promise.all([count(db, config.source), count(db, config.target)]);
      if (sourceCount !== targetCount) throw new Error(`${config.source} count parity failed (${sourceCount}/${targetCount}).`);
      const records = await getBatch(db, config.target, null, Number.MAX_SAFE_INTEGER);
      for (const record of records) {
        const opened = await zk[config.decrypt](dek, vaultId, record);
        if (opened.bytes) opened.bytes.fill(0);
      }
      state.stores[config.source] = { ...(state.stores[config.source] || {}), migrated: targetCount, complete: true };
    }
    state.status = "verified";
    state.verifiedAt = new Date().toISOString();
    state.plaintextRetained = true;
    await writeState(db, state);
    return state;
  }

  async function runMigration(db, dek, vaultId, options = {}) {
    let state = await readState(db);
    while (state.status !== "verified") state = await migrateBatch(db, dek, vaultId, options.batchSize || 25);
    return state;
  }

  return { MIGRATION_KEY, STORE_MAP, readState, migrateBatch, verifyMigration, runMigration, comparable };
});
