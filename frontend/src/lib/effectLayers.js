// Effect layers: one merged, Photoshop-style mask per effect.
//
// A layer stores the effect settings once (effectId/url/shader, opacity, tile…)
// plus an ordered list of mask operations ("ops"). Each op ADDS a shape to the
// mask, or — when `erase` is true — SUBTRACTS it (destination-out), so the
// eraser trims pixels instead of deleting a whole stroke. The renderer builds a
// single mask from all ops and shows the effect through it.
//
// op = { type: 'brush'|'lasso'|'marquee'|'fill', points?, rect?, width?, marqueeShape?, erase? }

export const newLayerId = () => `elay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// What makes two layers "the same effect" (so painting keeps adding to one layer)
export const layerIdentity = (e) => (e && (e.effectId || e.effectUrl || e.shaderName)) || '';

// Pull the effect fields off the active-effect template (settings or a layer)
export function layerEffectFields(t) {
  return {
    effectId: t.effectId || null,
    effectUrl: t.effectUrl || null,
    isShader: !!t.isShader,
    shaderName: t.shaderName || null,
    category: t.category || undefined,
    label: t.label || 'Effect',
    opacity: t.opacity ?? 0.9,
    tile: t.tile !== false,
    tileScale: t.tileScale || 100,
    blendMode: t.blendMode || 'normal',
  };
}

export function makeLayer(template, existing = []) {
  const f = layerEffectFields(template);
  const n = existing.filter((l) => layerIdentity(l) === layerIdentity(f)).length + 1;
  return { id: newLayerId(), name: `${f.label} ${n}`, ...f, edgeFade: 4, hidden: false, ops: [] };
}

// Invert a set of ops: start from a full fill and flip add<->erase.
export const invertOps = (ops) => [{ type: 'fill' }, ...ops.map((o) => ({ ...o, erase: !o.erase }))];

export function pasteOps(mode, srcOps, targetOps) {
  const src = JSON.parse(JSON.stringify(srcOps || []));
  if (mode === 'invert') return invertOps(src);
  if (mode === 'add') return [...(targetOps || []), ...src];
  return src; // replace
}

export function opsBounds(ops, cW, cH) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of ops) {
    if (o.erase) continue;
    if (o.type === 'fill') return { x: 0, y: 0, w: cW, h: cH };
    if (o.type === 'marquee' && o.rect) {
      x0 = Math.min(x0, o.rect.x); y0 = Math.min(y0, o.rect.y);
      x1 = Math.max(x1, o.rect.x + o.rect.width); y1 = Math.max(y1, o.rect.y + o.rect.height);
    } else if (o.points) {
      const pad = o.type === 'lasso' ? 0 : (o.width || 60) / 2;
      for (const p of o.points) {
        x0 = Math.min(x0, p.x - pad); y0 = Math.min(y0, p.y - pad);
        x1 = Math.max(x1, p.x + pad); y1 = Math.max(y1, p.y + pad);
      }
    }
  }
  if (!isFinite(x0)) return { x: 0, y: 0, w: cW, h: cH };
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

// Draw one op's shape in white onto a 2D context (caller sets composite mode)
export function drawOp(oc, op, cW, cH) {
  oc.fillStyle = '#fff';
  oc.strokeStyle = '#fff';
  oc.lineCap = 'round';
  oc.lineJoin = 'round';
  oc.lineWidth = op.width || 60;
  const pts = op.points || [];
  if (op.type === 'fill') {
    oc.fillRect(0, 0, cW, cH);
  } else if (op.type === 'marquee' && op.rect) {
    const r = op.rect;
    if (op.marqueeShape === 'circle') {
      oc.beginPath();
      oc.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
      oc.fill();
    } else {
      oc.fillRect(r.x, r.y, r.width, r.height);
    }
  } else if (op.type === 'lasso' && pts.length >= 3) {
    oc.beginPath();
    oc.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) oc.lineTo(pts[i].x, pts[i].y);
    oc.closePath();
    oc.fill();
  } else if (pts.length === 1) {
    oc.beginPath();
    oc.arc(pts[0].x, pts[0].y, (op.width || 60) / 2, 0, Math.PI * 2);
    oc.fill();
  } else if (pts.length >= 2) {
    oc.beginPath();
    oc.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) oc.lineTo(pts[i].x, pts[i].y);
    oc.stroke();
  }
}

// Build the layer's merged white-on-transparent mask canvas (no edge fade yet)
export function buildLayerMask(ops, cW, cH) {
  const off = document.createElement('canvas');
  off.width = cW; off.height = cH;
  const oc = off.getContext('2d');
  for (const op of ops) {
    oc.globalCompositeOperation = op.erase ? 'destination-out' : 'source-over';
    drawOp(oc, op, cW, cH);
  }
  oc.globalCompositeOperation = 'source-over';
  return off;
}
