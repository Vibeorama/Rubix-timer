// Keeps the screen awake while enabled, using two mechanisms:
//
// 1. Screen Wake Lock API. iOS Safari rejects the request (NotAllowedError)
//    unless it is made during a user gesture, so callers should also call
//    enable() from a touchend/click handler (see main.js).
//
// 2. Fallback: a tiny silent video kept playing. WebKit only keeps the display
//    awake for a video that has an audio track, is NOT muted and does NOT use
//    `loop`. So it plays unmuted (the track is silent) and seeks back before
//    the end instead of looping. The page's audio session is set to "ambient"
//    so this mixes with the user's music instead of stopping it. The video only
//    runs until the wake lock is confirmed, then pauses.

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

export function createWakeLock() {
  let sentinel = null;
  let pending = false;
  let wanted = false;
  let apiError = null;
  let videoError = null;
  const video = createVideo();

  async function acquireApi() {
    if (!('wakeLock' in navigator) || sentinel || pending) return;
    pending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      sentinel = lock;
      apiError = null;
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null;
      });
      if (!wanted) releaseApi(); // disabled while the request was pending
      else video.pause();        // the real lock works; fallback not needed
    } catch (err) {
      apiError = err.name;
    } finally {
      pending = false;
    }
  }

  function releaseApi() {
    sentinel?.release().catch(() => {});
    sentinel = null;
  }

  function startVideo() {
    if (sentinel) return; // play() on a playing video is a harmless no-op
    if (canMixAudio) navigator.audioSession.type = 'ambient';
    video.play().then(() => { videoError = null; }, (err) => { videoError = err.name; });
  }

  // The OS drops the lock when the page is hidden; resume on return.
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') {
      acquireApi();
      startVideo();
    }
  });

  return {
    /** Safe to call repeatedly; call it from user-gesture handlers too. */
    enable() {
      wanted = true;
      acquireApi();
      startVideo();
    },
    disable() {
      wanted = false;
      video.pause();
      releaseApi();
    },
    /** One-line diagnostic of both mechanisms, for debugging on a device. */
    status() {
      const api = !('wakeLock' in navigator) ? 'unsupported'
        : sentinel ? 'active' : apiError ?? 'off';
      const vid = videoError
        ?? (video.paused ? 'paused' : `playing ${video.currentTime.toFixed(1)}s`);
      const audio = canMixAudio ? `audio ${navigator.audioSession.type}` : 'muted';
      return `wake lock: ${api} · video: ${vid} (${audio})`;
    },
  };
}
