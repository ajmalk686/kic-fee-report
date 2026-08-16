# Weekly Fee Payment Report

An interactive web app that turns the Google Sheet fee ledger into live
Dashboard / Class-wise / Month-wise / Weekly / All Students reports, with
one-click WhatsApp fee reminders to parents. It is a plain static site — no
backend, no build step, no npm install.

## How it works

- On load (and whenever you click **Refresh**), the app reads the sheet live
  via Google's public `gviz` JSON endpoint. This only works if the sheet is
  shared as **"Anyone with the link can view"** — no login or API key needed.
- Every reminder button opens `wa.me/974<number>?text=...` in a new tab —
  it prefills the message in WhatsApp, but WhatsApp itself requires you to
  tap Send (there's no way to auto-send a WhatsApp message from a web link).
  For the same reason, **"Remind All Pending"** (header) and **"Remind
  class"** (Class-wise tab) don't mass-send anything — they open a queue
  modal listing everyone pending so you can click through Remind buttons
  one at a time.
- "Pending" for a student = the legacy `DUE` column (arrears from before
  April 2026) **plus** the monthly fee for every month, from April 2026
  onward, whose start date has already passed and which has no payment
  recorded and isn't marked `Leave`. The reminder message lists which
  specific months are unpaid.
- Some students have no mobile number in the sheet. Click the &#9998; icon
  next to any student's mobile info to add one — it's saved in **this
  browser's local storage only** (there's no write-access back to the
  Google Sheet from a static site without adding Google sign-in/a backend),
  so it won't appear for other people opening the app on a different device.
  For a permanent fix, also add the number in the sheet itself.

## Run it locally

Just open `index.html` in a browser — double-click it, or drag it into a
browser window. No server required.

If your browser blocks something when opening via `file://`, serve it
instead with any static server, e.g.:

```
npx serve .
```

then open the printed `http://localhost:...` URL.

## Deploy it (free static hosting)

**Netlify (drag and drop):**
1. Go to https://app.netlify.com/drop
2. Drag this whole project folder onto the page.
3. Netlify gives you a live URL immediately — no build command needed.

**GitHub Pages:**
1. Push this folder to a GitHub repository.
2. Repo Settings → Pages → set the source to the branch/root you pushed to.
3. GitHub gives you a `https://<user>.github.io/<repo>/` URL.

Either way, it's the same static files — nothing to configure.

## Changing the sheet / school / message

Everything tunable lives in [`assets/js/config.js`](assets/js/config.js):

- `SPREADSHEET_ID` — which Google Sheet file to read.
- `SHEET_TABS` — which worksheet tab(s) inside it to read, merged into one
  report. To add another tab of students (same column layout), open that tab
  in Google Sheets, copy the number after `gid=` in the address bar, and add
  `{ gid: '...', label: '...' }` to this array — no other code changes
  needed. Every tab must use the same columns, and admission numbers (Ad no)
  must be unique across all of them — the app warns (not blocks) if it finds
  a duplicate after merging.
- `COUNTRY_CODE` — country code prefixed to phone numbers for WhatsApp links.
- `SCHOOL_NAME`, `CURRENCY`, `QUERY_CONTACT`, `ONLINE_PAYMENT_NOTE`,
  `buildReminderMessage(...)` — the reminder text, including the bank/Fawran
  details block appended to every message.
- `ACADEMIC_MONTHS` — the list of month columns and the real calendar date
  each one starts on. Update this each academic year.
- `COLS` — the 0-indexed column layout, in case the sheet's columns are
  reordered.

The logo shown in the header is [`assets/img/logo.png`](assets/img/logo.png) — replace that file to change it.

If the sheet's column order or month list changes, update `COLS` and
`ACADEMIC_MONTHS` here — nothing else in the codebase needs to change.

## Known data assumptions

- A month's fee counts as paid if it has a real date, a non-zero amount, or
  the literal text `Leave` in its date cell.
- Class names are normalized by stripping all whitespace (`"V B"` and `"VB"`
  are treated as the same class) and sorted using the grade list in
  `CONFIG.CLASS_ORDER`.
- Rows without a numeric `SL` or an admission number (the sheet's bottom
  Total/Balance/formula rows) are skipped automatically.
