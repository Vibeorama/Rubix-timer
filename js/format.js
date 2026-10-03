// Time formatting helpers.

/** Format milliseconds as "s.cc" or "m:ss.cc". Null/undefined → "–". */
export function formatTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return '–';
  const cs = Math.floor(ms / 10);
  const minutes = Math.floor(cs / 6000);
  const seconds = Math.floor((cs % 6000) / 100);
  const hundredths = String(cs % 100).padStart(2, '0');
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}.${hundredths}`
    : `${seconds}.${hundredths}`;
}

/** Short date like "3 Oct 14:05". */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/** Compact axis label: "25", "25.5" or "1:05". */
export function formatAxisTime(ms) {
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return Number.isInteger(s) ? String(s) : s.toFixed(1);
  const whole = Math.round(s);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
