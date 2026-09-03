# Offline / Release Verification

Use this checklist before publishing Check-in Desk.

## Build and standalone files

1. Run `build-standalone.bat`.
2. Run `scripts\check-repository.ps1`.
3. Open `dist/index.html` directly with `file://`.
4. Open `dist/index.self-extract.html` directly and confirm it expands to the same app without console errors.
5. In DevTools, clear the Network panel, enable Offline, reload, and confirm the full app remains usable with no external runtime request.
6. Confirm CSP still contains `connect-src 'none'`.

## Core workflow

1. Clear the built-in sample data. Confirm the Check-in page explains that a roster is required and the primary action opens member registration.
2. Add, edit, and delete a member; verify destructive confirmation and Undo.
3. Use the CSV info icon, save the CSV template, and import `test-data/check-in-roster-test.csv`.
4. Import `check-in-roster-edge-cases.csv` and confirm duplicate/conflict/skipped-row review behaves correctly.
5. Import `check-in-roster-1000.csv` and confirm roster search/group filtering remains responsive.
6. Search for a value with zero roster matches and confirm a visible no-results state plus “Clear filters” action appears.
7. Start a Check-in session, record attendance, use the immediate toast Undo, then record again and perform a later explicit correction from Recent activity. Confirm the immediate Undo disappears without an audit row while the later correction remains in activity history.
8. Add a walk-in both session-only and with “also add to roster”.
9. End the session. Confirm the completion toast offers a direct History action.
10. Open session details, export the single-session CSV, rename the session with Undo, delete the completed session with Undo, and inspect the attendance matrix.
11. Repeat the key flow in Entry / Exit mode, including entry, exit, re-entry, and Undo.
12. Save an all-history CSV.

## Backup and recovery

1. Save a JSON backup.
2. Make visible changes, then restore the backup and confirm replace confirmation appears and the previous state returns.
3. Try an invalid JSON file and confirm current data is not replaced.
4. Confirm Data → Show sample data restores only the sample content without replacing user data, and that sample restore can be undone.
5. Delete all data and verify the first-use flow still has a clear next action.

## UI / accessibility

1. Check Japanese and English at desktop width, tablet width, 390px, and 360px.
2. Confirm no horizontal page scrolling, overlapping fixed UI, clipped dialogs, or hidden bottom content.
3. Confirm the Help dialog scrolls to its final note on short desktop and smartphone viewports.
4. Navigate interactive controls with the keyboard and confirm visible focus on buttons, inputs, selects, and dialog actions.
5. Confirm Escape closes dialogs; in Reception view, Escape clears search first and then exits focused reception when appropriate.
6. Test long names, IDs, group names, and notes for layout wrapping/truncation.

## Release assets and documentation

- `assets/favicon.svg` matches the app header icon and embedded favicon.
- `assets/screenshot.png`, `assets/screenshot-en.png`, and `assets/screenshot-mobile.png` show the current UI/version.
- README / README.ja / APP_SPEC / CHANGELOG / SECURITY / THIRD_PARTY_NOTICES describe the current behavior.
- `test-data/` fixtures are present and documented.
