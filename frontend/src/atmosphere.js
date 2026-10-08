// Shared helpers + defaults for the Atmosphere features: time of day tint,
// weather, painted Fog of War, spell circles, combat marks, graphics quality.

export const ATMOSPHERE_DEFAULTS = {
  // Time of day
  todPreset: 'off',
  todColor: '#0a1650',
  todOpacity: 0.5,
  todBlend: 'multiply',
  // Weather
  weatherFogOn: false,
  weatherFogDensity: 0.5,
  weatherFogSpeed: 0.5,
  weatherFogColor: '#cfd6dd',
  weatherRainOn: false,
  weatherRainDensity: 0.5,
  weatherRainSpeed: 1,
  weatherWindAngle: 15,
  weatherLightningOn: false,
  weatherLightningFreq: 8,
  weatherBlockers: [],
  // Fog of war
  fogEnabled: false,
  fogOpacity: 0.97,
  fogSoft: 0.4,
  fogBrush: 90,
  fogMode: 'reveal',
  fogOps: [],
  // Spell circles / combat marks
  spellCircles: [],
  combatMarks: [],
  spellDraft: { style: 'arcane', radius: 150, color: '#8b5cf6', rings: 3, spokes: 6, runes: 12, speed: 1, seed: 1 },
  markDraft: { type: 'slash', color: '#dc2626', size: 140, rotation: 35, persist: 6 },
  spellEditMode: false,
  // Groups
  itemGroups: [],
  // Graphics + mouse token
  gfxQuality: 'high',
  gfxParticles: true,
  gfxGlow: true,
  mouseTokenOn: false,
  mouseTokenImg: null,
  mouseTokenSize: 64,
  mouseTokenMode: 'mouse',
  // Per-window tool state (never copied between DM and game)
  atmoTool: null,
};

export const TOD_PRESETS = {
  off:      { label: 'Off',       color: '#000000', opacity: 0,    blend: 'normal',   emoji: '⚪' },
  morning:  { label: 'Morning',   color: '#ffcf8a', opacity: 0.2,  blend: 'normal',   emoji: '🌅' },
  noon:     { label: 'Noon',      color: '#fff6d8', opacity: 0.08, blend: 'normal',   emoji: '☀️' },
  dusk:     { label: 'Dusk',      color: '#ff6a2a', opacity: 0.35, blend: 'multiply', emoji: '🌇' },
  night:    { label: 'Night',     color: '#0a1650', opacity: 0.55, blend: 'multiply', emoji: '🌙' },
  moonlit:  { label: 'Moonlit',   color: '#2a3f8f', opacity: 0.38, blend: 'multiply', emoji: '🌕' },
  custom:   { label: 'Custom',    color: null,      opacity: null, blend: 'multiply', emoji: '🎨' },
};

export const GFX_SCALE = { high: 1, medium: 0.66, low: 0.5 };
export const GFX_FPS   = { high: 60, medium: 40, low: 24 };

export const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// Deterministic PRNG so a spell circle always draws identically from its seed.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A pseudo-rune: a short random polyline inside a 10x10 box.
export function runePath(rand) {
  const n = 3 + Math.floor(rand() * 3);
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = (rand() * 8 + 1).toFixed(1);
    const y = (rand() * 8 + 1).toFixed(1);
    d += `${i === 0 ? 'M' : 'L'}${x},${y} `;
  }
  if (rand() > 0.6) d += `M${(rand() * 8 + 1).toFixed(1)},1 L${(rand() * 8 + 1).toFixed(1)},9`;
  return d;
}

export function polygonPoints(cx, cy, r, sides, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

export const SPELL_STYLES = {
  arcane:   { label: 'Arcane',   color: '#8b5cf6' },
  fire:     { label: 'Fire',     color: '#f97316' },
  frost:    { label: 'Frost',    color: '#7dd3fc' },
  nature:   { label: 'Nature',   color: '#4ade80' },
  necrotic: { label: 'Necrotic', color: '#a3e635' },
  radiant:  { label: 'Radiant',  color: '#fde68a' },
};

export const MARK_TYPES = {
  slash:  { label: 'Slash',  emoji: '🗡️' },
  cross:  { label: 'Cross',  emoji: '✖️' },
  claw:   { label: 'Claw',   emoji: '🐾' },
  pierce: { label: 'Pierce', emoji: '🎯' },
  burst:  { label: 'Burst',  emoji: '💥' },
};

// Resize + compress an uploaded image to a small data URL (for the mouse token).
export function fileToSmallDataUrl(file, max = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
