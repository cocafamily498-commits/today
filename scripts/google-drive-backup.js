(function () {
  "use strict";

  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const BACKUP_FOLDER_NAME = "Sổ tay lịch Việt";
  const DEFAULT_GOOGLE_CLIENT_ID = "35262227108-trgh9bv458di4o3f3nsq1dj2r2vdk8lu.apps.googleusercontent.com";
  let accessToken = "";
  let readyPromise = null;

  async function loadClientId() {
    try {
      const response = await fetch("/api/google-drive-config", { cache: "no-store" });
      if (!response.ok) return DEFAULT_GOOGLE_CLIENT_ID;
      const config = await response.json();
      return String(config.clientId || "").trim() || DEFAULT_GOOGLE_CLIENT_ID;
    } catch (error) {
      return DEFAULT_GOOGLE_CLIENT_ID;
    }
  }

  function loadGoogleIdentityServices() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("Không tải được dịch vụ đăng nhập Google.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Không tải được dịch vụ đăng nhập Google."));
      document.head.append(script);
    });
  }

  function prepare() {
    if (!readyPromise) readyPromise = Promise.all([loadClientId(), loadGoogleIdentityServices()]);
    return readyPromise;
  }

  async function authorize() {
    const [clientId] = await prepare();
    return new Promise((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (!response || response.error || !response.access_token) {
            reject(new Error(response?.error_description || "Bạn chưa cấp quyền truy cập Google Drive."));
            return;
          }
          if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
            reject(new Error("Bạn chưa cấp quyền quản lý file sao lưu trên Google Drive."));
            return;
          }
          accessToken = response.access_token;
          resolve(accessToken);
        },
        error_callback: () => reject(new Error("Không hoàn tất được yêu cầu cấp quyền Google Drive."))
      });
      tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
    });
  }

  async function driveRequest(url, options = {}) {
    if (!accessToken) throw new Error("Bạn cần cấp quyền Google Drive trước.");
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` }
    });
    if (response.status === 401) {
      accessToken = "";
      throw new Error("Quyền Google Drive đã hết hạn. Hãy thực hiện lại thao tác.");
    }
    if (!response.ok) {
      let message = "Google Drive không xử lý được yêu cầu.";
      try {
        const payload = await response.json();
        message = payload?.error?.message || message;
      } catch (error) {
        // Keep the fallback when Google does not return JSON.
      }
      throw new Error(message);
    }
    return response;
  }

  function escapeQueryValue(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  async function getOrCreateBackupFolder() {
    const query = `name = '${escapeQueryValue(BACKUP_FOLDER_NAME)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,name)&pageSize=10`;
    const result = await (await driveRequest(url)).json();
    if (result.files?.length) return result.files[0];

    const response = await driveRequest("https://www.googleapis.com/drive/v3/files?fields=id,name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" })
    });
    return response.json();
  }

  async function uploadBackup(blob, fileName) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("File sao lưu trống hoặc không hợp lệ.");
    const folder = await getOrCreateBackupFolder();
    const metadata = {
      name: fileName,
      parents: [folder.id],
      description: "File sao lưu dữ liệu của ứng dụng Sổ tay lịch Việt"
    };
    const session = await driveRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/zip",
        "X-Upload-Content-Length": String(blob.size)
      },
      body: JSON.stringify(metadata)
    });
    const uploadUrl = session.headers.get("location");
    if (!uploadUrl) throw new Error("Google Drive không tạo được phiên tải lên.");
    return (await driveRequest(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/zip" },
      body: blob
    })).json();
  }

  async function listBackups() {
    const folder = await getOrCreateBackupFolder();
    const query = `'${escapeQueryValue(folder.id)}' in parents and trashed = false`;
    const fields = "files(id,name,size,modifiedTime,webViewLink)";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&orderBy=modifiedTime%20desc&pageSize=100&fields=${encodeURIComponent(fields)}`;
    const result = await (await driveRequest(url)).json();
    return (result.files || []).filter((file) => /\.zip$/i.test(file.name || ""));
  }

  async function downloadBackup(file) {
    if (!file?.id || !/\.zip$/i.test(file.name || "")) throw new Error("File sao lưu trên Google Drive không hợp lệ.");
    const response = await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`);
    return new File([await response.blob()], file.name, { type: "application/zip" });
  }

  window.LichVietGoogleDrive = Object.freeze({
    ready: () => prepare().then(() => true),
    authorize,
    uploadBackup,
    listBackups,
    downloadBackup
  });
})();
