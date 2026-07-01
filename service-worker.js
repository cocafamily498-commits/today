const CACHE_NAME = "homnay-pwa-v29";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/scripts/styles/part-01.css",
  "/scripts/styles/part-02.css",
  "/scripts/styles/part-03.css",
  "/scripts/styles/part-04.css",
  "/scripts/styles/part-05.css",
  "/scripts/styles/part-06.css",
  "/scripts/styles/part-07.css",
  "/scripts/styles/part-08.css",
  "/scripts/styles/part-09.css",
  "/scripts/styles/part-10.css",
  "/scripts/styles/part-11.css",
  "/scripts/styles/part-12.css",
  "/scripts/styles/part-13.css",
  "/scripts/styles/part-14.css",
  "/scripts/styles/part-15.css",
  "/scripts/styles/part-16.css",
  "/scripts/styles/part-17.css",
  "/scripts/styles/event-list-dialog.css",
  "/scripts/styles/event-list-dialog.css?v=3",
  "/scripts/styles/event-list-dialog.css?v=4",
  "/scripts/styles/event-list-dialog.css?v=5",
  "/scripts/styles/event-list-dialog.css?v=6",
  "/scripts/styles/event-list-dialog.css?v=7",
  "/scripts/data/app-data-core.js",
  "/scripts/data/app-data-events.js",
  "/scripts/data/app-data-journals.js",
  "/scripts/data/app-data-backup.js",
  "/app-data.js",
  "/favicon.ico",
  "/favicon-lichviet.ico",
  "/manifest.webmanifest",
  "/icons/app-icon-lichviet-transparent-192.png",
  "/icons/app-icon-lichviet-transparent-512.png",
  "/icons/app-icon-lichviet-calendar-192.png",
  "/icons/app-icon-lichviet-calendar-512.png",
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
  "/scripts/event-list-window-filters.js",
  "/scripts/event-list-dialog-render.js",
  "/scripts/event-list-dialog-render.js?v=3",
  "/scripts/event-list-dialog-render.js?v=4",
  "/scripts/event-list-dialog-render.js?v=5",
  "/scripts/event-list-dialog-render.js?v=6",
  "/scripts/event-list-dialog-render.js?v=7",
  "/scripts/event-reminders-system.js",
  "/scripts/event-reminders-push.js",
  "/scripts/event-backup.js",
  "/scripts/event-today-reminders.js?v=2",
  "/scripts/event-list-window-dialog.js",
  "/scripts/event-list-window-dialog.js?v=3",
  "/scripts/event-list-window-dialog.js?v=4",
  "/scripts/event-list-window-dialog.js?v=5",
  "/scripts/event-form.js?v=2",
  "/scripts/event-editor-window-styles.js",
  "/scripts/event-editor-window-form.js",
  "/scripts/event-editor-window-script.js",
  "/scripts/event-editor-window.js",
  "/scripts/event-model.js",
  "/scripts/event-schedule.js",
  "/scripts/calendar-controls.js",
  "/scripts/event-calendar.js?v=3",
  "/scripts/journal-calendar.js",
  "/scripts/journal-form.js",
  "/scripts/journal-images.js",
  "/scripts/journal-dialog.js",
  "/scripts/month-calendar.js",
  "/scripts/converter-tool.js",
  "/scripts/lunar-details.js",
  "/scripts/today-panel.js",
  "/scripts/weather-panel.js",
  "/scripts/market-panels.js",
  "/scripts/pwa-install.js?v=2",
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
    icon: data.icon || "/icons/app-icon-lichviet-calendar-192.png",
    badge: data.badge || "/icons/app-icon-lichviet-calendar-192.png",
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
