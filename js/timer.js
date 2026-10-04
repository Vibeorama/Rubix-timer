// Timer state machine, independent of the DOM.
//
// Without inspection:
//   idle --press--> armed --(hold HOLD_MS)--> ready --release--> running --press--> stopped
//   armed --release (too early)--> idle
//   stopped --release--> idle
//
// With inspection (WCA-style, 15 s):
//   idle --tap--> inspecting --press--> armed --(hold)--> ready --release--> running ...
//   armed --release (too early)--> inspecting
// The countdown keeps running through armed/ready and goes negative after
// 15 s (+2 / DNF territory); onInspect reports the ms left on every frame.

export const HOLD_MS = 300;
export const INSPECTION_MS = 15000;

export function createTimer({ onState, onTick, onStop, onInspect, inspectionEnabled = () => false }) {
  let state = 'idle';
  let startAt = 0;
  let holdTimer = null;
  let frame = null;
  let inspectAt = null;      // inspection start time, null when not inspecting
  let inspectFrame = null;
  let tapToInspect = false;  // press seen in idle; inspection starts on release

  const set = (next) => {
    state = next;
    onState(next);
  };

  const tick = () => {
    onTick(performance.now() - startAt);
    frame = requestAnimationFrame(tick);
  };

  const inspectTick = () => {
    onInspect?.(INSPECTION_MS - (performance.now() - inspectAt));
    inspectFrame = requestAnimationFrame(inspectTick);
  };

  function stopInspection() {
    cancelAnimationFrame(inspectFrame);
    inspectAt = null;
  }

  function arm() {
    set('armed');
    holdTimer = setTimeout(() => set('ready'), HOLD_MS);
  }

  return {
    get state() { return state; },
    get inspecting() { return inspectAt !== null; },

    press() {
      if (state === 'running') {
        const elapsed = performance.now() - startAt;
        cancelAnimationFrame(frame);
        set('stopped');
        onTick(elapsed);
        onStop(elapsed);
        return;
      }
      if (state === 'inspecting') return arm();
      if (state !== 'idle') return;
      if (inspectionEnabled()) tapToInspect = true;
      else arm();
    },

    release() {
      clearTimeout(holdTimer);
      if (tapToInspect) {
        tapToInspect = false;
        inspectAt = performance.now();
        set('inspecting');
        inspectTick();
      } else if (state === 'ready') {
        stopInspection();
        startAt = performance.now();
        set('running');
        frame = requestAnimationFrame(tick);
      } else if (state === 'armed') {
        set(inspectAt !== null ? 'inspecting' : 'idle');
      } else if (state === 'stopped') {
        set('idle');
      }
    },

    /** Abort a press in progress (e.g. pointer cancelled by the OS). */
    cancel() {
      clearTimeout(holdTimer);
      tapToInspect = false;
      if (state === 'armed' || state === 'ready') set(inspectAt !== null ? 'inspecting' : 'idle');
    },

    /** Leave inspection without starting a solve. */
    abortInspection() {
      clearTimeout(holdTimer);
      if (inspectAt === null) return;
      stopInspection();
      set('idle');
    },
  };
}
