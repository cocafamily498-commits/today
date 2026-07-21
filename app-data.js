(function () {
  "use strict";

  const parts = window.LichVietDataParts;
  window.LichVietData = {
    DB_NAME: parts.DB_NAME,
    DB_VERSION: parts.DB_VERSION,
    openDatabase: parts.openDatabase,
    createEvent: parts.createEvent,
    updateEvent: parts.updateEvent,
    deleteEvent: parts.deleteEvent,
    getEvent: parts.getEvent,
    getAllEvents: parts.getAllEvents,
    getEventsByDate: parts.getEventsByDate,
    getEventsByMonth: parts.getEventsByMonth,
    clearEventsReadCache: parts.clearEventsReadCache,
    createJournal: parts.createJournal,
    updateJournal: parts.updateJournal,
    getJournal: parts.getJournal,
    getJournalsByDate: parts.getJournalsByDate,
    deleteJournal: parts.deleteJournal,
    upsertJournalByDate: parts.upsertJournalByDate,
    getJournalByDate: parts.getJournalByDate,
    getAllJournals: parts.getAllJournals,
    deleteJournalByDate: parts.deleteJournalByDate,
    saveJournalImage: parts.saveJournalImage,
    getImage: parts.getImage,
    deleteImage: parts.deleteImage,
    dismissReminderOccurrence: parts.dismissReminderOccurrence,
    isReminderOccurrenceDismissed: parts.isReminderOccurrenceDismissed,
    getSetting: parts.getSetting,
    setSetting: parts.setSetting,
    getAppMeta: parts.getAppMeta,
    setAppMeta: parts.setAppMeta,
    exportBackup: parts.exportBackup,
    importBackup: parts.importBackup
  };
})();
