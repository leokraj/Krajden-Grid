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
  // rot: clockwise quarter-turns of the whole stage (0/90/180/270 degrees) so the DM can sit
  // at any edge of the table. tx/ty is where the stage's top-left lands on screen.
  const st = { s: 1, gw: 0, gh: 0, rot: 0, tx: 0, ty: 0, undo: [] };

  // real viewport point -> stage (layout) point
  st.toStage = (px, py) => {
    const u = (px - st.tx) / st.s, v = (py - st.ty) / st.s;
    switch (st.rot) {
      case 90: return [v, -u];
      case 180: return [-u, -v];
      case 270: return [-v, u];
      default: return [u, v];
    }
  };
  // stage point -> real viewport point
  st.toReal = (x, y) => {
    let u = x, v = y;
    switch (st.rot) {
      case 90: u = -y; v = x; break;
      case 180: u = -x; v = -y; break;
      case 270: u = y; v = -x; break;
      default: break;
    }
    return [u * st.s + st.tx, v * st.s + st.ty];
  };

  const patchPair = (proto, xp, yp) => {
    const dx = accessor(proto, xp), dy = accessor(proto, yp);
    if (!dx || !dy) return;
    const conv = (ev, idx) => {
      const px = dx.get.call(ev), py = dy.get.call(ev);
      return typeof px === 'number' && typeof py === 'number' ? st.toStage(px, py)[idx] : (idx ? py : px);
    };
    Object.defineProperty(proto, xp, { configurable: true, enumerable: dx.enumerable, get() { return conv(this, 0); } });
    Object.defineProperty(proto, yp, { configurable: true, enumerable: dy.enumerable, get() { return conv(this, 1); } });
    st.undo.push(() => { Object.defineProperty(proto, xp, dx); Object.defineProperty(proto, yp, dy); });
  };
  [['clientX', 'clientY'], ['pageX', 'pageY']].forEach(([xp, yp]) => {
    patchPair(window.MouseEvent && MouseEvent.prototype, xp, yp);
    patchPair(window.Touch && Touch.prototype, xp, yp);
  });

  const origRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const r = origRect.call(this);
    const [x1, y1] = st.toStage(r.x, r.y);
    const [x2, y2] = st.toStage(r.x + r.width, r.y + r.height);
    return new DOMRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  };
  st.undo.push(() => { Element.prototype.getBoundingClientRect = origRect; });

  const origEFP = document.elementFromPoint;
  document.elementFromPoint = function (x, y) { const [rx, ry] = st.toReal(x, y); return origEFP.call(this, rx, ry); };
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
  const odd = st.rot === 90 || st.rot === 270;
  const visW = odd ? st.gh : st.gw, visH = odd ? st.gw : st.gh;
  st.s = Math.min(vw / visW, vh / visH);
  st.tx = st.rot === 90 ? st.gh * st.s : st.rot === 180 ? st.gw * st.s : 0;
  st.ty = st.rot === 180 ? st.gh * st.s : st.rot === 270 ? st.gw * st.s : 0;
  const b = document.body.style;
  b.position = 'fixed'; b.left = '0'; b.top = '0'; b.margin = '0';
  b.width = `${st.gw}px`; b.height = `${st.gh}px`;
  b.overflow = 'hidden';
  b.transformOrigin = '0 0';
  b.transform = st.rot ? `translate(${st.tx}px, ${st.ty}px) rotate(${st.rot}deg) scale(${st.s})` : `scale(${st.s})`;
}

// Fit the page to a gw x gh stage (idempotent; call again when the size changes)
export function applyStageFit(gw, gh, rot = 0, keepBg = false) {
  if (!(gw > 0 && gh > 0)) return;
  if (!installed) {
    installed = install();
    installed.saved = {
      htmlOverflow: document.documentElement.style.overflow,
      htmlBg: document.documentElement.style.backgroundColor,
      bodyCss: document.body.style.cssText,
    };
    document.documentElement.style.overflow = 'hidden';
    if (!keepBg) document.documentElement.style.backgroundColor = '#050608';
  }
  installed.gw = Math.round(gw); installed.gh = Math.round(gh);
  installed.rot = [0, 90, 180, 270].includes(rot) ? rot : 0;
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
