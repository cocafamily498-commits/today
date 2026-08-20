(function (root, factory) {
  const api = factory(root.crypto || (typeof require === "function" ? require("node:crypto").webcrypto : null), root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LichVietZkCrypto = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function (webcrypto, root) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });

  function assertCrypto() {
    if (!webcrypto || !webcrypto.subtle) throw new Error("Thiết bị đang mở ứng dụng qua kết nối không an toàn. Hãy dùng HTTPS hoặc localhost để tạo/mở/khôi phục két Zero Knowledge.");
  }

  function canonicalize(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }

  function aad(namespace, context) {
    return encoder.encode(canonicalize({ namespace: `sotay:zk:v${SCHEMA_VERSION}:${namespace}`, ...context }));
  }

  async function importDek(raw) {
    assertCrypto();
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    if (bytes.byteLength !== 32) throw new Error("DEK must be exactly 32 bytes.");
    const key = await webcrypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    if (key.extractable) throw new Error("Session DEK must not be extractable.");
    return key;
  }

  async function createSessionDek() {
    assertCrypto();
    const raw = webcrypto.getRandomValues(new Uint8Array(32));
    try { return await importDek(raw); } finally { raw.fill(0); }
  }

  const PASSWORD_KDF = Object.freeze({ name: "Argon2id", timeCost: 3, memoryKiB: 65536, parallelism: 1, saltBytes: 16 });

  function assertNewPassword(password) {
    if (typeof password !== "string" || password.length < 8) throw new Error("Mật khẩu cần có ít nhất 8 ký tự.");
  }

  async function derivePasswordKek(password, config) {
    assertCrypto();
    if (typeof password !== "string") throw new Error("Mật khẩu không hợp lệ.");
    if (config && config.name === "PBKDF2-SHA-256") {
      if (!Number.isInteger(config.iterations) || config.iterations < 310000 || config.iterations > 2000000 || !(config.salt instanceof Uint8Array) || config.salt.byteLength !== 16) throw new Error("Thông số KDF không hợp lệ hoặc vượt giới hạn.");
      const material = await webcrypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
      return webcrypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: config.salt, iterations: config.iterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }
    if (!config || config.name !== "Argon2id" || !Number.isInteger(config.timeCost) || config.timeCost < 1 || config.timeCost > 10 || !Number.isInteger(config.memoryKiB) || config.memoryKiB < 8192 || config.memoryKiB > 262144 || !Number.isInteger(config.parallelism) || config.parallelism < 1 || config.parallelism > 4 || !(config.salt instanceof Uint8Array) || config.salt.byteLength !== 16 || !root.hashwasm?.argon2id) throw new Error("Thông số Argon2id không hợp lệ hoặc thư viện chưa sẵn sàng.");
    const raw = await root.hashwasm.argon2id({ password, salt: config.salt, iterations: config.timeCost, memorySize: config.memoryKiB, parallelism: config.parallelism, hashLength: 32, outputType: "binary" });
    try { return await importDek(raw); } finally { raw.fill(0); }
  }

  async function bip39() {
    const [library, words] = await Promise.all([
      import(root.document ? "/node_modules/@scure/bip39/index.js" : "@scure/bip39"),
      import(root.document ? "/node_modules/@scure/bip39/wordlists/english.js" : "@scure/bip39/wordlists/english.js")
    ]);
    return { ...library, wordlist: words.wordlist };
  }
  const normalizePhrase = (phrase) => String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  async function phraseEntropy(phrase) {
    const library = await bip39();
    const normalized = normalizePhrase(phrase);
    if (normalized.split(" ").length !== 24 || !library.validateMnemonic(normalized, library.wordlist)) throw new Error("Cụm 24 từ recovery không hợp lệ.");
    return library.mnemonicToEntropy(normalized, library.wordlist);
  }
  async function recoveryDigest(phrase, salt) {
    assertCrypto();
    const entropy = await phraseEntropy(phrase);
    const input = new Uint8Array(salt.length + entropy.length); input.set(salt); input.set(entropy, salt.length);
    try { return new Uint8Array(await webcrypto.subtle.digest("SHA-256", input)); } finally { entropy.fill(0); input.fill(0); }
  }
  async function deriveRecoveryKek(phrase, salt) {
    assertCrypto();
    const entropy = await phraseEntropy(phrase);
    try {
      const rootKey = await webcrypto.subtle.importKey("raw", entropy, "HKDF", false, ["deriveKey"]);
      return webcrypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("sotay:v1:recovery-kek") }, rootKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    } finally { entropy.fill(0); }
  }

  async function createPasswordVault(password) {
    assertCrypto();
    assertNewPassword(password);
    const vaultId = webcrypto.randomUUID();
    const raw = webcrypto.getRandomValues(new Uint8Array(32));
    const passwordKdf = { name: PASSWORD_KDF.name, timeCost: PASSWORD_KDF.timeCost, memoryKiB: PASSWORD_KDF.memoryKiB, parallelism: PASSWORD_KDF.parallelism, salt: webcrypto.getRandomValues(new Uint8Array(16)) };
    const recoveryVerifierSalt = webcrypto.getRandomValues(new Uint8Array(16));
    const recoveryWrapSalt = webcrypto.getRandomValues(new Uint8Array(16));
    const library = await bip39();
    const phrase = library.generateMnemonic(library.wordlist, 256);
    try {
      const [dek, kek, recoveryKek, verifierDigest] = await Promise.all([importDek(raw), derivePasswordKek(password, passwordKdf), deriveRecoveryKek(phrase, recoveryWrapSalt), recoveryDigest(phrase, recoveryVerifierSalt)]);
      const [passwordWrappedDek, recoveryWrappedDek] = await Promise.all([seal(raw, kek, aad("password-wrapped-dek", { vaultId })), seal(raw, recoveryKek, aad("recovery-wrapped-dek", { vaultId }))]);
      return { dek, phrase, meta: { key: "meta", version: 1, cryptoSuite: "AES-256-GCM+Argon2id+BIP39-HKDF", vaultId, passwordKdf, passwordWrappedDek, recoveryVerifier: { algorithm: "SHA-256", salt: recoveryVerifierSalt, digest: verifierDigest, words: 24 }, recoveryKdf: { name: "HKDF-SHA-256", salt: recoveryWrapSalt }, recoveryWrappedDek, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
    } finally { raw.fill(0); }
  }

  async function verifyRecoveryPhrase(meta, phrase) {
    try {
      const candidate = await recoveryDigest(phrase, meta.recoveryVerifier.salt);
      let different = candidate.length ^ meta.recoveryVerifier.digest.length;
      for (let index = 0; index < Math.min(candidate.length, meta.recoveryVerifier.digest.length); index += 1) different |= candidate[index] ^ meta.recoveryVerifier.digest[index];
      candidate.fill(0); return different === 0;
    } catch { return false; }
  }
  async function openRecoveryDekBytes(source, phrase) {
    try {
      const recoveryKek = await deriveRecoveryKek(phrase, source.recoveryKdf.salt);
      return await openBytes(source.recoveryWrappedDek, recoveryKek, aad("recovery-wrapped-dek", { vaultId: source.vaultId }));
    } catch {
      throw new Error("24 từ Recovery không đúng.");
    }
  }
  async function restoreWithRecovery(meta, phrase, newPassword) {
    assertNewPassword(newPassword);
    const raw = await openRecoveryDekBytes(meta, phrase);
    const passwordKdf = { name: "Argon2id", timeCost: 3, memoryKiB: 65536, parallelism: 1, salt: webcrypto.getRandomValues(new Uint8Array(16)) };
    try {
      const [dek, passwordKek] = await Promise.all([importDek(raw), derivePasswordKek(newPassword, passwordKdf)]);
      const passwordWrappedDek = await seal(raw, passwordKek, aad("password-wrapped-dek", { vaultId: meta.vaultId }));
      const restoredMeta = { ...meta, passwordKdf, passwordWrappedDek, updatedAt: new Date().toISOString() };
      delete restoredMeta.biometric;
      return { dek, meta: restoredMeta };
    } finally { raw.fill(0); }
  }
  async function restoreFromRecoverySource(source, phrase, newPassword) {
    assertNewPassword(newPassword);
    const raw = await openRecoveryDekBytes(source, phrase);
    const passwordKdf = { name: "Argon2id", timeCost: 3, memoryKiB: 65536, parallelism: 1, salt: webcrypto.getRandomValues(new Uint8Array(16)) };
    const verifierSalt = webcrypto.getRandomValues(new Uint8Array(16));
    try {
      const [dek, passwordKek, digest] = await Promise.all([importDek(raw), derivePasswordKek(newPassword, passwordKdf), recoveryDigest(phrase, verifierSalt)]);
      return { dek, meta: { key: "meta", version: 1, cryptoSuite: "AES-256-GCM+Argon2id+BIP39-HKDF", vaultId: source.vaultId, passwordKdf, passwordWrappedDek: await seal(raw, passwordKek, aad("password-wrapped-dek", { vaultId: source.vaultId })), recoveryVerifier: { algorithm: "SHA-256", salt: verifierSalt, digest, words: 24 }, recoveryKdf: source.recoveryKdf, recoveryWrappedDek: source.recoveryWrappedDek, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
    } finally { raw.fill(0); }
  }
  async function changePassword(meta, currentPassword, newPassword, newPasswordConfirm) {
    let raw;
    try {
      const dekKek = await derivePasswordKek(currentPassword, meta.passwordKdf);
      raw = await openBytes(meta.passwordWrappedDek, dekKek, aad("password-wrapped-dek", { vaultId: meta.vaultId }));
    } catch {
      throw new Error("Mật khẩu hiện tại không đúng.");
    }
    const passwordKdf = { name: "Argon2id", timeCost: 3, memoryKiB: 65536, parallelism: 1, salt: webcrypto.getRandomValues(new Uint8Array(16)) };
    try {
      assertNewPassword(newPassword);
      if (newPasswordConfirm !== undefined && newPassword !== newPasswordConfirm) throw new Error("Hai mật khẩu mới chưa khớp.");
      const newKek = await derivePasswordKek(newPassword, passwordKdf);
      const changedMeta = { ...meta, passwordKdf, passwordWrappedDek: await seal(raw, newKek, aad("password-wrapped-dek", { vaultId: meta.vaultId })), updatedAt: new Date().toISOString() };
      // The biometric wrapper protects the old password, so changing the password
      // deliberately disables it until the user enrolls again.
      delete changedMeta.biometric;
      return changedMeta;
    } finally { raw.fill(0); }
  }
  function biometricRuntimeContext() {
    const standalone = root.matchMedia?.("(display-mode: standalone)")?.matches || root.navigator?.standalone === true;
    return {
      hostname: root.location?.hostname || "không xác định",
      mode: standalone ? "Ứng dụng Màn hình chính" : "trình duyệt",
      userAgent: root.navigator?.userAgent || "không xác định"
    };
  }

  async function getBiometricSupport() {
    const context = biometricRuntimeContext();
    if (!root.isSecureContext) {
      return { supported: false, code: "insecure-context", message: "Trang chưa chạy trong ngữ cảnh HTTPS an toàn.", context };
    }
    if (!root.PublicKeyCredential || !root.navigator?.credentials) {
      return { supported: false, code: "webauthn-unavailable", message: "WebAuthn không khả dụng trong trình duyệt hiện tại.", context };
    }
    if (typeof root.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
      return { supported: false, code: "platform-check-unavailable", message: "Trình duyệt không cung cấp phép kiểm tra khóa màn hình hệ thống.", context };
    }
    try {
      if (!await root.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
        return { supported: false, code: "platform-authenticator-unavailable", message: "iOS không báo có khóa màn hình dùng được cho WebAuthn. Hãy kiểm tra mật mã, Face ID, Tự động điền mật khẩu và Chuỗi khóa iCloud.", context };
      }
      if (typeof root.PublicKeyCredential.getClientCapabilities === "function") {
        const capabilities = await root.PublicKeyCredential.getClientCapabilities();
        if (capabilities?.["extension:prf"] !== true) {
          return { supported: false, code: "prf-unavailable", message: "Safari/WebKit hiện tại không báo hỗ trợ WebAuthn PRF, tính năng cần để bảo vệ mật khẩu Két.", context };
        }
      }
      // Older clients cannot advertise extension support, so enrollment remains
      // the final capability probe.
      return { supported: true, code: "supported", message: "Thiết bị hỗ trợ mở nhanh bằng khóa màn hình.", context };
    } catch (error) {
      return {
        supported: false,
        code: "capability-check-failed",
        message: `WebKit không hoàn tất được phép kiểm tra khóa màn hình (${error?.name || "Error"}).`,
        context
      };
    }
  }

  async function supportsBiometric() {
    return (await getBiometricSupport()).supported;
  }
  const biometricSupportMessage = () => "Thiết bị hoặc trình duyệt hiện tại chưa hỗ trợ tính năng mở nhanh bằng khóa màn hình. Bạn vẫn có thể mở Két bằng mật khẩu.";
  function biometricOperationError(error) {
    if (error?.name === "NotAllowedError" || error?.name === "AbortError") return new Error("Xác thực bằng khóa màn hình đã bị hủy hoặc hết thời gian. Hãy thử lại.");
    if (error?.name === "SecurityError") return new Error("Không thể dùng khóa màn hình trên kết nối hoặc tên miền hiện tại.");
    return error instanceof Error ? error : new Error("Không thể xác thực bằng khóa màn hình thiết bị.");
  }
  function prfResult(credential) { return credential.getClientExtensionResults()?.prf?.results?.first; }
  async function biometricPrf(credentialId, salt) {
    let credential;
    try { credential = await root.navigator.credentials.get({ publicKey: { challenge: webcrypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: credentialId }], userVerification: "required", timeout: 60000, extensions: { prf: { eval: { first: salt } } } } }); }
    catch (error) { throw biometricOperationError(error); }
    const output = credential && prfResult(credential);
    if (!output || output.byteLength !== 32) throw new Error(biometricSupportMessage());
    return new Uint8Array(output);
  }
  async function enrollBiometric(meta, password) {
    if (!await supportsBiometric()) throw new Error(biometricSupportMessage());
    const passwordKek = await derivePasswordKek(password, meta.passwordKdf);
    let verifiedDek;
    try { verifiedDek = await openBytes(meta.passwordWrappedDek, passwordKek, aad("password-wrapped-dek", { vaultId: meta.vaultId })); }
    catch { throw new Error("Mật khẩu hiện tại không đúng."); }
    finally { if (verifiedDek) verifiedDek.fill(0); }
    const prfSalt = webcrypto.getRandomValues(new Uint8Array(32));
    let credential;
    try { credential = await root.navigator.credentials.create({ publicKey: { challenge: webcrypto.getRandomValues(new Uint8Array(32)), rp: { name: "Sổ tay Lịch Việt" }, user: { id: encoder.encode(meta.vaultId), name: meta.vaultId, displayName: "Két dữ liệu local" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }], authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", requireResidentKey: true, userVerification: "required" }, attestation: "none", timeout: 60000, extensions: { prf: { eval: { first: prfSalt } } } } }); }
    catch (error) { throw biometricOperationError(error); }
    if (!credential) throw new Error("Không tạo được khóa sinh trắc học.");
    const credentialId = new Uint8Array(credential.rawId);
    let output = prfResult(credential);
    output = output ? new Uint8Array(output) : await biometricPrf(credentialId, prfSalt);
    const passwordBytes = encoder.encode(password);
    try {
      const kek = await importDek(output);
      return { ...meta, biometric: { version: 2, credentialId, prfSalt, wrappedPassword: await seal(passwordBytes, kek, aad("biometric-wrapped-password", { vaultId: meta.vaultId })) }, updatedAt: new Date().toISOString() };
    } finally { output.fill(0); passwordBytes.fill(0); }
  }
  async function unlockBiometric(meta) {
    if (!meta.biometric || meta.biometric.version !== 2 || !meta.biometric.wrappedPassword) throw new Error("Sinh trắc học cần được bật lại bằng mật khẩu hiện tại.");
    const output = await biometricPrf(meta.biometric.credentialId, meta.biometric.prfSalt);
    let passwordBytes;
    try {
      const kek = await importDek(output);
      passwordBytes = await openBytes(meta.biometric.wrappedPassword, kek, aad("biometric-wrapped-password", { vaultId: meta.vaultId }));
      return await unlockPasswordVault(meta, decoder.decode(passwordBytes));
    } finally { output.fill(0); if (passwordBytes) passwordBytes.fill(0); }
  }

  async function unlockPasswordVault(meta, password) {
    const kek = await derivePasswordKek(password, meta && meta.passwordKdf);
    let raw;
    try {
      raw = await openBytes(meta.passwordWrappedDek, kek, aad("password-wrapped-dek", { vaultId: meta.vaultId }));
      return await importDek(raw);
    } catch {
      throw new Error("Mật khẩu không đúng hoặc metadata két đã hỏng.");
    } finally {
      if (raw) raw.fill(0);
    }
  }
  async function upgradeLegacyVaultRecovery(meta, password) {
    if (meta.recoveryWrappedDek) return { meta, dek: await unlockPasswordVault(meta, password), phrase: null };
    const passwordKek = await derivePasswordKek(password, meta.passwordKdf);
    let raw;
    try { raw = await openBytes(meta.passwordWrappedDek, passwordKek, aad("password-wrapped-dek", { vaultId: meta.vaultId })); }
    catch { throw new Error("Mật khẩu không đúng."); }
    const library = await bip39(); const phrase = library.generateMnemonic(library.wordlist, 256);
    const verifierSalt = webcrypto.getRandomValues(new Uint8Array(16)); const wrapSalt = webcrypto.getRandomValues(new Uint8Array(16));
    const passwordKdf = { name: "Argon2id", timeCost: 3, memoryKiB: 65536, parallelism: 1, salt: webcrypto.getRandomValues(new Uint8Array(16)) };
    try {
      const [dek, recoveryKek, digest, newPasswordKek] = await Promise.all([importDek(raw), deriveRecoveryKek(phrase, wrapSalt), recoveryDigest(phrase, verifierSalt), derivePasswordKek(password, passwordKdf)]);
      const [passwordWrappedDek, recoveryWrappedDek] = await Promise.all([seal(raw, newPasswordKek, aad("password-wrapped-dek", { vaultId: meta.vaultId })), seal(raw, recoveryKek, aad("recovery-wrapped-dek", { vaultId: meta.vaultId }))]);
      const upgraded = { ...meta, cryptoSuite: "AES-256-GCM+Argon2id+BIP39-HKDF", passwordKdf, passwordWrappedDek, recoveryVerifier: { algorithm: "SHA-256", salt: verifierSalt, digest, words: 24 }, recoveryKdf: { name: "HKDF-SHA-256", salt: wrapSalt }, recoveryWrappedDek, updatedAt: new Date().toISOString() };
      return { meta: upgraded, dek, phrase };
    } finally { raw.fill(0); }
  }

  async function seal(value, key, additionalData) {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const plaintext = value instanceof Uint8Array ? value : encoder.encode(canonicalize(value));
    try {
      const ciphertext = await webcrypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData }, key, plaintext
      );
      return { version: SCHEMA_VERSION, iv, ciphertext };
    } finally {
      if (!(value instanceof Uint8Array)) plaintext.fill(0);
    }
  }

  async function openBytes(box, key, additionalData) {
    if (!box || box.version !== SCHEMA_VERSION || !(box.iv instanceof Uint8Array) || box.iv.byteLength !== 12) {
      throw new Error("Invalid cipher box.");
    }
    return new Uint8Array(await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv: box.iv, additionalData }, key, box.ciphertext
    ));
  }

  async function openJson(box, key, additionalData) {
    const raw = await openBytes(box, key, additionalData);
    try { return JSON.parse(decoder.decode(raw)); } finally { raw.fill(0); }
  }

  function eventSchedule(source) {
    return {
      date: source.date,
      month: source.month || String(source.date || "").slice(0, 7),
      time: source.time || null,
      allDay: source.allDay !== false,
      calendarLabel: source.calendarLabel || "solar",
      lunar: source.lunar || null,
      repeat: source.repeat || { frequency: "none", calendar: source.calendarLabel || "solar", interval: 1, until: null },
      reminders: Array.isArray(source.reminders) ? source.reminders : [],
      notificationEnabled: Array.isArray(source.reminders) && source.reminders.some((item) => item && item.enabled !== false),
      showContentInNotification: source.showContentInNotification === true
    };
  }

  async function authenticateSchedule(dek, vaultId, id, revision, kind, schedule) {
    return seal(new Uint8Array(0), dek, aad("schedule-auth", { vaultId, id, revision, kind, schedule }));
  }

  async function verifySchedule(dek, vaultId, record) {
    const raw = await openBytes(record.scheduleAuth, dek, aad("schedule-auth", {
      vaultId, id: record.id, revision: record.revision, kind: record.kind, schedule: record.schedule
    }));
    try {
      if (raw.byteLength !== 0) throw new Error("Invalid schedule authentication payload.");
      return true;
    } finally { raw.fill(0); }
  }

  async function encryptEvent(dek, vaultId, source, revision) {
    const schedule = eventSchedule(source);
    const context = { vaultId, id: source.id, revision, kind: "event" };
    const [scheduleAuth, listCipher, detailCipher] = await Promise.all([
      authenticateSchedule(dek, vaultId, source.id, revision, "event", schedule),
      seal({ title: source.title || "", eventType: source.eventType || "other", eventTypeId: source.eventTypeId || "general", color: source.color || "red" }, dek, aad("list", context)),
      seal({ note: source.note || "", createdAt: source.createdAt || null }, dek, aad("detail", context))
    ]);
    return { schemaVersion: SCHEMA_VERSION, kind: "event", id: source.id, revision, deleted: false, updatedAt: source.updatedAt || new Date().toISOString(), schedule, scheduleAuth, listCipher, detailCipher };
  }

  async function decryptEvent(dek, vaultId, record) {
    await verifySchedule(dek, vaultId, record);
    const context = { vaultId, id: record.id, revision: record.revision, kind: "event" };
    const [list, detail] = await Promise.all([
      openJson(record.listCipher, dek, aad("list", context)), openJson(record.detailCipher, dek, aad("detail", context))
    ]);
    return { id: record.id, ...record.schedule, ...list, ...detail, updatedAt: record.updatedAt };
  }

  async function encryptJournal(dek, vaultId, source, revision) {
    const schedule = { date: source.date, month: source.month || String(source.date || "").slice(0, 7) };
    const context = { vaultId, id: source.id, revision, kind: "journal" };
    const [scheduleAuth, listCipher, detailCipher] = await Promise.all([
      authenticateSchedule(dek, vaultId, source.id, revision, "journal", schedule),
      seal({ title: source.title || "", eventTypeId: source.eventTypeId || "general" }, dek, aad("list", context)),
      seal({ text: source.text || "", imageIds: Array.isArray(source.imageIds) ? source.imageIds : [], createdAt: source.createdAt || null }, dek, aad("detail", context))
    ]);
    return { schemaVersion: SCHEMA_VERSION, kind: "journal", id: source.id, revision, deleted: false, updatedAt: source.updatedAt || new Date().toISOString(), schedule, scheduleAuth, listCipher, detailCipher };
  }

  async function decryptJournal(dek, vaultId, record) {
    await verifySchedule(dek, vaultId, record);
    const context = { vaultId, id: record.id, revision: record.revision, kind: "journal" };
    const [list, detail] = await Promise.all([
      openJson(record.listCipher, dek, aad("list", context)), openJson(record.detailCipher, dek, aad("detail", context))
    ]);
    return { id: record.id, ...record.schedule, ...list, ...detail, updatedAt: record.updatedAt };
  }

  async function encryptAttachment(dek, vaultId, source, revision) {
    const bytes = source.blob instanceof Blob ? new Uint8Array(await source.blob.arrayBuffer()) : new Uint8Array(source.bytes || []);
    const context = { vaultId, id: source.id, revision, kind: "attachment", chunkIndex: 0 };
    try {
      const [metaCipher, dataCipher, digest] = await Promise.all([
        seal({ mimeType: source.mimeType || source.blob?.type || "application/octet-stream", width: source.width ?? null, height: source.height ?? null, createdAt: source.createdAt || null }, dek, aad("attachment-meta", context)),
        seal(bytes, dek, aad("attachment-chunk", context)),
        webcrypto.subtle.digest("SHA-256", bytes)
      ]);
      return { schemaVersion: SCHEMA_VERSION, kind: "attachment", id: source.id, revision, size: bytes.byteLength, sha256: new Uint8Array(digest), metaCipher, chunks: [{ index: 0, size: bytes.byteLength, box: dataCipher }] };
    } finally { bytes.fill(0); }
  }

  async function decryptAttachment(dek, vaultId, record) {
    if (!record || !Array.isArray(record.chunks) || record.chunks.length !== 1) throw new Error("Unsupported attachment layout.");
    const context = { vaultId, id: record.id, revision: record.revision, kind: "attachment", chunkIndex: 0 };
    const [meta, bytes] = await Promise.all([
      openJson(record.metaCipher, dek, aad("attachment-meta", context)),
      openBytes(record.chunks[0].box, dek, aad("attachment-chunk", context))
    ]);
    if (bytes.byteLength !== record.size) { bytes.fill(0); throw new Error("Attachment size mismatch."); }
    const digest = new Uint8Array(await webcrypto.subtle.digest("SHA-256", bytes));
    let different = digest.length ^ record.sha256.length;
    for (let index = 0; index < Math.min(digest.length, record.sha256.length); index += 1) different |= digest[index] ^ record.sha256[index];
    digest.fill(0);
    if (different) { bytes.fill(0); throw new Error("Attachment digest mismatch."); }
    return { ...meta, id: record.id, bytes };
  }

  return { SCHEMA_VERSION, PASSWORD_KDF, canonicalize, aad, importDek, createSessionDek, createPasswordVault, unlockPasswordVault, upgradeLegacyVaultRecovery, verifyRecoveryPhrase, restoreWithRecovery, restoreFromRecoverySource, changePassword, getBiometricSupport, supportsBiometric, enrollBiometric, unlockBiometric, seal, openBytes, openJson, eventSchedule, authenticateSchedule, verifySchedule, encryptEvent, decryptEvent, encryptJournal, decryptJournal, encryptAttachment, decryptAttachment };
});
