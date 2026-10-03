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
    count: $('stat-count'),
  },
  history: $('history'),
  solveList: $('solve-list'),
  btnHistory: $('btn-history'),
  btnCloseHistory: $('btn-close-history'),
  btnNewScramble: $('btn-new-scramble'),
  btnClear: $('btn-clear'),
  version: $('version'),
};

const HINTS = {
  idle: 'Hold, release to start',
  armed: 'Keep holding…',
  ready: 'Release to start',
  running: '',
  stopped: '',
};

export function renderTime(ms) {
  els.time.textContent = formatTime(ms);
}

export function renderPadState(state, hint = HINTS[state] ?? '') {
  els.pad.dataset.state = state;
  els.hint.textContent = hint;
  document.body.classList.toggle('running', state === 'running');
}

export function renderScramble(text) {
  els.scramble.textContent = text;
}

export function renderStats({ count, best, ao5, ao12 }) {
  els.stats.best.textContent = formatTime(best);
  els.stats.ao5.textContent = formatTime(ao5);
  els.stats.ao12.textContent = formatTime(ao12);
  els.stats.count.textContent = String(count);
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
