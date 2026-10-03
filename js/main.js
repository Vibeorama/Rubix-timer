// App wiring: connects timer, store, stats and UI.

import { createTimer } from './timer.js';
import { createStore } from './store.js';
import { summarize } from './stats.js';
import { generateScramble } from './scramble.js';
import * as ui from './ui.js';

const store = createStore();

function refresh(solves) {
  const summary = summarize(solves);
  ui.renderStats(summary);
  ui.renderHistory(solves, summary.best);
}

function newScramble() {
  ui.renderScramble(generateScramble());
}

// Keeps the "new best" highlight on screen until the next solve starts.
let showPb = false;

const timer = createTimer({
  onState(state) {
    if (state === 'armed') showPb = false;
    ui.renderPadState(state === 'idle' && showPb ? 'pb' : state);
  },
  onTick: ui.renderTime,
  onStop(elapsed) {
    const prevBest = summarize(store.all()).best;
    store.add(elapsed);
    showPb = prevBest === null || elapsed < prevBest;
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
ui.els.btnHistory.addEventListener('click', () => ui.showHistory(true));
ui.els.btnCloseHistory.addEventListener('click', () => ui.showHistory(false));

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
