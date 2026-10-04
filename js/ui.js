// DOM rendering. Holds element references; no app logic.

import { formatTime, formatDate } from './format.js';

const $ = (id) => document.getElementById(id);

export const els = {
  pad: $('pad'),
  time: $('time'),
  hint: $('hint'),
  scramble: $('scramble'),
  stats: {
    best: $('stat-best'),
    ao5: $('stat-ao5'),
    ao12: $('stat-ao12'),
    ao100: $('stat-ao100'),
  },
  history: $('history'),
  solveList: $('solve-list'),
  btnHistory: $('btn-history'),
  btnStats: $('btn-stats'),
  btnCloseStats: $('btn-close-stats'),
  btnCloseHistory: $('btn-close-history'),
  btnNewScramble: $('btn-new-scramble'),
  btnClear: $('btn-clear'),
  version: $('version'),
  awake: $('awake'),
  btnInspection: $('btn-inspection'),
};

const HINTS = {
  idle: 'Hold, release to start',
  inspecting: 'Inspect · hold to start',
  armed: 'Keep holding…',
  ready: 'Release to start',
  running: '',
  stopped: '',
};

export function renderTime(ms) {
  els.time.textContent = formatTime(ms);
}

/** `focus` makes the pad cover the whole screen (solving or inspecting). */
export function renderPadState(state, hint = HINTS[state] ?? '', focus = state === 'running') {
  els.pad.dataset.state = state;
  els.hint.textContent = hint;
  document.body.classList.toggle('running', focus);
  if (!focus || state === 'running') delete els.pad.dataset.inspect;
}

/** Inspection countdown: "15"…"1", then "+2" (15–17 s), then "DNF". */
export function renderInspection(msLeft) {
  let text, level;
  if (msLeft > 0) {
    text = String(Math.ceil(msLeft / 1000));
    level = msLeft <= 3000 ? 'alert' : msLeft <= 7000 ? 'warn' : 'ok';
  } else {
    text = msLeft > -2000 ? '+2' : 'DNF';
    level = 'alert';
  }
  els.time.textContent = text;
  els.pad.dataset.inspect = level;
}

export function renderInspectionSetting(on) {
  els.btnInspection.textContent = `Inspection: ${on ? 'on' : 'off'}`;
  els.btnInspection.setAttribute('aria-pressed', String(on));
}

export function renderScramble(text) {
  els.scramble.textContent = text;
}

export function renderStats({ best, ao5, ao12, ao100 }) {
  els.stats.best.textContent = formatTime(best);
  els.stats.ao5.textContent = formatTime(ao5);
  els.stats.ao12.textContent = formatTime(ao12);
  els.stats.ao100.textContent = formatTime(ao100);
}

export function renderHistory(solves, bestTime) {
  const list = els.solveList;
  list.replaceChildren();

  if (!solves.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No solves yet';
    list.append(li);
    return;
  }

  // Newest first.
  for (let i = solves.length - 1; i >= 0; i--) {
    const s = solves[i];
    const li = document.createElement('li');
    if (s.time === bestTime) li.classList.add('pb');
    li.innerHTML = `
      <span class="idx">${i + 1}</span>
      <span class="t">${formatTime(s.time)}</span>
      <span class="date">${formatDate(s.date)}</span>
      <button class="del" type="button" aria-label="Delete solve" data-id="${s.id}">×</button>`;
    list.append(li);
  }
}

export function showHistory(open) {
  els.history.hidden = !open;
}

export function renderVersion(version) {
  els.version.textContent = `v${version}`;
}

/** Show the "tap to keep screen awake" prompt while the screen can auto-lock. */
export function renderAwake(isAwake) {
  els.awake.hidden = isAwake;
}
