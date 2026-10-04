// Small persisted user settings (localStorage), with defaults.

const KEY = 'cube-timer:v1:settings';
const DEFAULTS = { inspection: true };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = load();

export function getSetting(name) {
  return current[name];
}

export function setSetting(name, value) {
  current = { ...current, [name]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable: keep the setting for this session only.
  }
}
