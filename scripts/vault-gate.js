(function () {
  "use strict";
  let session = null;
  let database = null;
  let gateKeydownHandler = null;

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
    return `<label for="vaultPassword">Mật khẩu két</label><input id="vaultPassword" name="password" type="password" minlength="8" autocomplete="new-password" required>${confirm ? `<label for="vaultPasswordConfirm">Nhập lại mật khẩu</label><input id="vaultPasswordConfirm" name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required>` : ""}`;
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
    shell("Chuyển két từ thiết bị khác", "Chọn file ZIP backup két mã hóa, nhập 24 từ recovery và tạo mật khẩu cho thiết bị này.", `<form id="vaultGateForm"><label for="vaultBackupFile">Backup két mã hóa (.zip)</label><input id="vaultBackupFile" name="backup" type="file" accept=".zip,application/zip" required><small class="vault-field-help">Chỉ nhận ZIP được tạo từ chức năng Backup két mã hóa.</small><label for="vaultRecovery">24 từ recovery</label><textarea id="vaultRecovery" name="recovery" rows="5" required></textarea>${passwordFields()}<button type="submit">Khôi phục két</button><button class="vault-link" id="vaultBack" type="button">Quay lại</button></form>`);
    document.getElementById("vaultBack").onclick = () => firstUse(resolve);
    document.getElementById("vaultGateForm").onsubmit = async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); button.disabled = true;
      try {
        if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu chưa khớp.");
        const file = document.getElementById("vaultBackupFile")?.files?.[0];
        if (!file) throw new Error("Hãy chọn file ZIP backup két mã hóa.");
        if (!/\.zip$/i.test(file.name || "")) throw new Error("Chỉ chấp nhận file ZIP backup két mã hóa.");
        if (!window.isSecureContext || !window.crypto?.subtle) throw new Error("Android đang mở app qua HTTP LAN nên không cho phép Web Crypto. Hãy dùng HTTPS hoặc USB adb reverse rồi mở http://localhost:3000.");
        status("Đang kiểm tra loại backup ZIP…");
        const files = readEventBackupZip(await file.arrayBuffer());
        if (files.size !== 1 || !files.has("vault.json")) throw new Error("Đây không phải ZIP backup két mã hóa hợp lệ.");
        const parsed = window.LichVietZkBackup.parseBackup(eventBackupTextDecoder.decode(files.get("vault.json")));
        const restored = await window.LichVietZkCrypto.restoreFromRecoverySource(parsed, form.recovery.value, form.password.value);
        await window.LichVietZkBackup.verifyBackup(parsed, restored.dek); await importCipherRecords(parsed.records, restored.meta, parsed.eventGroups);
        session = restored; await finishSession(resolve);
      } catch (error) { status(error.message || "Không khôi phục được két."); button.disabled = false; }
    };
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
    shell(meta.biometric ? "Mở két dữ liệu" : "Nhập mật khẩu", "Dữ liệu chỉ được giải mã trong phiên đang mở khóa.", `<form id="vaultGateForm"><label for="vaultPassword">Mật khẩu két</label><input id="vaultPassword" name="password" type="password" autocomplete="current-password" required autofocus><button type="submit">Mở két</button></form>${meta.biometric ? `<button id="biometricLogin" type="button">Mở bằng sinh trắc học</button>` : ""}<button id="forgotVaultPassword" class="vault-link" type="button">Quên mật khẩu?</button>`);
    document.getElementById("vaultGateForm").onsubmit = async (event) => { event.preventDefault(); try { status("Đang mở khóa…"); if (!meta.recoveryWrappedDek) { const upgraded = await window.LichVietZkCrypto.upgradeLegacyVaultRecovery(meta, event.currentTarget.password.value); session = { meta: upgraded.meta, dek: upgraded.dek }; renderRecovery(upgraded.phrase, resolve, { previousMeta: meta }); return; } session = { meta, dek: await window.LichVietZkCrypto.unlockPasswordVault(meta, event.currentTarget.password.value) }; await finishSession(resolve); } catch (error) { status(error.message); } };
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
    change.onclick = () => openSettingsDialog("Đổi mật khẩu két", `<label>Mật khẩu hiện tại<input name="current" type="password" autocomplete="current-password" required></label><label>Mật khẩu mới<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>Nhập lại mật khẩu mới<input name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required></label>`, async (form) => { if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu mới chưa khớp."); const meta = await window.LichVietZkCrypto.changePassword(session.meta, form.current.value, form.password.value); await writeMeta(meta); session.meta = meta; }, { submitLabel: "Đổi mật khẩu", successMessage: "Đã đổi mật khẩu thành công." });
    biometric.onclick = async () => {
      if (session.meta.biometric) { const meta = { ...session.meta }; delete meta.biometric; await writeMeta(meta); session.meta = meta; biometric.textContent = "Bật sinh trắc học"; return; }
      openSettingsDialog("Bật sinh trắc học", `<label>Mật khẩu hiện tại<input name="current" type="password" required></label>`, async (form) => { const meta = await window.LichVietZkCrypto.enrollBiometric(session.meta, form.current.value); await writeMeta(meta); session.meta = meta; biometric.textContent = "Tắt sinh trắc học"; });
    };
    if (encryptedBackup) encryptedBackup.onclick = exportEncryptedBackup;
  }
  async function all(storeName) { const tx = database.transaction(storeName, "readonly"); return new Promise((resolve, reject) => { const request = tx.objectStore(storeName).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async function exportEncryptedBackup() {
    try {
      if (!session.meta.recoveryKdf || !session.meta.recoveryWrappedDek) throw new Error("Két chưa có recovery wrapper.");
      const [events, journals, attachments, eventGroups] = await Promise.all([all("zk_events_v1"), all("zk_journals_v1"), all("zk_attachments_v1"), window.LichVietData.getSetting("eventGroups")]);
      const text = await window.LichVietZkBackup.createBackup({ ...session.meta, dek: session.dek, events, journals, attachments, eventGroups });
      const zip = createEventBackupZip([{ name: "vault.json", bytes: eventBackupTextEncoder.encode(text) }]);
      const now = new Date();
      const vietnam = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      const date = `${vietnam.getFullYear()}-${String(vietnam.getMonth() + 1).padStart(2, "0")}-${String(vietnam.getDate()).padStart(2, "0")}`;
      const hour = String(vietnam.getHours()).padStart(2, "0");
      const minute = String(vietnam.getMinutes()).padStart(2, "0");
      const link = document.createElement("a"); link.href = URL.createObjectURL(zip); link.download = `Sotaylichviet-${date}-${hour}h${minute}.zip`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
    } catch (error) { openSettingsDialog("Chưa tạo được backup", `<p>${error.message}</p>`, async () => {}); }
  }
  function openSettingsDialog(title, fields, action, options = {}) {
    const dialog = document.createElement("dialog");
    dialog.className = "vault-settings-dialog";
    dialog.setAttribute("aria-labelledby", "vaultSettingsTitle");
    dialog.innerHTML = `<form class="vault-settings-form"><header class="vault-settings-header"><h2 id="vaultSettingsTitle">${title}</h2><button class="vault-settings-close" type="button" formnovalidate aria-label="Đóng" title="Đóng">×</button></header><div class="vault-settings-body"><div class="vault-settings-fields">${fields}</div><p class="vault-settings-status" role="alert" aria-live="polite"></p><div class="vault-settings-actions"><button class="vault-settings-cancel" type="button" formnovalidate>Hủy</button><button class="vault-settings-save" type="submit">${options.submitLabel || "Lưu thay đổi"}</button></div></div></form>`;
    document.body.append(dialog);
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
