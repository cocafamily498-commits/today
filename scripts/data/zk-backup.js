(function (root, factory) {
  const api = factory(root.LichVietZkCrypto);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LichVietZkBackup = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function (zk) {
  "use strict";
  const FORMAT = "lichviet-zk-backup";
  const VERSION = 1;
  const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
  const MAX_RECORDS = 200000;

  function toBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let result = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) result += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(result);
  }
  function fromBase64(value, maxBytes = MAX_BACKUP_BYTES) {
    if (typeof value !== "string" || value.length > Math.ceil(maxBytes * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error("Invalid or oversized base64 value.");
    const binary = atob(value);
    if (binary.length > maxBytes) throw new Error("Decoded value exceeds limit.");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  const boxToJson = (box) => ({ version: box.version, iv: toBase64(box.iv), ciphertext: toBase64(box.ciphertext) });
  function jsonToBox(value) {
    if (!value || value.version !== 1) throw new Error("Unsupported cipher box.");
    const iv = fromBase64(value.iv, 12);
    const ciphertext = fromBase64(value.ciphertext);
    if (iv.byteLength !== 12 || ciphertext.byteLength < 16) throw new Error("Invalid AES-GCM box.");
    return { version: 1, iv, ciphertext: ciphertext.buffer };
  }
  function mapBoxes(record, encode) {
    const output = { ...record };
    ["scheduleAuth", "listCipher", "detailCipher", "metaCipher"].forEach((key) => { if (output[key]) output[key] = encode(output[key]); });
    if (output.sha256) output.sha256 = encode === boxToJson ? toBase64(output.sha256) : fromBase64(output.sha256, 32);
    if (output.chunks) output.chunks = output.chunks.map((chunk) => ({ ...chunk, box: encode(chunk.box) }));
    return output;
  }
  function decodeRecord(record) {
    if (!record || typeof record.id !== "string" || record.id.length > 240 || !Number.isInteger(record.revision) || record.revision < 1) throw new Error("Invalid backup record.");
    if (record.chunks && (!Array.isArray(record.chunks) || record.chunks.length > 10000)) throw new Error("Invalid attachment chunks.");
    return mapBoxes(record, jsonToBox);
  }
  async function createBackup(input) {
    const records = [...(input.events || []), ...(input.journals || []), ...(input.attachments || [])];
    if (records.length > MAX_RECORDS) throw new Error("Backup has too many records.");
    const head = records.map((record) => ({ kind: record.kind, id: record.id, revision: record.revision, deleted: record.deleted === true }));
    const manifest = await zk.seal(head, input.dek, zk.aad("backup-manifest", { vaultId: input.vaultId }));
    return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), vaultId: input.vaultId,
      recoveryKdf: { name: input.recoveryKdf.name, salt: toBase64(input.recoveryKdf.salt) }, recoveryWrappedDek: boxToJson(input.recoveryWrappedDek), manifest: boxToJson(manifest), records: records.map((record) => mapBoxes(record, boxToJson)) });
  }
  function parseBackup(text) {
    if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("File backup vượt quá giới hạn cho phép.");
    if (text.slice(0, 2) === "PK") throw new Error("Đây là file ZIP backup cũ, không phải backup két mã hóa. Trên thiết bị cũ, vào Cài đặt/Hệ thống → Backup két mã hóa để tạo file .lichvietzk.");
    let value;
    try { value = JSON.parse(text); } catch { throw new Error("File không phải backup két mã hóa hợp lệ (.lichvietzk)."); }
    if (!value || value.format !== FORMAT || value.version !== VERSION || typeof value.vaultId !== "string" || !Array.isArray(value.records) || value.records.length > MAX_RECORDS) throw new Error("Unsupported backup format.");
    if (value.recoveryKdf?.name !== "HKDF-SHA-256") throw new Error("Backup thiếu Recovery KDF hợp lệ.");
    return { ...value, recoveryKdf: { name: "HKDF-SHA-256", salt: fromBase64(value.recoveryKdf.salt, 16) }, recoveryWrappedDek: jsonToBox(value.recoveryWrappedDek), manifest: jsonToBox(value.manifest), records: value.records.map(decodeRecord) };
  }
  async function verifyBackup(backup, dek) {
    const actual = await zk.openJson(backup.manifest, dek, zk.aad("backup-manifest", { vaultId: backup.vaultId }));
    const expected = backup.records.map((record) => ({ kind: record.kind, id: record.id, revision: record.revision, deleted: record.deleted === true }));
    if (zk.canonicalize(actual) !== zk.canonicalize(expected)) throw new Error("Backup manifest authentication failed.");
    return true;
  }
  function mergeRecords(localRecords, incomingRecords) {
    const merged = new Map(localRecords.map((record) => [`${record.kind}:${record.id}`, record]));
    const conflicts = [];
    incomingRecords.forEach((incoming) => {
      const key = `${incoming.kind}:${incoming.id}`;
      const local = merged.get(key);
      if (!local || incoming.revision > local.revision) merged.set(key, incoming);
      else if (incoming.revision === local.revision && zk.canonicalize(mapBoxes(incoming, boxToJson)) !== zk.canonicalize(mapBoxes(local, boxToJson))) conflicts.push({ key, local, incoming });
    });
    return { records: [...merged.values()], conflicts };
  }
  return { FORMAT, VERSION, MAX_BACKUP_BYTES, MAX_RECORDS, toBase64, fromBase64, boxToJson, jsonToBox, createBackup, parseBackup, verifyBackup, mergeRecords };
});
