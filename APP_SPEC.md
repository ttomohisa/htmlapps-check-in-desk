# APP_SPEC.md

## 1. Product identity

- **Product name:** Check-in Desk / 受付・出欠チェック
- **One-sentence purpose:** Keep a reusable local roster and record repeated check-in or entry/exit sessions without accounts, a backend, or cloud synchronization.
- **Primary users:** Small classes, clubs, workshops, internal meetings, community groups, training sessions, and other recurring receptions managed on one device.
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`

## 2. Problem and outcome

Many small receptions only need a roster, a fast tap-based check-in screen, and a history. Full event-management platforms add accounts, ticketing, cloud synchronization, and recurring fees that are unnecessary for this workflow.

A successful session lets the user keep one roster, start a named check-in, record attendance quickly, review who is still missing, end the session, and reuse the same roster next time. Data remains on the device unless the user exports CSV or JSON.

## 3. Core user flow

1. Add people manually or import a roster CSV.
2. Start a new check-in session, choose all members or one group, and choose Check-in or Entry / Exit mode.
3. Search / filter the roster and tap the primary action for each arriving person. A focused reception view can hide management navigation; if search leaves one actionable person, Enter records the action.
4. Add walk-ins for the current session, optionally adding them to the reusable roster.
5. End the session and review history / the attendance matrix.
6. Export CSV when needed and save a JSON backup before clearing browser storage or moving devices.

## 4. Functional requirements

- Persistent reusable roster with name, optional ID, group, and note.
- Manual add/edit/delete with deletion confirmation and Undo for roster deletion.
- CSV import and export for roster data. The Roster screen exposes the supported columns and a downloadable template. Import shows a preview with planned additions, possible duplicate names/IDs, and skipped rows before changing the roster.
- Multiple persistent reception sessions with immutable participant snapshots.
- Check-in mode: record one current attendance state, with explicit cancellation.
- Entry / Exit mode: record repeated enter/exit events chronologically.
- Active-session filters for Pending / Checked in / All, group filtering, and fast name/ID/group search. Starting or reopening a session clears search and group filters and selects Pending; ordinary rerenders within the same session preserve these controls. Visual selection and `aria-pressed` are rendered from the same filter state.
- Focused reception view for front-desk operation, with management tabs and mobile navigation hidden until the operator exits the view.
- Keyboard fast path: when exactly one actionable search result remains, Enter records the check-in / entry / exit and returns focus to the search field. Composition-confirmation Enter (`isComposing` or legacy key code 229) and auto-repeated Enter must not record, clear search, or prevent text composition. A later deliberate Enter remains available.
- Walk-in registration per session, optionally promoted into the reusable roster.
- End and reopen a session.
- Per-person active-session history from the reception list / Recent activity, including current status.
- Session detail view, recent activity, history list, and recent-session attendance matrix. Completed sessions can be deleted individually with confirmation and immediate Undo.
- Attendance-history CSV export.
- JSON full backup/restore with replace confirmation.
- Full-data reset with destructive confirmation.
- Japanese and English in the same HTML.
- Smartphone bottom navigation with four pages: Check-in, Roster, History, Data. Desktop uses the same four explicit tabs.

## 5. Data and privacy

- Roster, session snapshots, and attendance events are stored in browser `localStorage`.
- No account, server-side storage, analytics, telemetry, or runtime network request.
- CSV and JSON files are created only after an explicit user action.
- Browser site-data deletion may remove saved state, so the UI and help must explain JSON backup.

## 6. Non-goals

- Facial recognition or camera processing.
- Legal identity verification or security access control.
- Ticket sales, payment, invitations, or event registration websites.
- Cloud synchronization or simultaneous multi-device operation.
- QR-code self check-in in the current release.
- User accounts or organizations.

## 7. UX and accessibility

- Mobile-first from 320px.
- Reception prioritizes the Pending list; the count drops as people are checked in.
- Reception view removes management navigation from the visual workspace but is explicitly not a security lock.
- Primary check-in actions are at least 44px tall on smartphones.
- Names and long notes cannot force horizontal page scrolling.
- Destructive actions use `AppConfirm`; reversible roster/session deletion uses Undo toast after confirmation. Immediate toast Undo of a just-recorded reception action removes that action directly instead of creating an audit correction.
- Visible keyboard focus, accessible names for icon buttons, and reduced-motion behavior are required.
- Help explains the real workflow, local-only storage, backup risk, and non-identity-verification limitation.
- Empty and completion states always offer a sensible next step: add the first roster member, clear a zero-result roster filter, start/revisit reception, or view the just-completed history.

## 8. Performance expectations

- 1,000 roster members and 100 sessions should remain navigable on a typical desktop browser.
- Rendering filters should be synchronous but avoid unnecessary expensive processing.
- No large third-party runtime or model is needed.

## 9. Browser target

Current Chrome and Edge are the primary release targets. Firefox and Safari are intended to work with the standard APIs used by this app, but they are not part of the repository's automated release validation. Direct `file://` opening is required for `dist/index.html`; the self-extracting variant additionally requires `DecompressionStream`.

## 10. Acceptance criteria

- Both standalone variants build and repository verification passes.
- CSP retains `connect-src 'none'`; there are no runtime external dependencies.
- Roster persists after reload and can be backed up / restored.
- Starting, recording, ending, and reopening sessions works.
- Deleting or editing current roster entries does not modify participant names stored in past session snapshots.
- Check-in cancellation and Entry / Exit history behave consistently.
- Walk-ins can remain session-only or be added to the roster.
- CSV roster import accepts a header row (`name,id,group,note` or common Japanese equivalents) and a simple first-column-name file. The supported format is visible in-app and a template can be downloaded. Before import, duplicates / skipped rows are shown and duplicate candidates are excluded by default.
- Japanese and English fit at 360px without horizontal page scrolling.
- Clearing all sample/user data leaves a usable first-run path; roster search/group filters never leave a blank unexplained panel.
- No camera, face model, ONNX runtime, or biometric data remains in the application.

## 11. Explicit decisions

- No practical roster count hard cap is imposed; browser storage is the limiting factor.
- CSV and JSON exports use UTF-8; CSV includes BOM for spreadsheet compatibility.
- Session snapshots preserve history if the reusable roster is later edited or deleted.
- There is no automated multi-device merge. Backup restore replaces current data after confirmation.
- Smartphone navigation uses fixed bottom page tabs; focused reception view temporarily hides them for desk operation.
- No third-party runtime libraries are required.

## Audit trail

Reception history distinguishes two kinds of correction. Immediate **toast Undo** is treated as a mistaken tap and removes the just-created event without adding an audit row. A later explicit correction from **Recent activity** appends a reversal event so the original action and the correction both remain visible in session history.
