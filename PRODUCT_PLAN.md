# Gym Check-in System Template — Product Plan

## Product direction

Gym Check-in System Template should turn the working AXIS Check-in system into a reusable, client-ready product for a single gym. It should preserve the proven scanner experience and lightweight Google-based architecture while moving gym-specific values into configuration and giving the owner a simple admin interface.

The template should be adaptable by changing the gym name, logo, colors, schedule, training types, member data, QR card design, timezone, and basic messages. It is not intended to become a broad gym-management platform or multi-tenant SaaS product.

## 1. Current AXIS baseline

The current system already provides a complete working check-in path:

- A static, full-screen tablet scanner hosted from GitHub Pages.
- Camera-based QR scanning with a visible scan frame.
- QR parsing for raw member IDs such as `AJJ001` and URLs containing an `id` parameter.
- Loading, success, duplicate, invalid, and connection-error screens.
- Sound, vibration, automatic reset, and a 20-second JSONP timeout.
- A Google Apps Script web app used as the check-in backend.
- Google Sheets as the operational data store.
- Member lookup from the `Mitglieder` sheet.
- Schedule-based check-in windows from `Training_Schedule`.
- Duplicate prevention per training session using `Checkin_State` and a training key.
- Attendance recording with member, training, and message metadata.
- Personal and generated post-check-in messages with message-state tracking.
- QR/member card generation using Google Slides, Drive, and an external QR image service.
- Legacy direct-link and older scanner paths retained for compatibility.
- A GitHub-first workflow: source is committed and pushed, then Apps Script is updated with `clasp push` from `apps-script/`.

Today, the owner experience is primarily based on raw Google Sheets and manually run Apps Script functions. Branding, frontend reminder times, URLs, sheet names, message logic, and card details contain AXIS-specific assumptions.

One important template gap is active-status enforcement: the current AXIS card batch checks member status, but the main fast check-in lookup does not clearly reject inactive members. The template should make status validation part of the primary check-in transaction.

## 2. What the template should reuse

Reuse the working behavior and interaction patterns rather than replacing them:

- Tablet-friendly, full-screen scanner layout.
- Continuous camera QR scanning.
- Simple ready → loading → result → automatic reset flow.
- Large, readable success and error states.
- Sound and vibration feedback.
- Post-check-in welcome or motivational messages.
- Schedule-based check-in windows.
- Duplicate protection tied to a specific training session.
- Active/inactive member concept, with stronger enforcement in the template.
- Compact QR payload based on a member ID or similarly safe identifier.
- Branded QR/member card generation.
- Apps Script and Google Sheets for a single-gym installation.
- GitHub as source of truth and `clasp` as the Apps Script deployment mechanism.

Apps Script plus Sheets remains suitable for the MVP because it is inexpensive, familiar, easy to hand over, and already proven by AXIS. Reconsider the architecture only if real usage reaches Apps Script quota, concurrency, or performance limits.

## 3. Per-gym configuration

The following must be configuration, not copied constants scattered through code:

| Area | Configurable values |
|---|---|
| Identity | Gym name, short name, locale, timezone |
| Branding | Logo, icon, primary/accent/background colors, card design |
| Scanner text | Ready, loading, success, duplicate, inactive, closed-window, and error text |
| Scanner behavior | Result reset delays, sound/vibration options, preferred camera |
| Check-in rules | Window before/after class start and duplicate policy |
| Schedule | Active days, start times, training types, display names, audiences/categories |
| Members | ID format, names, status, optional category |
| Messages | Basic active messages and optional training/category targeting |
| Integration | Apps Script endpoint, scanner URL, Drive folder, Slides template ID |
| Deployment | Apps Script project binding and client-specific hosting settings |

Use one clear configuration model. The backend should be authoritative for schedule and check-in rules; the scanner should not maintain a second hardcoded schedule. Public scanner configuration may be loaded from a small safe config response or generated client config file. Secrets and admin authorization must not be exposed there.

## 4. AXIS-specific parts to simplify

Do not copy these directly into every client instance:

- AXIS names, URLs, logos, icons, colors, German strings, and Drive folder names.
- The hardcoded AXIS reminder schedule in the scanner.
- `AJJ`-specific member ID validation.
- AXIS-specific types such as Gi, No-Gi, Wrestling, Kinder, and Sparring.
- German title-string checks used by the frontend to infer backend state.
- The current advanced message-selection and non-repetition logic as a mandatory feature.
- AXIS-specific content columns and internal attendance metadata in the owner view.
- Test functions containing fixed AXIS member IDs.
- Multiple legacy check-in implementations with different duplicate rules.
- Repeated helpers and compatibility functions not required by a new installation.

For the template, use stable machine-readable response states such as `success`, `duplicate`, `not_found`, `inactive`, `outside_window`, and `error`. Display text should come from configuration rather than control frontend behavior.

Advanced message rotation may remain an optional module for clients who want it. The default MVP should use a small message list with optional training-type targeting.

## 5. Owner/admin interface

The admin panel is the owner's primary daily workspace. The owner uses it to add or edit members, activate or deactivate them, generate cards, review attendance, manage the schedule, and update settings. Google Sheets is internal storage and a readable backup/audit surface, not the normal operating interface.

The owner never creates, chooses, or edits Member IDs in Google Sheets. When a member is created, the backend atomically generates the next unique ID from the configured prefix and number format. That ID is immutable after creation and is shown in the admin panel only as a system-assigned reference.

All admin calls are protected and return `{ ok, data, error }`; form errors are shown inline and unexpected errors use a reusable retry panel. The interface must not expose sheet IDs, cache keys, state rows, callback names, deployment IDs, or message-cycle metadata.

### Dashboard screen

- **Purpose:** show today's operating status at a glance.
- **Visible fields:** gym name, local date, today's check-in count, active-member count, current/next training, and 10 most recent check-ins (`time`, `member name`, `training`).
- **Actions:** `Add member`, `View attendance`, `Open schedule`, and refresh.
- **Filters:** training dropdown for today's sessions; default `All trainings`.
- **Empty state:** “No check-ins today” with the next scheduled training, if one exists.
- **Error state:** keep navigation available, show “Dashboard data could not be loaded” and `Retry`.
- **Backend:** `getDashboardData({ date, trainingId? })`.

### Members screen

- **Purpose:** find and manage members.
- **Visible fields:** Member ID, first name, last name, status, optional category, last attendance, and card status.
- **Actions:** `Add member`; row actions `View`, `Edit`, `Activate/Deactivate`, and `Generate card`.
- **Filters:** text search across ID/name, status (`Active`, `Inactive`, `All`), category, and page size; default active members.
- **Empty state:** “No members match these filters”; if there are no members, show `Add first member`.
- **Error state:** table-level load error with `Retry`; failed status changes revert the toggle and show the backend message.
- **Backend:** `listMembers(filters)`, `setMemberStatus(memberId, active)`, and navigation to member/card functions.

### Add/Edit Member screen

- **Purpose:** create one member or update editable profile data.
- **Visible fields:** first name, last name, status, optional category, joined date, and notes. On creation, show a read-only “Member ID will be generated automatically” notice or non-authoritative preview. On edit, show the assigned Member ID as read-only.
- **Actions:** `Save`, `Save and generate card` for new members, and `Cancel`.
- **Controls:** category dropdown from active configured categories; status toggle; joined-date picker.
- **Empty/default state:** new member defaults to active and today as joined date; no Member ID input is available.
- **Validation/error state:** require first name and last name; if ID generation encounters a conflict, retry safely under a lock or return a system error without creating a partial member; keep entered values after a failed save.
- **Backend:** `getMemberFormOptions()`, `createMember(data)`, and `updateMember(memberId, data)`.

### Member Detail screen

- **Purpose:** show one member's operational record without exposing internal state.
- **Visible fields:** profile fields, status, card preview/link, joined date, last check-in, total check-ins in selected period, and recent attendance table.
- **Actions:** `Edit`, `Activate/Deactivate`, `Generate/Regenerate card`, `Download card`, and `Back to members`.
- **Filters:** attendance period (`30 days`, `90 days`, `This year`, custom dates).
- **Empty state:** “No attendance recorded for this period”; missing card shows `Generate card`.
- **Error state:** distinguish member not found from attendance/card load errors; card failure must not block profile display.
- **Backend:** `getMember(memberId)`, `getMemberAttendance(memberId, filters)`, `setMemberStatus(...)`, and `generateMemberCard(memberId)`.

### Attendance screen

- **Purpose:** provide the owner-facing attendance ledger and everyday filters.
- **Visible fields:** date/time, Member ID, first name, last name, training type, training name, and training start.
- **Actions:** `Apply filters`, `Clear`, `Refresh`, and optional `Export CSV` after the table is stable.
- **Filters:** from/to date, training type, training/session, member search; default today in gym timezone.
- **Empty state:** “No attendance found for the selected filters.”
- **Error state:** retain selected filters, show a retry action, and never expose raw sheet errors.
- **Backend:** `getAttendance(filters)` and optional `exportAttendanceCsv(filters)`.

### Schedule screen

- **Purpose:** manage recurring weekly check-in sessions and the short training-type list.
- **Visible fields:** active, day of week, start time, end time, training type, display name, optional audience/category, and effective check-in window.
- **Actions:** `Add session`, `Edit`, `Activate/Deactivate`, `Delete` only when unused, `Save order`, and `Manage training types`.
- **Filters:** day of week, active status, training type.
- **Empty state:** “No sessions configured” with `Add first session`.
- **Validation/error state:** require valid times and training type; warn about overlapping sessions for the same audience; failed saves leave the form open.
- **Backend:** `listSchedule()`, `createScheduleEntry(data)`, `updateScheduleEntry(scheduleId, data)`, `setScheduleStatus(scheduleId, active)`, `deleteScheduleEntry(scheduleId)`, and training-type CRUD.

### Settings screen

- **Purpose:** configure one gym instance without editing source code.
- **Visible fields:** gym name/short name, locale, timezone, logo URL/file reference, brand colors, Member ID prefix/number width, default check-in minutes before/after start, reset delays, scanner texts, preferred camera, sound/vibration switches, basic messages, scanner URL, card template ID, and card output folder ID. Member ID format becomes read-only after the first member is created.
- **Actions:** `Save settings`, `Preview scanner branding`, `Reset unsaved changes`, and `Test card configuration`.
- **Controls:** timezone and locale dropdowns, color inputs, numeric bounds, text areas, and enabled toggles.
- **Empty/default state:** setup defaults provide neutral branding and safe timing values; deployment-specific IDs remain visibly incomplete until configured.
- **Validation/error state:** validate colors, URLs/IDs, positive delays, and check-in ranges; show restart/redeploy notice only for settings that actually require it.
- **Backend:** `getSettings()`, `updateSettings(data)`, `getPublicScannerConfig()`, and `testCardConfiguration()`.

### QR Cards screen

- **Purpose:** generate and locate member cards without running Apps Script functions manually.
- **Visible fields:** member ID/name, status, current card thumbnail/link, last generated time, and generation status.
- **Actions:** `Generate`, `Regenerate`, `Download/Open`, and `Generate missing cards` for active members with confirmation.
- **Filters:** member search, card status (`Missing`, `Generated`, `Failed`, `All`), and member status.
- **Empty state:** “No members need cards” or “No members match these filters.”
- **Error state:** show failure per member with `Retry`; one failure must not stop the remaining batch.
- **Backend:** `listMemberCards(filters)`, `generateMemberCard(memberId)`, and `generateMissingMemberCards(options)`.

Admin authentication must be decided in Phase 1 and implemented before write actions. The protected admin interface must not rely on the anonymous scanner endpoint for authorization.

## 6. Scanner app

The template scanner keeps the AXIS full-screen landscape flow. It accepts a normalized QR payload, locks after the first read, and renders states from `result` rather than inspecting translated titles.

| State | Trigger | Display | Reset behavior |
|---|---|---|---|
| `ready` | Camera started or previous result reset | Gym logo, scan frame, configured ready title/instruction, camera-active indicator | No timer; scanner unlocked |
| `loading` | Valid QR payload accepted locally and request started | Configured loading title and “Please wait”; hide previous member/message | Stay locked until response, transport error, or 20-second timeout |
| `success` | Backend returns `result: "success"` after writing attendance | Success title, first name, training name, optional basic message; success color/sound/vibration | Configurable success delay, default 15 seconds, then `ready` |
| `duplicate` | Same member already has attendance for the resolved training key | Already-checked-in title, first name, training name; warning feedback | Configurable duplicate delay, default 3.5 seconds, then `ready` |
| `not_found` | Payload is valid but no member exists | Member-not-found title and trainer/help instruction; no member name | Error delay, default 5 seconds, then `ready` |
| `inactive` | Member exists but status is inactive | Inactive-member title and trainer/help instruction; name optional by gym setting | Error delay, default 5 seconds, then `ready` |
| `outside_window` | No matching training window is open for the member | Closed-window title; optionally show today's next opening returned as structured data | Closed-window delay, default 5 seconds, then `ready` |
| `error` | Invalid local payload, backend system error, script load error, or unusable response | Connection/system/invalid-code text appropriate to `reason`; error feedback | Error delay, default 5 seconds, then `ready` |
| `timeout` | No JSONP callback within exactly 20 seconds | Configured connection-timeout title and retry instruction; error feedback | Clean callback/script, ignore late response, use error delay, then `ready` |

The public scanner response should contain at least `result`, `reason`, `memberId`, `firstName`, `trainingType`, `trainingName`, `trainingStart`, `title`, `subtitle`, `message`, `color`, and `sound`. Display fields may be localized by the backend/configuration, but `result` and `reason` are stable contract fields.

## 7. Google Sheets structure

`setupTemplate()` creates missing sheets, headers, protections, validation lists, and hidden-state sheets without deleting existing data. Column names are an internal contract and are changed only through a schema migration.

Google Sheets is the system's storage and backup layer. The owner may receive read access for transparency and recovery, but routine member, card, attendance, schedule, and settings work happens through the admin panel. Direct sheet editing is unsupported except for an explicit maintainer-led recovery or migration procedure.

### A. Owner-readable storage sheets

| Sheet | Purpose | Exact columns | Used by | Editing rule |
|---|---|---|---|---|
| `Members` | Source of member profiles | `MemberID`, `FirstName`, `LastName`, `Status`, `Category`, `JoinedAt`, `Notes`, `CardURL` | Admin and backend check-in lookup | Readable backup; system-managed through admin, no routine manual edits and no manual Member IDs |
| `Attendance` | Simple owner ledger generated from canonical events | `DateTime`, `MemberID`, `FirstName`, `LastName`, `TrainingType`, `TrainingName`, `TrainingStart` | Owner and reports | Visible; system-generated/read-only, no manual attendance writes |
| `Schedule` | Recurring weekly sessions | `ScheduleID`, `Active`, `DayOfWeek`, `StartTime`, `EndTime`, `TrainingType`, `DisplayName`, `Audience` | Owner and backend window resolver | Readable backup; system-managed through admin |
| `Training_Types` | Controlled training-type dropdown | `TrainingType`, `DisplayName`, `Active`, `SortOrder` | Schedule/admin filters | Readable backup; system-managed through admin |
| `Settings` | Human-readable gym configuration | `Setting`, `Value`, `Description` | Owner setup and backend config loader | Readable backup; system-managed through admin |
| `Reports` | Optional generated summary area | No canonical schema; named report blocks only | Owner | Visible; system-generated/read-only |

`Attendance` is a projection, not the source of truth. The setup function may implement it as a protected formula/query view or refresh it from `_Raw_Attendance`; the chosen mechanism must be fixed in Phase 2 and tested for sorting/filtering.

### B. Hidden/internal sheets

| Sheet | Purpose | Exact columns | Used by | Editing rule |
|---|---|---|---|---|
| `_Raw_Attendance` | Canonical append-only attendance events | `AttendanceID`, `Timestamp`, `MemberID`, `FirstName`, `LastName`, `MemberCategory`, `TrainingKey`, `TrainingType`, `TrainingName`, `TrainingStart`, `MessageID`, `Source`, `CreatedAt` | Check-in backend, attendance queries, reports | Hidden; system-only |
| `_State` | Fast duplicate lookup per member | `MemberID`, `LastCheckin`, `LastAttendanceID`, `LastTrainingKey`, `UpdatedAt` | Check-in backend | Hidden; system-only |
| `_Messages` | Basic configurable check-in messages | `MessageID`, `Active`, `Message`, `TrainingType`, `Category`, `Weight` | Settings/admin and check-in message selector | Hidden by default; edited through admin only |
| `_Message_State` | Optional last-message/non-repeat state | `MemberID`, `LastMessageID`, `SeenMessageIDs`, `UpdatedAt` | Message selector | Hidden; system-only; omit entirely if simple random messages do not need it |
| `_Card_State` | Generated-card metadata | `MemberID`, `CardFileID`, `CardURL`, `GeneratedAt`, `TemplateVersion`, `LastError` | QR Cards screen and card generator | Hidden; system-only |
| `_Logs` | Compact support log | `Timestamp`, `Level`, `Action`, `MemberID`, `Message`, `RequestID` | Maintainer/support | Hidden; system-only; bounded retention |
| `_Internal_Config` | Installation and schema metadata | `Key`, `Value`, `UpdatedAt` | Setup/migration/backend | Hidden; system-only |

Required `_Internal_Config` keys are `SchemaVersion`, `InstallationID`, `SetupCompletedAt`, and `NextMemberNumber`. Member ID prefix and number width are documented settings; the next sequence value is internal and updated only by the backend. Deployment IDs and credentials remain outside owner-readable sheets. Internal sheets are protected and hidden but documented for maintainers.

## 8. Attendance data model

The canonical attendance event should contain enough information to remain useful even if a member or training is renamed later.

### Owner-facing fields

- Check-in date and time.
- Member ID.
- First name.
- Last name.
- Training type.
- Training display name.
- Scheduled training start.

### Internal fields

- Stable attendance/event ID.
- Stable training-session key.
- Member status/category snapshot if required.
- Request/source identifier.
- Result or audit information where useful.
- Message ID/source only if the message feature is enabled.
- Created/updated metadata required for support.

Do not put large message-cycle diagnostics into the normal owner attendance view. Attendance should be append-oriented; corrections should be deliberate and auditable rather than silently rewriting historical events.

## 9. Backend/API blueprint

Public scanner calls are anonymous but limited to check-in and safe public configuration. Admin calls require the Phase 1 authentication decision. Internal helpers are not routed from web requests. All dates are interpreted in the configured gym timezone.

| Function | Input | Output | Sheets read/written | Access |
|---|---|---|---|---|
| `checkIn(memberId, requestMeta?)` | Normalized member ID; optional scanner/request ID | Scanner contract with `result`, `reason`, member/training display fields, message, color, sound | Read `Members`, `Schedule`, `Settings`, `_Messages`, `_State`; append `_Raw_Attendance`; update `_State`/optional `_Message_State`; log failures | Public scanner API |
| `getPublicScannerConfig()` | None or config version | Safe branding, texts, timing, locale, timezone, scanner behavior; no admin IDs/secrets | Read `Settings`, `_Internal_Config` | Public scanner API |
| `getDashboardData(filters)` | `{ date, trainingId? }` | Counts, current/next training, active-member count, recent check-ins | Read `Members`, `Schedule`, `_Raw_Attendance` | Protected admin API |
| `listMembers(filters)` | `{ query?, status?, category?, page?, pageSize? }` | `{ items, total, page, categories }` with profile summary/card status | Read `Members`, `_Raw_Attendance`, `_Card_State` | Protected admin API |
| `getMember(memberId)` | Member ID | Member profile, card summary, attendance summary | Read `Members`, `_Raw_Attendance`, `_Card_State` | Protected admin API |
| `getMemberFormOptions()` | None | Categories, status options, and optional non-authoritative next-ID preview | Read `Members`, `Settings`, `_Internal_Config` | Protected admin API |
| `createMember(data)` | First/last name, active status, optional category/joined date/notes; no Member ID input | Created member including the generated unique Member ID, or validation/system errors | Under a lock, read ID settings and existing `Members`, generate the next ID, append `Members`, update ID sequence in `_Internal_Config`; optional `_Logs` | Protected admin API |
| `updateMember(memberId, data)` | Existing ID plus editable fields | Updated member or validation errors | Read/write `Members`; optional `_Logs` | Protected admin API |
| `setMemberStatus(memberId, active)` | Member ID and boolean | Updated ID/status | Read/write `Members`; write `_Logs` | Protected admin API |
| `getAttendance(filters)` | Date range, training type/session, member query, page/pageSize | Owner-facing rows plus total | Read `_Raw_Attendance` | Protected admin API |
| `getMemberAttendance(memberId, filters)` | Member ID and date range/page | Member attendance rows and summary count | Read `Members`, `_Raw_Attendance` | Protected admin API |
| `getReportData(reportType, filters)` | Report type plus date/month/training filters | Rows and totals for `today`, `by_training`, `top_attendees`, or `low_attendance` | Read `Members`, `Schedule`, `_Raw_Attendance` | Protected admin API |
| `listSchedule()` | Optional day/status/type filters | Sessions, active training types, check-in defaults | Read `Schedule`, `Training_Types`, `Settings` | Protected admin API |
| `createScheduleEntry(data)` | Day, times, type, name, audience, active | Created entry with generated `ScheduleID` or validation errors | Read/write `Schedule`, read `Training_Types` | Protected admin API |
| `updateScheduleEntry(scheduleId, data)` | Existing ID plus editable session fields | Updated entry or validation errors | Read/write `Schedule`, read `Training_Types` | Protected admin API |
| `setScheduleStatus(scheduleId, active)` | Schedule ID and boolean | Updated ID/status | Read/write `Schedule` | Protected admin API |
| `deleteScheduleEntry(scheduleId)` | Schedule ID | Deleted ID or `in_use` rejection | Read `Schedule`, `_Raw_Attendance`; write `Schedule` | Protected admin API |
| `listTrainingTypes()` / training-type CRUD | Filters or type data | Active/all types or mutation result | Read/write `Training_Types`; read `Schedule` before delete | Protected admin API |
| `getSettings()` | None | Full editable admin settings grouped by section | Read `Settings`, `_Messages`, `_Internal_Config` | Protected admin API |
| `updateSettings(data)` | Allowed settings and basic messages | Normalized saved settings plus validation/redeploy notices | Read/write `Settings`, `_Messages`; update cache/version metadata | Protected admin API |
| `listMemberCards(filters)` | Query, member/card status, page | Card rows and totals | Read `Members`, `_Card_State` | Protected admin API |
| `generateMemberCard(memberId)` | Member ID | File ID/URL, generated time, or structured error | Read `Members`, `Settings`; write Drive file and `_Card_State` | Protected admin API |
| `generateMissingMemberCards(options)` | Confirmation plus optional limit | Per-member successes/failures and totals | Read `Members`, `_Card_State`, `Settings`; write Drive and `_Card_State` | Protected admin API |
| `setupTemplate()` | Optional safe setup options | Schema version and created/verified resources | Create/verify all sheets and protections; write `_Internal_Config` | Maintainer/setup only |

`checkIn()` must normalize input, enforce active status, resolve one training window, acquire a short script lock, recheck `_State` inside the lock, append the attendance event, and update state before releasing the lock. Card generation and admin reporting must never run inside the scanner transaction.

## 10. Basic reports

MVP reporting should answer everyday gym questions:

- Today's check-ins.
- Attendance for a selected date or date range.
- Attendance for a selected training session or type.
- Attendance history for one member.
- Top attendees for a selected month.
- Members with no attendance or low attendance in a selected recent period, if this can be calculated simply.

Use simple filters, counts, and tables. Do not add predictive analytics, complex cohort analysis, or a general reporting builder.

## 11. QR card workflow

1. Create or import a member.
2. The backend automatically assigns the next unique gym-specific Member ID; the owner does not enter or edit it.
3. Encode the ID or a versioned safe check-in payload in the QR code.
4. Let the owner generate the card from the member screen.
5. Apply the configured gym logo, colors, member name, and card template.
6. Save the output to a configured Drive folder and expose a view/download link.
7. Allow regeneration after a branding or member-name change.

The AXIS Slides-based generator is a useful baseline, but the reusable template should remove fixed member IDs, fixed folder/template values, random design assumptions, and AXIS text. Prefer one predictable default template with an optional alternate design. Card generation failures should not affect check-in availability.

## 12. MVP scope

The first buildable template MVP should include:

- A reusable branded tablet scanner.
- A reusable Apps Script check-in backend.
- A clean, installable Google Sheets schema.
- Member list plus add/edit and activate/deactivate actions.
- Schedule and training-type management.
- Schedule-aware attendance and duplicate prevention.
- A simple owner dashboard and attendance filters.
- Branded QR card generation.
- Basic configurable messages.
- Demo data and a repeatable acceptance-test checklist.
- A documented GitHub, client-configuration, and `clasp` deployment workflow.

MVP success means a new gym can be created from the template without editing core check-in logic: configure branding and timezone, enter a schedule, import members, deploy, generate cards, and run the scanner. After setup, the owner can complete daily work in the admin panel without manually managing the Google Sheets data store.

## 13. Not included now

Explicitly exclude:

- Payments, billing, and subscriptions.
- WhatsApp, Telegram, SMS, or marketing notifications.
- CRM pipelines or lead management.
- Membership-plan and contract management.
- Multi-gym tenancy or a shared SaaS control plane.
- Complex roles and enterprise permissions.
- Complicated analytics or custom report builders.
- Native mobile apps when the tablet PWA is sufficient.
- A large backend rewrite without a proven technical need.
- Rebuilding working scanner behavior merely for code cleanup.
- The full AXIS advanced content/message engine as a mandatory MVP feature.

## 14. Build phases

Each phase is a separately reviewable implementation task. Complete its acceptance criteria before starting the next phase; do not modify AXIS production to make the template cleaner.

### Phase 1 — Create template repo structure and config model

- **Goal:** establish a separate template workspace and freeze the contracts before runtime implementation.
- **Deliverables:** agreed directory layout; `gym.config.example` schema covering identity, branding, scanner behavior, check-in defaults, integration IDs, and card settings; scanner response schema; admin authentication decision; demo-gym values; deployment/rollback notes.
- **Likely files:** template `README.md`, `AGENTS.md`, `DEPLOYMENT.md`, `docs/API_CONTRACT.md`, `docs/CONFIG.md`, `scanner/config.example.js` or equivalent, and empty `scanner/`/`apps-script/` structure.
- **Acceptance criteria:** two sample gym configurations validate against the same schema; no AXIS URL/name/asset is required by core config; public versus protected settings are explicitly listed; each scanner result has a documented payload example.
- **Manual tests:** review config with a second gym name/logo/colors/timezone; verify repository search finds no required AXIS constants; walk through deployment steps without executing them.
- **Must not change:** AXIS production repository/runtime, current API, Google Sheets data, or live deployment URLs.

### Phase 2 — Create clean Google Sheets schema and setup functions

- **Goal:** produce a repeatable empty/demo spreadsheet matching Section 7.
- **Deliverables:** idempotent `setupTemplate()`; exact headers; validation rules; hidden/protected internal sheets; schema version; demo-data loader kept separate from production setup; owner-visible Attendance projection decision.
- **Likely files:** `apps-script/Setup.gs`, `apps-script/Schema.gs`, `apps-script/SheetRepository.gs`, `apps-script/appsscript.json`, and `docs/SHEETS_SCHEMA.md`.
- **Acceptance criteria:** setup on a blank spreadsheet creates every sheet once; a second run preserves data; owner/internal visibility is correct; invalid status/day/type values are rejected; schema version is recorded.
- **Manual tests:** run setup twice; add one demo member/session; confirm dropdowns/protections; confirm owner cannot accidentally edit `_Raw_Attendance` through normal use; verify timezone formatting.
- **Must not change:** scanner behavior, check-in API, card generator, or AXIS spreadsheet.

### Phase 3 — Adapt AXIS scanner into the reusable template scanner

- **Goal:** retain the AXIS kiosk UX while removing hardcoded gym identity and state inference.
- **Deliverables:** configurable branding/text/timing; configurable endpoint; generalized QR payload validation; exact states from Section 6; public-config loading with safe fallback; preserved 20-second timeout and cleanup.
- **Likely files:** `scanner/index.html`, `scanner/styles.css`, `scanner/app.js`, `scanner/config.js`, `scanner/manifest.json`, scanner assets, and scanner-focused tests/fixtures.
- **Acceptance criteria:** switching config changes gym name/logo/colors/text without core edits; all nine states render from fixtures; no state depends on German title substrings; layout works on target landscape tablet and low-height viewport.
- **Manual tests:** camera allowed/denied; raw and URL QR payloads; each mocked result; sound unlock; timeout; late callback; automatic reset; refresh/install as PWA.
- **Must not change:** template backend logic beyond response fixtures, AXIS frontend, admin panel, or Sheets schema.

### Phase 4 — Implement the template check-in backend contract

- **Goal:** implement one fast, consistent check-in transaction using the Phase 2 schema.
- **Deliverables:** public route to `checkIn()`; safe callback handling if JSONP remains; member normalization; active-status validation; authoritative schedule resolver; training-key duplicate prevention; short lock/recheck/write transaction; stable response factory; bounded error logging.
- **Likely files:** `apps-script/WebApp.gs`, `apps-script/CheckInService.gs`, `apps-script/ScheduleService.gs`, `apps-script/MemberRepository.gs`, `apps-script/AttendanceRepository.gs`, `apps-script/ResponseFactory.gs`, and test fixtures.
- **Acceptance criteria:** outputs match every Section 6 contract; one success creates exactly one raw attendance row and state update; inactive/unknown/outside-window requests write no attendance; simultaneous identical requests create at most one event; display language does not control logic.
- **Manual tests:** boundary at open/close minute; matching/nonmatching category; active/inactive/unknown member; first scan/duplicate scan; concurrent requests; missing sheet; malformed callback; scanner timeout against delayed/no response.
- **Must not change:** admin UI, card generation, reports, AXIS production functions, or response fields already frozen for the template.

### Phase 5 — Build owner/admin panel MVP

- **Goal:** deliver authenticated navigation and the Dashboard, Members list, Add/Edit Member, Member Detail, Schedule, and Settings screens defined in Section 5.
- **Deliverables:** protected admin entry point; shared layout/navigation; reusable loading/empty/error components; forms and validation; dashboard/member/schedule/settings backend functions; no direct technical-sheet workflow required.
- **Likely files:** `apps-script/AdminWeb.gs`, `apps-script/AdminApi.gs`, `apps-script/Admin.html`, `apps-script/Admin.js.html`, `apps-script/Admin.css.html`, plus member/schedule/settings services.
- **Acceptance criteria:** unauthorized users cannot read or mutate admin data; authorized owner can complete all listed screen actions; errors preserve form input; technical fields never appear; scanner endpoint remains available independently.
- **Manual tests:** authorized/unauthorized access; empty gym; add/edit/duplicate member; status toggle failure rollback; schedule overlap validation; save/reload settings; dashboard with and without attendance.
- **Must not change:** scanner visual flow, check-in contract, QR generation, reports beyond dashboard summaries, or AXIS production.

### Phase 6 — Implement member management and QR card workflow

- **Goal:** complete member lifecycle and reliable branded card generation from the admin interface.
- **Deliverables:** locked automatic next-ID generation with configurable prefix/number format; immutable assigned IDs; status changes; QR Cards screen; configured Slides template/folder; single and confirmed batch generation; `_Card_State`; per-member failure handling; card link on member detail.
- **Likely files:** member service/repository files, `apps-script/CardService.gs`, `apps-script/CardRepository.gs`, QR Cards admin templates/components, and a demo Slides template reference in config documentation.
- **Acceptance criteria:** create → generate → open/download works for an active demo member; regeneration updates metadata; inactive members are excluded from default batch; one failed card does not stop the batch; no fixed AXIS member/folder/template remains.
- **Manual tests:** create sequential and concurrent members and confirm unique generated IDs; confirm no owner Member ID input exists; missing template/folder permission; special characters in names; generate/regenerate; batch with mixed success; deactivate/reactivate; confirm scanner still works during card failure.
- **Must not change:** attendance schema, scanner contract, schedule rules, or add advanced card design editors.

### Phase 7 — Implement attendance views and simple reports

- **Goal:** expose useful operational attendance without leaking internal columns or overbuilding analytics.
- **Deliverables:** Attendance screen; member attendance history; today/date/training filters; dashboard summaries; monthly top attendees; optional simple low-attendance list; protected/generated `Attendance` projection; pagination.
- **Likely files:** `apps-script/AttendanceService.gs`, `apps-script/ReportService.gs`, admin attendance/report components, and query tests/fixtures.
- **Acceptance criteria:** owner-visible rows contain exactly the seven fields defined in Section 7; totals match `_Raw_Attendance`; filters use gym timezone; member detail and main attendance agree; large demo data is paginated and remains usable.
- **Manual tests:** no data; one/multiple trainings per day; date boundaries; member search; month selection; renamed member/training snapshots; inactive member history; pagination; optional CSV output if included.
- **Must not change:** canonical raw events, check-in write path, member/card workflow, or add advanced analytics.

### Phase 8 — Test with demo data

- **Goal:** validate a fresh installation end to end before any client instance is created.
- **Deliverables:** deterministic demo members/schedule/messages; acceptance checklist; API/state fixtures; concurrency test procedure; supported-device matrix; known-limitations and recovery notes; clean install/deploy rehearsal.
- **Likely files:** `demo/` fixtures, `tests/` or Apps Script test functions, `docs/ACCEPTANCE_TESTS.md`, and `docs/OPERATIONS.md`.
- **Acceptance criteria:** every scanner/admin state passes; setup is repeatable; duplicate/concurrent scans do not duplicate attendance; no demo personal data is real; a clean deploy can be rolled back using documented steps.
- **Manual tests:** full scanner matrix; all admin empty/error states; fresh spreadsheet; settings changes; card generation; reports; tablet kiosk session; network loss/timeout; deployment and rollback rehearsal.
- **Must not change:** feature scope, API contract, or architecture except for defects proven by testing.

### Phase 9 — Create first gym instance from the template

- **Goal:** prove client reuse by configuring and handing over one real single-gym installation without core-code edits.
- **Deliverables:** client-owned repository/project; approved branding/config; client spreadsheet and Apps Script deployment; member import; schedule/training types; card template/folder; scanner hosting; owner access; handover and rollback record.
- **Likely files:** client configuration, client assets, deployment metadata excluded from public source as appropriate, import files, and client runbook. Core template files change only for reusable defects found during onboarding.
- **Acceptance criteria:** gym identity is changed through config/assets only; owner completes member, schedule, attendance, settings, and card tasks; test scans cover every rejection/success state; GitHub source matches the deployed Apps Script runtime copy.
- **Manual tests:** import sample then approved members; verify timezone/schedule windows; generate sample cards; run tablet check-ins; verify admin permissions and reports; perform final status/diff/deployment checks; confirm rollback version.
- **Must not change:** template core for client-specific preferences, AXIS production, or excluded product scope.

## Product guardrails

- Treat the existing AXIS production system as a working reference, not a cleanup target.
- Build the template separately and migrate behavior deliberately.
- Prefer configuration over forks with scattered hardcoded edits.
- Keep the public scanner fast and the owner interface simple.
- Hide technical state without making support or recovery impossible.
- Add only features required to onboard and operate a real single-gym client.
- Use small phases with demo data, acceptance checks, and clear rollback points.
