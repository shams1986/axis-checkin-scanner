# AXIS Check-In Scanner

A lightweight QR check-in system for AXIS Jiu-Jitsu. The static frontend scans member codes, while the Google Apps Script backend validates check-ins and records attendance in Google Sheets.

## Structure

- `index.html` — scanner UI, camera, QR parsing, and backend requests
- `manifest.json`, `service-worker.js` — PWA configuration
- `axis-logo.png`, `axis-icon.png` — frontend assets
- `apps-script/Code.js` — check-in API, attendance logic, messages, and card tools
- `apps-script/appsscript.json` — Apps Script configuration
- `AGENTS.md` — repository working rules
- `DEPLOYMENT.md` — deployment workflow

## How it works

The frontend extracts a member ID from a QR code and calls the deployed Apps Script web app using JSONP. The backend checks the member and training window, prevents duplicate check-ins, writes attendance, and returns the result shown by the scanner.

## Development

Check the working tree before and after making changes:

```sh
git status
```

Keep changes small and focused. Avoid changing Apps Script for frontend-only work, and preserve the existing public API response format when modifying the backend.

## Fast check-in cache

The Apps Script check-in path caches the infrequently changed `Mitglieder`,
`Checkin_Content`, and `Training_Schedule` sheets for up to six hours. Current
check-in state, message-cycle state, personal `ShowOnce` values, and attendance
rows are always read from or written to Sheets and are not cached as values.

After manually changing members, check-in content, or the training schedule,
run `clearFastCheckinCache()` once in the Apps Script editor. The next scanner
request reloads the current sheet data and rebuilds the cache. The same function
also clears cached header and state-row indexes.

Read [AGENTS.md](AGENTS.md) before working on the repository and [DEPLOYMENT.md](DEPLOYMENT.md) before deployment-related work. Do not push to GitHub or run `clasp push` without explicit approval.

## Production

The production AXIS Check-In system is currently working. Avoid broad rewrites or unnecessary cross-component changes without focused testing and a rollback plan.
