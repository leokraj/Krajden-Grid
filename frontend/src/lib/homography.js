// Perspective maths for the Table Photo: fit a homography from tapped points in
// a photo to their real positions on screen, and turn it into a CSS matrix3d.

// 3x3 grid of numbered calibration markers, inset 10% from every edge.
export const MARKER_FRACTIONS = [0.1, 0.5, 0.9];
export function calibMarkers(W, H) {
  const out = [];
  let n = 1;
  for (const fy of MARKER_FRACTIONS) for (const fx of MARKER_FRACTIONS) {
    out.push({ n: n++, fx, fy, x: fx * W, y: fy * H });
  }
  return out;
}

// Solve the 8 unknowns (h33 = 1) of a homography mapping src[i] -> dst[i]
// (least squares when there are more than 4 pairs). Points are normalised first
// for numerical stability. Returns a row-major 3x3 [9] or null if degenerate.
export function solveHomography(src, dst) {
  const n = src.length;
  if (n < 4 || dst.length !== n) return null;
  const norm = (pts) => {
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const d = pts.reduce((a, p) => a + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length || 1;
    const s = Math.SQRT2 / d;
    return { s, cx, cy, pts: pts.map((p) => ({ x: (p.x - cx) * s, y: (p.y - cy) * s })) };
  };
  const A = norm(src), B = norm(dst);
  // Normal equations for the 8 unknowns
  const M = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const v = new Array(8).fill(0);
  const addRow = (row, rhs) => {
    for (let i = 0; i < 8; i++) {
      v[i] += row[i] * rhs;
      for (let j = 0; j < 8; j++) M[i][j] += row[i] * row[j];
    }
  };
  for (let i = 0; i < n; i++) {
    const { x, y } = A.pts[i];
    const { x: X, y: Y } = B.pts[i];
    addRow([x, y, 1, 0, 0, 0, -x * X, -y * X], X);
    addRow([0, 0, 0, x, y, 1, -x * Y, -y * Y], Y);
  }
  // Gaussian elimination with partial pivoting
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9) return null;
    [M[c], M[p]] = [M[p], M[c]]; [v[c], v[p]] = [v[p], v[c]];
    for (let r = c + 1; r < 8; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 8; k++) M[r][k] -= f * M[c][k];
      v[r] -= f * v[c];
    }
  }
  const h = new Array(8).fill(0);
  for (let r = 7; r >= 0; r--) {
    let sum = v[r];
    for (let k = r + 1; k < 8; k++) sum -= M[r][k] * h[k];
    h[r] = sum / M[r][r];
  }
  const Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  // Denormalise: H = Tb^-1 * Hn * Ta
  const Ta = [A.s, 0, -A.s * A.cx, 0, A.s, -A.s * A.cy, 0, 0, 1];
  const TbInv = [1 / B.s, 0, B.cx, 0, 1 / B.s, B.cy, 0, 0, 1];
  const mul = (P, Q) => {
    const R = new Array(9).fill(0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) R[i * 3 + j] += P[i * 3 + k] * Q[k * 3 + j];
    return R;
  };
  const H = mul(TbInv, mul(Hn, Ta));
  const s = H[8] || 1;
  const out = H.map((x) => x / s);
  return out.every(Number.isFinite) ? out : null;
}

export function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

// Row-major 3x3 -> CSS matrix3d() string (use with transform-origin: 0 0)
export function homographyToMatrix3d(H) {
  return `matrix3d(${H[0]},${H[3]},0,${H[6]},${H[1]},${H[4]},0,${H[7]},0,0,1,0,${H[2]},${H[5]},0,${H[8]})`;
}

// pts: { [markerNumber]: {x,y} in photo pixels }  ->  { H, err: {avg,max}, used }
export function fitPhoto(pts, W, H) {
  const markers = calibMarkers(W, H);
  const src = [], dst = [];
  for (const m of markers) {
    const p = pts && pts[m.n];
    if (p) { src.push({ x: p.x, y: p.y }); dst.push({ x: m.x, y: m.y }); }
  }
  const Hm = solveHomography(src, dst);
  if (!Hm) return { H: null, err: null, used: src.length };
  let sum = 0, max = 0;
  for (let i = 0; i < src.length; i++) {
    const q = applyH(Hm, src[i].x, src[i].y);
    const e = Math.hypot(q.x - dst[i].x, q.y - dst[i].y);
    sum += e; max = Math.max(max, e);
  }
  return { H: Hm, err: { avg: sum / src.length, max }, used: src.length };
}
