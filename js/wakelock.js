// Keeps the screen awake while the app is in use (Screen Wake Lock API).
//
// iOS rejects the request (NotAllowedError) outside a user gesture, and a
// release after a long press (how the timer starts) does not count as one.
// So hold() is called from short taps/clicks anywhere; the lock is then kept
// while the app is in use and released after IDLE_MS without activity.
// It is never released while a solve is running.

const IDLE_MS = 2 * 60 * 1000;

export function createWakeLock({ onChange } = {}) {
  let sentinel = null;
  let idleTimer = null;
  let running = false;

  const changed = () => onChange?.(Boolean(sentinel));

  async function acquire() {
    if (!('wakeLock' in navigator) || sentinel) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (sentinel) { lock.release().catch(() => {}); return; }
      sentinel = lock;
      // The OS also releases it, e.g. when the app is backgrounded.
      lock.addEventListener('release', () => {
        if (sentinel === lock) { sentinel = null; changed(); }
      });
      changed();
    } catch {
      // Not in a gesture, or not allowed: the next tap tries again.
    }
  }

  function release() {
    sentinel?.release().catch(() => {});
    sentinel = null;
    changed();
  }

  /** Restart the idle countdown (paused while a solve runs). */
  function bump() {
    clearTimeout(idleTimer);
    if (!running) idleTimer = setTimeout(release, IDLE_MS);
  }

  return {
    get supported() { return 'wakeLock' in navigator; },
    get active() { return Boolean(sentinel); },

    /** Call from short-tap/click handlers (user gestures). */
    hold() {
      bump();
      acquire();
    },

    /** Tell it whether a solve is running; no idle release mid-solve. */
    setRunning(isRunning) {
      running = isRunning;
      bump();
    },
  };
}
