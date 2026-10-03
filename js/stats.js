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
