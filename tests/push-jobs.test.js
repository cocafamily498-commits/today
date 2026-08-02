const assert = require("assert").strict;
const {
  createJobs,
  createNextJob,
  getDueBucketPrefixes,
  getNextAutomaticReminderTime
} = require("../netlify/functions/push-jobs");

function reminder(overrides = {}) {
  return {
    id: "reminder-1",
    eventId: "event-1",
    occurrenceDate: "2026-08-10",
    occurrenceAt: "2026-08-10T08:00:00.000Z",
    reminderAt: "2026-08-07T08:00:00.000Z",
    title: "Test event",
    body: "Test body",
    tag: "test",
    url: "/#eventsTab",
    icon: "/icon.png",
    badge: "/badge.png",
    ...overrides
  };
}

function run(name, test) {
  try {
    test();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run("stores only the next pending job for each reminder", () => {
  const jobs = createJobs("subscription-1", [reminder()], new Date("2026-08-01T00:00:00.000Z"));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].dueAt, "2026-08-07T08:00:00.000Z");
  assert.match(jobs[0].key, /^due\/2026\/08\/07\/08\/00\/subscription-1\//);
});

run("derives automatic reminders from scheduled time rather than runtime", () => {
  const first = createJobs("subscription-1", [reminder()], new Date("2026-08-01T00:00:00.000Z"))[0];
  const next = createNextJob(first, new Date("2026-08-07T08:07:00.000Z"));
  assert.equal(next.dueAt, "2026-08-08T08:00:00.000Z");
  assert.equal(next.type, "automatic");
});

run("uses stable one-day, two-hour and final one-hour checkpoints", () => {
  const occurrence = new Date("2026-08-10T08:00:00.000Z");
  assert.equal(
    getNextAutomaticReminderTime(new Date("2026-08-08T08:00:00.000Z"), occurrence).toISOString(),
    "2026-08-09T08:00:00.000Z"
  );
  assert.equal(
    getNextAutomaticReminderTime(new Date("2026-08-09T12:00:00.000Z"), occurrence).toISOString(),
    "2026-08-09T14:00:00.000Z"
  );
  assert.equal(
    getNextAutomaticReminderTime(new Date("2026-08-10T06:30:00.000Z"), occurrence).toISOString(),
    "2026-08-10T07:00:00.000Z"
  );
  assert.equal(getNextAutomaticReminderTime(new Date("2026-08-10T07:00:00.000Z"), occurrence), null);
});

run("does not create jobs that are already expired", () => {
  const jobs = createJobs("subscription-1", [reminder()], new Date("2026-08-07T08:31:00.000Z"));
  assert.deepEqual(jobs, []);
});

run("bounds due lookup to hour prefixes covering the grace window", () => {
  assert.deepEqual(
    getDueBucketPrefixes(new Date("2026-08-02T00:10:00.000Z")),
    ["due/2026/08/01/23/", "due/2026/08/02/00/"]
  );
});
