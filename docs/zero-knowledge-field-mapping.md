# Zero Knowledge / Local First field mapping

This document is the migration contract for schema version `zk-v1`. It is based on
the current IndexedDB v3 schema and `zero-knowledge-integration-spec.md`.

## Stored records

| Current store | Current field | zk-v1 destination | Classification | Notes |
|---|---|---|---|---|
| `events` | `id` | `id` | plaintext | Random identifier; included in every AAD. |
| `events` | `date`, `month`, `time`, `allDay` | `schedule.startAt`, `schedule.endAt`, indexes | plaintext schedule | Needed for calendar/scheduler. `month` is derived and must not be trusted independently. |
| `events` | `calendarLabel`, `lunar`, `repeat` | `schedule.calendar`, `schedule.lunar`, `schedule.recurrenceRule` | plaintext schedule | Required to calculate occurrences while locked. Authenticated by `scheduleAuth`. |
| `events` | reminder ids, enabled, offsets, time, snooze options | `schedule.reminders`, `nextReminderAt` | plaintext schedule | Content-free scheduling data only; authenticated by `scheduleAuth`. |
| `events` | `eventType`, `eventTypeId`, `color` | `listCipher` | ciphertext | These values can reveal event meaning/category and are not required by the OS scheduler. |
| `events` | `title` | `listCipher` | ciphertext | Never sent to push/backend unless an explicit future per-event opt-in exists. |
| `events` | `note` | `detailCipher` | ciphertext | Sensitive content. |
| `events` | `createdAt` | `detailCipher` | ciphertext | Not required for ordering/sync. |
| `events` | `updatedAt` | `updatedAt` | plaintext | Minimal sync metadata, authenticated through record AAD. |
| `events` | implicit state | `revision`, `deleted` | plaintext | Monotonic revision and tombstone; hard delete is deferred. |
| `journals` | `id` | `id` | plaintext | Included in AAD. |
| `journals` | `date`, `month` | `schedule.date`, indexed date | plaintext schedule | Enables calendar dots/range queries while locked; authenticated by `scheduleAuth`. |
| `journals` | `title`, `eventTypeId` | `listCipher` | ciphertext | Decrypted only for visible list rows. |
| `journals` | `text`, `createdAt` | `detailCipher` | ciphertext | Decrypted only when opening/exporting one journal. |
| `journals` | `imageIds` | `detailCipher.attachmentIds` | ciphertext | Prevents relationship leakage in the journal record. |
| `journals` | `updatedAt` | `updatedAt` | plaintext | Minimal sync metadata. |
| `journals` | implicit state | `revision`, `deleted` | plaintext | Monotonic revision and tombstone. |
| `images` | `id` | encrypted attachment `id` | plaintext | Random identifier included in attachment AAD. |
| `images` | `blob` | attachment chunks | ciphertext | Each chunk has a fresh IV and AAD containing vault/record/attachment/chunk/revision. |
| `images` | `mimeType`, `width`, `height`, `createdAt` | encrypted attachment metadata | ciphertext | Not required for scheduling. |
| `images` | `size` | `size` plus encrypted metadata | plaintext leakage | Required for quota/streaming checks; exact size leakage is documented. |
| `reminderDismissals` | all current fields | content-free notification state | plaintext schedule | IDs/dates only; authenticated when associated event is verified. |
| `settings` | UI preferences, group definitions | keep per approved key | plaintext or ciphertext by allowlist | Unknown/new keys default to ciphertext. OAuth tokens and secrets are forbidden. |
| `appMeta` | schema/checkpoints/device heads | app metadata | plaintext | Must never contain password, phrase, raw key, or content. |

## Transport and runtime

| Flow | Current exposure | zk-v1 rule |
|---|---|---|
| ZIP and Google Drive backup | Full event/journal JSON and image bytes are plaintext. | Export only vault recovery wrapper, authenticated encrypted manifest, ciphertext records/chunks, and minimal schedule metadata. |
| Import | Clears stores one by one, so failure can leave a partial restore. | Parse with limits, authenticate before writes, stage under an import id, then atomically promote. Never clear legacy plaintext during migration. |
| Web push | Sends `event.title` and a descriptive body to Netlify. | Send generic title/body plus event id and schedule timestamps. The backend must reject client-supplied content fields in zk-v1. |
| Local notifications | Reads full plaintext event. | Scheduler reads schedule only. Content is decrypted only while the vault is unlocked and only for an explicit notification-content opt-in. |
| Google Drive | Uploads plaintext ZIP. | Drive receives the same ciphertext-only archive as local export. |
| Sync | No record sync protocol; Drive backup is replacement-based. | Compare `{vaultId,id,revision,cipherHash,deleted}`; equal revision/different hash is a conflict, never silent overwrite. |

## Safe migration and cutover

1. Add versioned `zk_*_v1` shadow stores without changing or deleting v3 stores.
2. Create/unlock a vault and keep the non-extractable DEK in memory only.
3. Migrate bounded batches. In one transaction, write ciphertext plus a checkpoint; never update the source record.
4. Immediately decrypt each written record and compare canonical source/round-trip values. Attachments additionally compare byte length and SHA-256.
5. Resume from per-store checkpoints after a crash. A changed source record is re-encrypted at a new revision.
6. Verify count, sorted ID set, record digest, attachment count/size/digest, and GCM authentication for the complete dataset.
7. Mark `verified`; this still does not delete plaintext. Export and restore a ciphertext backup in an isolated/staging database and verify it.
8. Mark `cutover-ready`, then switch repositories behind `zkStorageEnabled`. Keep legacy stores read-only for rollback.
9. Plaintext cleanup is a separate, explicit maintenance release after a retention period and user-confirmed backup. It is intentionally not part of this migration implementation.

Rollback before cleanup only changes the repository feature flag back to v3. No reverse decryption migration is required.
