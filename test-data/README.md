# Check-in Desk test data

Files for manual import and release regression checks.

- `check-in-roster-test.csv` — normal UTF-8/BOM roster with IDs, groups, notes, and quoted commas.
- `check-in-roster-edge-cases.csv` — duplicate IDs/names, empty names, extra columns, and other CSV edge cases.
- `check-in-roster-1000.csv` — 1,000-member roster for search and import performance checks.
- `check-in-desk-backup-test.json` — complete JSON backup with roster and historical sessions.

Use these together with `VERIFY_OFFLINE.md`. The fixtures intentionally cover both normal and problematic inputs; do not replace the edge-case file with only valid rows.
