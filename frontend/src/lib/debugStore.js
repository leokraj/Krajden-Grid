// Shared app-wide debug store. Any part of the app can log a diagnostic
// entry here, and the "App Debug Log" panel (in FloatingControls, tear-off
// capable) displays them live. Two kinds of data are tracked:
//
//   - renderStatus: a live, wholesale-replaced snapshot of per-effect render
//     state, refreshed every ~500ms by EffectsLayer's render loop.
//   - eventLog: an append-only history of one-off events from anywhere in
//     the app (scene save/load/export, import, errors, etc.), capped so it
//     doesn't grow unbounded over a long session.

const listeners = new Set();
let renderStatus = [];
let eventLog = [];

function notify() {
  const snapshot = { renderStatus, eventLog };
  listeners.forEach(fn => fn(snapshot));
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
    notify();
  },

  clearLog() {
    eventLog = [];
    notify();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
