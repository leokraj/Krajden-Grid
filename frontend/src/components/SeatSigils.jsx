import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useGrid } from '../context/GridContext';
import { useInitiative, useCampaignPersistence } from '../lib/useInitiative';
import { getActiveTable, getActiveCampaign, resolveSigils, cget, clamp01 } from '../lib/campaign';

// ── Turn stepping (hotkeys) ───────────────────────────────────────────────
// The hotkey system dispatches 'kg-init-step' (+1 / -1). Mounted once per
// window so exactly one handler runs.
export function InitiativeStepper() {
  useCampaignPersistence();
  const init = useInitiative();
  const ref = useRef(init);
  ref.current = init;
  useEffect(() => {
    const onStep = (e) => {
      const { list, turn, setInit } = ref.current;
      const d = e.detail >= 0 ? 1 : -1;
      if (!list.length) { toast.info('No one in the turn order yet'); return; }
      const n = turn < 0 ? (d > 0 ? 0 : list.length - 1) : (turn + d + list.length) % list.length;
      setInit(list, n);
      toast(`Turn: ${list[n].name}`, { duration: 1500 });
    };
    window.addEventListener('kg-init-step', onStep);
    return () => window.removeEventListener('kg-init-step', onStep);
  }, []);
  return null;
}

const CSS = `
@keyframes kgSigilSpin { to { transform: rotate(360deg); } }
@keyframes kgSigilSpinRev { to { transform: rotate(-360deg); } }
@keyframes kgSigilPulse { 0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 50% { transform: translate(-50%,-50%) scale(1.14); opacity: .82; } }
@keyframes kgSigilBreath { 0%,100% { opacity: .95; } 50% { opacity: .6; } }
`;

function Sigil({ x, y, size, color, kind, label }) {
  const isCur = kind === 'current';
  const s = isCur ? size : size * 0.72;
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width: s, height: s,
        transform: 'translate(-50%,-50%)',
        animation: isCur ? 'kgSigilPulse 1.6s ease-in-out infinite' : 'kgSigilBreath 2.4s ease-in-out infinite',
        filter: `drop-shadow(0 0 ${isCur ? 14 : 8}px ${color}) drop-shadow(0 0 ${isCur ? 30 : 14}px ${color})`,
        pointerEvents: 'none',
      }}
      data-testid={`sigil-${kind}`}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <g style={{ transformOrigin: '50px 50px', animation: `kgSigilSpin ${isCur ? 14 : 30}s linear infinite` }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="2.2" strokeDasharray="6 5" />
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1="50" y1="2" x2="50" y2="10" stroke={color} strokeWidth="3" strokeLinecap="round" transform={`rotate(${i * 45} 50 50)`} />
          ))}
        </g>
        <g style={{ transformOrigin: '50px 50px', animation: `kgSigilSpinRev ${isCur ? 9 : 22}s linear infinite` }}>
          <circle cx="50" cy="50" r="33" fill="none" stroke={color} strokeWidth="2" />
          <polygon points="50,20 77,66 23,66" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
          <polygon points="50,80 23,34 77,34" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" opacity="0.7" />
        </g>
        <circle cx="50" cy="50" r={isCur ? 9 : 6} fill={color} />
        <circle cx="50" cy="50" r={isCur ? 16 : 11} fill={color} opacity="0.25" />
      </svg>
      {label && (
        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4, whiteSpace: 'nowrap', fontSize: 11, color, fontFamily: 'monospace', textShadow: '0 0 4px #000' }}>
          {label}
        </div>
      )}
    </div>
  );
}

function SeatPlacementOverlay({ W, H }) {
  const { settings, updateSettings } = useGrid();
  const n = settings.placingSeat;
  useEffect(() => {
    if (!n) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') updateSettings({ placingSeat: null }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, updateSettings]);
  if (!n) return null;
  const place = (e) => {
    const table = getActiveTable(settings);
    if (!table) return;
    const fx = clamp01(e.clientX / W);
    const fy = clamp01(e.clientY / H);
    const tableLayouts = settings.tableLayouts.map((t) => t.id !== table.id ? t
      : { ...t, seats: t.seats.map((s) => s.n === n ? { ...s, x: fx, y: fy } : s) });
    updateSettings({ tableLayouts, placingSeat: null });
    toast.success(`Seat ${n} placed`);
  };
  return (
    <div
      onClick={place}
      className="fixed inset-0 z-[45]"
      style={{ cursor: 'crosshair', background: 'rgba(202,160,85,0.06)', WebkitAppRegion: 'no-drag' }}
      data-testid="seat-placement-overlay"
    >
      <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.85)', border: '1px solid #caa055', color: '#f1d9a0', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', pointerEvents: 'none' }}>
        Click where Seat {n} sits · Esc to cancel
      </div>
    </div>
  );
}

// Glowing initiative sigils at the saved seat positions. The projector shows
// only the current turn (colour A) and the next player (colour B); the DM
// screen additionally shows every seat as a faint numbered dot.
export function SeatSigils({ canvasSize }) {
  const { settings, isDmScreen } = useGrid();
  const { list, turn } = useInitiative();
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const W = canvasSize?.width || vp.w;
  const H = canvasSize?.height || vp.h;
  const table = getActiveTable(settings);
  const campaign = getActiveCampaign(settings);
  const { current, next } = resolveSigils(settings, list, turn);
  const size = cget(settings, 'sigilSize');
  const placing = !!settings.placingSeat;
  const showDots = (isDmScreen || placing) && table;

  return (
    <>
      <style>{CSS}</style>
      <SeatPlacementOverlay W={W} H={H} />
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 16 }} data-testid="seat-sigils">
        {showDots && table.seats.filter((s) => s.x != null).map((s) => {
          const ch = campaign?.party.find((p) => p.seat === s.n);
          const hot = (current && current.n === s.n) || (next && next.n === s.n);
          return (
            <div key={s.n} style={{ position: 'absolute', left: s.x * W, top: s.y * H, transform: 'translate(-50%,-50%)', pointerEvents: 'none', textAlign: 'center' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1px dashed rgba(202,160,85,${ch ? 0.9 : 0.45})`, background: 'rgba(0,0,0,.35)', color: '#caa055', fontSize: 11, fontFamily: 'monospace', lineHeight: '20px', opacity: hot ? 0.35 : 1 }}>{s.n}</div>
              {ch && !hot && <div style={{ fontSize: 10, color: '#f1d9a0', fontFamily: 'monospace', marginTop: 2, textShadow: '0 0 3px #000', whiteSpace: 'nowrap' }}>{ch.name}</div>}
            </div>
          );
        })}
        {next && cget(settings, 'showNextSigil') && (
          <Sigil x={next.x * W} y={next.y * H} size={size} color={cget(settings, 'sigilNext')} kind="next" label={isDmScreen ? next.char.name : null} />
        )}
        {current && (
          <Sigil x={current.x * W} y={current.y * H} size={size} color={cget(settings, 'sigilCurrent')} kind="current" label={isDmScreen ? current.char.name : null} />
        )}
      </div>
    </>
  );
}

export default SeatSigils;
