# Security Policy

## Supported version

Security fixes target the latest version on the default branch.

## Reporting a vulnerability

Do not publish sensitive vulnerability details in a public issue. Use the repository owner's private security reporting channel when available. Include the affected version, reproduction steps, expected/actual behavior, security impact, and a minimal test CSV/JSON when file parsing is involved.

## Application trust model

Check-in Desk is a static, single-device attendance tool. It has no backend, account system, cloud database, analytics, or telemetry. The generated HTML uses a Content Security Policy with `connect-src 'none'`, so ordinary runtime HTTP/HTTPS connections are blocked.

Roster names, optional IDs/groups/notes, and attendance history are stored in browser `localStorage`. Anyone who can use the same browser profile may be able to view that data. Do not treat local browser storage as an access-control boundary.

CSV exports and JSON backups can contain personal names and attendance history. They are created only after an explicit user action and are not encrypted by this app. Store and share exported files according to the rules that apply to your organization or event.

Check-in Desk is not an identity-verification system, security gate, legal attendance register, or tamper-resistant audit system.

## Untrusted input

Roster CSV and backup JSON files should be treated as untrusted input. The app validates expected backup structure, limits CSV imports to 5,000 people per import, enforces CSV field length limits, escapes user text before injecting generated HTML, and shows import review before changing the roster.

When changing CSV/JSON parsing or export behavior:

- Test malformed quoting, missing names, duplicate IDs/names, extra columns, and oversized fields.
- Never render imported text as executable HTML.
- Do not silently replace current data when a backup is unreadable.
- Keep destructive actions explicit and confirmed; preserve Undo where the operation is safely reversible.

## Release boundary

Before release, open both standalone variants with the network disabled, exercise the reception and backup flows, and confirm there are no runtime external requests or console errors. See [VERIFY_OFFLINE.md](VERIFY_OFFLINE.md).
