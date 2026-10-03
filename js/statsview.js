// Stats page: all-time progress chart with pinch zoom, plus summary tiles.

import { computeProgress, activeDays, TOP_N } from './progress.js';
import { createTimeChart } from './chart.js';
import { formatTime, formatDate, formatAxisTime } from './format.js';

const $ = (id) => document.getElementById(id);
const DAY = 24 * 60 * 60 * 1000;
const RANGES = { day: DAY, week: 7 * DAY, month: 31 * DAY, year: 366 * DAY, all: null };

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createStatsView(store) {
  const sheet = $('stats');
  const empty = $('chart-empty');
  const readout = $('chart-readout');
  const rangeButtons = [...document.querySelectorAll('#chart-ranges button')];

  const chart = createTimeChart($('chart'), {
    series: [
      { key: 'mean', color: css('--series-1') },
      { key: 'topN', color: css('--series-2') },
    ],
    formatValue: formatAxisTime,
    onSelect(p) {
      readout.textContent = p
        ? `${formatDate(p.t)} · solve #${p.n} · avg ${formatTime(p.mean)} · top ${TOP_N} ${formatTime(p.topN)}`
        : '';
    },
  });

  function setRange(name) {
    rangeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.range === name)));
    chart.showLast(RANGES[name]);
  }
  rangeButtons.forEach((b) => b.addEventListener('click', () => setRange(b.dataset.range)));

  function render() {
    const solves = store.all();
    const points = computeProgress(solves);
    const last = points[points.length - 1];
    $('stats-mean').textContent = formatTime(last?.mean);
    $('stats-top').textContent = formatTime(last?.topN);
    $('stats-count').textContent = String(solves.length);
    $('stats-days').textContent = String(activeDays(solves));
    empty.hidden = points.length > 0;
    chart.refresh();
    chart.setData(points);
    setRange('all');
  }

  return {
    open() {
      sheet.hidden = false;
      render(); // after un-hiding so the canvas has a size
    },
    close() {
      sheet.hidden = true;
    },
  };
}
