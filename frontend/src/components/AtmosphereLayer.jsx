import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useGrid } from '../context/GridContext';
import {
  ATMOSPHERE_DEFAULTS, TOD_PRESETS, GFX_SCALE, GFX_FPS, uid,
  mulberry32, runePath, polygonPoints,
} from '../lib/atmosphere';

// ─────────────────────────────────────────────────────────────────────────────
// AtmosphereLayer — time of day tint, weather (fog / rain / lightning with
// blockers), painted Fog of War, spell circles, combat marks and the mouse
// token. Everything here is driven by settings so it mirrors across windows
// (and respects the DM Screen's Update-Game-Screen isolation) automatically.
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
@keyframes kgSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes kgSpinR { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
@keyframes kgPulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes kgSpark { 0% { opacity: 0; transform: translate(0,0); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)); } }
@keyframes kgSlashIn { 0% { transform: scale(.05,1); opacity: 0; } 25% { opacity: 1; } 100% { transform: scale(1,1); opacity: 1; } }
@keyframes kgBurstIn { 0% { transform: scale(.1); opacity: 0; } 30% { opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes kgFade { from { opacity: 1; } to { opacity: 0; } }
.kg-rot  { transform-origin: 100px 100px; animation: kgSpin linear infinite; }
.kg-rotr { transform-origin: 100px 100px; animation: kgSpinR linear infinite; }
.kg-pulse { animation: kgPulse 2.2s ease-in-out infinite; }
.kg-spark { animation: kgSpark ease-out infinite; }
`;

function useStyleOnce() {
  useEffect(() => {
    if (document.getElementById('kg-atmo-css')) return;
    const el = document.createElement('style');
    el.id = 'kg-atmo-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

const S = (settings, key) => (settings[key] === undefined ? ATMOSPHERE_DEFAULTS[key] : settings[key]);

// ── Time of day ─────────────────────────────────────────────────────────────
function TimeOfDayTint({ settings }) {
  const preset = S(settings, 'todPreset');
  if (!preset || preset === 'off') return null;
  const p = TOD_PRESETS[preset] || TOD_PRESETS.off;
  const color = preset === 'custom' ? S(settings, 'todColor') : p.color;
  const opacity = preset === 'custom' ? S(settings, 'todOpacity') : p.opacity;
  const blend = preset === 'custom' ? S(settings, 'todBlend') : p.blend;
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 16, background: color, opacity, mixBlendMode: blend, transition: 'opacity .6s, background .6s' }}
      data-testid="tod-tint"
    />
  );
}

// ── Weather ─────────────────────────────────────────────────────────────────
function WeatherCanvas({ settings, size }) {
  const canvasRef = useRef(null);
  const sRef = useRef(settings);
  sRef.current = settings;
  const stateRef = useRef({ blobs: null, drops: [], nextBolt: 0, flashes: [], bolt: null });

  const fogOn = !!S(settings, 'weatherFogOn');
  const rainOn = !!S(settings, 'weatherRainOn');
  const litOn = !!S(settings, 'weatherLightningOn');
  const active = fogOn || rainOn || litOn;
  const quality = S(settings, 'gfxQuality');
  const scale = GFX_SCALE[quality] || 1;
  const fps = GFX_FPS[quality] || 60;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(2, Math.round(size.width * scale));
    canvas.height = Math.max(2, Math.round(size.height * scale));
    const ctx = canvas.getContext('2d');
    if (!active) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

    const st = stateRef.current;
    const W = size.width, H = size.height;
    if (!st.blobs) {
      const rnd = mulberry32(7);
      st.blobs = Array.from({ length: 16 }, () => ({
        x: rnd() * W, y: rnd() * H, r: 260 + rnd() * 380, v: 0.5 + rnd() * 1.2, a: 0.5 + rnd() * 0.5,
        vy: (rnd() - 0.5) * 0.3,
      }));
    }
    let raf, last = performance.now(), acc = 0;
    const minDt = 1000 / fps;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = now - last;
      acc += dt; last = now;
      if (acc < minDt) return;
      const step = Math.min(acc, 100) / 1000; acc = 0;
      const s = sRef.current;
      const particles = S(s, 'gfxParticles');
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);

      // Fog clouds
      if (S(s, 'weatherFogOn')) {
        const dens = S(s, 'weatherFogDensity');
        const speed = S(s, 'weatherFogSpeed');
        const [r, g, b] = hexToRgbArr(S(s, 'weatherFogColor'));
        for (const bl of st.blobs) {
          bl.x += bl.v * speed * 40 * step;
          bl.y += bl.vy * speed * 40 * step;
          if (bl.x - bl.r > W) bl.x = -bl.r;
          if (bl.y < -bl.r) bl.y = H + bl.r; else if (bl.y > H + bl.r) bl.y = -bl.r;
          const grd = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, bl.r);
          const a = Math.min(0.5, dens * 0.34 * bl.a);
          grd.addColorStop(0, `rgba(${r},${g},${b},${a})`);
          grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = grd;
          ctx.fillRect(bl.x - bl.r, bl.y - bl.r, bl.r * 2, bl.r * 2);
        }
      }

      // Rain
      if (S(s, 'weatherRainOn')) {
        const dens = S(s, 'weatherRainDensity');
        const spd = S(s, 'weatherRainSpeed');
        const wind = (S(s, 'weatherWindAngle') * Math.PI) / 180;
        const target = Math.round(dens * (particles ? 420 : 170));
        while (st.drops.length < target) st.drops.push({ x: Math.random() * W * 1.3 - W * 0.15, y: Math.random() * H, l: 10 + Math.random() * 16, v: 0.8 + Math.random() * 0.6 });
        if (st.drops.length > target) st.drops.length = target;
        ctx.strokeStyle = 'rgba(200,220,245,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const dx = Math.sin(wind), dy = Math.cos(wind);
        for (const d of st.drops) {
          d.x += dx * d.v * 900 * spd * step;
          d.y += dy * d.v * 900 * spd * step;
          if (d.y > H + 20 || d.x > W + 60 || d.x < -60) { d.y = -20; d.x = Math.random() * W * 1.3 - W * 0.15; }
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - dx * d.l, d.y - dy * d.l);
        }
        ctx.stroke();
      }

      // Lightning
      if (S(s, 'weatherLightningOn')) {
        const freq = Math.max(2, S(s, 'weatherLightningFreq'));
        if (!st.nextBolt) st.nextBolt = now + freq * 1000 * (0.4 + Math.random());
        if (now >= st.nextBolt) {
          st.nextBolt = now + freq * 1000 * (0.5 + Math.random());
          st.flashes = [{ t: now, d: 130 }, { t: now + 190, d: 260 }];
          if (particles) st.bolt = { t: now, pts: makeBolt(W, H), life: 380 };
        }
        let a = 0;
        for (const f of st.flashes) {
          const k = (now - f.t) / f.d;
          if (k >= 0 && k <= 1) a = Math.max(a, 1 - k);
        }
        if (a > 0) {
          ctx.fillStyle = `rgba(225,235,255,${a * 0.5})`;
          ctx.fillRect(0, 0, W, H);
        }
        if (st.bolt) {
          const k = (now - st.bolt.t) / st.bolt.life;
          if (k > 1) st.bolt = null;
          else {
            ctx.save();
            ctx.globalAlpha = 1 - k;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(170,150,255,0.8)'; ctx.lineWidth = 7;
            ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 24;
            strokePts(ctx, st.bolt.pts);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.shadowBlur = 8;
            strokePts(ctx, st.bolt.pts);
            ctx.restore();
          }
        }
      }

      // Blockers: cut weather out of rooms / covered areas
      const blockers = S(s, 'weatherBlockers') || [];
      if (blockers.length) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        for (const b of blockers) {
          ctx.beginPath();
          if (b.type === 'circle') ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
          else ctx.rect(b.x, b.y, b.w, b.h);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, size.width, size.height, scale, fps]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ width: size.width, height: size.height, zIndex: 16 }}
      data-testid="weather-canvas"
    />
  );
}

function hexToRgbArr(hex) {
  const h = (hex || '#ffffff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeBolt(W, H) {
  const pts = [];
  let x = W * (0.15 + Math.random() * 0.7), y = 0;
  pts.push([x, y]);
  while (y < H * (0.55 + Math.random() * 0.35)) {
    y += 30 + Math.random() * 50;
    x += (Math.random() - 0.5) * 90;
    pts.push([x, y]);
  }
  return pts;
}
function strokePts(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

// ── Fog of War ──────────────────────────────────────────────────────────────
function drawFogOp(ctx, op, scale) {
  const reveal = op.mode !== 'hide';
  ctx.globalCompositeOperation = reveal ? 'destination-out' : 'source-over';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  const base = op.kind === 'path' ? (op.size || 60) : Math.min(op.w || (op.r || 0) * 2, op.h || (op.r || 0) * 2) || 60;
  const blur = (op.soft || 0) * base * 0.32 * scale;
  ctx.filter = blur > 0.5 ? `blur(${blur}px)` : 'none';
  if (op.kind === 'path') {
    const pts = op.points || [];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = op.size || 60;
    if (pts.length === 1) {
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], (op.size || 60) / 2, 0, Math.PI * 2); ctx.fill();
    } else if (pts.length > 1) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  } else if (op.kind === 'rect') {
    ctx.fillRect(op.x, op.y, op.w, op.h);
  } else if (op.kind === 'circle') {
    ctx.beginPath(); ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
}

function FogCanvas({ settings, size, liveOp, isDm }) {
  const canvasRef = useRef(null);
  const enabled = !!S(settings, 'fogEnabled');
  const ops = S(settings, 'fogOps') || [];
  const quality = S(settings, 'gfxQuality');
  const scale = GFX_SCALE[quality] || 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = Math.max(2, Math.round(size.width * scale));
    const h = Math.max(2, Math.round(size.height * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!enabled) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size.width, size.height);
    for (const op of ops) drawFogOp(ctx, op, scale);
    if (liveOp) drawFogOp(ctx, liveOp, scale);
  }, [enabled, ops, liveOp, size.width, size.height, scale]);

  if (!enabled) return null;
  const opacity = S(settings, 'fogOpacity');
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      // On the DM Screen the DM can still see the map through the fog.
      style={{ width: size.width, height: size.height, zIndex: 16, opacity: isDm ? Math.min(opacity, 0.45) : opacity }}
      data-testid="fog-canvas"
    />
  );
}

// ── Spell circles ───────────────────────────────────────────────────────────
function SpellCircleSvg({ c, particles, glow, hit }) {
  const rand = useMemo(() => mulberry32(c.seed || 1), [c.seed]);
  const parts = useMemo(() => {
    const r = mulberry32(c.seed || 1);
    const rings = Math.max(1, Math.min(6, c.rings || 3));
    const runes = Math.max(0, Math.min(36, c.runes || 12));
    const glyphs = Array.from({ length: runes }, () => runePath(r));
    const sparks = Array.from({ length: 10 }, () => ({
      cx: 100 + (r() - 0.5) * 120, cy: 100 + (r() - 0.5) * 120,
      dx: (r() - 0.5) * 30, dy: -20 - r() * 40, d: 1.8 + r() * 2.2, delay: r() * 3, rad: 1 + r() * 1.6,
    }));
    return { rings, glyphs, sparks, satRot: r() * 360 };
  }, [c.seed, c.rings, c.runes]);
  void rand;
  const col = c.color || '#8b5cf6';
  const sp = Math.max(0.1, c.speed || 1);
  const sides = Math.max(3, Math.min(12, c.spokes || 6));
  const style = c.style || 'arcane';
  const size = (c.radius || 150) * 2;

  const decor = [];
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360;
    if (style === 'fire') decor.push(<path key={i} d="M-3,-98 L0,-110 L3,-98 Z" fill={col} transform={`rotate(${a} 0 0)`} />);
    else if (style === 'frost') decor.push(<path key={i} d="M0,-96 L0,-108 M-3,-104 L0,-100 L3,-104" stroke={col} strokeWidth="1.2" fill="none" transform={`rotate(${a} 0 0)`} />);
    else if (style === 'nature') decor.push(<path key={i} d="M0,-96 Q6,-103 0,-110 Q-6,-103 0,-96 Z" fill="none" stroke={col} strokeWidth="1" transform={`rotate(${a} 0 0)`} />);
    else if (style === 'necrotic') decor.push(<circle key={i} cx="0" cy="-102" r={i % 2 ? 1.4 : 2.4} fill={col} transform={`rotate(${a} 0 0)`} />);
    else if (style === 'radiant') decor.push(<path key={i} d={i % 2 ? 'M0,-96 L0,-106' : 'M0,-96 L0,-112'} stroke={col} strokeWidth="1.4" transform={`rotate(${a} 0 0)`} />);
  }

  return (
    <svg
      width={size} height={size} viewBox="-12 -12 224 224"
      style={{ overflow: 'visible', pointerEvents: 'none', filter: glow ? `drop-shadow(0 0 6px ${col}) drop-shadow(0 0 14px ${col}66)` : 'none' }}
    >
      {/* Click targets: only the outer ring band and the centre are clickable,
          so tokens sitting inside the circle stay clickable. */}
      {hit && hit.on && (
        <g fill="transparent" stroke="transparent" data-spell-hit="1">
          <circle cx="100" cy="100" r="94" strokeWidth="26" style={{ pointerEvents: 'stroke', cursor: hit.locked ? 'default' : 'move' }}
            onMouseDown={hit.onDown} onWheel={hit.onWheel} />
          <circle cx="100" cy="100" r="22" style={{ pointerEvents: 'all', cursor: hit.locked ? 'default' : 'move' }}
            onMouseDown={hit.onDown} onWheel={hit.onWheel} />
        </g>
      )}
      {hit && hit.selected && (
        <circle cx="100" cy="100" r="108" fill="none" stroke="#caa055" strokeWidth="2" strokeDasharray="7 5" style={{ pointerEvents: 'none' }} />
      )}
      <g transform="translate(0 0)" fill="none" stroke={col} strokeWidth="1.6">
        <circle cx="100" cy="100" r="96" strokeWidth="2.4" />
        <circle cx="100" cy="100" r="91" strokeOpacity=".5" />
        <g transform="translate(100 100)" strokeWidth="1">{decor}</g>
        {Array.from({ length: parts.rings }, (_, i) => {
          const rad = 84 - i * (52 / parts.rings);
          const dash = i % 2 ? '2 5' : '14 4 2 4';
          return (
            <g key={i} className={i % 2 ? 'kg-rotr' : 'kg-rot'} style={{ animationDuration: `${(26 + i * 9) / sp}s` }}>
              <circle cx="100" cy="100" r={rad} strokeDasharray={dash} strokeOpacity=".85" />
            </g>
          );
        })}
        {/* rune ring */}
        <g className="kg-rotr" style={{ animationDuration: `${60 / sp}s` }}>
          {parts.glyphs.map((d, i) => {
            const a = (i / parts.glyphs.length) * Math.PI * 2;
            const x = 100 + Math.cos(a) * 78, y = 100 + Math.sin(a) * 78;
            return <path key={i} d={d} strokeWidth="1.1" transform={`translate(${x - 4.5} ${y - 4.5}) rotate(${(a * 180) / Math.PI + 90} 4.5 4.5)`} />;
          })}
        </g>
        {/* spokes */}
        <g className="kg-rot" style={{ animationDuration: `${40 / sp}s` }}>
          <polygon points={polygonPoints(100, 100, 62, sides)} strokeOpacity=".9" />
          <polygon points={polygonPoints(100, 100, 62, sides, Math.PI / sides)} strokeOpacity=".5" />
          {Array.from({ length: sides }, (_, i) => {
            const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
            return <line key={i} x1="100" y1="100" x2={100 + Math.cos(a) * 62} y2={100 + Math.sin(a) * 62} strokeOpacity=".4" />;
          })}
        </g>
        {/* satellites */}
        <g className="kg-rot" style={{ animationDuration: `${18 / sp}s` }}>
          {[0, 120, 240].map((deg, i) => {
            const a = ((deg + parts.satRot) * Math.PI) / 180;
            return (
              <g key={i}>
                <circle cx={100 + Math.cos(a) * 96} cy={100 + Math.sin(a) * 96} r="6" fill="#00000066" />
                <circle cx={100 + Math.cos(a) * 96} cy={100 + Math.sin(a) * 96} r="2.6" fill={col} />
              </g>
            );
          })}
        </g>
        {/* core */}
        <circle className="kg-pulse" cx="100" cy="100" r="9" fill={col} fillOpacity=".35" />
        <circle cx="100" cy="100" r="3" fill={col} stroke="none" />
        {particles && parts.sparks.map((s, i) => (
          <circle key={i} className="kg-spark" cx={s.cx} cy={s.cy} r={s.rad} fill={col} stroke="none"
            style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, animationDuration: `${s.d}s`, animationDelay: `${s.delay}s` }} />
        ))}
      </g>
    </svg>
  );
}

// ── Combat marks (animated slashes etc.) ────────────────────────────────────
const SLASH_D = 'M15,160 Q70,40 185,38 Q105,92 15,160 Z';
function CombatMarkSvg({ m, glow }) {
  const col = m.color || '#dc2626';
  const slash = (key, delay = 0, extra = {}) => (
    <g key={key} style={{ transformOrigin: '15px 160px', animation: `kgSlashIn .22s ease-out ${delay}s both`, ...extra.style }} transform={extra.transform}>
      <path d={SLASH_D} fill={col} />
      <path d={SLASH_D} fill="#fff" fillOpacity=".75" transform="translate(4 2) scale(.96)" style={{ transformOrigin: '100px 100px' }} />
    </g>
  );
  let body = null;
  if (m.type === 'cross') {
    body = (<>
      {slash('a')}
      <g transform="translate(200 0) scale(-1 1)">{slash('b', 0.1)}</g>
    </>);
  } else if (m.type === 'claw') {
    body = [0, 1, 2].map(i => slash(`c${i}`, i * 0.07, { transform: `translate(${(i - 1) * 20} ${(i - 1) * 28}) scale(.85)` }));
  } else if (m.type === 'pierce') {
    const spikes = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * 360; const L = i % 2 ? 62 : 92;
      return <path key={i} d={`M-3,0 L0,-${L} L3,0 Z`} fill={col} transform={`translate(100 100) rotate(${a})`} />;
    });
    body = (
      <g style={{ transformOrigin: '100px 100px', animation: 'kgBurstIn .18s ease-out both' }}>
        {spikes}<circle cx="100" cy="100" r="9" fill="#fff" fillOpacity=".85" />
      </g>
    );
  } else if (m.type === 'burst') {
    const pts = Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2; const r = i % 2 ? 38 : 94;
      return `${100 + Math.cos(a) * r},${100 + Math.sin(a) * r}`;
    }).join(' ');
    body = (
      <g style={{ transformOrigin: '100px 100px', animation: 'kgBurstIn .2s ease-out both' }}>
        <polygon points={pts} fill={col} />
        <polygon points={pts} fill="#fff" fillOpacity=".7" transform="translate(100 100) scale(.55) translate(-100 -100)" />
      </g>
    );
  } else {
    body = slash('a');
  }
  const size = m.size || 140;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200"
      style={{ overflow: 'visible', transform: `rotate(${m.rotation || 0}deg)`, filter: glow ? `drop-shadow(0 0 5px ${col})` : 'none' }}>
      {body}
    </svg>
  );
}

// ── Weather blocker outlines (shown while editing) ──────────────────────────
function BlockerOutlines({ blockers, live }) {
  const all = live ? [...blockers, live] : blockers;
  return (
    <svg className="fixed inset-0 pointer-events-none" style={{ zIndex: 17, width: '100%', height: '100%' }}>
      {all.map((b, i) => (b.type === 'circle'
        ? <circle key={b.id || i} cx={b.cx} cy={b.cy} r={b.r} fill="rgba(56,189,248,.12)" stroke="#38bdf8" strokeDasharray="6 4" />
        : <rect key={b.id || i} x={b.x} y={b.y} width={b.w} height={b.h} fill="rgba(56,189,248,.12)" stroke="#38bdf8" strokeDasharray="6 4" />))}
    </svg>
  );
}

// ── Mouse token ─────────────────────────────────────────────────────────────
function MouseToken({ settings }) {
  const [pos, setPos] = useState(null);
  const [outside, setOutside] = useState(false);
  const on = !!S(settings, 'mouseTokenOn') && !!S(settings, 'mouseTokenImg');
  const mode = S(settings, 'mouseTokenMode');
  useEffect(() => {
    if (!on) return;
    const move = (e) => { setPos({ x: e.clientX, y: e.clientY }); setOutside(false); };
    const out = (e) => { if (!e.relatedTarget) setOutside(true); };
    window.addEventListener('mousemove', move);
    document.addEventListener('mouseout', out);
    return () => { window.removeEventListener('mousemove', move); document.removeEventListener('mouseout', out); };
  }, [on]);
  if (!on || !pos) return null;
  const size = S(settings, 'mouseTokenSize');
  let { x, y } = pos;
  if (outside) {
    if (mode !== 'edges') return null;
    x = Math.max(size / 2, Math.min(window.innerWidth - size / 2, x));
    y = Math.max(size / 2, Math.min(window.innerHeight - size / 2, y));
  }
  return (
    <img
      src={S(settings, 'mouseTokenImg')} alt="" draggable={false}
      className="fixed pointer-events-none select-none"
      style={{
        left: x, top: y, width: size, height: size, transform: 'translate(-50%, -50%)', zIndex: 9999,
        borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 10px rgba(0,0,0,.6)',
        border: '2px solid rgba(202,160,85,.9)', opacity: outside ? 0.7 : 1,
      }}
      data-testid="mouse-token"
    />
  );
}

// ── Main layer ──────────────────────────────────────────────────────────────
export function AtmosphereLayer() {
  useStyleOnce();
  const { settings, updateSettings, isDmScreen } = useGrid();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const tool = settings.atmoTool || null;
  const [liveOp, setLiveOp] = useState(null);
  const [liveBlocker, setLiveBlocker] = useState(null);
  const [cursor, setCursor] = useState(null);
  const dragRef = useRef(null);
  const [now, setNow] = useState(Date.now());

  const marks = S(settings, 'combatMarks') || [];
  const circles = (S(settings, 'spellCircles') || []).filter(c => !c.hidden);
  const blockers = S(settings, 'weatherBlockers') || [];
  const particles = !!S(settings, 'gfxParticles');
  const glow = !!S(settings, 'gfxGlow') && S(settings, 'gfxQuality') !== 'low';
  const selectedSpellId = settings.selectedSpellId || null;
  const canPick = !tool && !settings.measureMode && !settings.drawingEnabled && !settings.eraserEnabled
    && !settings.pingMode && !settings.maskEnabled && !settings.effectsEnabled;

  // Tick so fading marks disappear; the game window also prunes expired ones.
  useEffect(() => {
    if (!marks.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [marks.length]);
  useEffect(() => {
    if (isDmScreen || !marks.length) return;
    const alive = marks.filter(m => !(m.persist > 0) || now - m.t0 < (m.persist + 2) * 1000);
    if (alive.length !== marks.length) updateSettings({ combatMarks: alive });
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tool interaction ──
  const exitTool = useCallback(() => {
    dragRef.current = null; setLiveOp(null); setLiveBlocker(null);
    updateSettings({ atmoTool: null });
  }, [updateSettings]);

  useEffect(() => {
    if (!tool) return;
    const onKey = (e) => { if (e.key === 'Escape') exitTool(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, exitTool]);

  const down = (e) => {
    if (e.button !== 0) return;
    const p = { x: e.clientX, y: e.clientY };
    const mode = S(settings, 'fogMode');
    if (tool === 'fog-brush') {
      dragRef.current = { kind: 'path', points: [[p.x, p.y]] };
      setLiveOp({ id: 'live', mode, kind: 'path', points: [[p.x, p.y]], size: S(settings, 'fogBrush'), soft: S(settings, 'fogSoft') });
    } else if (tool === 'fog-rect' || tool === 'fog-circle' || tool === 'blocker-rect' || tool === 'blocker-circle') {
      dragRef.current = { start: p };
    } else if (tool === 'spell') {
      const d = S(settings, 'spellDraft');
      const newId = uid('spell');
      updateSettings({
        selectedSpellId: newId,
        atmoTool: null,
        spellCircles: [...(S(settings, 'spellCircles') || []), {
          id: newId, x: p.x, y: p.y, radius: d.radius, color: d.color, style: d.style,
          rings: d.rings, spokes: d.spokes, runes: d.runes, speed: d.speed,
          seed: d.seed || Math.floor(Math.random() * 99999),
        }],
      });
    } else if (tool === 'mark') {
      const d = S(settings, 'markDraft');
      updateSettings({
        combatMarks: [...(S(settings, 'combatMarks') || []), {
          id: uid('mark'), x: p.x, y: p.y, type: d.type, color: d.color, size: d.size,
          rotation: d.rotation + (Math.random() - 0.5) * 14, persist: d.persist, t0: Date.now(),
        }],
      });
    }
  };

  const move = (e) => {
    const p = { x: e.clientX, y: e.clientY };
    setCursor(p);
    const d = dragRef.current;
    if (!d) return;
    const mode = S(settings, 'fogMode');
    if (tool === 'fog-brush') {
      const last = d.points[d.points.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) < 4) return;
      d.points.push([Math.round(p.x), Math.round(p.y)]);
      setLiveOp({ id: 'live', mode, kind: 'path', points: d.points.slice(), size: S(settings, 'fogBrush'), soft: S(settings, 'fogSoft') });
    } else if (tool === 'fog-rect') {
      setLiveOp({ id: 'live', mode, kind: 'rect', x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y), soft: S(settings, 'fogSoft') });
    } else if (tool === 'fog-circle') {
      setLiveOp({ id: 'live', mode, kind: 'circle', cx: d.start.x, cy: d.start.y, r: Math.hypot(p.x - d.start.x, p.y - d.start.y), soft: S(settings, 'fogSoft') });
    } else if (tool === 'blocker-rect') {
      setLiveBlocker({ type: 'rect', x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) });
    } else if (tool === 'blocker-circle') {
      setLiveBlocker({ type: 'circle', cx: d.start.x, cy: d.start.y, r: Math.hypot(p.x - d.start.x, p.y - d.start.y) });
    }
  };

  const up = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (liveOp && (tool || '').startsWith('fog')) {
      const tooSmall = liveOp.kind === 'rect' ? (liveOp.w < 4 || liveOp.h < 4) : liveOp.kind === 'circle' ? liveOp.r < 4 : false;
      if (!tooSmall) updateSettings({ fogOps: [...(S(settings, 'fogOps') || []), { ...liveOp, id: uid('fog') }] });
      setLiveOp(null);
    }
    if (liveBlocker) {
      const tooSmall = liveBlocker.type === 'rect' ? (liveBlocker.w < 6 || liveBlocker.h < 6) : liveBlocker.r < 6;
      if (!tooSmall) updateSettings({ weatherBlockers: [...blockers, { ...liveBlocker, id: uid('blk') }] });
      setLiveBlocker(null);
    }
  };

  // Right-click exits the tool. Handled on the overlay itself (while it is
  // still mounted) so the contextmenu never falls through to the grid's
  // radial menu.
  const ctxMenu = (e) => { e.preventDefault(); e.stopPropagation(); exitTool(); };

  const brushCursor = tool === 'fog-brush' && cursor;
  const showBlockers = (tool || '').startsWith('blocker');

  // ── Spell circles: click to select, drag to move, scroll to resize ──
  const circleDrag = useRef(null);
  const startCircleDrag = (e, c) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (settings.selectedSpellId !== c.id) updateSettings({ selectedSpellId: c.id });
    if (c.locked) return;
    circleDrag.current = { id: c.id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y };
    const mv = (ev) => {
      const cd = circleDrag.current; if (!cd) return;
      const list = (S(settingsRef.current, 'spellCircles') || []).map(x => x.id === cd.id ? { ...x, x: cd.ox + ev.clientX - cd.sx, y: cd.oy + ev.clientY - cd.sy } : x);
      updateSettings({ spellCircles: list });
    };
    const upH = () => { circleDrag.current = null; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', upH); };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', upH);
  };
  const wheelCircle = (e, c) => {
    if (c.locked) return;
    const r = Math.max(30, Math.min(900, (c.radius || 150) + (e.deltaY < 0 ? 10 : -10)));
    updateSettings({ spellCircles: (S(settingsRef.current, 'spellCircles') || []).map(x => x.id === c.id ? { ...x, radius: r } : x) });
  };
  const deleteCircle = (id) => {
    updateSettings({ spellCircles: (S(settingsRef.current, 'spellCircles') || []).filter(x => x.id !== id), selectedSpellId: null });
  };

  // Clicking anywhere that is not a circle deselects; Delete removes the selected circle.
  useEffect(() => {
    if (!selectedSpellId) return undefined;
    const onDown = (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-spell-hit], [data-spell-ui]')) return;
      updateSettings({ selectedSpellId: null });
    };
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteCircle(selectedSpellId);
      if (e.key === 'Escape') updateSettings({ selectedSpellId: null });
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [selectedSpellId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Spell circles */}
      {circles.map(c => {
        const sel = selectedSpellId === c.id;
        return (
          <div
            key={c.id}
            className="fixed"
            style={{ left: c.x, top: c.y, transform: 'translate(-50%, -50%)', zIndex: 16, pointerEvents: 'none' }}
            data-testid={`spell-circle-${c.id}`}
          >
            <SpellCircleSvg
              c={c} particles={particles} glow={glow}
              hit={{ on: canPick, selected: sel && canPick, locked: !!c.locked, onDown: (e) => startCircleDrag(e, c), onWheel: (e) => wheelCircle(e, c) }}
            />
            {sel && canPick && (
              <button
                data-spell-ui="1"
                className="absolute w-5 h-5 rounded-full bg-red-600 text-white text-[11px] leading-none pointer-events-auto"
                style={{ right: '4%', top: '4%' }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); deleteCircle(c.id); }}
                title="Delete circle"
              >×</button>
            )}
          </div>
        );
      })}

      {/* Combat marks */}
      {marks.map(m => {
        const remaining = m.persist > 0 ? m.persist - (now - m.t0) / 1000 : Infinity;
        if (remaining <= -1.5) return null;
        const fade = m.persist > 0 ? `kgFade 1.2s linear ${Math.max(0, remaining - 1.2).toFixed(2)}s forwards` : 'none';
        return (
          <div key={m.id} className="fixed pointer-events-none"
            style={{ left: m.x, top: m.y, transform: 'translate(-50%, -50%)', zIndex: 16, animation: fade }}>
            <CombatMarkSvg m={m} glow={glow} />
          </div>
        );
      })}

      {/* Fog hides circles/marks beneath it; tint and weather sit above everything */}
      <FogCanvas settings={settings} size={size} liveOp={liveOp} isDm={isDmScreen} />
      <TimeOfDayTint settings={settings} />
      <WeatherCanvas settings={settings} size={size} />

      {showBlockers && <BlockerOutlines blockers={blockers} live={liveBlocker} />}

      {/* Tool capture overlay */}
      {tool && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 18, cursor: 'crosshair', background: 'rgba(0,0,0,0.004)', touchAction: 'none' }}
          onMouseDown={down}
          onMouseMove={move}
          onMouseUp={up}
          onMouseLeave={up}
          onContextMenu={ctxMenu}
          data-testid="atmo-tool-overlay"
        >
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded bg-black/80 border border-[#caa055]/40 text-[#caa055] text-[10px] font-mono pointer-events-none">
            {toolLabel(tool, S(settings, 'fogMode'))} — right-click or Esc to exit
          </div>
          {brushCursor && (
            <div className="absolute pointer-events-none rounded-full"
              style={{ left: cursor.x, top: cursor.y, width: S(settings, 'fogBrush'), height: S(settings, 'fogBrush'), transform: 'translate(-50%,-50%)', border: '1.5px solid rgba(255,255,255,.8)', boxShadow: '0 0 0 1px rgba(0,0,0,.5)' }} />
          )}
        </div>
      )}

    </>
  );
}

function toolLabel(tool, fogMode) {
  const verb = fogMode === 'hide' ? 'Cover' : 'Reveal';
  return ({
    'fog-brush': `Fog brush · ${verb}`,
    'fog-rect': `Fog rectangle · ${verb}`,
    'fog-circle': `Fog circle · ${verb}`,
    'blocker-rect': 'Weather blocker · rectangle',
    'blocker-circle': 'Weather blocker · circle',
    spell: 'Click to place Spell Circle',
    mark: 'Click to place Combat Mark',
  })[tool] || tool;
}

export default AtmosphereLayer;
