import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, CloudSun, CloudFog, Wand2, Layers, MousePointer2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGrid } from '../context/GridContext';
import {
  ATMOSPHERE_DEFAULTS, TOD_PRESETS, SPELL_STYLES, MARK_TYPES, uid, fileToSmallDataUrl,
} from '../lib/atmosphere';

// Control-panel sections for the Atmosphere features. Rendered by
// FloatingControls via <AtmosphereSections />. Each section can be torn off
// into its own window like the other sections (sectionFilter).

const gv = (settings, key) => (settings[key] === undefined ? ATMOSPHERE_DEFAULTS[key] : settings[key]);

const Btn = ({ active, danger, className = '', ...p }) => (
  <button
    {...p}
    className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
      active ? 'bg-[#caa055]/25 border-[#caa055] text-[#f1d9a0]'
      : danger ? 'border-red-500/40 text-red-300 hover:bg-red-500/15'
      : 'border-[#caa055]/25 text-[#caa055]/80 hover:bg-[#caa055]/10'} ${className}`}
  />
);

const Slider = ({ label, value, min, max, step = 1, onChange, fmt }) => (
  <label className="block text-[10px] text-[#caa055]/70 font-mono">
    <div className="flex justify-between"><span>{label}</span><span>{fmt ? fmt(value) : value}</span></div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-[#caa055]" />
  </label>
);

const Check = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-[10px] text-[#caa055]/80 font-mono cursor-pointer">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#caa055]" />
    {label}
  </label>
);

const ColorInput = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between text-[10px] text-[#caa055]/70 font-mono">
    {label}
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-5 bg-transparent border border-[#caa055]/30 rounded" />
  </label>
);

function Section({ id, title, icon: Icon, sectionFilter, children, defaultOpen = false }) {
  const [open, setOpen] = useState(sectionFilter === id ? true : defaultOpen);
  if (sectionFilter && sectionFilter !== id) return null;
  return (
    <div className="space-y-3" id={`section-${id}`}>
      <div className="flex items-center gap-1 w-full">
        <div className="flex-1 min-w-0">
          <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-[#caa055]/80" />
              {title}
            </span>
            {open ? <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" />}
          </button>
        </div>
        {!sectionFilter && (
          <button
            onClick={(e) => { e.stopPropagation(); window.electronAPI?.openSectionWindow?.(id, title); }}
            className="shrink-0 p-1 rounded text-[#caa055]/40 hover:text-[#caa055] hover:bg-[#caa055]/10"
            title={`Tear off ${title} into its own window`}
          ><MapPin className="w-3 h-3" /></button>
        )}
      </div>
      {open && <div className="space-y-2.5 pt-1">{children}</div>}
      <div className="h-px bg-[#caa055]/15" />
    </div>
  );
}

// ── Time of Day + Weather ───────────────────────────────────────────────────
function TimeWeather() {
  const { settings, updateSettings } = useGrid();
  const g = (k) => gv(settings, k);
  const set = updateSettings;
  const tool = settings.atmoTool;
  return (
    <>
      <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono">Time of day</div>
      <div className="grid grid-cols-4 gap-1">
        {Object.entries(TOD_PRESETS).map(([k, p]) => (
          <Btn key={k} active={g('todPreset') === k} onClick={() => set({ todPreset: k })} title={p.label}>{p.emoji} {p.label}</Btn>
        ))}
      </div>
      {g('todPreset') === 'custom' && (
        <>
          <ColorInput label="Tint colour" value={g('todColor')} onChange={(v) => set({ todColor: v })} />
          <Slider label="Strength" value={g('todOpacity')} min={0} max={0.9} step={0.01} onChange={(v) => set({ todOpacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          <div className="flex gap-1">
            {['multiply', 'normal', 'overlay', 'soft-light'].map(b => <Btn key={b} active={g('todBlend') === b} onClick={() => set({ todBlend: b })}>{b}</Btn>)}
          </div>
        </>
      )}

      <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono pt-2">Weather</div>
      <Check label="🌫️ Fog clouds" checked={g('weatherFogOn')} onChange={(v) => set({ weatherFogOn: v })} />
      {g('weatherFogOn') && (<>
        <Slider label="Density" value={g('weatherFogDensity')} min={0.05} max={1} step={0.05} onChange={(v) => set({ weatherFogDensity: v })} />
        <Slider label="Drift speed" value={g('weatherFogSpeed')} min={0} max={3} step={0.1} onChange={(v) => set({ weatherFogSpeed: v })} />
        <ColorInput label="Fog colour" value={g('weatherFogColor')} onChange={(v) => set({ weatherFogColor: v })} />
      </>)}
      <Check label="🌧️ Rain & wind" checked={g('weatherRainOn')} onChange={(v) => set({ weatherRainOn: v })} />
      {g('weatherRainOn') && (<>
        <Slider label="Intensity" value={g('weatherRainDensity')} min={0.05} max={1} step={0.05} onChange={(v) => set({ weatherRainDensity: v })} />
        <Slider label="Fall speed" value={g('weatherRainSpeed')} min={0.3} max={2.5} step={0.1} onChange={(v) => set({ weatherRainSpeed: v })} />
        <Slider label="Wind angle" value={g('weatherWindAngle')} min={-45} max={45} onChange={(v) => set({ weatherWindAngle: v })} fmt={(v) => `${v}°`} />
      </>)}
      <Check label="⚡ Lightning" checked={g('weatherLightningOn')} onChange={(v) => set({ weatherLightningOn: v })} />
      {g('weatherLightningOn') && (
        <Slider label="Average gap" value={g('weatherLightningFreq')} min={2} max={30} onChange={(v) => set({ weatherLightningFreq: v })} fmt={(v) => `${v}s`} />
      )}

      <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono pt-2">Weather blockers (keep rooms dry)</div>
      <div className="flex gap-1 flex-wrap">
        <Btn active={tool === 'blocker-rect'} onClick={() => set({ atmoTool: tool === 'blocker-rect' ? null : 'blocker-rect' })}>▭ Rectangle</Btn>
        <Btn active={tool === 'blocker-circle'} onClick={() => set({ atmoTool: tool === 'blocker-circle' ? null : 'blocker-circle' })}>◯ Circle</Btn>
        <Btn danger onClick={() => set({ weatherBlockers: (g('weatherBlockers') || []).slice(0, -1) })}>Undo</Btn>
        <Btn danger onClick={() => set({ weatherBlockers: [] })}>Clear ({(g('weatherBlockers') || []).length})</Btn>
      </div>
      <div className="text-[9px] text-[#caa055]/45 font-mono">Drag over a room — rain, fog and lightning are cut out inside it.</div>
    </>
  );
}

// ── Fog of War ──────────────────────────────────────────────────────────────
function FogPanel() {
  const { settings, updateSettings } = useGrid();
  const g = (k) => gv(settings, k);
  const set = updateSettings;
  const tool = settings.atmoTool;
  const ops = g('fogOps') || [];
  const pick = (t) => set({ atmoTool: tool === t ? null : t, fogEnabled: true });
  return (
    <>
      <Check label="Enable Fog of War (map starts fully covered)" checked={g('fogEnabled')} onChange={(v) => set({ fogEnabled: v })} />
      <div className="grid grid-cols-2 gap-1">
        <Btn active={g('fogMode') === 'reveal'} onClick={() => set({ fogMode: 'reveal' })}>👁 Reveal</Btn>
        <Btn active={g('fogMode') === 'hide'} onClick={() => set({ fogMode: 'hide' })}>🌑 Re-cover</Btn>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <Btn active={tool === 'fog-brush'} onClick={() => pick('fog-brush')}>🖌 Brush</Btn>
        <Btn active={tool === 'fog-rect'} onClick={() => pick('fog-rect')}>▭ Rect</Btn>
        <Btn active={tool === 'fog-circle'} onClick={() => pick('fog-circle')}>◯ Circle</Btn>
      </div>
      <Slider label="Brush size" value={g('fogBrush')} min={20} max={400} onChange={(v) => set({ fogBrush: v })} fmt={(v) => `${v}px`} />
      <Slider label="Soft edges" value={g('fogSoft')} min={0} max={1} step={0.05} onChange={(v) => set({ fogSoft: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Fog opacity (game screen)" value={g('fogOpacity')} min={0.3} max={1} step={0.01} onChange={(v) => set({ fogOpacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
      <div className="flex gap-1 flex-wrap">
        <Btn onClick={() => set({ fogEnabled: true, fogOps: [...ops, { id: uid('fog'), mode: 'reveal', kind: 'rect', x: -5000, y: -5000, w: 20000, h: 20000, soft: 0 }] })}>Reveal all</Btn>
        <Btn onClick={() => set({ fogEnabled: true, fogOps: [] })}>Cover all</Btn>
        <Btn danger onClick={() => set({ fogOps: ops.slice(0, -1) })}>Undo ({ops.length})</Btn>
      </div>
      <div className="text-[9px] text-[#caa055]/45 font-mono">
        On the DM Screen the fog is see-through so you can plan; the game screen shows it solid. Right-click or Esc exits the tool.
      </div>
    </>
  );
}

// ── Spell circles + combat marks ────────────────────────────────────────────
function SpellPanel() {
  const { settings, updateSettings } = useGrid();
  const g = (k) => gv(settings, k);
  const set = updateSettings;
  const tool = settings.atmoTool;
  const md = g('markDraft');
  const setM = (p) => set({ markDraft: { ...md, ...p } });
  const circles = g('spellCircles') || [];
  const selId = settings.selectedSpellId || null;
  const sel = circles.find(c => c.id === selId) || null;

  // The same controls edit either the selected circle or the defaults used for new ones.
  const target = sel || g('spellDraft');
  const setT = (p) => {
    if (sel) set({ spellCircles: circles.map(c => (c.id === sel.id ? { ...c, ...p } : c)) });
    else set({ spellDraft: { ...g('spellDraft'), ...p } });
  };
  const reroll = () => setT({ seed: Math.floor(Math.random() * 99999) + 1 });
  const duplicate = () => {
    if (!sel) return;
    const id = uid('spell');
    set({ spellCircles: [...circles, { ...sel, id, x: sel.x + 60, y: sel.y + 60, groupId: undefined, locked: false }], selectedSpellId: id });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono">
          {sel ? 'Editing selected circle' : 'New circle settings'}
        </div>
        {sel && <Btn onClick={() => set({ selectedSpellId: null })}>Done</Btn>}
      </div>
      {!sel && (
        <div className="text-[9px] text-[#caa055]/45 font-mono">
          Click a placed circle on the map (on its outer ring or its centre) to select it, then change it here. Drag to move, scroll to resize, Delete to remove.
        </div>
      )}
      <div className="grid grid-cols-3 gap-1">
        {Object.entries(SPELL_STYLES).map(([k, st]) => (
          <Btn key={k} active={target.style === k} onClick={() => setT({ style: k, color: st.color })}>{st.label}</Btn>
        ))}
      </div>
      <ColorInput label="Colour" value={target.color} onChange={(v) => setT({ color: v })} />
      <Slider label="Radius" value={target.radius} min={40} max={500} onChange={(v) => setT({ radius: v })} fmt={(v) => `${v}px`} />
      <Slider label="Rings" value={target.rings} min={1} max={6} onChange={(v) => setT({ rings: v })} />
      <Slider label="Spokes" value={target.spokes} min={3} max={12} onChange={(v) => setT({ spokes: v })} />
      <Slider label="Runes" value={target.runes} min={0} max={36} onChange={(v) => setT({ runes: v })} />
      <Slider label="Spin speed" value={target.speed} min={0.2} max={4} step={0.1} onChange={(v) => setT({ speed: v })} />
      <div className="flex gap-1 flex-wrap">
        {!sel && <Btn active={tool === 'spell'} onClick={() => set({ atmoTool: tool === 'spell' ? null : 'spell' })}>✦ Place circle</Btn>}
        <Btn onClick={reroll} title="Re-draws the rune symbols, the sparkle positions and the orbiting dots' starting angle. Size, rings, spokes and colour stay the same.">🎲 New rune symbols</Btn>
        {sel && <Btn onClick={duplicate}>⧉ Duplicate</Btn>}
        {sel && <Btn danger onClick={() => set({ spellCircles: circles.filter(c => c.id !== sel.id), selectedSpellId: null })}>Delete</Btn>}
        {!sel && <Btn danger onClick={() => set({ spellCircles: [] })}>Clear all ({circles.length})</Btn>}
      </div>

      <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono pt-2">Combat marks (animated hits)</div>
      <div className="grid grid-cols-5 gap-1">
        {Object.entries(MARK_TYPES).map(([k, m]) => (
          <Btn key={k} active={md.type === k} onClick={() => setM({ type: k })} title={m.label}>{m.emoji}</Btn>
        ))}
      </div>
      <ColorInput label="Colour" value={md.color} onChange={(v) => setM({ color: v })} />
      <Slider label="Size" value={md.size} min={50} max={400} onChange={(v) => setM({ size: v })} fmt={(v) => `${v}px`} />
      <Slider label="Angle" value={md.rotation} min={-180} max={180} onChange={(v) => setM({ rotation: v })} fmt={(v) => `${v}°`} />
      <Slider label="Linger" value={md.persist} min={0} max={60} onChange={(v) => setM({ persist: v })} fmt={(v) => (v === 0 ? 'stays' : `${v}s`)} />
      <div className="flex gap-1 flex-wrap">
        <Btn active={tool === 'mark'} onClick={() => set({ atmoTool: tool === 'mark' ? null : 'mark' })}>⚔ Strike</Btn>
        <Btn danger onClick={() => set({ combatMarks: [] })}>Clear marks</Btn>
      </div>
    </>
  );
}

// ── Groups + Mass Edit ──────────────────────────────────────────────────────
const moveEffect = (ep, dx, dy) => {
  const out = { ...ep };
  if (ep.rect) out.rect = { ...ep.rect, x: ep.rect.x + dx, y: ep.rect.y + dy };
  if (Array.isArray(ep.points)) out.points = ep.points.map(p => (Array.isArray(p) ? [p[0] + dx, p[1] + dy] : { ...p, x: p.x + dx, y: p.y + dy }));
  if (typeof ep.x === 'number') out.x = ep.x + dx;
  if (typeof ep.y === 'number') out.y = ep.y + dy;
  return out;
};

function GroupsPanel() {
  const grid = useGrid();
  const { settings, updateSettings, selectedClipartIds, setSelectedClipartIds, selectedBgLayerId } = grid;
  const groups = gv(settings, 'itemGroups') || [];
  const [name, setName] = useState('');
  const [step, setStep] = useState(50);
  const selIds = selectedClipartIds || [];
  const selEffect = settings.selectedEffectPathId;
  const selCount = selIds.length + (selBg(selectedBgLayerId) ? 1 : 0) + (selEffect ? 1 : 0);

  function selBg(id) { return !!id; }

  const membersOf = (gid) => ({
    cliparts: (settings.placedCliparts || []).filter(c => c.groupId === gid),
    effects: (settings.effectPaths || []).filter(e => e.groupId === gid),
    bgs: (settings.backgroundLayers || []).filter(b => b.groupId === gid),
    spells: (settings.spellCircles || []).filter(s => s.groupId === gid),
  });
  const countOf = (gid) => { const m = membersOf(gid); return m.cliparts.length + m.effects.length + m.bgs.length + m.spells.length; };

  const patchAll = (gid, fn) => {
    const p = {};
    p.placedCliparts = (settings.placedCliparts || []).map(c => (c.groupId === gid ? fn('clipart', c) : c));
    p.effectPaths = (settings.effectPaths || []).map(e => (e.groupId === gid ? fn('effect', e) : e));
    p.backgroundLayers = (settings.backgroundLayers || []).map(b => (b.groupId === gid ? fn('bg', b) : b));
    p.spellCircles = (settings.spellCircles || []).map(s => (s.groupId === gid ? fn('spell', s) : s));
    return p;
  };

  const createGroup = () => {
    const gid = uid('grp');
    const nm = name.trim() || `Group ${groups.length + 1}`;
    const patch = { itemGroups: [...groups, { id: gid, name: nm, locked: false, hidden: false }] };
    if (selCount) {
      patch.placedCliparts = (settings.placedCliparts || []).map(c => (selIds.includes(c.instanceId) ? { ...c, groupId: gid } : c));
      patch.backgroundLayers = (settings.backgroundLayers || []).map(b => (b.id === selectedBgLayerId ? { ...b, groupId: gid } : b));
      patch.effectPaths = (settings.effectPaths || []).map(e => (e.id === selEffect ? { ...e, groupId: gid } : e));
    }
    updateSettings(patch);
    setName('');
    toast.success(`Created "${nm}"${selCount ? ` with ${selCount} item${selCount === 1 ? '' : 's'}` : ''}`);
  };

  const addSelection = (gid) => {
    updateSettings({
      placedCliparts: (settings.placedCliparts || []).map(c => (selIds.includes(c.instanceId) ? { ...c, groupId: gid } : c)),
      backgroundLayers: (settings.backgroundLayers || []).map(b => (b.id === selectedBgLayerId ? { ...b, groupId: gid } : b)),
      effectPaths: (settings.effectPaths || []).map(e => (e.id === selEffect ? { ...e, groupId: gid } : e)),
    });
  };

  const setGroup = (gid, p) => updateSettings({ itemGroups: groups.map(x => (x.id === gid ? { ...x, ...p } : x)) });

  const toggleLock = (gr) => {
    const v = !gr.locked;
    updateSettings({ ...patchAll(gr.id, (_, it) => ({ ...it, locked: v })), itemGroups: groups.map(x => (x.id === gr.id ? { ...x, locked: v } : x)) });
  };
  const toggleHide = (gr) => {
    const v = !gr.hidden;
    updateSettings({ ...patchAll(gr.id, (_, it) => ({ ...it, hidden: v })), itemGroups: groups.map(x => (x.id === gr.id ? { ...x, hidden: v } : x)) });
  };
  const nudge = (gr, dx, dy) => {
    if (gr.locked) { toast('Group is locked'); return; }
    updateSettings(patchAll(gr.id, (kind, it) => {
      if (kind === 'effect') return moveEffect(it, dx, dy);
      if (typeof it.x === 'number') return { ...it, x: it.x + dx, y: it.y + dy };
      return it;
    }));
  };
  const selectMembers = (gr) => setSelectedClipartIds && setSelectedClipartIds(membersOf(gr.id).cliparts.map(c => c.instanceId));
  const ungroup = (gr) => {
    updateSettings({
      ...patchAll(gr.id, (_, it) => { const { groupId, ...rest } = it; return { ...rest, locked: false, hidden: false }; }),
      itemGroups: groups.filter(x => x.id !== gr.id),
    });
  };
  const deleteAll = (gr) => {
    if (!window.confirm(`Delete "${gr.name}" and all ${countOf(gr.id)} items in it?`)) return;
    updateSettings({
      placedCliparts: (settings.placedCliparts || []).filter(c => c.groupId !== gr.id),
      effectPaths: (settings.effectPaths || []).filter(e => e.groupId !== gr.id),
      backgroundLayers: (settings.backgroundLayers || []).filter(b => b.groupId !== gr.id),
      spellCircles: (settings.spellCircles || []).filter(s => s.groupId !== gr.id),
      itemGroups: groups.filter(x => x.id !== gr.id),
    });
  };
  const duplicate = (gr) => {
    const gid = uid('grp');
    const off = 60;
    const m = membersOf(gr.id);
    updateSettings({
      itemGroups: [...groups, { ...gr, id: gid, name: `${gr.name} copy`, locked: false, hidden: false }],
      placedCliparts: [...(settings.placedCliparts || []), ...m.cliparts.map(c => ({ ...c, instanceId: uid('clipart'), groupId: gid, locked: false, hidden: false, x: c.x + off, y: c.y + off }))],
      effectPaths: [...(settings.effectPaths || []), ...m.effects.map(e => ({ ...moveEffect(e, off, off), id: uid('eff'), groupId: gid, locked: false, hidden: false }))],
      spellCircles: [...(settings.spellCircles || []), ...m.spells.map(s => ({ ...s, id: uid('spell'), groupId: gid, locked: false, hidden: false, x: s.x + off, y: s.y + off }))],
    });
  };

  // Mass edit acts on the current multi-selection of tokens/images.
  const massUpdate = (fn) => updateSettings({ placedCliparts: (settings.placedCliparts || []).map(c => (selIds.includes(c.instanceId) ? fn(c) : c)) });

  return (
    <>
      <div className="text-[10px] text-[#caa055]/60 font-mono">
        Selected: {selIds.length} token{selIds.length === 1 ? '' : 's'}{selectedBgLayerId ? ' · 1 map layer' : ''}{selEffect ? ' · 1 effect' : ''}
      </div>
      <div className="flex gap-1">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New group name"
          className="flex-1 min-w-0 bg-black/40 border border-[#caa055]/25 rounded px-2 py-1 text-[10px] font-mono text-[#f1d9a0]" />
        <Btn onClick={createGroup}>＋ Group{selCount ? ` (${selCount})` : ''}</Btn>
      </div>

      {groups.length === 0 && <div className="text-[9px] text-[#caa055]/45 font-mono">Select tokens / a map layer / an effect, then press ＋ Group to bundle them.</div>}
      {groups.map(gr => (
        <div key={gr.id} className="border border-[#caa055]/20 rounded p-1.5 space-y-1 bg-black/20">
          <div className="flex items-center gap-1">
            <input value={gr.name} onChange={(e) => setGroup(gr.id, { name: e.target.value })}
              className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-[#f1d9a0] border-b border-transparent focus:border-[#caa055]/40 outline-none" />
            <span className="text-[9px] text-[#caa055]/50 font-mono">{countOf(gr.id)}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            <Btn onClick={() => selectMembers(gr)} title="Select its tokens">Select</Btn>
            <Btn onClick={() => addSelection(gr.id)} disabled={!selCount} title="Add current selection">＋ Sel</Btn>
            <Btn active={gr.locked} onClick={() => toggleLock(gr)}>{gr.locked ? '🔒' : '🔓'}</Btn>
            <Btn active={gr.hidden} onClick={() => toggleHide(gr)}>{gr.hidden ? '🙈' : '👁'}</Btn>
            <Btn onClick={() => duplicate(gr)}>⧉</Btn>
            <Btn danger onClick={() => ungroup(gr)} title="Ungroup (keep items)">Ungroup</Btn>
            <Btn danger onClick={() => deleteAll(gr)} title="Delete group and items">🗑</Btn>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[#caa055]/50 font-mono">Move</span>
            <Btn onClick={() => nudge(gr, -step, 0)}>←</Btn>
            <Btn onClick={() => nudge(gr, 0, -step)}>↑</Btn>
            <Btn onClick={() => nudge(gr, 0, step)}>↓</Btn>
            <Btn onClick={() => nudge(gr, step, 0)}>→</Btn>
          </div>
        </div>
      ))}
      {groups.length > 0 && <Slider label="Move step" value={step} min={5} max={300} step={5} onChange={setStep} fmt={(v) => `${v}px`} />}

      <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono pt-2">Mass edit (selected tokens)</div>
      <div className="flex gap-1 flex-wrap">
        <Btn disabled={!selIds.length} onClick={() => massUpdate(c => ({ ...c, scale: Math.round((c.scale || 50) * 1.15) }))}>Size +</Btn>
        <Btn disabled={!selIds.length} onClick={() => massUpdate(c => ({ ...c, scale: Math.max(8, Math.round((c.scale || 50) / 1.15)) }))}>Size −</Btn>
        <Btn disabled={!selIds.length} onClick={() => massUpdate(c => ({ ...c, rotation: ((c.rotation || 0) + 45) % 360 }))}>Rotate 45°</Btn>
        <Btn disabled={!selIds.length} onClick={() => massUpdate(c => ({ ...c, rotation: 0 }))}>Reset rot</Btn>
        <Btn disabled={!selIds.length} onClick={() => massUpdate(c => ({ ...c, locked: !c.locked }))}>Lock/Unlock</Btn>
        <Btn disabled={!selIds.length} onClick={() => {
          const copies = (settings.placedCliparts || []).filter(c => selIds.includes(c.instanceId)).map(c => ({ ...c, instanceId: uid('clipart'), x: c.x + 50, y: c.y + 50 }));
          updateSettings({ placedCliparts: [...(settings.placedCliparts || []), ...copies] });
          setSelectedClipartIds && setSelectedClipartIds(copies.map(c => c.instanceId));
        }}>Duplicate</Btn>
        <Btn danger disabled={!selIds.length} onClick={() => {
          updateSettings({ placedCliparts: (settings.placedCliparts || []).filter(c => !selIds.includes(c.instanceId)) });
          setSelectedClipartIds && setSelectedClipartIds([]);
        }}>Delete</Btn>
      </div>
      <div className="text-[9px] text-[#caa055]/45 font-mono">Tip: drag a select box on the map to pick many tokens, then use these.</div>
    </>
  );
}

// ── Graphics + Mouse Token ──────────────────────────────────────────────────
function GraphicsPanel() {
  const { settings, updateSettings } = useGrid();
  const g = (k) => gv(settings, k);
  const set = updateSettings;
  const fileRef = useRef(null);
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const url = await fileToSmallDataUrl(f);
      set({ mouseTokenImg: url, mouseTokenOn: true });
    } catch (err) { toast.error('Could not read that image'); }
  };
  return (
    <>
      <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono">Graphics</div>
      <div className="grid grid-cols-3 gap-1">
        {['high', 'medium', 'low'].map(q => <Btn key={q} active={g('gfxQuality') === q} onClick={() => set({ gfxQuality: q })}>{q}</Btn>)}
      </div>
      <Check label="Particle effects (rain drops, sparks, lightning bolts)" checked={g('gfxParticles')} onChange={(v) => set({ gfxParticles: v })} />
      <Check label="Glow on circles & marks" checked={g('gfxGlow')} onChange={(v) => set({ gfxGlow: v })} />
      <div className="text-[9px] text-[#caa055]/45 font-mono">Lower quality renders fog, weather and fog-of-war at reduced resolution and frame rate — use it on weaker PCs.</div>

      <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono pt-2">Mouse token</div>
      <div className="flex items-center gap-2">
        {g('mouseTokenImg') && <img src={g('mouseTokenImg')} alt="" className="w-9 h-9 rounded-full object-cover border border-[#caa055]/60" />}
        <Btn onClick={() => fileRef.current?.click()}>{g('mouseTokenImg') ? 'Change image' : 'Choose image'}</Btn>
        {g('mouseTokenImg') && <Btn danger onClick={() => set({ mouseTokenImg: null, mouseTokenOn: false })}>Remove</Btn>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      <Check label="Show token on my mouse" checked={g('mouseTokenOn')} onChange={(v) => set({ mouseTokenOn: v })} />
      <div className="grid grid-cols-2 gap-1">
        <Btn active={g('mouseTokenMode') === 'mouse'} onClick={() => set({ mouseTokenMode: 'mouse' })}>On mouse</Btn>
        <Btn active={g('mouseTokenMode') === 'edges'} onClick={() => set({ mouseTokenMode: 'edges' })}>Stick to screen edge</Btn>
      </div>
      <Slider label="Token size" value={g('mouseTokenSize')} min={24} max={200} onChange={(v) => set({ mouseTokenSize: v })} fmt={(v) => `${v}px`} />
    </>
  );
}

export function AtmosphereSections({ sectionFilter }) {
  return (
    <>
      <Section id="atmo-weather" title="Time & Weather" icon={CloudSun} sectionFilter={sectionFilter}><TimeWeather /></Section>
      <Section id="atmo-fog" title="Fog of War" icon={CloudFog} sectionFilter={sectionFilter}><FogPanel /></Section>
      <Section id="atmo-spells" title="Spell Circles & Hits" icon={Wand2} sectionFilter={sectionFilter}><SpellPanel /></Section>
      <Section id="atmo-groups" title="Groups & Mass Edit" icon={Layers} sectionFilter={sectionFilter}><GroupsPanel /></Section>
      <Section id="atmo-gfx" title="Graphics & Mouse Token" icon={MousePointer2} sectionFilter={sectionFilter}><GraphicsPanel /></Section>
    </>
  );
}

export default AtmosphereSections;
