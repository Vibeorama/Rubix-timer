// Persistence for solves (localStorage). Each solve: { id, time, date }.

const KEY = 'cube-timer:v1:solves';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(solves) {
  try {
    localStorage.setItem(KEY, JSON.stringify(solves));
  } catch {
    // Storage full or unavailable: keep working in memory.
  }
}

export function createStore() {
  let solves = load();
  const listeners = new Set();

  const commit = () => {
    save(solves);
    listeners.forEach((fn) => fn(solves));
  };

  return {
    all: () => solves,
    add(time) {
      const solve = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), time, date: Date.now() };
      solves = [...solves, solve];
      commit();
      return solve;
    },
    remove(id) {
      solves = solves.filter((s) => s.id !== id);
      commit();
    },
    clear() {
      solves = [];
      commit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
