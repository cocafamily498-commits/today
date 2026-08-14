(function () {
  "use strict";
  let session = null;
  let database = null;
  let gateKeydownHandler = null;
  let passwordEstimator = null;

  const txDone = (tx) => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  async function readMeta() { const tx = database.transaction("zk_vault_v1", "readonly"); return new Promise((resolve, reject) => { const request = tx.objectStore("zk_vault_v1").get("meta"); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
  async function writeMeta(meta) { const tx = database.transaction("zk_vault_v1", "readwrite"); tx.objectStore("zk_vault_v1").put(meta); await txDone(tx); }
  async function cancelUnfinishedVault() {
    const stores = ["zk_vault_v1", "zk_events_v1", "zk_journals_v1", "zk_attachments_v1", "zk_migrations_v1"];
    const tx = database.transaction(stores, "readwrite");
    stores.forEach((storeName) => tx.objectStore(storeName).clear());
    await txDone(tx);
    session = null;
  }
  async function hasLegacyPlaintext() {
    const stores = ["events", "journals", "images"];
    const tx = database.transaction(stores, "readonly");
    const counts = await Promise.all(stores.map((storeName) => new Promise((resolve, reject) => {
      const request = tx.objectStore(storeName).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })));
    return counts.some((count) => count > 0);
  }
  async function discardPreRecoveryTestVault(meta) {
    if (!meta || meta.recoveryWrappedDek) return false;
    const stores = ["zk_vault_v1", "zk_events_v1", "zk_journals_v1", "zk_attachments_v1", "zk_migrations_v1"];
    const tx = database.transaction(stores, "readwrite");
    stores.forEach((storeName) => tx.objectStore(storeName).clear());
    await txDone(tx);
    return true;
  }
  const root = () => document.getElementById("appRoot");
  const status = (message = "") => { const node = document.getElementById("vaultGateStatus"); if (node) node.textContent = message; };
  function getPasswordEstimator() {
    if (passwordEstimator) return passwordEstimator;
    const core = window.zxcvbnts?.core;
    const common = window.zxcvbnts?.["language-common"];
    if (!core?.ZxcvbnFactory || !common?.dictionary?.["passwords-common"]) return null;
    passwordEstimator = new core.ZxcvbnFactory({
      dictionary: { "passwords-common": common.dictionary["passwords-common"] },
      graphs: common.adjacencyGraphs
    });
    return passwordEstimator;
  }
  function passwordInput({ id, name, label, autocomplete, isNew = false, autofocus = false }) {
    const requirements = isNew ? `<p class="vault-password-help" id="${id}Help">Tối thiểu 8 ký tự. Nên dùng một cụm từ dài, riêng biệt và khó đoán.</p><div class="vault-password-strength" data-password-strength-for="${id}" data-level="empty" role="status" aria-live="polite"><span class="vault-password-strength-bar"><i></i></span><span class="vault-password-strength-label">Chưa nhập mật khẩu</span></div>` : "";
    return `<div class="vault-password-field"><label for="${id}">${label}</label><div class="vault-password-input"><input id="${id}" name="${name}" type="password"${isNew ? ` minlength="8" aria-describedby="${id}Help"` : ""} autocomplete="${autocomplete}" required${autofocus ? " autofocus" : ""}><button class="vault-password-toggle" type="button" aria-label="Hiện mật khẩu" title="Hiện mật khẩu" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/><path class="vault-password-eye-slash" d="m4 4 16 16"/></svg></button></div>${requirements}</div>`;
  }
  function passwordStrength(password) {
    if (!password) return { level: "empty", label: "Chưa nhập mật khẩu" };
    if (password.length < 8) return { level: "weak", label: "Yếu — cần ít nhất 8 ký tự" };
    const estimatedScore = getPasswordEstimator()?.check(password).score ?? 0;
    const lengthCap = password.length < 12 ? 1 : password.length < 16 ? 2 : password.length < 20 ? 3 : 4;
    const score = Math.min(estimatedScore, lengthCap);
    if (score <= 1) return { level: "weak", label: "Yếu — cụm từ phổ biến hoặc dễ đoán" };
    if (score === 2) return { level: "medium", label: "Trung bình" };
    if (score === 3) return { level: "strong", label: "Mạnh" };
    return { level: "very-strong", label: "Rất mạnh" };
  }
  function setupPasswordControls(container) {
    container.querySelectorAll(".vault-password-toggle").forEach((button) => {
      const input = button.closest(".vault-password-input")?.querySelector("input");
      if (!input) return;
      button.onclick = () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-pressed", String(show));
        button.classList.toggle("is-visible", show);
        button.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
        button.title = show ? "Ẩn mật khẩu" : "Hiện mật khẩu";
        input.focus({ preventScroll: true });
      };
    });
    container.querySelectorAll("[data-password-strength-for]").forEach((meter) => {
      const input = container.querySelector(`#${meter.dataset.passwordStrengthFor}`);
      const update = () => {
        const result = passwordStrength(input?.value || "");
        meter.dataset.level = result.level;
        meter.querySelector(".vault-password-strength-label").textContent = result.label;
      };
      input?.addEventListener("input", update);
      update();
    });
  }
  async function finishSession(resolve) {
    if (!session?.dek || !window.LichVietZkRepository) throw new Error("Không thể kích hoạt kho dữ liệu mã hóa.");
    status("Đang kiểm tra dữ liệu local cũ…");
    await window.LichVietZkMigration.runMigration(database, session.dek, session.meta.vaultId, { batchSize: 20 });
    window.LichVietZkRepository.activate(database, session);
    resolve(session);
  }

  function shell(title, copy, content, modifier = "") {
    if (gateKeydownHandler) {
      document.removeEventListener("keydown", gateKeydownHandler);
      gateKeydownHandler = null;
    }
    root().innerHTML = `<section class="vault-gate${modifier ? ` ${modifier}` : ""}" aria-labelledby="vaultGateTitle"><div class="vault-gate-mark" aria-hidden="true">⌾</div><h1 id="vaultGateTitle">${title}</h1><p>${copy}</p>${content}<p id="vaultGateStatus" class="vault-gate-status" role="alert" aria-live="polite"></p></section>`;
    setupPasswordControls(root());
  }
  function firstUse(resolve) {
    shell("Bảo vệ dữ liệu của bạn", "Tạo một két mới hoặc mang két đã mã hóa từ thiết bị khác sang.", `<div class="vault-choice-grid"><button id="createVaultChoice" type="button"><strong>Tạo két mới</strong><span>Tạo mật khẩu và nhận 24 từ recovery</span></button><button id="restoreVaultChoice" type="button"><strong>Chuyển từ thiết bị khác</strong><span>Dùng backup mã hóa và 24 từ recovery</span></button></div>`);
    document.getElementById("createVaultChoice").onclick = () => renderCreate(resolve);
    document.getElementById("restoreVaultChoice").onclick = () => renderDeviceRestore(resolve);
  }
  function renderLegacyUpgrade(resolve) {
    shell(
      "Dữ liệu của bạn cần được bảo vệ",
      "Ứng dụng phát hiện dữ liệu được tạo bởi phiên bản cũ và chưa được mã hóa. Hãy tạo két để ứng dụng mã hóa, xác minh và bảo vệ dữ liệu hiện có của bạn.",
      `<div class="vault-legacy-actions"><div class="vault-legacy-notice"><strong>Nâng cấp an toàn</strong><span>Không đóng ứng dụng trong lúc nâng cấp. Dữ liệu cũ chỉ bị xóa sau khi bản mã hóa đã được kiểm tra thành công.</span></div><button id="confirmLegacyUpgrade" type="button">OK, tạo két bảo mật</button></div>`,
      "vault-gate-legacy"
    );
    const panel = root().querySelector(".vault-gate-legacy");
    const close = document.createElement("button");
    close.className = "vault-gate-close";
    close.type = "button";
    close.setAttribute("aria-label", "Thoát ứng dụng");
    close.title = "Thoát ứng dụng";
    close.textContent = "×";
    panel.prepend(close);
    const exitApp = () => {
      if (gateKeydownHandler) {
        document.removeEventListener("keydown", gateKeydownHandler);
        gateKeydownHandler = null;
      }
      window.close();
      setTimeout(() => renderExitedApp(), 50);
    };
    close.onclick = exitApp;
    gateKeydownHandler = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      exitApp();
    };
    document.addEventListener("keydown", gateKeydownHandler);
    document.getElementById("confirmLegacyUpgrade").onclick = () => renderCreate(resolve, { legacyUpgrade: true });
  }
  function renderExitedApp() {
    shell(
      "Ứng dụng đã thoát",
      "Dữ liệu của bạn vẫn được giữ nguyên và chưa được ứng dụng mở. Bạn có thể đóng tab hoặc cửa sổ này.",
      "",
      "vault-gate-exited"
    );
  }
  function passwordFields(confirm = true) {
    return `${passwordInput({ id: "vaultPassword", name: "password", label: "Mật khẩu két", autocomplete: "new-password", isNew: true })}${confirm ? passwordInput({ id: "vaultPasswordConfirm", name: "passwordConfirm", label: "Nhập lại mật khẩu", autocomplete: "new-password" }) : ""}`;
  }
  function renderCreate(resolve, options = {}) {
    const legacyUpgrade = options.legacyUpgrade === true;
    const title = legacyUpgrade ? "Tạo két để mã hóa dữ liệu cũ" : "Tạo két dữ liệu riêng tư";
    const submitLabel = legacyUpgrade ? "Tạo két và mã hóa dữ liệu" : "Tạo két mới";
    shell(title, "Sau bước này bạn sẽ nhận 24 từ recovery chỉ hiển thị một lần.", `<form id="vaultGateForm">${passwordFields()}<button type="submit">${submitLabel}</button><button class="vault-link" id="vaultBack" type="button">Quay lại</button></form>`);
    const back = document.getElementById("vaultBack");
    back.onclick = () => legacyUpgrade ? renderLegacyUpgrade(resolve) : firstUse(resolve);
    document.getElementById("vaultGateForm").onsubmit = async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); button.disabled = true;
      try {
        if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu chưa khớp.");
        status("Đang tạo khóa Argon2id trên thiết bị…");
        const created = await window.LichVietZkCrypto.createPasswordVault(form.password.value);
        session = { meta: created.meta, dek: created.dek };
        renderRecovery(created.phrase, resolve, { legacyUpgrade });
      } catch (error) { status(error.message); button.disabled = false; }
    };
  }
  function renderRecovery(phrase, resolve, options = {}) {
    const words = phrase.split(" ").map((word, index) => `<span><b>${String(index + 1).padStart(2, "0")}</b>${word}</span>`).join("");
    shell("Lưu 24 từ recovery", "Chép và cất ở nơi an toàn. Ứng dụng không lưu cụm từ này và không thể cấp lại.", `<div class="recovery-grid">${words}</div><label class="vault-confirm"><input id="recoverySaved" type="checkbox"> Tôi đã chép và kiểm tra đủ 24 từ</label><div class="vault-row"><button id="copyRecovery" type="button">Sao chép</button><button id="finishRecovery" type="button" disabled>Tiếp tục</button></div><button id="recoveryBack" class="vault-link" type="button">Quay lại</button>`);
    document.getElementById("copyRecovery").onclick = () => navigator.clipboard.writeText(phrase);
    document.getElementById("recoverySaved").onchange = (event) => { document.getElementById("finishRecovery").disabled = !event.target.checked; };
    document.getElementById("recoveryBack").onclick = async () => {
      try {
        status("Đang hủy két chưa hoàn tất…");
        if (options.previousMeta) {
          await writeMeta(options.previousMeta);
          session = null;
          renderLogin(options.previousMeta, resolve);
        } else {
          await cancelUnfinishedVault();
          if (options.legacyUpgrade) renderLegacyUpgrade(resolve);
          else firstUse(resolve);
        }
      } catch (error) { status(error.message || "Không thể quay lại an toàn."); }
    };
    document.getElementById("finishRecovery").onclick = async () => {
      const button = document.getElementById("finishRecovery");
      button.disabled = true;
      try {
        status("Đang hoàn tất két và bảo vệ dữ liệu…");
        await writeMeta(session.meta);
        await finishSession(resolve);
      } catch (error) {
        status(error.message || "Không thể hoàn tất két an toàn.");
        button.disabled = false;
      }
    };
  }
  function renderDeviceRestore(resolve) {
    shell("Chuyển két từ thiết bị khác", "Chọn file ZIP backup két mã hóa, nhập 24 từ recovery và tạo mật khẩu cho thiết bị này.", `<form id="vaultGateForm"><div class="vault-backup-field"><span class="vault-backup-label">Backup két mã hóa (.zip)</span><input id="vaultBackupFile" name="backup" type="file" accept=".zip,application/zip" hidden><div class="vault-backup-sources"><button id="vaultBackupDevice" class="vault-source-button" type="button">File trên thiết bị</button><button id="vaultBackupDrive" class="vault-source-button" type="button">Google Drive</button></div><p id="vaultBackupSelection" class="vault-backup-selection" hidden></p><small class="vault-field-help">Chỉ nhận ZIP được tạo từ chức năng Backup két mã hóa.</small></div><label for="vaultRecovery">24 từ recovery</label><textarea id="vaultRecovery" name="recovery" rows="5" required></textarea>${passwordFields()}<button type="submit">Khôi phục két</button><button class="vault-link" id="vaultBack" type="button">Quay lại</button></form>`);
    let selectedBackupFile = null;
    const fileInput = document.getElementById("vaultBackupFile");
    const selection = document.getElementById("vaultBackupSelection");
    const setSelectedBackup = (file, sourceLabel) => {
      selectedBackupFile = file;
      selection.textContent = `${sourceLabel}: ${file.name}`;
      selection.hidden = false;
      status("");
    };
    document.getElementById("vaultBackupDevice").onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (file) setSelectedBackup(file, "Đã chọn");
    };
    document.getElementById("vaultBackupDrive").onclick = async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      let progress = null;
      try {
        if (!window.LichVietGoogleDrive) throw new Error("Chức năng Google Drive chưa sẵn sàng.");
        status("Đang kết nối với Google Drive…");
        await window.LichVietGoogleDrive.authorize();
        const files = await window.LichVietGoogleDrive.listBackups({ backupType: "encrypted-vault" });
        if (!files.length) throw new Error("Chưa có backup két mã hóa trên Google Drive.");
        const selected = await chooseGoogleDriveBackupFile(files, {
          title: "Chọn backup két mã hóa",
          description: "Chọn file ZIP backup két mã hóa trong thư mục <strong>Sổ tay lịch Việt</strong>:"
        });
        if (!selected) { status(""); return; }
        progress = openEventBackupProgressDialog("Đang tải backup két", "Đang chuẩn bị tải file từ Google Drive…");
        await waitForEventBackupProgressPaint();
        progress.update(35, "Đang tải backup két mã hóa…");
        const file = await window.LichVietGoogleDrive.downloadBackup(selected);
        progress.update(85, "Đang chuẩn bị file để xác minh…");
        setSelectedBackup(file, "Google Drive");
        progress.update(100, "Đã tải xong backup két mã hóa.");
        await new Promise((resolvePaint) => setTimeout(resolvePaint, 250));
      } catch (error) {
        status(error.message || "Không tải được backup két từ Google Drive.");
      } finally {
        if (progress) progress.close();
        button.disabled = false;
      }
    };
    document.getElementById("vaultBack").onclick = () => firstUse(resolve);
    document.getElementById("vaultGateForm").onsubmit = async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); button.disabled = true;
      let progress = null;
      try {
        if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu chưa khớp.");
        const file = selectedBackupFile;
        if (!file) throw new Error("Hãy chọn file ZIP backup két mã hóa.");
        if (!/\.zip$/i.test(file.name || "")) throw new Error("Chỉ chấp nhận file ZIP backup két mã hóa.");
        if (!window.isSecureContext || !window.crypto?.subtle) throw new Error("Android đang mở app qua HTTP LAN nên không cho phép Web Crypto. Hãy dùng HTTPS hoặc USB adb reverse rồi mở http://localhost:3000.");
        progress = openEventBackupProgressDialog("Đang khôi phục két", "Đang đọc file ZIP backup…");
        await waitForEventBackupProgressPaint();
        progress.update(15, "Đang kiểm tra cấu trúc ZIP…");
        const files = readEventBackupZip(await file.arrayBuffer());
        progress.update(30, "Đang kiểm tra manifest và attachment mã hóa…");
        const parsed = window.LichVietZkBackup.parseBackup(JSON.stringify(parseEncryptedVaultZip(files)));
        progress.update(48, "Đang xác thực 24 từ recovery và tạo khóa mới…");
        const restored = await window.LichVietZkCrypto.restoreFromRecoverySource(parsed, form.recovery.value, form.password.value);
        progress.update(68, "Đang xác minh toàn bộ bản ghi mã hóa…");
        await window.LichVietZkBackup.verifyBackup(parsed, restored.dek);
        progress.update(82, "Đang nhập dữ liệu vào két trên thiết bị…");
        await importCipherRecords(parsed.records, restored.meta, parsed.eventGroups);
        session = restored;
        progress.update(94, "Đang hoàn tất và mở két…");
        await finishSession(resolve);
        progress.update(100, "Khôi phục két thành công.");
      } catch (error) {
        status(error.message || "Không khôi phục được két.");
        button.disabled = false;
      } finally {
        if (progress) progress.close();
      }
    };
  }
  function parseEncryptedVaultZip(files) {
    const vaultBytes = files.get("vault.json");
    if (!vaultBytes) throw new Error("ZIP backup két mã hóa thiếu vault.json.");
    let packed;
    try { packed = JSON.parse(eventBackupTextDecoder.decode(vaultBytes)); }
    catch { throw new Error("vault.json trong ZIP không hợp lệ."); }
    const referenced = new Set(["vault.json"]);
    (packed.records || []).forEach((record) => {
      if (record?.kind !== "attachment") return;
      (record.chunks || []).forEach((chunk) => {
        const name = chunk?.box?.ciphertextFile;
        if (typeof name !== "string" || !/^attachments\/[0-9]{6}-[0-9]{4}\.bin$/.test(name) || referenced.has(name)) throw new Error("Tham chiếu attachment mã hóa không hợp lệ.");
        const bytes = files.get(name);
        if (!bytes) throw new Error(`ZIP thiếu attachment mã hóa ${name}.`);
        referenced.add(name);
        chunk.box.ciphertext = window.LichVietZkBackup.toBase64(bytes);
        delete chunk.box.ciphertextFile;
      });
    });
    if (files.size !== referenced.size || [...files.keys()].some((name) => !referenced.has(name))) throw new Error("ZIP backup két chứa file không được phép.");
    return packed;
  }
  async function importCipherRecords(records, meta, eventGroups = null) {
    const stores = ["zk_events_v1", "zk_journals_v1", "zk_attachments_v1", "zk_vault_v1", "events", "journals", "images", "settings"];
    const tx = database.transaction(stores, "readwrite");
    stores.slice(0, 3).forEach((storeName) => tx.objectStore(storeName).clear());
    const storeByKind = { event: stores[0], journal: stores[1], attachment: stores[2] };
    records.forEach((record) => {
      const storeName = storeByKind[record?.kind];
      if (!storeName) throw new Error("Backup chứa loại bản ghi không hợp lệ.");
      tx.objectStore(storeName).put(record);
    });
    tx.objectStore("zk_vault_v1").put(meta);
    stores.slice(4, 7).forEach((storeName) => tx.objectStore(storeName).clear());
    if (eventGroups) tx.objectStore("settings").put({ key: "eventGroups", value: eventGroups, updatedAt: new Date().toISOString() });
    else tx.objectStore("settings").delete("eventGroups");
    await txDone(tx);
  }
  function renderLogin(meta, resolve) {
    shell(meta.biometric ? "Mở két dữ liệu" : "Nhập mật khẩu", "Dữ liệu chỉ được giải mã trong phiên đang mở khóa.", `<form id="vaultGateForm">${passwordInput({ id: "vaultPassword", name: "password", label: "Mật khẩu két", autocomplete: "current-password", autofocus: true })}<button type="submit">Mở két</button></form>${meta.biometric ? `<button id="biometricLogin" type="button">Mở bằng sinh trắc học</button>` : ""}<button id="forgotVaultPassword" class="vault-link" type="button">Quên mật khẩu?</button>`);
    document.getElementById("vaultGateForm").onsubmit = async (event) => {
      event.preventDefault();
      status("Đang mở khóa…");
      const password = event.currentTarget.password.value;
      if (!meta.recoveryWrappedDek) {
        try {
          const upgraded = await window.LichVietZkCrypto.upgradeLegacyVaultRecovery(meta, password);
          session = { meta: upgraded.meta, dek: upgraded.dek };
          renderRecovery(upgraded.phrase, resolve, { previousMeta: meta });
        } catch { status("Mật khẩu không đúng."); }
        return;
      }
      try {
        session = { meta, dek: await window.LichVietZkCrypto.unlockPasswordVault(meta, password) };
      } catch {
        status("Mật khẩu không đúng.");
        return;
      }
      try { await finishSession(resolve); }
      catch (error) { status(error.message || "Không thể mở két dữ liệu."); }
    };
    if (meta.biometric) document.getElementById("biometricLogin").onclick = async () => { try { session = { meta, dek: await window.LichVietZkCrypto.unlockBiometric(meta) }; await finishSession(resolve); } catch (error) { status(error.message); } };
    document.getElementById("forgotVaultPassword").onclick = () => renderForgot(meta, resolve);
  }
  function renderForgot(meta, resolve) {
    shell("Đặt lại mật khẩu bằng recovery", "Nhập đúng 24 từ để bọc lại cùng DEK. Dữ liệu không bị mã hóa lại.", `<form id="vaultGateForm"><label for="vaultRecovery">24 từ recovery</label><textarea id="vaultRecovery" name="recovery" rows="5" required autofocus></textarea>${passwordFields()}<button type="submit">Đặt mật khẩu mới</button><button id="vaultBack" class="vault-link" type="button">Quay lại đăng nhập</button></form>`);
    document.getElementById("vaultBack").onclick = () => renderLogin(meta, resolve);
    document.getElementById("vaultGateForm").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; try { if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu chưa khớp."); status("Đang xác thực 24 từ…"); const restored = await window.LichVietZkCrypto.restoreWithRecovery(meta, form.recovery.value, form.password.value); await writeMeta(restored.meta); session = restored; await finishSession(resolve); } catch (error) { status(error.message); } };
  }
  async function requireSession() {
    database = await window.LichVietData.openDatabase();
    const meta = await readMeta();
    // Két chuyển tiếp trước khi có BIP39 không thể đáp ứng recovery contract.
    // Chỉ bỏ ciphertext dẫn xuất; các store plaintext v3 vẫn nguyên vẹn để migrate lại.
    const discarded = await discardPreRecoveryTestVault(meta);
    const legacyPlaintext = await hasLegacyPlaintext();
    return new Promise((resolve) => {
      if (!discarded && meta) renderLogin(meta, resolve);
      else if (legacyPlaintext) renderLegacyUpgrade(resolve);
      else firstUse(resolve);
    });
  }

  function setupSystemControls() {
    const change = document.getElementById("systemChangeVaultPassword"); const biometric = document.getElementById("systemBiometricVault"); const encryptedBackup = document.getElementById("systemExportEncryptedVault"); if (!change || !biometric) return;
    biometric.textContent = session.meta.biometric ? "Tắt sinh trắc học" : "Bật sinh trắc học";
    change.onclick = () => openSettingsDialog("Đổi mật khẩu két", `${passwordInput({ id: "vaultCurrentPassword", name: "current", label: "Mật khẩu hiện tại", autocomplete: "current-password" })}${passwordInput({ id: "vaultNewPassword", name: "password", label: "Mật khẩu mới", autocomplete: "new-password", isNew: true })}${passwordInput({ id: "vaultNewPasswordConfirm", name: "passwordConfirm", label: "Nhập lại mật khẩu mới", autocomplete: "new-password" })}`, async (form) => { const meta = await window.LichVietZkCrypto.changePassword(session.meta, form.current.value, form.password.value, form.passwordConfirm.value); await writeMeta(meta); session.meta = meta; }, { submitLabel: "Đổi mật khẩu", successMessage: "Đã đổi mật khẩu thành công.", noValidate: true });
    biometric.onclick = async () => {
      if (session.meta.biometric) { const meta = { ...session.meta }; delete meta.biometric; await writeMeta(meta); session.meta = meta; biometric.textContent = "Bật sinh trắc học"; return; }
      openSettingsDialog("Bật sinh trắc học", passwordInput({ id: "vaultBiometricPassword", name: "current", label: "Mật khẩu hiện tại", autocomplete: "current-password" }), async (form) => { const meta = await window.LichVietZkCrypto.enrollBiometric(session.meta, form.current.value); await writeMeta(meta); session.meta = meta; biometric.textContent = "Tắt sinh trắc học"; });
    };
    if (encryptedBackup) encryptedBackup.onclick = exportEncryptedBackup;
  }
  async function all(storeName) { const tx = database.transaction(storeName, "readonly"); return new Promise((resolve, reject) => { const request = tx.objectStore(storeName).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async function exportEncryptedBackup() {
    openEncryptedBackupDestinationDialog();
  }
  function encryptedBackupFileName() {
    const now = new Date();
    const vietnam = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const date = `${vietnam.getFullYear()}-${String(vietnam.getMonth() + 1).padStart(2, "0")}-${String(vietnam.getDate()).padStart(2, "0")}`;
    const hour = String(vietnam.getHours()).padStart(2, "0");
    const minute = String(vietnam.getMinutes()).padStart(2, "0");
    return `Sotaylichviet-${date}-${hour}h${minute}.zip`;
  }
  async function createEncryptedBackupArchive(progress) {
    if (!session.meta.recoveryKdf || !session.meta.recoveryWrappedDek) throw new Error("Két chưa có recovery wrapper.");
    progress.update(10, "Đang đọc dữ liệu mã hóa trong két…");
    const [events, journals, attachments, eventGroups] = await Promise.all([all("zk_events_v1"), all("zk_journals_v1"), all("zk_attachments_v1"), window.LichVietData.getSetting("eventGroups")]);
    progress.update(35, "Đang tạo manifest và xác minh backup…");
    const text = await window.LichVietZkBackup.createBackup({ ...session.meta, dek: session.dek, events, journals, attachments, eventGroups });
    const packed = JSON.parse(text);
    const zipFiles = [];
    let attachmentIndex = 0;
    progress.update(60, "Đang đóng gói attachment mã hóa…");
    packed.records.forEach((record) => {
      if (record.kind !== "attachment") return;
      attachmentIndex += 1;
      record.chunks.forEach((chunk, chunkIndex) => {
        const name = `attachments/${String(attachmentIndex).padStart(6, "0")}-${String(chunkIndex).padStart(4, "0")}.bin`;
        zipFiles.push({ name, bytes: window.LichVietZkBackup.fromBase64(chunk.box.ciphertext) });
        chunk.box.ciphertextFile = name;
        delete chunk.box.ciphertext;
      });
    });
    zipFiles.unshift({ name: "vault.json", bytes: eventBackupTextEncoder.encode(JSON.stringify(packed)) });
    progress.update(80, "Đang tạo file ZIP mã hóa…");
    return { blob: createEventBackupZip(zipFiles), fileName: encryptedBackupFileName() };
  }
  function openEncryptedBackupDestinationDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "event-backup-dialog";
    dialog.innerHTML = `<div class="event-backup-content"><h2>Backup két mã hóa</h2><p>Chọn nơi lưu file ZIP backup két mã hóa.</p><p data-drive-status role="status" aria-live="polite" hidden></p><div class="event-backup-dialog-actions"><button class="event-secondary-button" type="button" data-cancel>Hủy</button><button class="event-secondary-button" type="button" data-drive>Tải lên Google Drive</button><button class="event-submit" type="button" data-download>Copy file về</button></div></div>`;
    const close = () => dialog.close();
    dialog.querySelector("[data-cancel]").onclick = close;
    dialog.querySelector("[data-download]").onclick = () => { close(); downloadEncryptedBackup(); };
    dialog.querySelector("[data-drive]").onclick = async (event) => {
      const button = event.currentTarget;
      const driveStatus = dialog.querySelector("[data-drive-status]");
      button.disabled = true;
      driveStatus.hidden = false;
      driveStatus.textContent = "Đang kết nối với Google Drive…";
      try {
        if (!window.LichVietGoogleDrive) throw new Error("Chức năng Google Drive chưa sẵn sàng.");
        await window.LichVietGoogleDrive.authorize();
        close();
        await uploadEncryptedBackupToGoogleDrive();
      } catch (error) {
        driveStatus.textContent = error.message || "Không kết nối được với Google Drive.";
        button.disabled = false;
      }
    };
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector("[data-download]").focus();
  }
  async function downloadEncryptedBackup() {
    const progress = openEventBackupProgressDialog("Đang backup két mã hóa", "Đang chuẩn bị dữ liệu…");
    try {
      await waitForEventBackupProgressPaint();
      const { blob, fileName } = await createEncryptedBackupArchive(progress);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = fileName;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      progress.update(100, "Đã tạo file backup két mã hóa.");
      await new Promise((resolvePaint) => setTimeout(resolvePaint, 350));
      progress.close();
      openEventBackupMessageDialog("Backup hoàn tất", `Đã tạo ${fileName}.`, "OK");
    } catch (error) {
      progress.close();
      openEventBackupMessageDialog("Chưa tạo được backup", error.message || "Không tạo được backup két mã hóa.");
    }
  }
  async function uploadEncryptedBackupToGoogleDrive() {
    const progress = openEventBackupProgressDialog("Đang backup két mã hóa", "Đang chuẩn bị dữ liệu…");
    try {
      await waitForEventBackupProgressPaint();
      const { blob, fileName } = await createEncryptedBackupArchive(progress);
      progress.update(88, "Đang tải backup két mã hóa lên Google Drive…");
      await window.LichVietGoogleDrive.uploadBackup(blob, fileName, { backupType: "encrypted-vault" });
      progress.update(100, `Đã lưu ${fileName} vào Google Drive.`);
      await new Promise((resolvePaint) => setTimeout(resolvePaint, 450));
      progress.close();
      openEventBackupMessageDialog("Backup hoàn tất", "Đã tải backup két mã hóa lên Google Drive.", "OK");
    } catch (error) {
      progress.close();
      openEventBackupMessageDialog("Chưa tải được backup", error.message || "Không tải được backup két mã hóa lên Google Drive.");
    }
  }
  function openSettingsDialog(title, fields, action, options = {}) {
    const dialog = document.createElement("dialog");
    dialog.className = "vault-settings-dialog";
    dialog.setAttribute("aria-labelledby", "vaultSettingsTitle");
    dialog.innerHTML = `<form class="vault-settings-form"${options.noValidate ? " novalidate" : ""}><header class="vault-settings-header"><h2 id="vaultSettingsTitle">${title}</h2><button class="vault-settings-close" type="button" formnovalidate aria-label="Đóng" title="Đóng">×</button></header><div class="vault-settings-body"><div class="vault-settings-fields">${fields}</div><p class="vault-settings-status" role="alert" aria-live="polite"></p><div class="vault-settings-actions"><button class="vault-settings-cancel" type="button" formnovalidate>Hủy</button><button class="vault-settings-save" type="submit">${options.submitLabel || "Lưu thay đổi"}</button></div></div></form>`;
    document.body.append(dialog);
    setupPasswordControls(dialog);
    const form = dialog.querySelector("form");
    const save = dialog.querySelector(".vault-settings-save");
    const close = (event) => {
      event?.preventDefault();
      event?.stopPropagation();
      dialog.close("cancel");
    };
    dialog.querySelector(".vault-settings-close").addEventListener("click", close, { capture: true });
    dialog.querySelector(".vault-settings-cancel").addEventListener("click", close, { capture: true });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); dialog.close("cancel"); });
    form.onsubmit = async (event) => { event.preventDefault(); save.disabled = true; try { await action(form); dialog.close("success"); if (options.successMessage) openVaultMessageDialog(options.successMessage); } catch (error) { dialog.querySelector(".vault-settings-status").textContent = error.message; save.disabled = false; } };
    dialog.onclose = () => dialog.remove(); dialog.showModal();
    dialog.querySelector("input")?.focus();
  }
  function openVaultMessageDialog(message) {
    const dialog = document.createElement("dialog");
    dialog.className = "vault-settings-dialog vault-message-dialog";
    dialog.setAttribute("aria-labelledby", "vaultMessageTitle");
    dialog.innerHTML = `<div class="vault-settings-form"><header class="vault-settings-header"><h2 id="vaultMessageTitle">Thông báo</h2><button class="vault-settings-close" type="button" aria-label="Đóng" title="Đóng">×</button></header><div class="vault-settings-body"><p class="vault-message-text">${message}</p><button class="vault-message-close" type="button">Đóng</button></div></div>`;
    document.body.append(dialog);
    const close = () => dialog.close();
    dialog.querySelector(".vault-settings-close").onclick = close;
    dialog.querySelector(".vault-message-close").onclick = close;
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
    dialog.querySelector(".vault-message-close").focus();
  }
  window.LichVietVault = Object.freeze({ requireSession, getSession: () => session, setupSystemControls, lock: () => location.reload() });
})();
