/**
 * Theme management — dark/light mode with localStorage persistence.
 */
type Theme = 'dark' | 'light';

let _current: Theme = (localStorage.getItem('cinecreate-theme') as Theme) || 'light';
const listeners = new Set<() => void>();

export function getTheme(): Theme { return _current; }
export function toggleTheme(): Theme {
  _current = _current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('cinecreate-theme', _current);
  applyTheme(_current);
  listeners.forEach(fn => fn());
  return _current;
}
export function setTheme(t: Theme) {
  _current = t;
  localStorage.setItem('cinecreate-theme', t);
  applyTheme(t);
  listeners.forEach(fn => fn());
}
export function onThemeChange(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
}

// Initialize on load
applyTheme(_current);
