# Cube Timer

Minimal, dark-mode Rubik's cube timer built for small phones (iPhone SE 2020). No build step, no dependencies.

## Use

- **Hold** the big pad until the time turns green, **release** to start.
- **Tap anywhere** to stop. The time is saved automatically.
- Stats: best, Ao5, Ao12 (WCA-style: drop best and worst).
- History: view and delete solves. Data is stored locally on the device (`localStorage`).
- Desktop: spacebar works the same as the pad.

Add to Home Screen in Safari (Share → Add to Home Screen) for full-screen, offline use.

## Structure

```
index.html            markup
css/style.css         all styling (dark theme tokens in :root)
js/main.js            wiring: connects modules + event listeners
js/timer.js           timer state machine (no DOM)
js/store.js           solve persistence (localStorage)
js/stats.js           best / average-of-N
js/scramble.js        3x3 scramble generator
js/format.js          time/date formatting
js/ui.js              DOM rendering
sw.js                 offline cache (bump VERSION on release)
```

## Deploy

Pushes to `main` deploy via `.github/workflows/pages.yml`.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## Run locally

```
python3 -m http.server 8000
```
