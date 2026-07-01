const CACHE_NAME = "homnay-pwa-v16";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app-data.js",
  "/favicon.ico",
  "/favicon-lichviet.ico",
  "/manifest.webmanifest",
  "/icons/app-icon-lichviet-transparent-192.png",
  "/icons/app-icon-lichviet-transparent-512.png",
  "/partials/tabs.html",
  "/partials/today-tab.html",
  "/partials/converter-tab.html",
  "/partials/events-tab.html",
  "/partials/journals-tab.html",
  "/partials/app-info-tab.html",
  "/partials/event-dialog.html",
  "/partials/journal-dialog.html",
  "/partials/app-info-dialog.html",
  "/scripts/partials-loader.js",
  "/scripts/lunar-core.js",
  "/scripts/app-shell.js",
  "/scripts/event-list-window.js",
  "/scripts/event-form.js",
  "/scripts/event-editor-window-styles.js",
  "/scripts/event-editor-window-form.js",
  "/scripts/event-editor-window-script.js",
  "/scripts/event-editor-window.js",
  "/scripts/event-model.js",
  "/scripts/event-schedule.js",
  "/scripts/calendar-controls.js",
  "/scripts/event-calendar.js",
  "/scripts/journal-calendar.js",
  "/scripts/month-calendar.js",
  "/scripts/converter-tool.js",
  "/scripts/lunar-details.js",
  "/scripts/today-panel.js",
  "/scripts/weather-panel.js",
  "/scripts/market-panels.js",
  "/scripts/pwa-install.js",
  "/scripts/startup.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key !== CACHE_NAME)
      .map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/functions/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }

  const title = data.title || "Nhắc sự kiện";
  const options = {
    body: data.body || "",
    tag: data.tag || "lichviet-event-reminder",
    renotify: true,
    icon: data.icon || "/icons/app-icon-lichviet-transparent-192.png",
    badge: data.badge || "/icons/app-icon-lichviet-transparent-192.png",
    data: {
      url: data.url || "/#eventsTab",
      eventId: data.eventId || "",
      occurrenceDate: data.occurrenceDate || ""
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification && event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const target = new URL(targetUrl, self.location.origin);
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === target.origin && clientUrl.pathname === target.pathname) {
          return client.focus().then(() => client.navigate(target.href));
        }
      }

      if (clients.openWindow) return clients.openWindow(target.href);
      return null;
    })
  );
});
