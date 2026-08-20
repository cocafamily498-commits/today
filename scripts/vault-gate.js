(function () {
  "use strict";
  let session = null;
  let database = null;
  let gateKeydownHandler = null;
  let passwordEstimator = null;
  const MAX_CURRENT_PASSWORD_ATTEMPTS = 5;
  const CURRENT_PASSWORD_LOCK_MS = 10 * 60 * 1000;
  const passwordAttemptFallback = new Map();

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
  const passwordAttemptKey = (meta) => `lichviet:vault-password-attempts:${meta.vaultId}`;
  function normalizePasswordAttemptState(value) {
    if (!value || typeof value !== "object") return { attempts: 0, lockedUntil: 0 };
    const attempts = Math.min(MAX_CURRENT_PASSWORD_ATTEMPTS, Math.max(0, Number(value.attempts) || 0));
    const lockedUntil = Number(value.lockedUntil) || 0;
    if (lockedUntil && lockedUntil <= Date.now()) return { attempts: 0, lockedUntil: 0 };
    return { attempts, lockedUntil };
  }
  function currentPasswordAttemptState(meta) {
    try {
      const stored = localStorage.getItem(passwordAttemptKey(meta));
      if (!stored) return normalizePasswordAttemptState(passwordAttemptFallback.get(meta.vaultId));
      // Số thuần là dữ liệu từ bản cũ từng khóa vĩnh viễn; cho phép thử lại ngay.
      if (!stored.trim().startsWith("{")) {
        localStorage.removeItem(passwordAttemptKey(meta));
        return { attempts: 0, lockedUntil: 0 };
      }
      const state = normalizePasswordAttemptState(JSON.parse(stored));
      if (!state.attempts && !state.lockedUntil) localStorage.removeItem(passwordAttemptKey(meta));
      return state;
    } catch { return normalizePasswordAttemptState(passwordAttemptFallback.get(meta.vaultId)); }
  }
  function setCurrentPasswordAttemptState(meta, state) {
    const normalized = normalizePasswordAttemptState(state);
    passwordAttemptFallback.set(meta.vaultId, normalized);
    try {
      if (normalized.attempts || normalized.lockedUntil) localStorage.setItem(passwordAttemptKey(meta), JSON.stringify(normalized));
      else localStorage.removeItem(passwordAttemptKey(meta));
    } catch { /* Bộ đếm dự phòng vẫn có hiệu lực trong phiên hiện tại. */ }
    return normalized;
  }
  const clearCurrentPasswordAttempts = (meta) => setCurrentPasswordAttemptState(meta, { attempts: 0, lockedUntil: 0 });
  const currentPasswordRemaining = (meta) => MAX_CURRENT_PASSWORD_ATTEMPTS - currentPasswordAttemptState(meta).attempts;
  const currentPasswordLocked = (meta) => currentPasswordAttemptState(meta).lockedUntil > Date.now();
  function currentPasswordLockMessage(meta) {
    const seconds = Math.max(0, Math.ceil((currentPasswordAttemptState(meta).lockedUntil - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60);
    return `Bạn đã nhập sai mật khẩu 5 lần. Vui lòng thử lại sau ${minutes}:${String(seconds % 60).padStart(2, "0")}.`;
  }
  function currentPasswordFailure(meta) {
    const previous = currentPasswordAttemptState(meta);
    const attempts = Math.min(MAX_CURRENT_PASSWORD_ATTEMPTS, previous.attempts + 1);
    const remaining = MAX_CURRENT_PASSWORD_ATTEMPTS - attempts;
    setCurrentPasswordAttemptState(meta, { attempts, lockedUntil: remaining === 0 ? Date.now() + CURRENT_PASSWORD_LOCK_MS : 0 });
    const error = new Error(remaining > 0
      ? `Mật khẩu không đúng. Bạn còn ${remaining} lần thử.`
      : currentPasswordLockMessage(meta));
    error.currentPasswordLocked = remaining === 0;
    return error;
  }
  function disableCurrentPasswordForm(form) {
    form.querySelectorAll('input[autocomplete="current-password"], .vault-password-toggle, button[type="submit"]').forEach((control) => { control.disabled = true; });
  }
  function enableCurrentPasswordForm(form) {
    form.querySelectorAll('input[autocomplete="current-password"], .vault-password-toggle, button[type="submit"]').forEach((control) => { control.disabled = false; });
  }
  function watchCurrentPasswordLock(meta, form, showMessage) {
    const update = () => {
      if (!form.isConnected) { clearInterval(timer); return; }
      if (currentPasswordLocked(meta)) { disableCurrentPasswordForm(form); showMessage(currentPasswordLockMessage(meta)); return; }
      clearCurrentPasswordAttempts(meta);
      enableCurrentPasswordForm(form);
      showMessage("Bạn có thể thử nhập mật khẩu lại.");
      form.querySelector('input[autocomplete="current-password"]')?.focus();
      clearInterval(timer);
    };
    const timer = setInterval(update, 1000);
    update();
  }
  async function runCurrentPasswordAction(meta, form, action) {
    if (currentPasswordLocked(meta)) {
      disableCurrentPasswordForm(form);
      const error = new Error(currentPasswordLockMessage(meta));
      error.currentPasswordLocked = true;
      throw error;
    }
    try {
      const result = await action();
      clearCurrentPasswordAttempts(meta);
      return result;
    } catch (error) {
      if (/mật khẩu (hiện tại )?không đúng/i.test(error?.message || "")) throw currentPasswordFailure(meta);
      clearCurrentPasswordAttempts(meta);
      throw error;
    }
  }
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
  function isIosPasswordAutofill() {
    const userAgent = window.navigator?.userAgent || "";
    return /iPhone|iPad|iPod/i.test(userAgent)
      || (/Macintosh/i.test(userAgent) && Number(window.navigator?.maxTouchPoints) > 1);
  }
  function passwordInput({ id, name, label, autocomplete, isNew = false, autofocus = false }) {
    const requirements = isNew ? `<p class="vault-password-help" id="${id}Help">Tối thiểu 8 ký tự. Nên dùng một cụm từ dài, riêng biệt và khó đoán.</p><div class="vault-password-strength" data-password-strength-for="${id}" data-level="empty" role="status" aria-live="polite"><span class="vault-password-strength-bar"><i></i></span><span class="vault-password-strength-label">Chưa nhập mật khẩu</span></div>` : "";
    const effectiveAutocomplete = autocomplete === "off" && isIosPasswordAutofill() ? "one-time-code" : autocomplete;
    return `<div class="vault-password-field"><label for="${id}">${label}</label><div class="vault-password-input"><input id="${id}" name="${name}" type="password"${isNew ? ` minlength="8" aria-describedby="${id}Help"` : ""} autocomplete="${effectiveAutocomplete}" autocapitalize="none" autocorrect="off" spellcheck="false" required${autofocus ? " autofocus" : ""}><button class="vault-password-toggle" type="button" aria-label="Hiện mật khẩu" title="Hiện mật khẩu" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/><path class="vault-password-eye-slash" d="m4 4 16 16"/></svg></button></div>${requirements}</div>`;
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
  async function finishSession(resolve, options = {}) {
    if (!session?.dek || !window.LichVietZkRepository) throw new Error("Không thể kích hoạt kho dữ liệu mã hóa.");
    if (options.migrateLegacy === true) {
      status("Đang mã hóa dữ liệu cũ…");
      await window.LichVietZkMigration.runMigration(database, session.dek, session.meta.vaultId, { batchSize: 20 });
    }
    window.LichVietZkRepository.activate(database, session);
    resolve(session);
  }

  function shell(title, copy, content, modifier = "") {
    if (gateKeydownHandler) {
      document.removeEventListener("keydown", gateKeydownHandler);
      gateKeydownHandler = null;
    }
    root().innerHTML = `<section class="vault-gate${modifier ? ` ${modifier}` : ""}" aria-labelledby="vaultGateTitle"><div class="vault-gate-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="16" cy="20" r="8"/><path d="M22 26 38 42M31 35l5-5M36 40l5-5"/></svg></div><h1 id="vaultGateTitle">${title}</h1>${copy ? `<p>${copy}</p>` : ""}${content}<p id="vaultGateStatus" class="vault-gate-status" role="alert" aria-live="polite"></p></section>`;
    setupPasswordControls(root());
  }
  function firstUse(resolve) {
    shell("Bảo vệ dữ liệu của bạn", "Dữ liệu cá nhân sẽ được <strong>mã hóa ngay trên thiết bị</strong> để chỉ bạn mới có thể truy cập.<br><br>Hãy chọn cách bạn muốn bắt đầu.", `<div class="vault-choice-grid"><button id="createVaultChoice" type="button"><strong>Tạo két mới</strong><span><b class="vault-choice-audience">Dành cho lần đầu thiết lập Két bảo mật.</b>Tạo mật khẩu, nhận <b>24 từ Recovery</b> và mã hóa dữ liệu trên thiết bị này.</span></button><button id="restoreVaultChoice" type="button"><strong>Chuyển từ thiết bị khác</strong><span><b class="vault-choice-audience">Dành cho khi bạn đã có Két bảo mật trước đó.</b>Khôi phục dữ liệu bằng <b>file Backup mã hóa</b> và đúng <b>24 từ Recovery</b>.</span></button><button id="vaultGuideChoice" type="button"><strong>ⓘ Hướng dẫn</strong><span>Tìm hiểu cách hoạt động của Két bảo mật, mật khẩu, 24 từ Recovery, Backup và cách khôi phục dữ liệu.</span></button></div>`);
    document.getElementById("createVaultChoice").onclick = () => renderCreate(resolve);
    document.getElementById("restoreVaultChoice").onclick = () => renderDeviceRestore(resolve);
    document.getElementById("vaultGuideChoice").onclick = openVaultGettingStartedGuide;
  }

  function openVaultGettingStartedGuide() {
    document.getElementById("vaultGettingStartedGuide")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "vaultGettingStartedGuide";
    dialog.className = "vault-guide-dialog";
    dialog.innerHTML = `<article class="vault-guide-content"><header><h2>Hướng dẫn sử dụng Két bảo mật</h2></header><div class="vault-guide-body">
      <p>Ứng dụng sử dụng <strong>Két bảo mật</strong> để bảo vệ dữ liệu cá nhân của bạn. Dữ liệu trong Két được mã hóa ngay trên thiết bị theo mô hình <strong>Zero-Knowledge</strong>.</p>
      <p>Điều này có nghĩa là dữ liệu của bạn chỉ có thể được đọc sau khi Két được mở đúng cách. Ứng dụng và nhà phát triển không lưu mật khẩu, 24 từ Recovery hoặc khóa giải mã dữ liệu của bạn.</p>
      <h2>Tạo két mới</h2><p>Chọn <strong>Tạo két mới</strong> nếu đây là lần đầu bạn thiết lập Két bảo mật trên thiết bị này.</p><p>Ứng dụng sẽ thực hiện các bước sau:</p>
      <ol><li>Bạn tạo một mật khẩu dùng để mở Két.</li><li>Ứng dụng tạo khóa mã hóa dữ liệu riêng cho Két.</li><li>Bạn được cấp <strong>24 từ Recovery</strong>.</li><li>Dữ liệu hiện có trên thiết bị được chuyển sang dạng mã hóa.</li><li>Từ lần sử dụng tiếp theo, bạn cần mở Két trước khi truy cập dữ liệu cá nhân.</li></ol>
      <h3>Mật khẩu Két dùng để làm gì?</h3><p>Mật khẩu giúp bạn mở Két nhanh chóng trên thiết bị đang sử dụng.</p><p>Bạn có thể thay đổi mật khẩu sau này mà không cần tạo lại dữ liệu đã mã hóa.</p><p>Nên dùng một mật khẩu hoặc cụm từ:</p><ul><li>đủ dài;</li><li>dễ nhớ đối với bạn nhưng khó đoán đối với người khác;</li><li>không dùng lại mật khẩu của các tài khoản quan trọng khác.</li></ul>
      <h2>Mở nhanh bằng khóa màn hình thiết bị</h2><p>Sau khi mở Két bằng mật khẩu, bạn có thể vào <strong>Cài đặt ứng dụng → Cấu hình</strong> và bật <strong>Mở nhanh bằng khóa màn hình thiết bị</strong>.</p><p>Khi tính năng này được bật, bạn có thể dùng vân tay, khuôn mặt, PIN, hình vẽ hoặc mật mã do hệ điều hành cung cấp để mở nhanh ứng dụng.</p><ol><li>Chọn <strong>Bật</strong> tại mục mở nhanh.</li><li>Nhập <strong>mật khẩu Két hiện tại</strong> trong cửa sổ của ứng dụng.</li><li>Chọn <strong>Tiếp tục đến khóa màn hình</strong>.</li><li>Xác thực trong cửa sổ của hệ điều hành.</li><li>Ở lần đăng nhập hoặc khi ứng dụng tự khóa, chọn <strong>Dùng khóa màn hình thiết bị</strong>.</li></ol><p><strong>Lưu ý:</strong> Nếu cửa sổ hệ điều hành yêu cầu PIN, hình vẽ hoặc mật mã, hãy nhập mã mở khóa thiết bị — <strong>không nhập mật khẩu Két</strong>.</p><p>Tính năng này chỉ bảo vệ và điền mật khẩu Két; nó không thay thế mật khẩu Két hoặc 24 từ Recovery. Sau khi đổi hay khôi phục mật khẩu Két, bạn cần bật lại mở nhanh. Tùy chọn chỉ xuất hiện trên trình duyệt và thiết bị tương thích.</p>
      <h3>24 từ Recovery dùng để làm gì?</h3><p>24 từ Recovery là <strong>chìa khóa khôi phục cuối cùng</strong> của Két.</p><p>Bạn cần 24 từ này khi:</p><ul><li>quên mật khẩu Két;</li><li>chuyển dữ liệu sang thiết bị khác;</li><li>cài lại ứng dụng hoặc mất dữ liệu cục bộ nhưng vẫn còn file Backup mã hóa.</li></ul><p>Ứng dụng <strong>không lưu và không thể cấp lại</strong> 24 từ Recovery.</p><p><strong>Nếu bạn quên mật khẩu và đồng thời làm mất 24 từ Recovery, dữ liệu đã mã hóa sẽ không thể khôi phục.</strong></p><p>Hãy sao chép đủ 24 từ, giữ đúng thứ tự và cất ở nơi an toàn.</p><p>Không nên:</p><ul><li>chụp ảnh rồi để trong thư viện ảnh không được bảo vệ;</li><li>gửi 24 từ qua email, tin nhắn hoặc mạng xã hội;</li><li>lưu 24 từ cùng một nơi với file Backup mã hóa nếu có thể tránh được;</li><li>cung cấp 24 từ cho bất kỳ ai.</li></ul>
      <h2>Chuyển từ thiết bị khác</h2><p>Chọn <strong>Chuyển từ thiết bị khác</strong> nếu bạn đã có Két bảo mật trên một thiết bị khác và muốn tiếp tục sử dụng dữ liệu đó trên thiết bị hiện tại.</p><p>Bạn cần chuẩn bị:</p><ul><li><strong>file Backup đã mã hóa</strong> được xuất từ Két cũ;</li><li>đúng <strong>24 từ Recovery</strong> của Két đó.</li></ul><p>Ứng dụng sẽ dùng 24 từ Recovery để khôi phục khóa giải mã của Két và kiểm tra file Backup.</p><p>Nếu dữ liệu hợp lệ, bạn có thể đặt một <strong>mật khẩu mới cho thiết bị hiện tại</strong>.</p><p>Mật khẩu trên thiết bị mới không bắt buộc phải giống mật khẩu cũ. Dữ liệu vẫn thuộc cùng một Két vì khóa mã hóa dữ liệu được khôi phục từ 24 từ Recovery.</p>
      <h2>Backup dữ liệu</h2><p>Dữ liệu của Két được lưu cục bộ trên thiết bị và không tự động gửi lên cloud.</p><p>Bạn nên định kỳ sử dụng chức năng <strong>Backup dữ liệu</strong> trong <strong>Cài đặt/Hệ thống</strong> để tạo một bản sao lưu mã hóa.</p><p>File Backup vẫn ở trạng thái mã hóa. Người có file Backup nhưng không có khóa khôi phục phù hợp sẽ không thể đọc nội dung bên trong.</p><p>Khi cần sao lưu hoặc chuyển dữ liệu sang thiết bị khác, hãy sử dụng chức năng <strong>Backup dữ liệu trong Cài đặt/Hệ thống</strong>.</p>
      <h2>Khi quên mật khẩu</h2><p>Nếu quên mật khẩu Két nhưng vẫn còn 24 từ Recovery, bạn có thể:</p><ol><li>chọn chức năng khôi phục;</li><li>nhập đúng 24 từ Recovery;</li><li>khôi phục quyền truy cập dữ liệu;</li><li>đặt mật khẩu mới.</li></ol><p>Ứng dụng không khôi phục lại mật khẩu cũ. Mật khẩu cũ được thay bằng mật khẩu mới do bạn đặt.</p>
      <h2>Khi nhập dữ liệu</h2><p>Chức năng <strong>Import dữ liệu</strong> thông thường chỉ dành cho Backup thuộc Két hiện tại.</p><p>Nếu file không thể được giải mã hoặc không đúng định dạng mà ứng dụng hỗ trợ, quá trình nhập sẽ không thành công và ứng dụng sẽ thông báo file không tương thích.</p><p>Ứng dụng sẽ không yêu cầu 24 từ Recovery của một Két khác trong chức năng Import thông thường.</p>
      <h2>Quyền riêng tư</h2><p>Khi Két đang khóa, dữ liệu cá nhân không được hiển thị dưới dạng rõ.</p><p>Đối với các sự kiện được đánh dấu <strong>Riêng tư</strong>, thông báo trên thiết bị chỉ hiển thị nội dung chung như:</p><p><strong>“Bạn có sự kiện mới.”</strong></p><p>Tên sự kiện và nội dung riêng tư sẽ không xuất hiện trực tiếp trên Notification.</p>
      <h2>Một nguyên tắc quan trọng</h2><p>Hãy xem:</p><ul><li><strong>Mật khẩu</strong> là chìa khóa sử dụng hằng ngày.</li><li><strong>24 từ Recovery</strong> là chìa khóa khôi phục cuối cùng.</li><li><strong>File Backup mã hóa</strong> là bản sao dữ liệu.</li></ul><p>Để khôi phục dữ liệu trên một thiết bị mới, bạn cần giữ an toàn cả <strong>Backup mã hóa</strong> và <strong>24 từ Recovery</strong>.</p><p><strong>Không chia sẻ 24 từ Recovery với bất kỳ ai.</strong></p>
    </div><footer><button type="button" data-close>Đóng</button></footer></article>`;
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }
  function renderLegacyUpgrade(resolve) {
    shell(
      "Dữ liệu của bạn cần được bảo vệ",
      "Ứng dụng phát hiện dữ liệu được tạo bởi phiên bản cũ và chưa được mã hóa. Hãy tạo két để ứng dụng mã hóa, xác minh và bảo vệ dữ liệu hiện có của bạn.",
      `<div class="vault-legacy-actions"><div class="vault-legacy-notice"><strong>Nâng cấp an toàn</strong><span>Vui lòng giữ ứng dụng mở trong lúc nâng cấp. Dữ liệu của bạn được giữ nguyên và chỉ chuyển sang trạng thái được bảo vệ sau khi bản mã hóa đã được kiểm tra thành công.</span></div><button id="confirmLegacyUpgrade" type="button">Ok, Bảo vệ dữ liệu</button><button id="legacyUpgradeGuide" class="vault-legacy-guide" type="button"><strong>ⓘ Hướng dẫn</strong><span>Tìm hiểu cách hoạt động của Két bảo mật, mật khẩu, 24 từ Recovery, Backup và cách khôi phục dữ liệu.</span></button></div>`,
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
    document.getElementById("legacyUpgradeGuide").onclick = openVaultGettingStartedGuide;
  }
  function renderExitedApp() {
    shell(
      "Ứng dụng đã thoát",
      "Dữ liệu của bạn vẫn được giữ nguyên và chưa được ứng dụng mở. Bạn có thể đóng tab hoặc cửa sổ này.",
      "",
      "vault-gate-exited"
    );
  }
  function passwordFields(confirm = true, labels = {}) {
    return `${passwordInput({ id: "vaultPassword", name: "password", label: labels.password || "Mật khẩu két", autocomplete: "off", isNew: true })}${confirm ? passwordInput({ id: "vaultPasswordConfirm", name: "passwordConfirm", label: labels.confirm || "Nhập lại mật khẩu", autocomplete: "off" }) : ""}`;
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
    shell("Lưu 24 từ recovery", `<span class="vault-recovery-warning"><strong>Hãy sao chép và cất 24 từ dưới đây ở nơi an toàn.</strong> Ứng dụng không lưu và không thể cấp lại cụm từ Recovery này.<br><br><strong>Nếu bạn quên mật khẩu và đồng thời làm mất 24 từ Recovery, dữ liệu đã mã hóa sẽ không thể khôi phục bằng bất kỳ cách nào.</strong><br><br>24 từ Recovery chính là chìa khóa cuối cùng để khôi phục dữ liệu của bạn.</span>`, `<div class="vault-recovery-alert-icon" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 6 59 54H5L32 6Z"/><path d="M32 22v16"/><circle cx="32" cy="46" r="2"/></svg></div><section class="recovery-card" aria-labelledby="recoveryCardTitle"><h2 id="recoveryCardTitle">24 từ Recovery</h2><p class="recovery-phrase">${phrase}</p></section><label class="vault-confirm"><input id="recoverySaved" type="checkbox"> Tôi đã chép và kiểm tra đủ 24 từ</label><div class="vault-row"><button id="copyRecovery" type="button">Sao chép</button><button id="finishRecovery" type="button" disabled>Tiếp tục</button></div><button id="recoveryBack" class="vault-link" type="button">Quay lại</button>`, "vault-gate-recovery");
    let copyTooltipTimer = null;
    let copyTooltip = null;
    document.getElementById("copyRecovery").onclick = async (event) => {
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(phrase);
      } catch {
        const fallback = document.createElement("textarea");
        fallback.value = phrase;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.append(fallback);
        fallback.select();
        const copied = document.execCommand("copy");
        fallback.remove();
        if (!copied) { status("Không thể sao chép vào Clipboard."); return; }
      }
      button.setAttribute("aria-label", "Đã copy vào Clipboard");
      copyTooltip?.remove();
      clearTimeout(copyTooltipTimer);
      const rect = button.getBoundingClientRect();
      copyTooltip = document.createElement("div");
      copyTooltip.className = "vault-copy-tooltip";
      copyTooltip.setAttribute("role", "status");
      copyTooltip.textContent = "Đã copy vào Clipboard";
      copyTooltip.style.left = `${rect.left + rect.width / 2}px`;
      copyTooltip.style.top = `${rect.top - 10}px`;
      document.body.append(copyTooltip);
      requestAnimationFrame(() => copyTooltip?.classList.add("is-visible"));
      copyTooltipTimer = setTimeout(() => {
        copyTooltip?.classList.remove("is-visible");
        setTimeout(() => { copyTooltip?.remove(); copyTooltip = null; }, 180);
        button.setAttribute("aria-label", "Sao chép 24 từ recovery");
      }, 2200);
    };
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
        await finishSession(resolve, { migrateLegacy: options.legacyUpgrade === true });
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
        if (!window.isSecureContext || !window.crypto?.subtle) throw new Error("Kết nối hiện tại chưa đáp ứng yêu cầu bảo mật để xử lý dữ liệu mã hóa. Hãy mở ứng dụng bằng HTTPS hoặc qua localhost rồi thử lại.");
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
  function hasBiometricPasswordProtection(meta) { return meta?.biometric?.version === 2 && Boolean(meta.biometric.wrappedPassword); }
  function renderLogin(meta, resolve) {
    const biometricEnabled = hasBiometricPasswordProtection(meta);
    shell(biometricEnabled ? "Mở két dữ liệu" : "Nhập mật khẩu", "", `<form id="vaultGateForm">${passwordInput({ id: "vaultPassword", name: "password", label: "Mật khẩu két", autocomplete: "current-password", autofocus: true })}<button type="submit">Mở két</button></form>${biometricEnabled ? `<button id="biometricLogin" type="button">Dùng khóa màn hình thiết bị</button><small class="vault-field-help">Nếu được yêu cầu nhập PIN, hình vẽ hoặc mật mã, hãy dùng mã mở khóa thiết bị — không phải mật khẩu két.</small>` : ""}<button id="forgotVaultPassword" class="vault-link" type="button">Quên mật khẩu?</button>`);
    const loginForm = document.getElementById("vaultGateForm");
    if (currentPasswordLocked(meta)) {
      disableCurrentPasswordForm(loginForm);
      watchCurrentPasswordLock(meta, loginForm, status);
    }
    loginForm.onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      status("Đang mở khóa…");
      const password = form.password.value;
      if (!meta.recoveryWrappedDek) {
        try {
          const upgraded = await runCurrentPasswordAction(meta, form, () => window.LichVietZkCrypto.upgradeLegacyVaultRecovery(meta, password));
          session = { meta: upgraded.meta, dek: upgraded.dek };
          renderRecovery(upgraded.phrase, resolve, { previousMeta: meta });
        } catch (error) { form.password.value = ""; status(error.message); if (error.currentPasswordLocked) watchCurrentPasswordLock(meta, form, status); else { submit.disabled = false; form.password.focus(); } }
        return;
      }
      try {
        session = { meta, dek: await runCurrentPasswordAction(meta, form, () => window.LichVietZkCrypto.unlockPasswordVault(meta, password)) };
      } catch (error) {
        form.password.value = "";
        status(error.message);
        if (error.currentPasswordLocked) watchCurrentPasswordLock(meta, form, status); else { submit.disabled = false; form.password.focus(); }
        return;
      }
      try { await finishSession(resolve); }
      catch (error) { status(error.message || "Không thể mở két dữ liệu."); }
    };
    if (biometricEnabled) document.getElementById("biometricLogin").onclick = async () => { try { session = { meta, dek: await window.LichVietZkCrypto.unlockBiometric(meta) }; await finishSession(resolve); } catch (error) { status(error.message); } };
    document.getElementById("forgotVaultPassword").onclick = () => renderForgot(meta, resolve);
  }
  function renderForgot(meta, resolve) {
    shell("Khôi phục mật khẩu bằng 24 từ Recovery", "Nhập đúng 24 từ Recovery đã được cấp khi tạo két. Sau khi xác minh thành công, bạn có thể đặt một mật khẩu mới để tiếp tục sử dụng dữ liệu của mình.", `<form id="vaultGateForm"><label for="vaultRecovery">24 từ Recovery</label><textarea id="vaultRecovery" name="recovery" rows="5" required autofocus></textarea>${passwordFields(true, { password: "Mật khẩu mới", confirm: "Nhập lại mật khẩu mới" })}<button type="submit">Đặt mật khẩu mới</button><button id="vaultBack" class="vault-link" type="button">Quay lại đăng nhập</button></form>`);
    document.getElementById("vaultBack").onclick = () => renderLogin(meta, resolve);
    document.getElementById("vaultGateForm").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; try { if (form.password.value !== form.passwordConfirm.value) throw new Error("Hai mật khẩu chưa khớp."); status("Đang xác thực 24 từ…"); const restored = await window.LichVietZkCrypto.restoreWithRecovery(meta, form.recovery.value, form.password.value); await writeMeta(restored.meta); clearCurrentPasswordAttempts(meta); session = restored; await finishSession(resolve); } catch (error) { status(error.message); } };
  }
  async function requireSession() {
    database = await window.LichVietData.openDatabase();
    let meta = await readMeta();
    // Version 1 wrapped the DEK directly and made biometrics an independent
    // unlock factor. Remove that legacy capability instead of continuing it.
    if (meta?.biometric && !hasBiometricPasswordProtection(meta)) {
      meta = { ...meta }; delete meta.biometric; await writeMeta(meta);
    }
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
    const biometricLabel = biometric.querySelector("span");
    const biometricStatus = document.getElementById("systemBiometricStatus");
    const setBiometricLabel = (enabled) => {
      biometricLabel.textContent = enabled ? "Tắt" : "Bật";
      if (biometricStatus) biometricStatus.textContent = enabled ? "Đang bật" : "Đang tắt";
      biometric.classList.toggle("is-enabled", enabled);
    };
    setBiometricLabel(hasBiometricPasswordProtection(session.meta));
    change.onclick = () => openSettingsDialog("Đổi mật khẩu két", `${passwordInput({ id: "vaultCurrentPassword", name: "current", label: "Mật khẩu hiện tại", autocomplete: "current-password" })}${passwordInput({ id: "vaultNewPassword", name: "password", label: "Mật khẩu mới", autocomplete: "off", isNew: true })}${passwordInput({ id: "vaultNewPasswordConfirm", name: "passwordConfirm", label: "Nhập lại mật khẩu mới", autocomplete: "off" })}`, async (form) => { const meta = await runCurrentPasswordAction(session.meta, form, () => window.LichVietZkCrypto.changePassword(session.meta, form.current.value, form.password.value, form.passwordConfirm.value)); await writeMeta(meta); session.meta = meta; setBiometricLabel(false); }, { submitLabel: "Đổi mật khẩu", successMessage: "Đã đổi mật khẩu thành công. Hãy bật lại mở nhanh bằng khóa màn hình thiết bị để bảo vệ mật khẩu mới.", noValidate: true, currentPasswordMeta: session.meta });
    biometric.onclick = async () => {
      if (session.meta.biometric) { const meta = { ...session.meta }; delete meta.biometric; await writeMeta(meta); session.meta = meta; setBiometricLabel(false); return; }
      const biometricSupport = await window.LichVietZkCrypto.getBiometricSupport();
      if (!biometricSupport.supported && !biometricSupport.canAttempt) {
        const context = biometricSupport.context || {};
        openVaultMessageDialog(`<strong>${biometricSupport.message}</strong><br><br>Mã kiểm tra: <code>${biometricSupport.code}</code><br>Ngữ cảnh: ${context.mode || "không xác định"}<br>Hostname: <code>${context.hostname || "không xác định"}</code><br><br>Bạn vẫn có thể mở Két bằng mật khẩu.`);
        return;
      }
      const compatibilityNotice = biometricSupport.canAttempt
        ? `<p class="vault-field-help"><strong>Chế độ tương thích:</strong> WebKit chưa xác nhận PRF, vì vậy ứng dụng sẽ kiểm tra trực tiếp khi bạn tiếp tục. Nếu iOS không trả về khóa hợp lệ, Két vẫn an toàn và tiếp tục mở được bằng mật khẩu.</p>`
        : "";
      openSettingsDialog("Bật mở nhanh bằng khóa màn hình", `${compatibilityNotice}<p class="vault-field-help">Bước này cần mật khẩu két. Ở màn hình hệ điều hành kế tiếp, nếu chọn dùng PIN, hình vẽ hoặc mật mã, hãy nhập mã mở khóa thiết bị — không nhập mật khẩu két.</p>${passwordInput({ id: "vaultBiometricPassword", name: "current", label: "Mật khẩu két hiện tại", autocomplete: "current-password" })}`, async (form) => { const meta = await runCurrentPasswordAction(session.meta, form, () => window.LichVietZkCrypto.enrollBiometric(session.meta, form.current.value)); await writeMeta(meta); session.meta = meta; setBiometricLabel(true); }, { submitLabel: "Tiếp tục đến khóa màn hình", currentPasswordMeta: session.meta });
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
    dialog.className = "event-backup-dialog vault-transfer-dialog";
    dialog.setAttribute("closedby", "closerequest");
    dialog.innerHTML = `<div class="event-backup-content"><header class="vault-transfer-header"><h2>Backup két mã hóa</h2><button class="vault-transfer-close" type="button" data-close aria-label="Đóng" title="Đóng">×</button></header><div class="vault-transfer-body"><p>Chọn nơi lưu file ZIP backup két mã hóa.</p><p data-drive-status role="status" aria-live="polite" hidden></p><div class="event-backup-dialog-actions"><button class="event-secondary-button" type="button" data-cancel>Hủy</button><button class="event-secondary-button" type="button" data-drive>Tải lên Google Drive</button><button class="event-submit" type="button" data-download>Copy file về</button></div></div></div>`;
    const close = () => dialog.close();
    dialog.querySelector("[data-close]").onclick = close;
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
    document.body.classList.add("event-dialog-open");
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (!document.querySelector("dialog.event-backup-dialog[open], dialog.vault-settings-dialog[open]")) {
        document.body.classList.remove("event-dialog-open");
      }
    }, { once: true });
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
    dialog.setAttribute("closedby", "closerequest");
    dialog.setAttribute("aria-labelledby", "vaultSettingsTitle");
    dialog.innerHTML = `<form class="vault-settings-form"${options.noValidate ? " novalidate" : ""}><header class="vault-settings-header"><h2 id="vaultSettingsTitle">${title}</h2><button class="vault-settings-close" type="button" formnovalidate aria-label="Đóng" title="Đóng">×</button></header><div class="vault-settings-body"><div class="vault-settings-fields">${fields}</div><p class="vault-settings-status" role="alert" aria-live="polite"></p><div class="vault-settings-actions"><button class="vault-settings-cancel" type="button" formnovalidate>Hủy</button><button class="vault-settings-save" type="submit">${options.submitLabel || "Đồng ý"}</button></div></div></form>`;
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
    if (options.currentPasswordMeta && currentPasswordLocked(options.currentPasswordMeta)) {
      watchCurrentPasswordLock(options.currentPasswordMeta, form, (message) => { dialog.querySelector(".vault-settings-status").textContent = message; });
    }
    form.onsubmit = async (event) => { event.preventDefault(); save.disabled = true; try { await action(form); dialog.close("success"); if (options.successMessage) openVaultMessageDialog(options.successMessage); } catch (error) { dialog.querySelector(".vault-settings-status").textContent = error.message; if (error.currentPasswordLocked) watchCurrentPasswordLock(options.currentPasswordMeta, form, (message) => { dialog.querySelector(".vault-settings-status").textContent = message; }); else { form.querySelector('input[autocomplete="current-password"]')?.select(); save.disabled = false; } } };
    document.body.classList.add("event-dialog-open");
    dialog.onclose = () => {
      dialog.remove();
      if (!document.querySelector("dialog.event-backup-dialog[open], dialog.vault-settings-dialog[open]")) {
        document.body.classList.remove("event-dialog-open");
      }
    };
    dialog.showModal();
    dialog.querySelector("input")?.focus();
  }
  function openVaultMessageDialog(message) {
    const dialog = document.createElement("dialog");
    dialog.className = "vault-settings-dialog vault-message-dialog";
    dialog.setAttribute("closedby", "closerequest");
    dialog.setAttribute("aria-labelledby", "vaultMessageTitle");
    dialog.innerHTML = `<div class="vault-settings-form"><header class="vault-settings-header"><h2 id="vaultMessageTitle">Thông báo</h2><button class="vault-settings-close" type="button" aria-label="Đóng" title="Đóng">×</button></header><div class="vault-settings-body"><p class="vault-message-text">${message}</p><button class="vault-message-close" type="button">Đóng</button></div></div>`;
    document.body.append(dialog);
    const close = () => dialog.close();
    dialog.querySelector(".vault-settings-close").onclick = close;
    dialog.querySelector(".vault-message-close").onclick = close;
    document.body.classList.add("event-dialog-open");
    dialog.onclose = () => {
      dialog.remove();
      if (!document.querySelector("dialog.event-backup-dialog[open], dialog.vault-settings-dialog[open]")) {
        document.body.classList.remove("event-dialog-open");
      }
    };
    dialog.showModal();
    dialog.querySelector(".vault-message-close").focus();
  }
  function softLock() {
    if (!session?.meta || document.querySelector(".vault-soft-lock-overlay")) return;
    const biometricEnabled = hasBiometricPasswordProtection(session.meta);
    const app = root();
    const previousFocus = document.activeElement;
    const overlay = document.createElement("dialog");
    overlay.className = "vault-soft-lock-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "softLockTitle");
    overlay.innerHTML = `<section class="vault-gate vault-soft-lock-panel"><div class="vault-gate-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="16" cy="20" r="8"/><path d="M22 26 38 42M31 35l5-5M36 40l5-5"/></svg></div><h1 id="softLockTitle">Ứng dụng đã khóa</h1><p>${biometricEnabled ? "Dùng khóa màn hình thiết bị hoặc nhập mật khẩu két để tiếp tục phiên đang làm việc." : "Nhập mật khẩu két để tiếp tục phiên đang làm việc."}</p><form>${passwordInput({ id: "softLockPassword", name: "password", label: "Mật khẩu két", autocomplete: "current-password", autofocus: !biometricEnabled })}<button type="submit">Mở khóa</button></form>${biometricEnabled ? `<button id="softLockBiometric" type="button">Dùng khóa màn hình thiết bị</button><small class="vault-field-help">Nếu được yêu cầu nhập PIN, hình vẽ hoặc mật mã, hãy dùng mã mở khóa thiết bị — không phải mật khẩu két.</small>` : ""}<p class="vault-gate-status" role="alert" aria-live="polite"></p></section>`;
    document.body.append(overlay);
    overlay.addEventListener("cancel", (event) => event.preventDefault());
    overlay.showModal();
    document.body.classList.add("vault-soft-locked");
    app.inert = true;
    app.setAttribute("aria-hidden", "true");
    setupPasswordControls(overlay);
    const form = overlay.querySelector("form");
    const lockStatus = overlay.querySelector(".vault-gate-status");
    const showLockStatus = (message) => { lockStatus.textContent = message; };
    const finishSoftUnlock = () => {
      overlay.close();
      overlay.remove();
      document.body.classList.remove("vault-soft-locked");
      app.inert = false;
      app.removeAttribute("aria-hidden");
      previousFocus?.focus?.();
    };
    if (currentPasswordLocked(session.meta)) watchCurrentPasswordLock(session.meta, form, showLockStatus);
    form.onsubmit = async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      showLockStatus("Đang mở khóa…");
      try {
        await runCurrentPasswordAction(session.meta, form, () => window.LichVietZkCrypto.unlockPasswordVault(session.meta, form.password.value));
        finishSoftUnlock();
      } catch (error) {
        form.password.value = "";
        showLockStatus(error.message);
        if (error.currentPasswordLocked) watchCurrentPasswordLock(session.meta, form, showLockStatus);
        else { submit.disabled = false; form.password.focus(); }
      }
    };
    if (biometricEnabled) {
      const biometric = overlay.querySelector("#softLockBiometric");
      biometric.onclick = async () => {
        biometric.disabled = true;
        showLockStatus("Đang xác thực bằng khóa màn hình thiết bị…");
        try {
          await window.LichVietZkCrypto.unlockBiometric(session.meta);
          finishSoftUnlock();
        } catch (error) {
          showLockStatus(error.message);
          biometric.disabled = false;
          biometric.focus();
        }
      };
      biometric.focus();
    } else form.password.focus();
  }
  window.LichVietVault = Object.freeze({ requireSession, getSession: () => session, setupSystemControls, lock: softLock, openGuide: openVaultGettingStartedGuide });
})();
