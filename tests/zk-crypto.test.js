const assert = require("node:assert/strict");
global.hashwasm = require("hash-wasm");
const zk = require("../scripts/data/zk-crypto.js");
global.LichVietZkCrypto = zk;
const backup = require("../scripts/data/zk-backup.js");

async function rejects(action, message) {
  let rejected = false;
  try { await action(); } catch { rejected = true; }
  assert.equal(rejected, true, message);
}

(async () => {
  const dek = await zk.createSessionDek();
  assert.equal(dek.extractable, false);
  const vaultId = "vault-test";
  await rejects(() => zk.createPasswordVault("ngan"), "new password shorter than eight characters must fail");
  const vault = await zk.createPasswordVault("mot cum tu dai de nho");
  const unlocked = await zk.unlockPasswordVault(vault.meta, "mot cum tu dai de nho");
  assert.equal(unlocked.extractable, false);
  await rejects(() => zk.unlockPasswordVault(vault.meta, "mat-khau-sai"), "wrong vault password must fail");
  await assert.rejects(
    () => zk.unlockPasswordVault(vault.meta, "ngan"),
    /Mật khẩu không đúng/,
    "current-password verification must not apply the new-password minimum length rule"
  );
  const damagedRecoveryMeta = structuredClone(vault.meta);
  new Uint8Array(damagedRecoveryMeta.recoveryWrappedDek.ciphertext)[0] ^= 1;
  await assert.rejects(
    () => zk.restoreWithRecovery(damagedRecoveryMeta, vault.phrase, "mat khau moi hop le"),
    /24 từ Recovery không đúng/,
    "recovery decryption failures must not expose Web Crypto errors"
  );
  await assert.rejects(
    () => zk.restoreWithRecovery(vault.meta, "khong phai cum recovery hop le", "mat khau moi hop le"),
    /24 từ Recovery không đúng/,
    "invalid recovery phrases must use the same friendly error"
  );
  await assert.rejects(
    () => zk.changePassword(vault.meta, "mat-khau-sai", "ngan", "khong-khop"),
    /Mật khẩu hiện tại không đúng/,
    "current password error must take priority over invalid new password"
  );
  const event = {
    id: "event-1", date: "2026-08-12", month: "2026-08", title: "Bí mật", note: "Nội dung",
    eventType: "other", eventTypeId: "general", calendarLabel: "solar", lunar: null, time: "09:30", allDay: false,
    color: "red", repeat: { frequency: "none", calendar: "solar", interval: 1, until: null },
    reminders: [{ id: "r1", enabled: true, beforeDays: 1, beforeHours: 0, time: "09:30" }],
    createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z"
  };
  const encrypted = await zk.encryptEvent(dek, vaultId, event, 1);
  const opened = await zk.decryptEvent(dek, vaultId, encrypted);
  assert.equal(opened.title, event.title);
  assert.equal(opened.note, event.note);
  assert.equal(Object.prototype.hasOwnProperty.call(encrypted, "title"), false);

  const changedSchedule = structuredClone(encrypted);
  changedSchedule.schedule.time = "10:30";
  await rejects(() => zk.decryptEvent(dek, vaultId, changedSchedule), "schedule tampering must fail");

  const changedRevision = structuredClone(encrypted);
  changedRevision.revision = 2;
  await rejects(() => zk.decryptEvent(dek, vaultId, changedRevision), "revision tampering must fail");

  const attachment = await zk.encryptAttachment(dek, vaultId, {
    id: "image-1", bytes: new Uint8Array([1, 2, 3, 4]), mimeType: "image/png", width: 1, height: 1
  }, 1);
  const attachmentOpened = await zk.decryptAttachment(dek, vaultId, attachment);
  assert.deepEqual([...attachmentOpened.bytes], [1, 2, 3, 4]);
  attachmentOpened.bytes.fill(0);

  const wrappingKey = await zk.createSessionDek();
  const recoveryWrappedDek = await zk.seal(new Uint8Array(32), wrappingKey, zk.aad("test-wrapper", { vaultId }));
  const eventGroups = { version: 3, groups: [{ id: "general", name: "Nhóm chung", iconId: "group-family", color: "#64748b", readonly: true }, { id: "family-secret", name: "Gia đình riêng", iconId: "group-family", color: "#d97706", readonly: false }] };
  const text = await backup.createBackup({ vaultId, dek, recoveryKdf: { name: "HKDF-SHA-256", salt: new Uint8Array(16) }, recoveryWrappedDek, events: [encrypted], attachments: [attachment], eventGroups });
  assert.equal(text.includes("Bí mật"), false);
  assert.equal(text.includes("Gia đình riêng"), false);
  const parsed = backup.parseBackup(text);
  assert.equal(await backup.verifyBackup(parsed, dek), true);
  assert.deepEqual(parsed.eventGroups, eventGroups);
  assert.throws(() => backup.parseBackup("PK\u0003\u0004legacy zip"), /ZIP backup cũ/);

  const tampered = backup.parseBackup(text);
  tampered.records[0].revision += 1;
  await rejects(() => backup.verifyBackup(tampered, dek), "manifest mismatch must fail");

  const missingGroups = backup.parseBackup(text);
  missingGroups.eventGroupsCipher = null;
  await rejects(() => backup.verifyBackup(missingGroups, dek), "removing encrypted groups must fail manifest verification");

  const conflict = structuredClone(encrypted);
  conflict.listCipher.iv[0] ^= 1;
  const merge = backup.mergeRecords([encrypted], [conflict]);
  assert.equal(merge.conflicts.length, 1);
  console.log("Zero Knowledge crypto/backup tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
