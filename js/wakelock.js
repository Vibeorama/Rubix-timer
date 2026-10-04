// Keeps the screen awake while the app is in use, using two mechanisms:
//
// 1. Screen Wake Lock API.
// 2. Fallback: a tiny silent video kept playing. WebKit only keeps the display
//    awake for a video that has an audio track, is NOT muted and does NOT use
//    `loop`. So it plays unmuted (the track is silent) and seeks back before
//    the end instead of looping. The page's audio session is set to "ambient"
//    so this mixes with the user's music instead of stopping it. The video
//    only runs until the wake lock is confirmed, then pauses.
//
// iOS rejects both (NotAllowedError) outside a user gesture, and a release
// after a long press (how the timer starts) does not count as one. So hold()
// is called from short taps/clicks anywhere, and the lock is then kept while
// the app is in use, released after IDLE_MS without activity.

import { KEEP_AWAKE_VIDEO } from './keepawake-video.js';

const canMixAudio = 'audioSession' in navigator;

function createVideo() {
  const video = document.createElement('video');
  video.src = KEEP_AWAKE_VIDEO;
  // Unmuted only where the audio session can be made "ambient" (iOS 16.4+);
  // otherwise unmuted playback would pause the user's music.
  video.muted = !canMixAudio;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  // Seek back before the end instead of `loop` (see top of file).
  video.addEventListener('timeupdate', () => {
    if (video.currentTime > 1) video.currentTime = 0.1;
  });
  // In the DOM and technically visible (1px, 1% opacity): hidden media
  // only blocks system sleep, not display sleep.
  Object.assign(video.style, {
    position: 'fixed', left: '0', bottom: '0', width: '1px', height: '1px',
    opacity: '0.01', pointerEvents: 'none', zIndex: '2147483647',
  });
  document.body.append(video);
  return video;
}

const IDLE_MS = 10 * 60 * 1000;
const LOG_SIZE = 12;

export function createWakeLock({ onChange } = {}) {
  let sentinel = null;
  let idleTimer = null;
  let log = []; // recent attempt results, for status()
  const video = createVideo();

  const record = (entry) => { log = [...log, entry].slice(-LOG_SIZE); };
  const changed = () => onChange?.(Boolean(sentinel));

  async function acquireApi(source) {
    if (!('wakeLock' in navigator) || sentinel) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      record(`${source} lock ok`);
      if (sentinel) { lock.release().catch(() => {}); return; }
      sentinel = lock;
      lock.addEventListener('release', () => {
        if (sentinel === lock) { sentinel = null; changed(); }
      });
      video.pause(); // the real lock works; fallback not needed
      changed();
    } catch (err) {
      record(`${source} lock ${err.name}`);
    }
  }

  function startVideo(source) {
    if (sentinel || !video.paused) return;
    if (canMixAudio) navigator.audioSession.type = 'ambient';
    video.play().then(
      () => { record(`${source} video ok`); if (sentinel) video.pause(); changed(); },
      (err) => record(`${source} video ${err.name}`),
    );
  }

  function release() {
    sentinel?.release().catch(() => {});
    sentinel = null;
    video.pause();
    changed();
  }

  /** Activity: push back the idle release. */
  function bump() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(release, IDLE_MS);
  }

  return {
    get active() { return Boolean(sentinel) || !video.paused; },

    /** Call from short-tap/click handlers (user gestures). `source` labels the log. */
    hold(source) {
      bump();
      acquireApi(source);
      startVideo(source);
    },

    /** Call on non-gesture activity (e.g. a solve starting). */
    keepAlive() {
      bump();
    },

    /** Diagnostic of both mechanisms, for debugging on a device. */
    status() {
      const api = !('wakeLock' in navigator) ? 'unsupported' : sentinel ? 'active' : 'off';
      const vid = video.paused ? 'paused' : `playing ${video.currentTime.toFixed(1)}s`;
      const audio = canMixAudio ? `audio ${navigator.audioSession.type}` : 'muted';
      return `wake lock: ${api} · video: ${vid} (${audio})\n${log.join('\n') || 'no attempts'}`;
    },
  };
}
