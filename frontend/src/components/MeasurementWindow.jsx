import React, { useEffect, useState } from 'react';
import { Ruler } from 'lucide-react';

const LABELS = { line: 'Line', radial: 'Radial', cone: 'Cone' };

// Floating live-measurement readout (its own always-on-top Electron window,
// so it can be dragged to any screen). Fed by 'measure-live' broadcasts.
export default function MeasurementWindow() {
  const [m, setM] = useState({ measureMode: false, value: null, segment: null, waypoints: 0, multiplier: 1, coneAngle: null });
  useEffect(() => {
    const off = window.electronAPI?.on?.('measure-live', (d) => d && setM((p) => ({ ...p, ...d })));
    return () => { try { off && off(); } catch (e) {} };
  }, []);
  const active = !!m.measureMode;
  const has = active && m.value != null;
  const drag = window.electronAPI?.isElectron ? { WebkitAppRegion: 'drag' } : undefined;
  const nodrag = window.electronAPI?.isElectron ? { WebkitAppRegion: 'no-drag' } : undefined;
  return (
    <div className="fixed inset-0 bg-[#0d0d0f] text-white flex flex-col select-none p-1.5" data-testid="measure-window">
      <div className="flex-1 rounded-xl border border-[#caa055]/30 bg-gradient-to-b from-[#16130c] to-[#0d0d0f] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-white/5" style={drag}>
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#caa055]">
            <Ruler className="w-3.5 h-3.5" /> Live Measure
          </span>
          <button onClick={() => window.close()} className="h-5 w-5 text-white/60 hover:text-white hover:bg-white/10 rounded text-xs" style={nodrag}>✕</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-3 text-center">
          {active ? (
            <>
              <div className="text-[10px] uppercase tracking-wider text-[#caa055]/80 mb-1" data-testid="measure-window-mode">
                {LABELS[m.measureMode] || m.measureMode}{m.measureMode === 'cone' && m.coneAngle ? ` ${m.coneAngle}°` : ''}
              </div>
              <div className="font-mono text-5xl font-bold text-[#F3EEE7] leading-none" data-testid="measure-window-value">
                {has ? Number(m.value).toFixed(1) : '—'}
              </div>
              <div className="text-[10px] text-white/50 mt-1 font-mono">
                units{m.multiplier !== 1 ? ` (${m.multiplier}x)` : ''}
              </div>
              {has && m.waypoints > 1 && (
                <div className="text-[10px] text-white/60 mt-1 font-mono">segment {Number(m.segment || 0).toFixed(1)} · {m.waypoints} pts</div>
              )}
              {!has && <div className="text-[10px] text-white/40 mt-2">Click on the map to start measuring</div>}
            </>
          ) : (
            <div className="text-[11px] text-white/40">Measure tool is off</div>
          )}
        </div>
      </div>
    </div>
  );
}
