// Single source of truth for the app version (MAJOR.MINOR.PATCH).
// Bump on every release: it is shown in the app and names the offline cache,
// so changing it makes phones download the new files.
// Classic script (not a module) so the service worker can importScripts() it.
self.APP_VERSION = '1.1.0';
