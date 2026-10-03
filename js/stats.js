// Statistics over solve times (ms).

export function best(times) {
  return times.length ? Math.min(...times) : null;
}

/**
 * WCA-style average of the last n solves: drop best and worst, mean the rest.
 * Returns null when there are fewer than n solves.
 */
export function averageOf(times, n) {
  if (times.length < n) return null;
  const sorted = times.slice(-n).sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((sum, t) => sum + t, 0) / trimmed.length;
}

export function summarize(solves) {
  const times = solves.map((s) => s.time);
  return {
    count: times.length,
    best: best(times),
    ao5: averageOf(times, 5),
    ao12: averageOf(times, 12),
  };
}

/** Best (lowest) average-of-n over every window of n consecutive solves. */
export function bestAverageOf(times, n) {
  let bestAvg = null;
  for (let end = n; end <= times.length; end++) {
    const avg = averageOf(times.slice(end - n, end), n);
    if (bestAvg === null || avg < bestAvg) bestAvg = avg;
  }
  return bestAvg;
}

/** All-time personal bests. */
export function personalBests(times) {
  return {
    single: best(times),
    ao5: bestAverageOf(times, 5),
    ao12: bestAverageOf(times, 12),
  };
}

const RECORD_LABELS = { single: 'single', ao5: 'Ao5', ao12: 'Ao12' };

/**
 * Records beaten between two personalBests() results, e.g. ['single', 'Ao5'].
 * A first-ever value doesn't count: there must be a previous record to beat.
 */
export function newRecords(before, after) {
  return Object.keys(RECORD_LABELS)
    .filter((k) => before[k] !== null && after[k] !== null && after[k] < before[k])
    .map((k) => RECORD_LABELS[k]);
}
