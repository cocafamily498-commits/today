const http = require("http");
const fs = require("fs");
const path = require("path");
const { convertLunarToSolar, parseInput: parseLunarInput } = require("./netlify/functions/lunar-to-solar");
const {
  getMarkets,
  getAssets,
  getQuotes,
  getWeather,
  searchLocations,
  normalizeRequestedLocation,
  getFallbackMarkets,
  getFallbackAssets,
  getFallbackQuotes,
  getFallbackWeather
} = require("./netlify/functions/data");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = process.env.PORT || 3000;
const STATIC_FILES = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/app-data-core.js": { file: "app-data-core.js", type: "text/javascript; charset=utf-8" },
  "/app-data-events.js": { file: "app-data-events.js", type: "text/javascript; charset=utf-8" },
  "/app-data-journals.js": { file: "app-data-journals.js", type: "text/javascript; charset=utf-8" },
  "/app-data-backup.js": { file: "app-data-backup.js", type: "text/javascript; charset=utf-8" },
  "/app-data.js": { file: "app-data.js", type: "text/javascript; charset=utf-8" },
  "/favicon.ico": { file: "favicon.ico", type: "image/x-icon" },
  "/favicon-lichviet.ico": { file: "favicon-lichviet.ico", type: "image/x-icon" },
  "/manifest.webmanifest": { file: "manifest.webmanifest", type: "application/manifest+json; charset=utf-8" },
  "/service-worker.js": { file: "service-worker.js", type: "text/javascript; charset=utf-8" }
};
const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};
const STATIC_DIRECTORIES = ["partials", "scripts", "icons", "styles"];
const API_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function send(response, status, contentType, body, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(body);
}

function getStaticFile(pathname) {
  const knownFile = STATIC_FILES[pathname];
  if (knownFile) return knownFile;

  const normalizedPath = path.posix.normalize(decodeURIComponent(pathname));
  if (normalizedPath !== pathname || normalizedPath.includes("..")) return null;

  const parts = normalizedPath.replace(/^\//, "").split("/");
  if (!STATIC_DIRECTORIES.includes(parts[0])) return null;

  const type = STATIC_TYPES[path.extname(normalizedPath)];
  if (!type) return null;

  return { file: normalizedPath.replace(/^\//, ""), type };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 250000) request.destroy(new Error("Request body too large"));
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Du lieu JSON khong hop le"));
      }
    });
    request.on("error", reject);
  });
}

async function handleApiRequest(request, response, requestUrl) {
  if (request.method === "OPTIONS") {
    send(response, 204, "text/plain; charset=utf-8", "", API_CORS_HEADERS);
    return true;
  }

  if (requestUrl.pathname === "/api/markets") {
    const markets = await getMarkets().catch(() => getFallbackMarkets());
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ markets }), API_CORS_HEADERS);
    return true;
  }

  if (requestUrl.pathname === "/api/assets") {
    const assets = await getAssets().catch(() => getFallbackAssets());
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ assets }), API_CORS_HEADERS);
    return true;
  }

  if (requestUrl.pathname === "/api/quotes") {
    const quotes = await getQuotes().catch(() => getFallbackQuotes());
    send(response, 200, "application/json; charset=utf-8", JSON.stringify(quotes), API_CORS_HEADERS);
    return true;
  }

  if (requestUrl.pathname === "/api/locations") {
    const locations = await searchLocations(requestUrl.searchParams.get("q")).catch(() => []);
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ locations }), API_CORS_HEADERS);
    return true;
  }

  if (requestUrl.pathname === "/api/weather") {
    const clientIp = request.headers["x-forwarded-for"] || request.socket.remoteAddress;
    const requestedLocation = normalizeRequestedLocation({
      name: requestUrl.searchParams.get("name"),
      latitude: requestUrl.searchParams.get("lat"),
      longitude: requestUrl.searchParams.get("lon")
    });
    const weather = await getWeather(clientIp, requestedLocation).catch(() => getFallbackWeather(requestedLocation));
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ weather }), API_CORS_HEADERS);
    return true;
  }

  return handleLocalApiRequest(request, response, requestUrl);
}

async function handleLocalApiRequest(request, response, requestUrl) {
  if (requestUrl.pathname === "/api/lunar-to-solar") {
    if (request.method !== "POST") {
      send(response, 405, "application/json; charset=utf-8", JSON.stringify({ error: "Chi ho tro phuong thuc POST" }), API_CORS_HEADERS);
      return true;
    }
    const input = parseLunarInput(await readJsonBody(request));
    const solar = convertLunarToSolar(input.lunarDay, input.lunarMonth, input.lunarYear, input.lunarLeap, input.timeZone);
    if (!solar) {
      send(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "Ngay am hoac thang nhuan khong hop le" }), API_CORS_HEADERS);
      return true;
    }
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ solar }), API_CORS_HEADERS);
    return true;
  }

  if (requestUrl.pathname === "/api/push-vapid-public-key") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({
      publicKey: process.env.VAPID_PUBLIC_KEY || "",
      configured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    }), API_CORS_HEADERS);
    return true;
  }

  if (requestUrl.pathname === "/api/push-subscription") {
    if (request.method !== "POST") {
      send(response, 405, "application/json; charset=utf-8", JSON.stringify({ error: "Chi ho tro phuong thuc POST" }), API_CORS_HEADERS);
      return true;
    }
    const input = await readJsonBody(request);
    const reminders = Array.isArray(input.reminders) ? input.reminders.length : 0;
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, local: true, reminders }), API_CORS_HEADERS);
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (requestUrl.pathname.startsWith("/api/") && await handleApiRequest(request, response, requestUrl)) return;

    const staticFile = getStaticFile(requestUrl.pathname);
    if (!staticFile) {
      send(response, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    send(response, 200, staticFile.type, fs.readFileSync(path.join(__dirname, staticFile.file)));
  } catch (error) {
    send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`So tay lich Viet app: http://localhost:${PORT}`);
});
