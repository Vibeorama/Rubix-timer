// Canvas time-series line chart with touch pinch-zoom and pan on the x (time) axis.
//
//   one finger drag  → pan         two fingers → pinch zoom
//   tap              → select the nearest point (readout via onSelect)
//   mouse wheel      → zoom (desktop)
//
// Generic: knows nothing about cubes. Points are { t, ...values }; series are
// { key, color } and read point[key].

const MIN_SPAN = 10 * 60 * 1000;          // 10 minutes
const PAD = { top: 12, right: 12, bottom: 26, left: 46 };
const TAP_SLOP = 8;                       // px of movement before a touch is a drag

const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
// Tick steps, smallest first. Calendar months/years are handled specially.
const STEPS = [
  { ms: MIN, unit: 'min', n: 1 }, { ms: 5 * MIN, unit: 'min', n: 5 },
  { ms: 15 * MIN, unit: 'min', n: 15 }, { ms: 30 * MIN, unit: 'min', n: 30 },
  { ms: HOUR, unit: 'hour', n: 1 }, { ms: 3 * HOUR, unit: 'hour', n: 3 },
  { ms: 6 * HOUR, unit: 'hour', n: 6 }, { ms: 12 * HOUR, unit: 'hour', n: 12 },
  { ms: DAY, unit: 'day', n: 1 }, { ms: 2 * DAY, unit: 'day', n: 2 },
  { ms: 7 * DAY, unit: 'day', n: 7 }, { ms: 14 * DAY, unit: 'day', n: 14 },
  { ms: 30 * DAY, unit: 'month', n: 1 }, { ms: 91 * DAY, unit: 'month', n: 3 },
  { ms: 182 * DAY, unit: 'month', n: 6 }, { ms: 365 * DAY, unit: 'year', n: 1 },
  { ms: 2 * 365 * DAY, unit: 'year', n: 2 }, { ms: 5 * 365 * DAY, unit: 'year', n: 5 },
];
const MAX_X_TICKS = 4;

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Tick timestamps for [t0, t1], aligned to local calendar boundaries. */
function timeTicks(t0, t1) {
  const span = t1 - t0;
  const step = STEPS.find((s) => span / s.ms <= MAX_X_TICKS) ?? STEPS[STEPS.length - 1];
  const d = new Date(t0);
  d.setSeconds(0, 0);
  if (step.unit === 'min') d.setMinutes(Math.ceil(d.getMinutes() / step.n) * step.n);
  else if (step.unit === 'hour') d.setHours(Math.ceil((d.getHours() + (d.getMinutes() ? 1 : 0)) / step.n) * step.n, 0);
  else {
    d.setHours(0, 0);
    if (step.unit === 'month' || step.unit === 'year') d.setDate(1);
    if (step.unit === 'month') d.setMonth(Math.floor(d.getMonth() / step.n) * step.n);
    if (step.unit === 'year') d.setMonth(0);
  }
  const ticks = [];
  for (let guard = 0; guard < 100; guard++) {
    if (d.getTime() >= t0 && d.getTime() <= t1) ticks.push(d.getTime());
    if (d.getTime() > t1) break;
    if (step.unit === 'min') d.setMinutes(d.getMinutes() + step.n);
    else if (step.unit === 'hour') d.setHours(d.getHours() + step.n);
    else if (step.unit === 'day') d.setDate(d.getDate() + step.n);
    else if (step.unit === 'month') d.setMonth(d.getMonth() + step.n);
    else d.setFullYear(d.getFullYear() + step.n);
  }
  return { ticks, unit: step.unit };
}

function tickLabel(t, unit) {
  const d = new Date(t);
  if (unit === 'min' || unit === 'hour') {
    if (d.getHours() === 0 && d.getMinutes() === 0) {
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    }
    return d.getMinutes()
      ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleTimeString(undefined, { hour: 'numeric' });
  }
  if (unit === 'day') return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (unit === 'month') {
    return d.getMonth() === 0
      ? String(d.getFullYear())
      : d.toLocaleDateString(undefined, { month: 'short' });
  }
  return String(d.getFullYear());
}

/** ~4 "nice" value ticks covering [lo, hi]. */
function niceTicks(lo, hi) {
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(v);
  return ticks;
}

export function createTimeChart(canvas, { series, formatValue, onSelect }) {
  const ctx = canvas.getContext('2d');
  let points = [];
  let view = null;        // { t0, t1 }
  let bounds = null;      // full zoom-out range
  let selected = null;    // index into points
  let width = 0, height = 0;

  // ---------- geometry ----------
  const plotW = () => width - PAD.left - PAD.right;
  const plotH = () => height - PAD.top - PAD.bottom;
  const xOf = (t) => PAD.left + ((t - view.t0) / (view.t1 - view.t0)) * plotW();
  const tOf = (x) => view.t0 + ((x - PAD.left) / plotW()) * (view.t1 - view.t0);

  function clampView(t0, t1) {
    let span = Math.max(MIN_SPAN, Math.min(t1 - t0, bounds.t1 - bounds.t0));
    if (t0 < bounds.t0) t0 = bounds.t0;
    if (t0 + span > bounds.t1) t0 = bounds.t1 - span;
    return { t0, t1: t0 + span };
  }

  /** Points in view, plus one on each side so lines run off the edges. */
  function visibleRange() {
    let i0 = points.findIndex((p) => p.t >= view.t0);
    if (i0 === -1) i0 = points.length - 1;
    let i1 = points.length - 1;
    while (i1 > 0 && points[i1].t > view.t1) i1--;
    return [Math.max(0, i0 - 1), Math.min(points.length - 1, Math.max(i1, i0) + 1)];
  }

  // ---------- drawing ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    if (!width) resize();
    ctx.clearRect(0, 0, width, height);
    if (!points.length || !view) return;

    const [a, b] = visibleRange();
    let lo = Infinity, hi = -Infinity;
    for (let i = a; i <= b; i++) {
      for (const s of series) {
        lo = Math.min(lo, points[i][s.key]);
        hi = Math.max(hi, points[i][s.key]);
      }
    }
    const pad = Math.max((hi - lo) * 0.1, 1000); // ≥1s so tiny ranges get distinct labels
    lo = Math.max(0, lo - pad);
    hi += pad;
    const yOf = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH();

    const grid = css('--border');
    const muted = css('--muted');
    const surface = css('--bg');
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.lineWidth = 1;

    // y grid + labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of niceTicks(lo, hi)) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.strokeStyle = grid;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(width - PAD.right, y); ctx.stroke();
      ctx.fillStyle = muted;
      ctx.fillText(formatValue(v), PAD.left - 6, y);
    }

    // x ticks + labels
    const { ticks, unit } = timeTicks(view.t0, view.t1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const t of ticks) {
      const x = Math.round(xOf(t)) + 0.5;
      ctx.strokeStyle = grid;
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, height - PAD.bottom); ctx.stroke();
      ctx.fillStyle = muted;
      ctx.fillText(tickLabel(t, unit), x, height - PAD.bottom + 6);
    }

    // series lines, clipped to the plot
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.left, PAD.top - 4, plotW(), plotH() + 8);
    ctx.clip();
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const x = xOf(points[i].t), y = yOf(points[i][s.key]);
        i === a ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (a === b) { // single point: draw a dot so it's visible
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(xOf(points[a].t), yOf(points[a][s.key]), 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // selection hairline + markers (8px dots with a 2px surface ring)
    if (selected !== null) {
      const p = points[selected];
      const x = Math.round(xOf(p.t)) + 0.5;
      if (x >= PAD.left && x <= width - PAD.right) {
        ctx.strokeStyle = muted;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, height - PAD.bottom); ctx.stroke();
        for (const s of series) {
          const y = yOf(p[s.key]);
          ctx.fillStyle = surface;
          ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = s.color;
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  let frame = null;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = null; draw(); }); };

  function select(index) {
    selected = index;
    onSelect?.(index === null ? null : points[index]);
    redraw();
  }

  function nearestIndex(t) {
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    }
    return best;
  }

  // ---------- gestures ----------
  const pointers = new Map(); // id → { x, startX }
  let gesture = null;         // { kind: 'pan'|'pinch', ... }

  const localX = (e) => e.clientX - canvas.getBoundingClientRect().left;

  function startGesture() {
    const ps = [...pointers.values()];
    if (ps.length === 1) {
      gesture = { kind: 'pan', x0: ps[0].x, view0: { ...view }, moved: false };
    } else if (ps.length >= 2) {
      const [p, q] = ps;
      const mid = (p.x + q.x) / 2;
      gesture = {
        kind: 'pinch',
        dist0: Math.max(20, Math.abs(p.x - q.x)),
        anchorT: tOf(mid),
        anchorFrac: (mid - PAD.left) / plotW(),
        span0: view.t1 - view.t0,
      };
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!view) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: localX(e) });
    startGesture();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.get(e.pointerId).x = localX(e);
    const ps = [...pointers.values()];

    if (gesture.kind === 'pan') {
      const dx = ps[0].x - gesture.x0;
      if (Math.abs(dx) > TAP_SLOP) gesture.moved = true;
      if (!gesture.moved) return;
      const dt = (dx / plotW()) * (gesture.view0.t1 - gesture.view0.t0);
      view = clampView(gesture.view0.t0 - dt, gesture.view0.t1 - dt);
    } else if (ps.length >= 2) {
      const dist = Math.max(20, Math.abs(ps[0].x - ps[1].x));
      const span = gesture.span0 * (gesture.dist0 / dist);
      const mid = (ps[0].x + ps[1].x) / 2;
      const frac = (mid - PAD.left) / plotW();
      // Keep the time under the fingers' midpoint under the midpoint.
      const t0 = gesture.anchorT - frac * span;
      view = clampView(t0, t0 + span);
    }
    redraw();
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    const wasTap = gesture?.kind === 'pan' && !gesture.moved && pointers.size === 1;
    pointers.delete(e.pointerId);
    if (wasTap && e.type === 'pointerup') select(nearestIndex(tOf(localX(e))));
    // Continue with the remaining finger(s) without a jump.
    if (pointers.size) startGesture(); else gesture = null;
    if (gesture?.kind === 'pan') gesture.moved = true; // leftover finger after pinch never taps
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('wheel', (e) => {
    if (!view) return;
    e.preventDefault();
    const t = tOf(localX(e));
    const k = Math.exp(e.deltaY * 0.002);
    view = clampView(t - (t - view.t0) * k, t + (view.t1 - t) * k);
    redraw();
  }, { passive: false });

  window.addEventListener('resize', () => { resize(); redraw(); });

  // ---------- API ----------
  return {
    setData(newPoints) {
      points = newPoints;
      if (!points.length) { view = bounds = null; select(null); return; }
      const first = points[0].t, last = points[points.length - 1].t;
      const pad = Math.min(Math.max((last - first) * 0.03, MIN_SPAN / 2), DAY);
      bounds = { t0: first - pad, t1: last + pad };
      view = { ...bounds };
      select(points.length - 1);
    },
    /** Show the `ms` of time up to the latest point (null = everything). */
    showLast(ms) {
      if (!bounds) return;
      const end = points[points.length - 1].t + (ms ?? 0) * 0.04;
      view = ms ? clampView(end - ms, end) : { ...bounds };
      select(points.length - 1);
    },
    refresh() { resize(); redraw(); },
  };
}
