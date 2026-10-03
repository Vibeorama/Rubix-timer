// Timer state machine, independent of the DOM.
//
// idle --press--> armed --(hold HOLD_MS)--> ready --release--> running --press--> stopped
// armed --release (too early)--> idle
// stopped --release--> idle

export const HOLD_MS = 300;

export function createTimer({ onState, onTick, onStop }) {
  let state = 'idle';
  let startAt = 0;
  let holdTimer = null;
  let frame = null;

  const set = (next) => {
    state = next;
    onState(next);
  };

  const tick = () => {
    onTick(performance.now() - startAt);
    frame = requestAnimationFrame(tick);
  };

  return {
    get state() { return state; },

    press() {
      if (state === 'running') {
        const elapsed = performance.now() - startAt;
        cancelAnimationFrame(frame);
        set('stopped');
        onTick(elapsed);
        onStop(elapsed);
        return;
      }
      if (state !== 'idle') return;
      set('armed');
      holdTimer = setTimeout(() => set('ready'), HOLD_MS);
    },

    release() {
      clearTimeout(holdTimer);
      if (state === 'ready') {
        startAt = performance.now();
        set('running');
        frame = requestAnimationFrame(tick);
      } else if (state === 'armed' || state === 'stopped') {
        set('idle');
      }
    },

    /** Abort a press in progress (e.g. pointer cancelled by the OS). */
    cancel() {
      clearTimeout(holdTimer);
      if (state === 'armed' || state === 'ready') set('idle');
    },
  };
}
