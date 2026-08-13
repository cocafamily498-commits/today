(function () {
  "use strict";
  let session = null;
  let database = null;

  const txDone = (tx) => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  async function readMeta() { const tx = database.transaction("zk_vault_v1", "readonly"); return new Promise((resolve, reject) => { const request = tx.objectStore("zk_vault_v1").get("meta"); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
  async function writeMeta(meta) { const tx = database.transaction("zk_vault_v1", "readwrite"); tx.objectStore("zk_vault_v1").put(meta); await txDone(tx); }
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

  function shell(title, copy, content) {
    root().innerHTML = `<section class="vault-gate" aria-labelledby="vaultGateTitle"><div class="vault-gate-mark" aria-hidden="true">⌾</div><h1 id="vaultGateTitle">${title}</h1><p>${copy}</p>${content}<p id="vaultGateStatus" class="vault-gate-status" role="alert" aria-live="polite"></p></section>`;
  }
  function firstUse(resolve) {
    shell("Bảo vệ dữ liệu của bạn", "Tạo một két mới hoặc mang két đã mã hóa từ thiết bị khác sang.", `<div class="vault-choice-grid"><button id="createVaultChoice" type="button"><strong>Tạo két mới</strong><span>Tạo mật khẩu và nhận 24 từ recovery</span></button><button id="restoreVaultChoice" type="button"><strong>Chuyển từ thiết bị khác</strong><span>Dùng backup mã hóa và 24 từ recovery</span></button></div>`);
    document.getElementById("createVaultChoice").onclick = () => renderCreate(resolve);
    document.getElementById("restoreVaultChoice").onclick = () => renderDeviceRestore(resolve);
  }
  function passwordFields(confirm = true) {
    return `<label for="vaultPassword">Mật khẩu két</label><input id="vaultPassword" name="password" type="password" minlength="8" autocomplete="new-password" required>${confirm ? `<label for="vaultPasswordConfirm">Nhập lại mật khẩu</label><input id="vaultPasswordConfirm" name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required>` : ""}`;
  }
  function renderCreate(resolve) {
    shell("Tạo két dữ liệu riêng tư", "Sau bước này bạn sẽ nhận 24 từ recovery chỉ hiển thị một lần.", `<form id="vaultGateForm">${passwordFields()}<button type="submit">Tạo két mới</button><button class="vault-link" id="vaultBack" type="button">Quay lại</button></form>`);
    document.getElementById("vaultBack").onclick = () => firstUse(resolve);
    document.getElementById("vaultGateForm").onsubmit = async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); button.disabled = true;
      try {
        if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu chưa khớp.");
        status("Đang tạo khóa Argon2id trên thiết bị…");
        const created = await window.LichVietZkCrypto.createPasswordVault(form.password.value);
        session = { meta: created.meta, dek: created.dek }; await writeMeta(created.meta);
        renderRecovery(created.phrase, resolve);
      } catch (error) { status(error.message); button.disabled = false; }
    };
  }
  function renderRecovery(phrase, resolve) {
    const words = phrase.split(" ").map((word, index) => `<span><b>${String(index + 1).padStart(2, "0")}</b>${word}</span>`).join("");
    shell("Lưu 24 từ recovery", "Chép và cất ở nơi an toàn. Ứng dụng không lưu cụm từ này và không thể cấp lại.", `<div class="recovery-grid">${words}</div><label class="vault-confirm"><input id="recoverySaved" type="checkbox"> Tôi đã chép và kiểm tra đủ 24 từ</label><div class="vault-row"><button id="copyRecovery" type="button">Sao chép</button><button id="finishRecovery" type="button" disabled>Tiếp tục</button></div>`);
    document.getElementById("copyRecovery").onclick = () => navigator.clipboard.writeText(phrase);
    document.getElementById("recoverySaved").onchange = (event) => { document.getElementById("finishRecovery").disabled = !event.target.checked; };
    document.getElementById("finishRecovery").onclick = async () => { status("Đang mã hóa và xác minh dữ liệu cũ…"); await window.LichVietZkMigration.runMigration(database, session.dek, session.meta.vaultId, { batchSize: 20 }); await finishSession(resolve); };
  }
  function renderDeviceRestore(resolve) {
    shell("Chuyển két từ thiết bị khác", "Chọn file .lichvietzk được tạo từ mục Backup két mã hóa, nhập 24 từ recovery và tạo mật khẩu cho thiết bị này.", `<form id="vaultGateForm"><label for="vaultBackupFile">Backup két mã hóa (.lichvietzk)</label><input id="vaultBackupFile" name="backup" type="file" accept=".lichvietzk,application/json" required><small class="vault-field-help">Không dùng file .ZIP Export data của phiên bản cũ.</small><label for="vaultRecovery">24 từ recovery</label><textarea id="vaultRecovery" name="recovery" rows="5" required></textarea>${passwordFields()}<button type="submit">Khôi phục két</button><button class="vault-link" id="vaultBack" type="button">Quay lại</button></form>`);
    document.getElementById("vaultBack").onclick = () => firstUse(resolve);
    document.getElementById("vaultGateForm").onsubmit = async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); button.disabled = true;
      try {
        if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu chưa khớp.");
        const file = form.backup.files[0];
        if (!file || !/\.lichvietzk$/i.test(file.name || "")) throw new Error("Hãy chọn file Backup két mã hóa có đuôi .lichvietzk, không chọn file ZIP backup cũ.");
        if (!window.isSecureContext || !window.crypto?.subtle) throw new Error("Android đang mở app qua HTTP LAN nên không cho phép Web Crypto. Hãy dùng HTTPS hoặc USB adb reverse rồi mở http://localhost:3000.");
        status("Đang xác thực backup và recovery…"); const parsed = window.LichVietZkBackup.parseBackup(await file.text());
        const restored = await window.LichVietZkCrypto.restoreFromRecoverySource(parsed, form.recovery.value, form.password.value);
        await window.LichVietZkBackup.verifyBackup(parsed, restored.dek); await importCipherRecords(parsed.records, restored.meta);
        session = restored; await finishSession(resolve);
      } catch (error) { status(error.message || "Không khôi phục được két."); button.disabled = false; }
    };
  }
  async function importCipherRecords(records, meta) {
    const stores = ["zk_events_v1", "zk_journals_v1", "zk_attachments_v1", "zk_vault_v1", "events", "journals", "images"];
    const tx = database.transaction(stores, "readwrite");
    stores.slice(0, 3).forEach((storeName) => tx.objectStore(storeName).clear());
    const storeByKind = { event: stores[0], journal: stores[1], attachment: stores[2] };
    records.forEach((record) => {
      const storeName = storeByKind[record?.kind];
      if (!storeName) throw new Error("Backup chứa loại bản ghi không hợp lệ.");
      tx.objectStore(storeName).put(record);
    });
    tx.objectStore("zk_vault_v1").put(meta);
    stores.slice(4).forEach((storeName) => tx.objectStore(storeName).clear());
    await txDone(tx);
  }
  function renderLogin(meta, resolve) {
    shell(meta.biometric ? "Mở két dữ liệu" : "Nhập mật khẩu", "Dữ liệu chỉ được giải mã trong phiên đang mở khóa.", `<form id="vaultGateForm"><label for="vaultPassword">Mật khẩu két</label><input id="vaultPassword" name="password" type="password" autocomplete="current-password" required autofocus><button type="submit">Mở két</button></form>${meta.biometric ? `<button id="biometricLogin" type="button">Mở bằng sinh trắc học</button>` : ""}<button id="forgotVaultPassword" class="vault-link" type="button">Quên mật khẩu?</button>`);
    document.getElementById("vaultGateForm").onsubmit = async (event) => { event.preventDefault(); try { status("Đang mở khóa…"); if (!meta.recoveryWrappedDek) { const upgraded = await window.LichVietZkCrypto.upgradeLegacyVaultRecovery(meta, event.currentTarget.password.value); await writeMeta(upgraded.meta); session = { meta: upgraded.meta, dek: upgraded.dek }; renderRecovery(upgraded.phrase, resolve); return; } session = { meta, dek: await window.LichVietZkCrypto.unlockPasswordVault(meta, event.currentTarget.password.value) }; await finishSession(resolve); } catch (error) { status(error.message); } };
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
    return new Promise((resolve) => !discarded && meta ? renderLogin(meta, resolve) : firstUse(resolve));
  }

  function setupSystemControls() {
    const change = document.getElementById("systemChangeVaultPassword"); const biometric = document.getElementById("systemBiometricVault"); const encryptedBackup = document.getElementById("systemExportEncryptedVault"); if (!change || !biometric) return;
    biometric.textContent = session.meta.biometric ? "Tắt sinh trắc học" : "Bật sinh trắc học";
    change.onclick = () => openSettingsDialog("Đổi mật khẩu két", `<label>Mật khẩu hiện tại<input name="current" type="password" required></label>${passwordFields()}`, async (form) => { if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu chưa khớp."); const meta = await window.LichVietZkCrypto.changePassword(session.meta, form.current.value, form.password.value); await writeMeta(meta); session.meta = meta; });
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
      const [events, journals, attachments] = await Promise.all([all("zk_events_v1"), all("zk_journals_v1"), all("zk_attachments_v1")]);
      const text = await window.LichVietZkBackup.createBackup({ ...session.meta, dek: session.dek, events, journals, attachments });
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); link.download = `Sotaylichviet-${new Date().toISOString().slice(0, 10)}.lichvietzk`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
    } catch (error) { openSettingsDialog("Chưa tạo được backup", `<p>${error.message}</p>`, async () => {}); }
  }
  function openSettingsDialog(title, fields, action) {
    const dialog = document.createElement("dialog"); dialog.className = "app-info-dialog vault-settings-dialog"; dialog.innerHTML = `<form method="dialog" class="vault-settings-form"><h2>${title}</h2>${fields}<p role="alert"></p><div class="vault-row"><button value="cancel">Hủy</button><button id="vaultSettingsSave" value="default">Lưu</button></div></form>`; document.body.append(dialog);
    dialog.querySelector("form").onsubmit = async (event) => { event.preventDefault(); try { await action(event.currentTarget); dialog.close(); } catch (error) { dialog.querySelector("p").textContent = error.message; } };
    dialog.onclose = () => dialog.remove(); dialog.showModal();
  }
  window.LichVietVault = Object.freeze({ requireSession, getSession: () => session, setupSystemControls, lock: () => location.reload() });
})();
