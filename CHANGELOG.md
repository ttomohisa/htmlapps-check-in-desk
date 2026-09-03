# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-09-03

- Promoted the release candidate to the first stable release after full repository, data-flow, privacy, responsive-layout, and standalone-output review.
- Rewrote the English and Japanese README files to match the established Browser Kitty repository format, with live demo, quick-start, usage, privacy, browser support, limitations, build, and regression-data sections.
- Refreshed release screenshots and all generated standalone metadata for v1.0.0.
- Kept the v0.7.0 product behavior unchanged: reusable local roster, Check-in / Entry-Exit modes, focused reception workflow, CSV/JSON import-export, correction history, sample restore, attendance matrix, and local-only storage.

## [0.7.0] - 2026-09-03

- Polished first-use and empty states: reception now guides an empty roster directly to member registration, History has a clear next action, and filtered roster searches show a resettable no-results state.
- Added a direct “View history” action after ending a check-in so the completed result is easier to find.
- Improved keyboard accessibility by giving selects the same inherited typography and visible focus treatment as other form controls.
- Brought release documentation in sync with the current app, including browser-support wording, app-specific security/privacy notes, offline verification steps, and all regression fixtures.
- Refreshed Japanese, English, and smartphone screenshots for the release candidate.

## [0.6.1] - 2026-09-03

- Reordered roster CSV actions to CSV import, CSV export, then format info.
- Kept the CSV format info icon visually quiet on hover.

## [0.6.0] - 2026-09-03

- Replaced the prominent CSV-format button with a compact accessible info icon next to CSV import.
- Hardened roster CSV import: up to 5,000 people per import, extra-column tolerance, invalid-row handling, malformed-CSV detection, and clearer duplicate categories.
- Added session-name editing for active and completed sessions with Undo; participant snapshots and attendance records are unchanged.
- Preserved historical attendance-matrix people even after they are removed from the reusable roster.
- Added per-session CSV export and walk-in counts in session details.
- Added browser-storage write/read failure handling so corrupt saved data is not silently overwritten.
- Added 1,000-person and CSV edge-case regression fixtures, plus tablet/mobile layout hardening.

## [0.5.0] - 2026-09-03

- Changed toast Undo into a true immediate rollback: no extra cancellation/audit event is created when undoing the just-recorded action from the toast.
- Kept explicit later corrections from Recent activity as auditable reversal events.
- Added sample-data restore under Data management without replacing user-created data, with Undo.
- Fixed help/dialog scrolling so long content remains reachable on short desktop and smartphone viewports.
- Added per-session history deletion with confirmation and Undo; active sessions cannot be deleted.
- Added an in-app roster CSV format guide and downloadable CSV template.

## [0.4.0] - 2026-09-03

- Added a focused reception view that hides management navigation during active desk operation.
- Added reception-side group filtering and faster keyboard check-in: when one result remains, Enter records the action and returns focus to search.
- Made names in the active roster and Recent activity open a per-person session history with current status.
- Added CSV import preview with planned additions, possible duplicates, skipped rows, and an explicit option to include duplicates.
- Kept existing Undo/audit-trail behavior, sample data, backup compatibility, and local-only processing intact.

## [0.3.0] - 2026-09-02

- Added Undo actions to check-in and entry/exit toasts.
- Added one-tap Undo controls to the Recent activity list.
- Reverted operations are now preserved as audit events instead of deleting prior records.
- Added an activity log to session details so corrections remain visible in history.

## [0.2.0] - 2026-09-02

- Added built-in sample roster and two sample check-in sessions for first-use guidance.
- Added a Task Packing-style sample-data banner with sample-only clearing and Undo.
- Added CSV and JSON import fixtures under `test-data/`.
- Made roster CSV import tolerant of UTF-8 BOM, including files exported by this app.

## [0.1.0] - 2026-09-02

### Added

- Reusable local roster with manual add, edit, delete, search, group filter, CSV import, and CSV export.
- Persistent check-in sessions with participant snapshots so later roster edits do not change past history.
- Check-in and Entry / Exit reception modes.
- Pending-first reception flow, search, walk-in registration, session end, and reopen.
- Recent activity, session details, history list, and attendance matrix.
- Attendance CSV export and full JSON backup / restore.
- Japanese / English UI and smartphone four-tab bottom navigation.
- Standalone local-first build with no runtime dependency or network request.
