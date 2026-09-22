// Shared app-wide debug store. Any part of the app can log a diagnostic
// entry here, and the "App Debug Log" panel (in FloatingControls, tear-off
// capable) displays them live. Two kinds of data are tracked:
//
//   - renderStatus: a live, wholesale-replaced snapshot of per-effect render
//     state, refreshed every ~500ms by EffectsLayer's render loop. Local to
//     each window only — this is about that window's own rendering, which
//     only makes sense to inspect from within the window doing the
//     rendering (the Grid window), so it's not synced across windows.
//   - eventLog: an append-only history of one-off events from anywhere in
//     the app (scene save/load/export, import, errors, etc.), capped so it
//     doesn't grow unbounded over a long session.
//
// CRITICAL: this module is loaded separately by every Electron window (each
// is its own isolated renderer process with its own JS memory), so without
// explicit cross-window sync, eventLog would be a completely different,
// disconnected list in each window — logs written by the Grid window's
// render loop would silently never appear in a debug panel being viewed
// from the Controls window, even though they were logged correctly. This
// caused a very confusing, hours-long debugging detour where diagnostic
// logging added specifically to the Grid window's render loop appeared to
// never fire at all, when it was actually firing correctly the whole time
// — just into a store the viewer had no visibility into. Synced here via
// localStorage + the 'storage' event, the same pattern already used
// elsewhere in this app for scenes/settings cross-window sync.

const STORAGE_KEY = 'overgrid_debug_eventlog';
const listeners = new Set();
let renderStatus = [];
let eventLog = [];

// Seed from whatever's already been logged by other windows, so a freshly
// opened window doesn't start with an empty history.
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) eventLog = parsed;
  }
} catch (e) {}

function notify() {
  const snapshot = { renderStatus, eventLog };
  listeners.forEach(fn => fn(snapshot));
}

function persistEventLog() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventLog));
  } catch (e) {
    // If this fails (e.g. size limit), the log still works locally for
    // this window — it just won't be visible from other windows.
  }
}

// Picks up eventLog entries logged by OTHER windows.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      const parsed = e.newValue ? JSON.parse(e.newValue) : [];
      if (Array.isArray(parsed)) {
        eventLog = parsed;
        notify();
      }
    } catch (err) {}
  });
}

export const appDebugStore = {
  get renderStatus() { return renderStatus; },
  get eventLog() { return eventLog; },

  // Called by EffectsLayer's render loop — replaces the whole live snapshot.
  setRenderStatus(next) {
    renderStatus = next;
    notify();
  },

  // Called by anything (scene save/load/export, import, etc.) to append a
  // timestamped, human-readable diagnostic entry to the history log.
  log(entry) {
    eventLog = [...eventLog, { ...entry, timestamp: Date.now() }];
    if (eventLog.length > 200) eventLog = eventLog.slice(-200);
    persistEventLog();
    notify();
  },

  clearLog() {
    eventLog = [];
    persistEventLog();
    notify();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
