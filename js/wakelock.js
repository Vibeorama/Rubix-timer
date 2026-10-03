// Keeps the screen awake via the Screen Wake Lock API (iOS 16.4+, Chrome).
// Silently does nothing where unsupported.

export function createWakeLock() {
  let sentinel = null;
  let wanted = false;

  async function acquire() {
    if (!('wakeLock' in navigator) || sentinel) return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => { sentinel = null; });
      if (!wanted) release(); // stopped while the request was pending
    } catch {
      sentinel = null;
    }
  }

  function release() {
    sentinel?.release().catch(() => {});
    sentinel = null;
  }

  // The OS drops the lock when the page is hidden; take it back on return.
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') acquire();
  });

  return {
    enable() { wanted = true; acquire(); },
    disable() { wanted = false; release(); },
  };
}
