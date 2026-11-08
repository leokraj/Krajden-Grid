import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useGrid } from '../context/GridContext';
import { calibMarkers, fitPhoto, homographyToMatrix3d } from '../lib/homography';

// Table Photo: photograph the table from above while the projector shows
// numbered calibration markers, load the photo on the DM Screen, tap the
// markers you can see, and the app straightens the photo to match the screen.
// It then sits under the effect painting as a DM-only reference.

const PHOTO_KEY = 'krajden_table_photo';

const useStageSize = () => {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
};

// Downscale a phone photo (max 2400px) to a JPEG data URL
export function fileToPhoto(file, max = 2400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * s));
        const h = Math.max(1, Math.round(img.naturalHeight * s));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ src: c.toDataURL('image/jpeg', 0.85), w, h });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Markers drawn on the projector (and mirrored on the DM screen if switched on there)
export function CalibrationMarkers() {
  const { settings, isDmScreen } = useGrid();
  const { w, h } = useStageSize();
  // Markers belong on the projector (they're what the phone photographs), not the DM screen
  if (!settings.calibMarkersOn || isDmScreen) return null;
  const u = Math.max(0.6, Math.min(w, h) / 1080);
  const arm = 34 * u, gap = 7 * u;
  return (
    <svg className="fixed inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 9000 }} data-testid="calib-markers">
      {calibMarkers(w, h).map((m) => (
        <g key={m.n} transform={`translate(${m.x} ${m.y})`}>
          {[[-arm, 0, -gap, 0], [gap, 0, arm, 0], [0, -arm, 0, -gap], [0, gap, 0, arm]].map((l, i) => (
            <g key={i}>
              <line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#000" strokeWidth={9 * u} strokeLinecap="butt" />
              <line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#fff" strokeWidth={5 * u} strokeLinecap="butt" />
            </g>
          ))}
          <circle r={3 * u} fill="#ff2d55" stroke="#fff" strokeWidth={1.5 * u} />
          <text x={arm * 0.55} y={-arm * 0.45} fontSize={34 * u} fontWeight="800" fontFamily="sans-serif"
            fill="#fff" stroke="#000" strokeWidth={6 * u} paintOrder="stroke" textAnchor="start">{m.n}</text>
        </g>
      ))}
    </svg>
  );
}

// The straightened photo, drawn with a perspective (matrix3d) transform
export function TablePhotoLayer() {
  const { settings } = useGrid();
  const { w, h } = useStageSize();
  const photo = settings.tablePhoto;
  const fit = useMemo(() => (photo?.pts ? fitPhoto(photo.pts, w, h) : null), [photo, w, h]);
  if (!settings.tablePhotoOn || !photo?.src || !fit?.H) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 12 }} data-testid="table-photo-layer">
      <img
        src={photo.src} alt="" draggable={false}
        style={{
          position: 'absolute', left: 0, top: 0, width: photo.w, height: photo.h, maxWidth: 'none',
          transformOrigin: '0 0', transform: homographyToMatrix3d(fit.H),
          opacity: settings.tablePhotoOpacity ?? 0.6,
        }}
      />
    </div>
  );
}

// Keep the loaded photo across DM screen restarts (localStorage, best effort)
export function useTablePhotoPersistence(enabled) {
  const { settings, updateSettings } = useGrid();
  const loaded = useRef(false);
  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(PHOTO_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.photo?.src) updateSettings({ tablePhoto: d.photo, tablePhotoOpacity: d.opacity ?? 0.6 });
      }
    } catch (e) {}
  }, [enabled, updateSettings]);
  useEffect(() => {
    if (!enabled || !loaded.current) return;
    try {
      if (settings.tablePhoto?.src) {
        localStorage.setItem(PHOTO_KEY, JSON.stringify({ photo: settings.tablePhoto, opacity: settings.tablePhotoOpacity ?? 0.6 }));
      } else if (settings.tablePhoto === null) {
        localStorage.removeItem(PHOTO_KEY);
      }
    } catch (e) { /* too big for storage — the photo just won't be remembered */ }
  }, [enabled, settings.tablePhoto, settings.tablePhotoOpacity]);
}

// Full-window calibration screen: pick a marker number, tap it in the photo.
export function TablePhotoCalibrator() {
  const { settings, updateSettings } = useGrid();
  const photo = settings.tablePhoto;
  const { w: SW, h: SH } = useStageSize();
  const [pts, setPts] = useState(() => ({ ...(photo?.pts || {}) }));
  const [sel, setSel] = useState(() => {
    for (let n = 1; n <= 9; n++) if (!photo?.pts?.[n]) return n;
    return 1;
  });
  const [zoom, setZoom] = useState(1);
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      const r = es[0].contentRect;
      if (r.width > 0) setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useMemo(() => fitPhoto(pts, SW, SH), [pts, SW, SH]);
  if (!photo?.src) return null;

  const baseScale = Math.min(box.w / photo.w, box.h / photo.h);
  const dispW = photo.w * baseScale * zoom;
  const dispH = photo.h * baseScale * zoom;
  const placed = Object.keys(pts).length;
  const nextUnplaced = (from, p) => {
    for (let i = 1; i <= 9; i++) { const n = ((from - 1 + i) % 9) + 1; if (!p[n]) return n; }
    return from;
  };

  const onPhotoClick = (e) => {
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * photo.w;
    const y = ((e.clientY - r.top) / r.height) * photo.h;
    const next = { ...pts, [sel]: { x, y } };
    setPts(next);
    setSel(nextUnplaced(sel, next));
  };
  const close = () => updateSettings({ tablePhotoCalibrating: false });
  const apply = () => {
    if (!fit.H) { toast.error('Tap at least 4 markers (not all in one line) first.'); return; }
    updateSettings({ tablePhoto: { ...photo, pts }, tablePhotoOn: true, tablePhotoCalibrating: false });
    toast.success(`Table photo aligned using ${fit.used} markers`);
  };

  return createPortal(
    <div className="fixed inset-0 flex flex-col bg-[#0a0b0d]" style={{ zIndex: 100001 }} data-testid="table-photo-calibrator">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#caa055]/30 bg-[#111214]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#caa055]">Align table photo</span>
        <div className="flex gap-1">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setSel(n)}
              className={`w-7 h-7 rounded font-bold text-[11px] border ${sel === n ? 'bg-[#caa055] text-black border-[#caa055]' : pts[n] ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'text-[#caa055]/80 border-[#caa055]/30 hover:bg-[#caa055]/10'}`}
              title={pts[n] ? `Marker ${n} placed — click to re-place` : `Marker ${n}`}
              data-testid={`calib-chip-${n}`}
            >{n}</button>
          ))}
        </div>
        <button onClick={() => { const p = { ...pts }; delete p[sel]; setPts(p); }}
          className="px-2 py-1 text-[10px] font-mono rounded border border-[#caa055]/25 text-[#caa055]/80 hover:bg-[#caa055]/10">Clear #{sel}</button>
        <button onClick={() => { setPts({}); setSel(1); }}
          className="px-2 py-1 text-[10px] font-mono rounded border border-red-500/40 text-red-300 hover:bg-red-500/15">Reset all</button>
        <div className="flex items-center gap-1 text-[10px] font-mono text-[#caa055]/80">
          Zoom
          <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="w-5 h-5 border border-[#caa055]/25 rounded">−</button>
          <span className="w-8 text-center">{zoom}×</span>
          <button onClick={() => setZoom((z) => Math.min(5, z + 0.5))} className="w-5 h-5 border border-[#caa055]/25 rounded">+</button>
        </div>
        <span className="text-[10px] font-mono text-[#caa055]/60 flex-1 min-w-[160px]">
          {placed < 4 ? `Pick a number, then tap that marker in the photo (${placed}/4 minimum)` :
            fit.H ? `${placed} placed · fit error avg ${fit.err.avg.toFixed(1)}px, worst ${fit.err.max.toFixed(1)}px` : 'Markers are all in a line — tap more spread-out ones'}
        </span>
        <button onClick={close} className="px-3 py-1 text-[10px] font-mono rounded border border-[#caa055]/25 text-[#caa055]/80 hover:bg-[#caa055]/10">Cancel</button>
        <button onClick={apply} disabled={!fit.H}
          className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-[#caa055] text-black disabled:opacity-40 hover:bg-[#e2b563]"
          data-testid="calib-apply">Apply</button>
      </div>
      <div ref={boxRef} className="flex-1 overflow-auto flex items-start justify-center p-2">
        <div className="relative shrink-0" style={{ width: dispW, height: dispH }}>
          <img ref={imgRef} src={photo.src} alt="" draggable={false} onClick={onPhotoClick}
            style={{ width: dispW, height: dispH, maxWidth: 'none', cursor: 'crosshair', display: 'block' }}
            data-testid="calib-photo" />
          {Object.entries(pts).map(([n, p]) => (
            <div key={n} className="absolute pointer-events-none"
              style={{ left: `${(p.x / photo.w) * 100}%`, top: `${(p.y / photo.h) * 100}%`, transform: 'translate(-50%, -50%)' }}>
              <div className={`w-4 h-4 rounded-full border-2 ${Number(n) === sel ? 'border-[#caa055]' : 'border-emerald-400'} bg-black/40`} />
              <span className="absolute left-4 -top-1 text-[12px] font-extrabold text-white" style={{ textShadow: '0 0 3px #000, 0 0 3px #000' }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const Btn = ({ active, danger, className = '', ...p }) => (
  <button
    {...p}
    className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
      active ? 'bg-[#caa055]/25 border-[#caa055] text-[#f1d9a0]'
      : danger ? 'border-red-500/40 text-red-300 hover:bg-red-500/15'
      : 'border-[#caa055]/25 text-[#caa055]/80 hover:bg-[#caa055]/10'} ${className}`}
  />
);

// Body of the "Table Photo" control section
export function TablePhotoPanel() {
  const { settings, updateSettings, isDmScreen } = useGrid();
  const fileRef = useRef(null);
  const photo = settings.tablePhoto;
  const aligned = !!(photo?.pts && Object.keys(photo.pts).length >= 4);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const p = await fileToPhoto(f);
      updateSettings({ tablePhoto: { ...p, pts: {} }, tablePhotoOn: false, tablePhotoCalibrating: true });
    } catch (err) {
      toast.error('Could not read that photo');
    }
  };

  return (
    <>
      <label className="flex items-center gap-2 text-[10px] text-[#caa055]/80 font-mono cursor-pointer">
        <input type="checkbox" checked={!!settings.calibMarkersOn} onChange={(e) => { updateSettings({ calibMarkersOn: e.target.checked }); if (isDmScreen) window.electronAPI?.dmCalibMarkers?.(e.target.checked); }} className="accent-[#caa055]" />
        Show calibration markers on the projector (3×3, numbered)
      </label>
      <p className="text-[10px] text-[#caa055]/50 font-mono leading-snug">
        1) Turn markers on (they appear on the projector). 2) Take a top-down photo of the table with your phone. 3) Load it on the DM Screen and tap the markers you can see.
      </p>
      {!isDmScreen ? (
        <p className="text-[10px] text-amber-300/80 font-mono leading-snug">Loading and aligning the photo happens on the DM Screen — players never see it.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            <Btn onClick={() => fileRef.current?.click()} data-testid="table-photo-load">{photo?.src ? 'Load a different photo' : 'Load table photo…'}</Btn>
            {photo?.src && <Btn onClick={() => updateSettings({ tablePhotoCalibrating: true })} data-testid="table-photo-realign">Re-align markers</Btn>}
            {photo?.src && <Btn danger onClick={() => updateSettings({ tablePhoto: null, tablePhotoOn: false })}>Remove</Btn>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </div>
          {photo?.src && !aligned && <p className="text-[10px] text-amber-300/80 font-mono">Photo loaded but not aligned yet — press “Re-align markers”.</p>}
          {aligned && (
            <>
              <label className="flex items-center gap-2 text-[10px] text-[#caa055]/80 font-mono cursor-pointer">
                <input type="checkbox" checked={!!settings.tablePhotoOn} onChange={(e) => updateSettings({ tablePhotoOn: e.target.checked })} className="accent-[#caa055]" />
                Show photo under my painting
              </label>
              <label className="block text-[10px] text-[#caa055]/70 font-mono">
                <div className="flex justify-between"><span>Photo opacity</span><span>{Math.round((settings.tablePhotoOpacity ?? 0.6) * 100)}%</span></div>
                <input type="range" min={0.05} max={1} step={0.05} value={settings.tablePhotoOpacity ?? 0.6}
                  onChange={(e) => updateSettings({ tablePhotoOpacity: parseFloat(e.target.value) })} className="w-full accent-[#caa055]" />
              </label>
            </>
          )}
        </>
      )}
    </>
  );
}
