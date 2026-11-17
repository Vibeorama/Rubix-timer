# Anki streak widget (iPhone)

Home/Lock Screen widget that tracks a daily Anki streak and reminds you to send your stats to Claude every 7 days. Runs in [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) (free). No server, data lives in iCloud Drive → Scriptable → `anki-streak.json`.

## What it does

- Widget: current streak 🔥, last 7 days as dots, "Review today" / "Today ✓"; turns orange once today is done. Shows **📤 Send stats to Claude** when an export is due.
- Medium widget adds best streak, days practiced in the last 30, days since last stats export.
- Lock Screen widgets (circular / rectangular / inline) supported.
- Notifications: 20:00 "streak at risk" if today isn't logged; 19:00 "send stats to Claude" when due (repeats 3 days).
- Tap widget → menu: log/undo today, open Anki, **Send stats to Claude** (copies a review prompt to the clipboard, marks export done, opens Claude).

## Setup

1. Install **Scriptable** from the App Store.
2. Scriptable → **+** → paste `AnkiStreak.js` → rename the script to **AnkiStreak** (tap the title).
3. Run it once (▶) → allow notifications.
4. Home Screen: long-press → **+** → Scriptable → Small or Medium → add → long-press it → **Edit Widget** → Script: `AnkiStreak`, When Interacting: **Run Script**.
5. Auto-log practice (recommended) — Shortcuts app → **Automation** → **+** → **App** → choose **AnkiMobile**:
   - **Is Opened**, **Run Immediately** → action *Scriptable → Run Script* → `AnkiStreak`, Parameter `open`.
   - Second automation: **Is Closed**, **Run Immediately** → same action, Parameter `close`.

   A day counts once AnkiMobile has been open ≥ 2 minutes (`minSessionMinutes`). Skip this step if you prefer to log manually from the widget menu.

## Sending stats to Claude

When the widget shows 📤 (or the notification fires):

1. AnkiMobile → Statistics → screenshot Today, Reviews and Future Due (1 month range).
2. Tap the widget → **Send stats to Claude** → paste the prompt into the new chat and attach the screenshots.
3. Claude replies with a review and new cards as `Spanish;English` lines → save as `.txt` and import in Anki (desktop: File → Import, separator `;`).

## Settings

Edit `CONFIG` at the top of the script: session length, export interval, reminder hours, deck label.

## Limits

AnkiMobile has no API, so practice is inferred from app usage (or manual logging), not actual review counts. Shortcuts automations run only on the phone where AnkiMobile is used.
