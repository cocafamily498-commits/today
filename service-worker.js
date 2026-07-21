const CACHE_NAME = "homnay-pwa-v137";
const SHARE_TARGET_CACHE = "homnay-share-target-files";
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
  "/styles.css?v=23",
  "/styles.css?v=24",
  "/styles.css?v=25",
  "/styles.css?v=26",
  "/styles.css?v=27",
  "/styles.css?v=28",
  "/styles.css?v=29",
  "/styles.css?v=30",
  "/styles.css?v=31",
  "/styles.css?v=32",
  "/styles.css?v=33",
  "/styles.css?v=34",
  "/styles.css?v=35",
  "/styles.css?v=36",
  "/styles.css?v=37",
  "/styles.css?v=38",
  "/styles.css?v=39",
  "/styles.css?v=40",
  "/styles.css?v=41",
  "/styles.css?v=42",
  "/styles.css?v=43",
  "/styles.css?v=44",
  "/styles.css?v=45",
  "/styles.css?v=46",
  "/styles.css?v=47",
  "/styles.css?v=48",
  "/styles.css?v=49",
  "/styles.css?v=50",
  "/styles.css?v=51",
  "/styles.css?v=52",
  "/styles.css?v=61",
  "/scripts/styles/part-01.css",
  "/scripts/styles/part-02.css",
  "/scripts/styles/part-02.css?v=2",
  "/scripts/styles/part-02.css?v=3",
  "/scripts/styles/part-03.css",
  "/scripts/styles/part-03.css?v=2",
  "/scripts/styles/part-03.css?v=3",
  "/scripts/styles/part-03.css?v=4",
  "/scripts/styles/part-03.css?v=5",
  "/scripts/styles/part-01.css?v=2",
  "/scripts/styles/part-03.css?v=6",
  "/scripts/styles/part-02.css?v=4",
  "/scripts/styles/part-02.css?v=5",
  "/scripts/styles/part-02.css?v=6",
  "/scripts/styles/part-02.css?v=7",
  "/scripts/styles/part-02.css?v=8",
  "/scripts/styles/part-02.css?v=9",
  "/scripts/styles/part-02.css?v=10",
  "/assets/fonts/inter-vietnamese.woff2",
  "/assets/fonts/inter-latin.woff2",
  "/scripts/styles/part-04.css",
  "/scripts/styles/part-04.css?v=2",
  "/scripts/styles/part-04.css?v=3",
  "/scripts/styles/part-04.css?v=4",
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
  "/scripts/styles/part-10.css?v=2",
  "/scripts/styles/part-11.css",
  "/scripts/styles/part-11.css?v=2",
  "/scripts/styles/part-11.css?v=3",
  "/scripts/styles/part-11.css?v=4",
  "/scripts/styles/part-11.css?v=5",
  "/scripts/styles/part-11.css?v=6",
  "/scripts/styles/part-12.css",
  "/scripts/styles/part-12.css?v=2",
  "/scripts/styles/part-12.css?v=3",
  "/scripts/styles/part-12.css?v=4",
  "/scripts/styles/part-12.css?v=5",
  "/scripts/styles/part-12.css?v=6",
  "/scripts/styles/part-13.css",
  "/scripts/styles/part-14.css",
  "/scripts/styles/part-15.css",
  "/scripts/styles/part-16.css",
  "/scripts/styles/part-16.css?v=2",
  "/scripts/styles/part-16.css?v=3",
  "/scripts/styles/part-16.css?v=4",
  "/scripts/styles/part-17.css",
  "/scripts/styles/part-18.css?v=1",
  "/scripts/styles/part-18.css?v=2",
  "/scripts/styles/part-18.css?v=3",
  "/scripts/styles/part-18.css?v=4",
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
  "/scripts/styles/event-list-dialog.css?v=18",
  "/scripts/styles/event-list-dialog.css?v=19",
  "/scripts/styles/event-list-dialog.css?v=20",
  "/scripts/styles/event-list-dialog.css?v=21",
  "/scripts/styles/event-list-dialog.css?v=22",
  "/scripts/styles/event-list-dialog.css?v=23",
  "/scripts/data/app-data-core.js",
  "/scripts/data/app-data-events.js",
  "/scripts/data/app-data-events.js?v=2",
  "/scripts/data/app-data-events.js?v=3",
  "/scripts/data/app-data-journals.js",
  "/scripts/data/app-data-backup.js",
  "/app-data.js",
  "/favicon.ico",
  "/favicon-lichviet.ico",
  "/manifest.webmanifest",
  "/manifest.webmanifest?v=10",
  "/manifest.webmanifest?v=11",
  "/icons/app-icon-lichviet-transparent-192.png",
  "/icons/app-icon-lichviet-transparent-512.png",
  "/icons/app-icon-lichviet-calendar-192.png",
  "/icons/app-icon-lichviet-calendar-512.png",
  "/icons/event-group-icons-sprite.svg",
  "/data/event-groups.json?v=1",
  "/data/event-groups.json?v=2",
  "/data/event-groups.json?v=3",
  "/partials/tabs.html",
  "/partials/today-tab.html",
  "/partials/converter-tab.html",
  "/partials/events-tab.html",
  "/partials/journals-tab.html",
  "/partials/app-info-tab.html",
  "/partials/event-dialog.html",
  "/partials/journal-dialog.html",
  "/partials/app-info-dialog.html",
  "/partials/tabs.html?v=2026-07-03-journal-actions",
  "/partials/today-tab.html?v=2026-07-03-journal-actions",
  "/partials/converter-tab.html?v=2026-07-03-journal-actions",
  "/partials/events-tab.html?v=2026-07-03-journal-actions",
  "/partials/journals-tab.html?v=2026-07-03-journal-actions",
  "/partials/app-info-tab.html?v=2026-07-03-journal-actions",
  "/partials/event-dialog.html?v=2026-07-03-journal-actions",
  "/partials/journal-dialog.html?v=2026-07-03-journal-actions",
  "/partials/app-info-dialog.html?v=2026-07-03-journal-actions",
  "/partials/tabs.html?v=2026-07-10-event-groups",
  "/partials/today-tab.html?v=2026-07-10-event-groups",
  "/partials/converter-tab.html?v=2026-07-10-event-groups",
  "/partials/events-tab.html?v=2026-07-10-event-groups",
  "/partials/journals-tab.html?v=2026-07-10-event-groups",
  "/partials/app-info-tab.html?v=2026-07-10-event-groups",
  "/partials/event-dialog.html?v=2026-07-10-event-groups",
  "/partials/journal-dialog.html?v=2026-07-10-event-groups",
  "/partials/app-info-dialog.html?v=2026-07-10-event-groups",
  "/partials/tabs.html?v=2026-07-10-event-group-select",
  "/partials/today-tab.html?v=2026-07-10-event-group-select",
  "/partials/converter-tab.html?v=2026-07-10-event-group-select",
  "/partials/events-tab.html?v=2026-07-10-event-group-select",
  "/partials/journals-tab.html?v=2026-07-10-event-group-select",
  "/partials/app-info-tab.html?v=2026-07-10-event-group-select",
  "/partials/event-dialog.html?v=2026-07-10-event-group-select",
  "/partials/journal-dialog.html?v=2026-07-10-event-group-select",
  "/partials/app-info-dialog.html?v=2026-07-10-event-group-select",
  "/partials/tabs.html?v=2026-07-10-event-group-icon-list",
  "/partials/today-tab.html?v=2026-07-10-event-group-icon-list",
  "/partials/converter-tab.html?v=2026-07-10-event-group-icon-list",
  "/partials/events-tab.html?v=2026-07-10-event-group-icon-list",
  "/partials/events-tab.html?v=2026-07-12-remove-event-backup-actions",
  "/partials/journals-tab.html?v=2026-07-10-event-group-icon-list",
  "/partials/app-info-tab.html?v=2026-07-10-event-group-icon-list",
  "/partials/event-dialog.html?v=2026-07-10-event-group-icon-list",
  "/partials/journal-dialog.html?v=2026-07-10-event-group-icon-list",
  "/partials/app-info-dialog.html?v=2026-07-10-event-group-icon-list",
  "/partials/tabs.html?v=2026-07-14-astrology-tool",
  "/partials/today-tab.html?v=2026-07-14-astrology-tool",
  "/partials/converter-tab.html?v=2026-07-14-astrology-tool",
  "/partials/events-tab.html?v=2026-07-14-astrology-tool",
  "/partials/journals-tab.html?v=2026-07-14-astrology-tool",
  "/partials/app-info-tab.html?v=2026-07-14-astrology-tool",
  "/partials/event-dialog.html?v=2026-07-14-astrology-tool",
  "/partials/journal-dialog.html?v=2026-07-14-astrology-tool",
  "/partials/app-info-dialog.html?v=2026-07-14-astrology-tool",
  "/partials/tabs.html?v=2026-07-14-astrology-result-details",
  "/partials/today-tab.html?v=2026-07-14-astrology-result-details",
  "/partials/converter-tab.html?v=2026-07-14-astrology-result-details",
  "/partials/events-tab.html?v=2026-07-14-astrology-result-details",
  "/partials/journals-tab.html?v=2026-07-14-astrology-result-details",
  "/partials/app-info-tab.html?v=2026-07-14-astrology-result-details",
  "/partials/event-dialog.html?v=2026-07-14-astrology-result-details",
  "/partials/journal-dialog.html?v=2026-07-14-astrology-result-details",
  "/partials/app-info-dialog.html?v=2026-07-14-astrology-result-details",
  "/partials/tabs.html?v=2026-07-14-astrology-year-control",
  "/partials/today-tab.html?v=2026-07-14-astrology-year-control",
  "/partials/converter-tab.html?v=2026-07-14-astrology-year-control",
  "/partials/events-tab.html?v=2026-07-14-astrology-year-control",
  "/partials/journals-tab.html?v=2026-07-14-astrology-year-control",
  "/partials/app-info-tab.html?v=2026-07-14-astrology-year-control",
  "/partials/event-dialog.html?v=2026-07-14-astrology-year-control",
  "/partials/journal-dialog.html?v=2026-07-14-astrology-year-control",
  "/partials/app-info-dialog.html?v=2026-07-14-astrology-year-control",
  "/scripts/partials-loader.js",
  "/scripts/partials-loader.js?v=2",
  "/scripts/partials-loader.js?v=3",
  "/scripts/partials-loader.js?v=4",
  "/scripts/partials-loader.js?v=5",
  "/scripts/partials-loader.js?v=6",
  "/scripts/partials-loader.js?v=7",
  "/scripts/partials-loader.js?v=8",
  "/scripts/partials-loader.js?v=9",
  "/scripts/partials-loader.js?v=10",
  "/scripts/lunar-core.js",
  "/scripts/lunar-core.js?v=2",
  "/scripts/app-shell.js",
  "/scripts/app-shell.js?v=2",
  "/scripts/confirm-dialog.js?v=2",
  "/scripts/event-list-window.js",
  "/scripts/event-list-window.js?v=2",
  "/scripts/event-list-window.js?v=3",
  "/scripts/event-list-window.js?v=4",
  "/scripts/event-list-window.js?v=5",
  "/scripts/event-list-window.js?v=6",
  "/scripts/event-list-window-filters.js",
  "/scripts/event-list-window-filters.js?v=2",
  "/scripts/event-list-window-filters.js?v=3",
  "/scripts/event-list-window-filters.js?v=4",
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
  "/scripts/event-list-dialog-render.js?v=14",
  "/scripts/event-list-dialog-render.js?v=15",
  "/scripts/event-list-dialog-render.js?v=16",
  "/scripts/event-list-dialog-render.js?v=17",
  "/scripts/event-list-dialog-render.js?v=18",
  "/scripts/event-list-dialog-render.js?v=19",
  "/scripts/event-reminders-system.js?v=3",
  "/scripts/event-reminders-system.js?v=4",
  "/scripts/event-reminders-push.js",
  "/scripts/event-reminders-push.js?v=2",
  "/scripts/event-reminders-push.js?v=3",
  "/scripts/event-reminders-push.js?v=4",
  "/scripts/event-reminders-push.js?v=5",
  "/scripts/event-reminders-push.js?v=6",
  "/scripts/event-backup.js",
  "/scripts/event-backup.js?v=2",
  "/scripts/event-backup.js?v=3",
  "/scripts/event-backup.js?v=4",
  "/scripts/event-backup.js?v=7",
  "/scripts/event-backup.js?v=8",
  "/scripts/google-drive-backup.js",
  "/scripts/google-drive-backup.js?v=1",
  "/scripts/google-drive-backup.js?v=2",
  "/scripts/event-today-reminders.js?v=2",
  "/scripts/event-today-reminders.js?v=3",
  "/scripts/event-today-reminders.js?v=4",
  "/scripts/event-today-reminders.js?v=5",
  "/scripts/event-today-reminders.js?v=6",
  "/scripts/event-today-reminders.js?v=7",
  "/scripts/event-today-reminders.js?v=8",
  "/scripts/event-list-window-dialog.js",
  "/scripts/event-list-window-dialog.js?v=3",
  "/scripts/event-list-window-dialog.js?v=4",
  "/scripts/event-list-window-dialog.js?v=5",
  "/scripts/event-list-window-dialog.js?v=6",
  "/scripts/event-list-window-dialog.js?v=7",
  "/scripts/event-list-window-dialog.js?v=8",
  "/scripts/event-list-window-dialog.js?v=9",
  "/scripts/event-groups.js?v=1",
  "/scripts/event-groups.js?v=2",
  "/scripts/event-groups.js?v=3",
  "/scripts/event-groups.js?v=4",
  "/scripts/event-groups.js?v=5",
  "/scripts/event-groups.js?v=6",
  "/scripts/event-groups.js?v=7",
  "/scripts/event-groups.js?v=8",
  "/scripts/event-groups.js?v=9",
  "/scripts/event-groups.js?v=10",
  "/scripts/event-groups.js?v=11",
  "/scripts/event-groups.js?v=12",
  "/scripts/event-groups.js?v=13",
  "/scripts/event-groups.js?v=14",
  "/scripts/event-form.js?v=2",
  "/scripts/event-form.js?v=3",
  "/scripts/event-form.js?v=4",
  "/scripts/event-form.js?v=5",
  "/scripts/event-form.js?v=6",
  "/scripts/event-form.js?v=7",
  "/scripts/event-form.js?v=8",
  "/scripts/event-form.js?v=9",
  "/scripts/event-form.js?v=10",
  "/scripts/event-form.js?v=11",
  "/scripts/event-form.js?v=13",
  "/scripts/event-form.js?v=14",
  "/scripts/event-editor-window-styles.js",
  "/scripts/event-editor-window-styles.js?v=2",
  "/scripts/event-editor-window-styles.js?v=3",
  "/scripts/event-editor-window-styles.js?v=4",
  "/scripts/event-editor-window-styles.js?v=5",
  "/scripts/event-editor-window-form.js",
  "/scripts/event-editor-window-form.js?v=2",
  "/scripts/event-editor-window-form.js?v=3",
  "/scripts/event-editor-window-script.js",
  "/scripts/event-editor-window-script.js?v=2",
  "/scripts/event-editor-window-script.js?v=3",
  "/scripts/event-editor-window-script.js?v=4",
  "/scripts/event-editor-window.js",
  "/scripts/event-editor-window.js?v=2",
  "/scripts/event-model.js",
  "/scripts/event-model.js?v=2",
  "/scripts/event-model.js?v=3",
  "/scripts/event-model.js?v=4",
  "/scripts/event-model.js?v=5",
  "/scripts/event-model.js?v=6",
  "/scripts/event-model.js?v=7",
  "/scripts/event-model.js?v=8",
  "/scripts/event-schedule.js",
  "/scripts/event-schedule.js?v=2",
  "/scripts/calendar-controls.js",
  "/scripts/calendar-controls.js?v=2",
  "/scripts/calendar-controls.js?v=3",
  "/scripts/calendar-controls.js?v=4",
  "/scripts/app-shell.js?v=3",
  "/scripts/app-shell.js?v=4",
  "/scripts/app-shell.js?v=5",
  "/scripts/app-shell.js?v=6",
  "/scripts/app-shell.js?v=7",
  "/scripts/app-shell.js?v=8",
  "/scripts/event-calendar.js?v=3",
  "/scripts/event-calendar.js?v=4",
  "/scripts/event-calendar.js?v=5",
  "/scripts/event-calendar.js?v=6",
  "/scripts/event-calendar.js?v=7",
  "/scripts/event-calendar.js?v=8",
  "/scripts/event-calendar.js?v=9",
  "/scripts/event-calendar.js?v=10",
  "/scripts/journal-calendar.js",
  "/scripts/journal-form.js",
  "/scripts/journal-calendar.js?v=2",
  "/scripts/journal-form.js?v=2",
  "/scripts/journal-images.js",
  "/scripts/journal-dialog.js",
  "/scripts/month-calendar.js",
  "/scripts/month-calendar.js?v=2",
  "/scripts/month-calendar.js?v=3",
  "/scripts/converter-tool.js",
  "/scripts/converter-tool.js?v=2",
  "/scripts/lunar-details.js",
  "/scripts/astrology-tool.js?v=1",
  "/scripts/astrology-tool.js?v=2",
  "/scripts/astrology-tool.js?v=3",
  "/scripts/today-panel.js",
  "/scripts/today-panel.js?v=2",
  "/scripts/today-panel.js?v=3",
  "/scripts/weather-panel.js",
  "/scripts/market-panels.js",
  "/scripts/pwa-install.js?v=2",
  "/scripts/pwa-install.js?v=3",
  "/scripts/startup.js",
  "/scripts/startup.js?v=2",
  "/scripts/startup.js?v=3",
  "/styles.css?v=67",
  "/scripts/styles/part-07.css?v=4",
  "/scripts/styles/part-08.css?v=3",
  "/scripts/styles/part-10.css?v=4",
  "/scripts/styles/part-16.css?v=6",
  "/scripts/data/app-data-core.js?v=2",
  "/scripts/data/app-data-journals.js?v=2",
  "/scripts/data/app-data-backup.js?v=2",
  "/app-data.js?v=2",
  "/scripts/partials-loader.js?v=12",
  "/scripts/event-groups.js?v=15",
  "/scripts/calendar-controls.js?v=5",
  "/scripts/journal-calendar.js?v=4",
  "/scripts/journal-form.js?v=3",
  "/scripts/journal-dialog.js?v=6",
  "/scripts/month-calendar.js?v=4",
  "/partials/tabs.html?v=2026-07-21-journal-groups-v2",
  "/partials/today-tab.html?v=2026-07-21-journal-groups-v2",
  "/partials/converter-tab.html?v=2026-07-21-journal-groups-v2",
  "/partials/events-tab.html?v=2026-07-21-journal-groups-v2",
  "/partials/journals-tab.html?v=2026-07-21-journal-groups-v2",
  "/partials/app-info-tab.html?v=2026-07-21-journal-groups-v2",
  "/partials/event-dialog.html?v=2026-07-21-journal-groups-v2",
  "/partials/journal-dialog.html?v=2026-07-21-journal-groups-v2",
  "/partials/app-info-dialog.html?v=2026-07-21-journal-groups-v2",
  "/styles.css?v=68",
  "/scripts/styles/part-10.css?v=5",
  "/scripts/partials-loader.js?v=13",
  "/scripts/journal-calendar.js?v=5",
  "/scripts/journal-dialog.js?v=7",
  "/partials/tabs.html?v=2026-07-21-journal-list-filters",
  "/partials/today-tab.html?v=2026-07-21-journal-list-filters",
  "/partials/converter-tab.html?v=2026-07-21-journal-list-filters",
  "/partials/events-tab.html?v=2026-07-21-journal-list-filters",
  "/partials/journals-tab.html?v=2026-07-21-journal-list-filters",
  "/partials/app-info-tab.html?v=2026-07-21-journal-list-filters",
  "/partials/event-dialog.html?v=2026-07-21-journal-list-filters",
  "/partials/journal-dialog.html?v=2026-07-21-journal-list-filters",
  "/partials/app-info-dialog.html?v=2026-07-21-journal-list-filters",
  "/styles.css?v=69",
  "/scripts/styles/part-10.css?v=6",
  "/scripts/partials-loader.js?v=14",
  "/scripts/journal-calendar.js?v=6",
  "/partials/tabs.html?v=2026-07-21-journal-group-icons",
  "/partials/today-tab.html?v=2026-07-21-journal-group-icons",
  "/partials/converter-tab.html?v=2026-07-21-journal-group-icons",
  "/partials/events-tab.html?v=2026-07-21-journal-group-icons",
  "/partials/journals-tab.html?v=2026-07-21-journal-group-icons",
  "/partials/app-info-tab.html?v=2026-07-21-journal-group-icons",
  "/partials/event-dialog.html?v=2026-07-21-journal-group-icons",
  "/partials/journal-dialog.html?v=2026-07-21-journal-group-icons",
  "/partials/app-info-dialog.html?v=2026-07-21-journal-group-icons",
  "/styles.css?v=70",
  "/scripts/styles/part-10.css?v=7",
  "/scripts/journal-dialog.js?v=8",
  "/styles.css?v=71",
  "/scripts/styles/part-10.css?v=8",
  "/scripts/styles/part-16.css?v=7",
  "/scripts/partials-loader.js?v=15",
  "/scripts/journal-dialog.js?v=9",
  "/partials/tabs.html?v=2026-07-21-journal-filter-order",
  "/partials/today-tab.html?v=2026-07-21-journal-filter-order",
  "/partials/converter-tab.html?v=2026-07-21-journal-filter-order",
  "/partials/events-tab.html?v=2026-07-21-journal-filter-order",
  "/partials/journals-tab.html?v=2026-07-21-journal-filter-order",
  "/partials/app-info-tab.html?v=2026-07-21-journal-filter-order",
  "/partials/event-dialog.html?v=2026-07-21-journal-filter-order",
  "/partials/journal-dialog.html?v=2026-07-21-journal-filter-order",
  "/partials/app-info-dialog.html?v=2026-07-21-journal-filter-order",
  "/scripts/journal-calendar.js?v=7",
  "/scripts/journal-form.js?v=4",
  "/scripts/journal-calendar.js?v=8",
  "/scripts/journal-form.js?v=5",
  "/scripts/journal-dialog.js?v=10",
  "/scripts/journal-calendar.js?v=9",
  "/scripts/journal-dialog.js?v=11",
  "/scripts/journal-calendar.js?v=10",
  "/styles.css?v=72",
  "/scripts/styles/part-10.css?v=9",
  "/styles.css?v=73",
  "/scripts/styles/part-16.css?v=8",
  "/styles.css?v=74",
  "/scripts/styles/part-16.css?v=9",
  "/scripts/journal-calendar.js?v=11",
  "/styles.css?v=75",
  "/scripts/styles/part-02.css?v=20",
  "/scripts/partials-loader.js?v=16",
  "/partials/tabs.html?v=2026-07-21-settings-icons",
  "/partials/today-tab.html?v=2026-07-21-settings-icons",
  "/partials/converter-tab.html?v=2026-07-21-settings-icons",
  "/partials/events-tab.html?v=2026-07-21-settings-icons",
  "/partials/journals-tab.html?v=2026-07-21-settings-icons",
  "/partials/app-info-tab.html?v=2026-07-21-settings-icons",
  "/partials/event-dialog.html?v=2026-07-21-settings-icons",
  "/partials/journal-dialog.html?v=2026-07-21-settings-icons",
  "/partials/app-info-dialog.html?v=2026-07-21-settings-icons",
  "/scripts/event-backup.js?v=9",
  "/scripts/event-backup.js?v=10"
];

// APP_SHELL keeps historical entries for compatibility, but installing every
// cache-busted version makes updates unnecessarily expensive. The last entry
// for a pathname is the current version used by index.html/styles.css.
const INSTALL_SHELL = Array.from(APP_SHELL.reduce((assets, asset) => {
  const url = new URL(asset, self.location.origin);
  assets.set(url.pathname, asset);
  return assets;
}, new Map()).values());

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(INSTALL_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key !== CACHE_NAME && key !== SHARE_TARGET_CACHE)
      .map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith((async () => {
      const formData = await request.formData();
      const file = formData.get("backup");
      if (!(file instanceof File) || !file.size) {
        return Response.redirect(new URL("/?share-error=no-file", self.location.origin), 303);
      }
      const shareId = `${Date.now()}-${crypto.randomUUID()}`;
      const fileUrl = new URL(`/share-target-file?id=${encodeURIComponent(shareId)}`, self.location.origin);
      const cache = await caches.open(SHARE_TARGET_CACHE);
      await cache.put(fileUrl, new Response(file, {
        headers: {
          "content-type": file.type || "application/zip",
          "x-share-file-name": encodeURIComponent(file.name || "Sotaylichviet-backup.zip"),
          "cache-control": "no-store"
        }
      }));
      return Response.redirect(new URL(`/?share-target=${encodeURIComponent(shareId)}`, self.location.origin), 303);
    })());
    return;
  }

  if (request.method === "GET" && url.pathname === "/share-target-file") {
    event.respondWith((async () => {
      const cache = await caches.open(SHARE_TARGET_CACHE);
      const response = await cache.match(request);
      if (!response) return new Response("Shared file not found", { status: 404 });
      await cache.delete(request);
      return response;
    })());
    return;
  }

  if (request.method !== "GET") return;
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
