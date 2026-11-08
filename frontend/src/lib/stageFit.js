// DM Screen "stage fit": makes the DM window behave like a window of exactly
// the game screen's size (gw x gh), scaled to fit the DM monitor.
//
// Everything is laid out at game-screen size and the <body> is scaled with a
// CSS transform (anchored top-left, so bars appear only at the right/bottom).
// To keep the rest of the app oblivious, the browser APIs it reads positions
// from are adjusted to the unscaled coordinate space: event clientX/Y/pageX/Y,
// getBoundingClientRect, elementFromPoint and window.innerWidth/innerHeight.
// This is effectively browser page-zoom, done in the page, so it only affects
// this window (Electron's own zoom is shared by every window of the same origin).

let installed = null;

const accessor = (proto, prop) => {
  const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
  return d && d.get ? d : null;
};

function install() {
  const st = { s: 1, gw: 0, gh: 0, undo: [] };
  const patchGet = (proto, prop, map) => {
    const d = accessor(proto, prop);
    if (!d) return;
    Object.defineProperty(proto, prop, { configurable: true, enumerable: d.enumerable, get() { return map(d.get.call(this)); } });
    st.undo.push(() => Object.defineProperty(proto, prop, d));
  };
  const div = (v) => (typeof v === 'number' ? v / st.s : v);
  ['clientX', 'clientY', 'pageX', 'pageY'].forEach((p) => {
    patchGet(window.MouseEvent && MouseEvent.prototype, p, div);
    patchGet(window.Touch && Touch.prototype, p, div);
  });

  const origRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const r = origRect.call(this);
    return new DOMRect(r.x / st.s, r.y / st.s, r.width / st.s, r.height / st.s);
  };
  st.undo.push(() => { Element.prototype.getBoundingClientRect = origRect; });

  const origEFP = document.elementFromPoint;
  document.elementFromPoint = function (x, y) { return origEFP.call(this, x * st.s, y * st.s); };
  st.undo.push(() => { document.elementFromPoint = origEFP; });

  ['innerWidth', 'innerHeight'].forEach((p) => {
    const d = Object.getOwnPropertyDescriptor(window, p);
    if (!d) return;
    Object.defineProperty(window, p, { configurable: true, enumerable: d.enumerable, get: () => (p === 'innerWidth' ? st.gw : st.gh) });
    st.undo.push(() => Object.defineProperty(window, p, d));
  });

  st.onResize = () => recompute(st);
  window.addEventListener('resize', st.onResize);
  st.undo.push(() => window.removeEventListener('resize', st.onResize));
  return st;
}

function recompute(st) {
  const root = document.documentElement;
  const vw = root.clientWidth, vh = root.clientHeight;
  if (!vw || !vh || !st.gw || !st.gh) return;
  st.s = Math.min(vw / st.gw, vh / st.gh);
  const b = document.body.style;
  b.position = 'fixed'; b.left = '0'; b.top = '0'; b.margin = '0';
  b.width = `${st.gw}px`; b.height = `${st.gh}px`;
  b.overflow = 'hidden';
  b.transformOrigin = '0 0';
  b.transform = `scale(${st.s})`;
}

// Fit the page to a gw x gh stage (idempotent; call again when the size changes)
export function applyStageFit(gw, gh) {
  if (!(gw > 0 && gh > 0)) return;
  if (!installed) {
    installed = install();
    installed.saved = {
      htmlOverflow: document.documentElement.style.overflow,
      htmlBg: document.documentElement.style.backgroundColor,
      bodyCss: document.body.style.cssText,
    };
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.backgroundColor = '#050608';
  }
  installed.gw = Math.round(gw); installed.gh = Math.round(gh);
  recompute(installed);
  // Let layout-dependent components (they listen for resize) re-measure
  window.dispatchEvent(new Event('resize'));
}

export function removeStageFit() {
  if (!installed) return;
  installed.undo.forEach((fn) => { try { fn(); } catch (e) {} });
  document.documentElement.style.overflow = installed.saved.htmlOverflow;
  document.documentElement.style.backgroundColor = installed.saved.htmlBg;
  document.body.style.cssText = installed.saved.bodyCss;
  installed = null;
  window.dispatchEvent(new Event('resize'));
}

export const getStageScale = () => (installed ? installed.s : 1);
