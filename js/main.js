// App wiring: connects timer, store, stats and UI.

import { createTimer } from './timer.js';
import { createStore } from './store.js';
import { summarize, personalBests, newRecords } from './stats.js';
import { generateScramble } from './scramble.js';
import { createWakeLock } from './wakelock.js';
import { burst } from './confetti.js';
import { createStatsView } from './statsview.js';
import * as ui from './ui.js';

const store = createStore();
const wakeLock = createWakeLock();
const statsView = createStatsView(store);

function refresh(solves) {
  const summary = summarize(solves);
  ui.renderStats(summary);
  ui.renderHistory(solves, summary.best);
}

function newScramble() {
  ui.renderScramble(generateScramble());
}

const times = () => store.all().map((s) => s.time);

// Records beaten by the last solve; shown until the next solve starts.
let records = [];

// Keep-awake diagnostic captured at the end of each solve; tap the version label to see it.
let lastWakeStatus = 'no solve timed yet';

const timer = createTimer({
  onState(state) {
    if (state === 'armed') records = [];
    if (state === 'running') wakeLock.enable();
    if (state === 'stopped') lastWakeStatus = wakeLock.status();
    if (state === 'stopped') wakeLock.disable();
    if (state === 'idle' && records.length) {
      ui.renderPadState('pb', `New best ${records.join(' + ')}!`);
    } else {
      ui.renderPadState(state);
    }
  },
  onTick: ui.renderTime,
  onStop(elapsed) {
    const before = personalBests(times());
    store.add(elapsed);
    records = newRecords(before, personalBests(times()));
    if (records.length) burst();
    newScramble();
  },
});

// ---------- Big pad input (touch / mouse / pen) ----------
const { pad } = ui.els;

pad.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pad.setPointerCapture?.(e.pointerId);
  timer.press();
});
pad.addEventListener('pointerup', (e) => {
  e.preventDefault();
  timer.release();
});
pad.addEventListener('pointercancel', () => timer.cancel());
pad.addEventListener('contextmenu', (e) => e.preventDefault());

// Spacebar for desktop use.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return;
  e.preventDefault();
  timer.press();
});
window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  timer.release();
});

// ---------- Controls ----------
ui.els.btnNewScramble.addEventListener('click', newScramble);
ui.els.version.addEventListener('click', () => alert(`Last solve keep-awake status:\n${lastWakeStatus}`));
ui.els.btnHistory.addEventListener('click', () => ui.showHistory(true));
ui.els.btnCloseHistory.addEventListener('click', () => ui.showHistory(false));
ui.els.btnStats.addEventListener('click', () => statsView.open());
ui.els.btnCloseStats.addEventListener('click', () => statsView.close());

ui.els.solveList.addEventListener('click', (e) => {
  const id = e.target.closest('.del')?.dataset.id;
  if (id && confirm('Delete this solve?')) store.remove(id);
});

ui.els.btnClear.addEventListener('click', () => {
  if (store.all().length && confirm('Delete ALL solves? This cannot be undone.')) store.clear();
});

// ---------- Init ----------
store.subscribe(refresh);
refresh(store.all());
newScramble();
ui.renderPadState('idle');
ui.renderTime(0);
ui.renderVersion(self.APP_VERSION);

if ('serviceWorker' in navigator) {
  // When a new release's service worker takes over, reload once to show it.
  // Skipped on first install (no previous controller).
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  }
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
