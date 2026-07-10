const CACHE_NAME = "homnay-pwa-v61";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/styles.css?v=15",
  "/styles.css?v=16",
  "/styles.css?v=17",
  "/styles.css?v=18",
  "/styles.css?v=19",
  "/styles.css?v=20",
  "/styles.css?v=21",
  "/styles.css?v=22",
  "/scripts/styles/part-01.css",
  "/scripts/styles/part-02.css",
  "/scripts/styles/part-02.css?v=2",
  "/scripts/styles/part-03.css",
  "/scripts/styles/part-04.css",
  "/scripts/styles/part-05.css",
  "/scripts/styles/part-06.css",
  "/scripts/styles/part-06.css?v=2",
  "/scripts/styles/part-07.css",
  "/scripts/styles/part-07.css?v=2",
  "/scripts/styles/part-08.css",
  "/scripts/styles/part-08.css?v=2",
  "/scripts/styles/part-09.css",
  "/scripts/styles/part-09.css?v=2",
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
  "/scripts/styles/event-list-dialog.css?v=8",
  "/scripts/styles/event-list-dialog.css?v=9",
  "/scripts/styles/event-list-dialog.css?v=10",
  "/scripts/styles/event-list-dialog.css?v=11",
  "/scripts/styles/event-list-dialog.css?v=12",
  "/scripts/styles/event-list-dialog.css?v=13",
  "/scripts/styles/event-list-dialog.css?v=14",
  "/scripts/styles/event-list-dialog.css?v=15",
  "/scripts/styles/event-list-dialog.css?v=16",
  "/scripts/styles/event-list-dialog.css?v=17",
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
  "/scripts/partials-loader.js?v=2",
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
  "/scripts/event-list-dialog-render.js?v=8",
  "/scripts/event-list-dialog-render.js?v=9",
  "/scripts/event-list-dialog-render.js?v=10",
  "/scripts/event-list-dialog-render.js?v=11",
  "/scripts/event-list-dialog-render.js?v=12",
  "/scripts/event-list-dialog-render.js?v=13",
  "/scripts/event-reminders-system.js?v=3",
  "/scripts/event-reminders-system.js?v=4",
  "/scripts/event-reminders-push.js",
  "/scripts/event-reminders-push.js?v=2",
  "/scripts/event-reminders-push.js?v=3",
  "/scripts/event-reminders-push.js?v=4",
  "/scripts/event-reminders-push.js?v=5",
  "/scripts/event-reminders-push.js?v=6",
  "/scripts/event-backup.js",
  "/scripts/event-today-reminders.js?v=2",
  "/scripts/event-today-reminders.js?v=3",
  "/scripts/event-today-reminders.js?v=4",
  "/scripts/event-today-reminders.js?v=5",
  "/scripts/event-today-reminders.js?v=6",
  "/scripts/event-today-reminders.js?v=7",
  "/scripts/event-list-window-dialog.js",
  "/scripts/event-list-window-dialog.js?v=3",
  "/scripts/event-list-window-dialog.js?v=4",
  "/scripts/event-list-window-dialog.js?v=5",
  "/scripts/event-list-window-dialog.js?v=6",
  "/scripts/event-list-window-dialog.js?v=7",
  "/scripts/event-list-window-dialog.js?v=8",
  "/scripts/event-form.js?v=2",
  "/scripts/event-form.js?v=3",
  "/scripts/event-form.js?v=4",
  "/scripts/event-form.js?v=5",
  "/scripts/event-form.js?v=6",
  "/scripts/event-editor-window-styles.js",
  "/scripts/event-editor-window-styles.js?v=2",
  "/scripts/event-editor-window-styles.js?v=3",
  "/scripts/event-editor-window-styles.js?v=4",
  "/scripts/event-editor-window-form.js",
  "/scripts/event-editor-window-form.js?v=2",
  "/scripts/event-editor-window-script.js",
  "/scripts/event-editor-window-script.js?v=2",
  "/scripts/event-editor-window.js",
  "/scripts/event-model.js",
  "/scripts/event-model.js?v=2",
  "/scripts/event-model.js?v=3",
  "/scripts/event-model.js?v=4",
  "/scripts/event-model.js?v=5",
  "/scripts/event-schedule.js",
  "/scripts/event-schedule.js?v=2",
  "/scripts/calendar-controls.js",
  "/scripts/event-calendar.js?v=3",
  "/scripts/event-calendar.js?v=4",
  "/scripts/event-calendar.js?v=5",
  "/scripts/event-calendar.js?v=6",
  "/scripts/event-calendar.js?v=7",
  "/scripts/event-calendar.js?v=8",
  "/scripts/event-calendar.js?v=9",
  "/scripts/journal-calendar.js",
  "/scripts/journal-form.js",
  "/scripts/journal-calendar.js?v=2",
  "/scripts/journal-form.js?v=2",
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
          return client.navigate(target.href)
            .then((navigatedClient) => (navigatedClient || client).focus())
            .then((focusedClient) => {
              focusedClient.postMessage({
                type: "lichviet-event-reminder-open",
                eventId: event.notification.data && event.notification.data.eventId || "",
                occurrenceDate: event.notification.data && event.notification.data.occurrenceDate || ""
              });
              return focusedClient;
            });
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(target.href).then((openedClient) => {
          if (openedClient) {
            openedClient.postMessage({
              type: "lichviet-event-reminder-open",
              eventId: event.notification.data && event.notification.data.eventId || "",
              occurrenceDate: event.notification.data && event.notification.data.occurrenceDate || ""
            });
          }
          return openedClient;
        });
      }
      return null;
    })
  );
});
