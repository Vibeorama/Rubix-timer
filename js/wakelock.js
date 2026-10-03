// Keeps the screen awake while enabled, using two mechanisms:
// 1. Screen Wake Lock API (Android, desktop, recent iOS Safari).
// 2. A tiny muted video kept playing. iOS doesn't auto-lock while a video with
//    an audio track plays, and this covers cases where the API is missing or
//    ignored (Home Screen apps before iOS 18.4, Low Power Mode). Must be
//    started from a user gesture, which it is: the timer starts on touch release.
//    It must NOT use `loop`: WebKit never keeps the display awake for looping
//    media, so playback is kept going by seeking back before the end instead.

import { KEEP_AWAKE_VIDEO } from './keepawake-video.js';

function createVideo() {
  const video = document.createElement('video');
  video.src = KEEP_AWAKE_VIDEO;
  video.muted = true;          // muted: never interrupts the user's music
  // Seek back before the end instead of `loop` (see top of file).
  video.addEventListener('timeupdate', () => {
    if (video.currentTime > 1) video.currentTime = 0.1;
  });
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('aria-hidden', 'true');
  // In the DOM, on top and technically visible (1px, 1% opacity): iOS may
  // pause muted media that is detached, hidden or covered.
  Object.assign(video.style, {
    position: 'fixed', left: '0', bottom: '0', width: '1px', height: '1px',
    opacity: '0.01', pointerEvents: 'none', zIndex: '2147483647',
  });
  document.body.append(video);
  return video;
}

export function createWakeLock() {
  let sentinel = null;
  let wanted = false;
  let apiError = null;
  let videoError = null;
  const video = createVideo();

  async function acquireApi() {
    if (!('wakeLock' in navigator) || sentinel) return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => { sentinel = null; });
      if (!wanted) releaseApi(); // disabled while the request was pending
      apiError = null;
    } catch (err) {
      sentinel = null;
      apiError = err.name;
    }
  }

  function releaseApi() {
    sentinel?.release().catch(() => {});
    sentinel = null;
  }

  function start() {
    video.play().then(() => { videoError = null; }, (err) => { videoError = err.name; });
    acquireApi();
  }

  // The OS drops both when the page is hidden; resume on return.
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') start();
  });

  return {
    enable() {
      wanted = true;
      start();
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
      const vid = videoError ?? (video.paused ? 'paused' : `playing ${video.currentTime.toFixed(1)}s`);
      return `wake lock: ${api} · video: ${vid}`;
    },
  };
}
