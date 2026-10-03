// Progress-over-time series derived from solves. Pure functions, no DOM.

export const TOP_N = 10;

/**
 * One point per solve (sorted by date), holding the all-time values
 * as of that solve:
 *   mean  – mean of every solve so far
 *   topN  – mean of the best TOP_N solves so far (fewer while < TOP_N solves)
 *   time  – this solve's own time
 */
export function computeProgress(solves) {
  const sorted = [...solves].sort((a, b) => a.date - b.date);
  const points = [];
  const top = []; // ascending, at most TOP_N entries
  let sum = 0;

  sorted.forEach((s, i) => {
    sum += s.time;
    if (top.length < TOP_N || s.time < top[top.length - 1]) {
      let at = top.findIndex((t) => s.time < t);
      if (at === -1) at = top.length;
      top.splice(at, 0, s.time);
      if (top.length > TOP_N) top.pop();
    }
    points.push({
      t: s.date,
      n: i + 1,
      time: s.time,
      mean: sum / (i + 1),
      topN: top.reduce((a, b) => a + b, 0) / top.length,
    });
  });
  return points;
}

/** Number of distinct local calendar days with at least one solve. */
export function activeDays(solves) {
  return new Set(solves.map((s) => new Date(s.date).toDateString())).size;
}
