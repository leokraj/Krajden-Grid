import { useState } from 'react';
import { Armchair, Users, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useGrid } from '../context/GridContext';
import { useInitiative } from '../lib/useInitiative';
import {
  makeTable, makeCampaign, makeSeats, uid, cget, rollInitiative,
  getActiveTable, getActiveCampaign,
} from '../lib/campaign';
import { Btn, Slider, Check, ColorInput, Section } from './AtmospherePanel';

const inputCls = 'bg-black/40 border border-[#caa055]/25 rounded px-2 py-1 text-[11px] text-[#f1d9a0] font-mono focus:border-[#caa055] outline-none';
const selectCls = `${inputCls} w-full`;
const Label = ({ children }) => <div className="text-[10px] uppercase tracking-wider text-[#caa055]/60 font-mono">{children}</div>;

// ── Table seats ────────────────────────────────────────────────────────────
function TableSeatsPanel() {
  const { settings, updateSettings } = useGrid();
  const tables = settings.tableLayouts || [];
  const table = getActiveTable(settings);
  const campaign = getActiveCampaign(settings);

  const setTables = (next, extra = {}) => updateSettings({ tableLayouts: next, ...extra });
  const patchTable = (patch) => setTables(tables.map((t) => (t.id === table.id ? { ...t, ...patch } : t)));

  if (!table) {
    return (
      <>
        <div className="text-[10px] text-[#caa055]/60 font-mono">Save where each seat sits at your table once — then just assign who showed up.</div>
        <Btn active onClick={() => { const t = makeTable('My table'); setTables([t], { activeTableId: t.id }); }}>＋ Create my table</Btn>
      </>
    );
  }
  const count = table.seats.length;
  const setCount = (c) => {
    if (c < 1 || c > 16) return;
    const seats = c > count ? [...table.seats, ...makeSeats(c).slice(count)] : table.seats.slice(0, c);
    patchTable({ seats });
  };
  const placed = table.seats.filter((s) => s.x != null).length;
  return (
    <>
      <Label>Table</Label>
      <div className="flex gap-1">
        <select className={selectCls} value={table.id} onChange={(e) => updateSettings({ activeTableId: e.target.value })} data-testid="table-select">
          {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Btn onClick={() => { const t = makeTable(`Table ${tables.length + 1}`); setTables([...tables, t], { activeTableId: t.id }); }} title="New table layout">＋</Btn>
        <Btn danger disabled={tables.length < 2} onClick={() => { const rest = tables.filter((t) => t.id !== table.id); setTables(rest, { activeTableId: rest[0].id }); }} title="Delete this table">🗑</Btn>
      </div>
      <input className={`${inputCls} w-full`} value={table.name} onChange={(e) => patchTable({ name: e.target.value })} data-testid="table-name" />
      <div className="flex items-center justify-between text-[10px] text-[#caa055]/70 font-mono">
        <span>Seats: {count} ({placed} placed)</span>
        <span className="flex gap-1"><Btn onClick={() => setCount(count - 1)}>−</Btn><Btn onClick={() => setCount(count + 1)}>＋</Btn></span>
      </div>
      <div className="space-y-1" data-testid="seat-list">
        {table.seats.map((s) => {
          const ch = campaign?.party.find((p) => p.seat === s.n);
          return (
            <div key={s.n} className="flex items-center gap-1 text-[10px] font-mono text-[#caa055]/80">
              <span className={`w-5 h-5 rounded-full border text-center leading-[18px] ${s.x != null ? 'border-[#caa055] text-[#f1d9a0]' : 'border-dashed border-[#caa055]/40'}`}>{s.n}</span>
              <span className="flex-1 truncate">{ch ? ch.name : <span className="opacity-50">empty</span>}</span>
              <Btn active={settings.placingSeat === s.n} onClick={() => updateSettings({ placingSeat: settings.placingSeat === s.n ? null : s.n })} data-testid={`seat-place-${s.n}`}>
                {s.x != null ? 'Move' : 'Place'}
              </Btn>
              {s.x != null && <Btn danger onClick={() => patchTable({ seats: table.seats.map((x) => (x.n === s.n ? { ...x, x: null, y: null } : x)) })}>✕</Btn>}
            </div>
          );
        })}
      </div>
      <div className="text-[9px] text-[#caa055]/45 font-mono">Click Place, then click that seat's spot on the grid (or on your table photo). Seats show as numbered dots on the DM screen only.</div>
    </>
  );
}

// ── Party roster ───────────────────────────────────────────────────────────
function PartyRosterPanel() {
  const { settings, updateSettings } = useGrid();
  const { list, turn, setInit } = useInitiative();
  const camps = settings.campaigns || [];
  const camp = getActiveCampaign(settings);
  const table = getActiveTable(settings);
  const [newName, setNewName] = useState('');
  const [newBonus, setNewBonus] = useState('');

  const setCamps = (next, extra = {}) => updateSettings({ campaigns: next, ...extra });
  const patchCamp = (patch) => setCamps(camps.map((c) => (c.id === camp.id ? { ...c, ...patch } : c)));
  const patchChar = (id, patch) => patchCamp({ party: camp.party.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  if (!camp) {
    return (
      <>
        <div className="text-[10px] text-[#caa055]/60 font-mono">Save your players once as a campaign profile, then load the whole party into the turn order in one click.</div>
        <Btn active onClick={() => { const c = makeCampaign('My campaign'); setCamps([c], { activeCampaignId: c.id }); }}>＋ Create my campaign</Btn>
      </>
    );
  }
  const addChar = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    patchCamp({ party: [...camp.party, { id: uid('pc'), name: newName.trim(), bonus: parseInt(newBonus, 10) || 0, seat: null }] });
    setNewName(''); setNewBonus('');
  };
  const loadParty = () => {
    const seated = camp.party.filter((p) => p.seat != null);
    const who = seated.length ? seated : camp.party;
    if (!who.length) { toast.info('Add some characters first'); return; }
    const have = new Set(list.map((c) => c.charId).filter(Boolean));
    const adds = who.filter((p) => !have.has(p.id)).map((p) => ({
      id: `combatant_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: p.name, value: rollInitiative(p.bonus), charId: p.id, addedBy: 'Campaign',
    }));
    if (!adds.length) { toast.info('The party is already in the turn order'); return; }
    const merged = [...list, ...adds].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    const curId = list[turn]?.id;
    setInit(merged, curId ? merged.findIndex((c) => c.id === curId) : 0);
    toast.success(`Added ${adds.length} to the turn order (rolled d20 + bonus)`);
  };
  const seatLabel = (n) => {
    const other = camp.party.find((p) => p.seat === n);
    return other ? `Seat ${n} · ${other.name}` : `Seat ${n}`;
  };
  return (
    <>
      <Label>Campaign</Label>
      <div className="flex gap-1">
        <select className={selectCls} value={camp.id} onChange={(e) => updateSettings({ activeCampaignId: e.target.value })} data-testid="campaign-select">
          {camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Btn onClick={() => { const c = makeCampaign(`Campaign ${camps.length + 1}`); setCamps([...camps, c], { activeCampaignId: c.id }); }} title="New campaign">＋</Btn>
        <Btn danger disabled={camps.length < 2} onClick={() => { const rest = camps.filter((c) => c.id !== camp.id); setCamps(rest, { activeCampaignId: rest[0].id }); }} title="Delete this campaign">🗑</Btn>
      </div>
      <input className={`${inputCls} w-full`} value={camp.name} onChange={(e) => patchCamp({ name: e.target.value })} data-testid="campaign-name" />

      <Label>Party</Label>
      <div className="space-y-1" data-testid="party-list">
        {camp.party.length === 0 && <div className="text-[10px] text-[#caa055]/45 font-mono">No characters yet.</div>}
        {camp.party.map((p) => (
          <div key={p.id} className="flex items-center gap-1">
            <span className="flex-1 min-w-0 truncate text-[11px] text-[#f1d9a0] font-mono" title={p.name}>{p.name}</span>
            <input type="number" className={`${inputCls} w-12`} value={p.bonus} title="Initiative bonus" onChange={(e) => patchChar(p.id, { bonus: parseInt(e.target.value, 10) || 0 })} />
            <select className={`${inputCls} w-[88px]`} value={p.seat ?? ''} onChange={(e) => patchChar(p.id, { seat: e.target.value === '' ? null : parseInt(e.target.value, 10) })} data-testid={`party-seat-${p.id}`}>
              <option value="">no seat</option>
              {(table?.seats || []).map((s) => <option key={s.n} value={s.n}>{seatLabel(s.n)}</option>)}
            </select>
            <Btn danger onClick={() => patchCamp({ party: camp.party.filter((x) => x.id !== p.id) })}>✕</Btn>
          </div>
        ))}
      </div>
      <form onSubmit={addChar} className="flex gap-1">
        <input className={`${inputCls} flex-1 min-w-0`} placeholder="Character name" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="party-new-name" />
        <input className={`${inputCls} w-12`} type="number" placeholder="+0" title="Initiative bonus" value={newBonus} onChange={(e) => setNewBonus(e.target.value)} />
        <Btn type="submit" active data-testid="party-add">Add</Btn>
      </form>
      <Btn active className="w-full py-1.5" onClick={loadParty} data-testid="load-party-btn">⚔ Load party into turn order</Btn>
      <div className="text-[9px] text-[#caa055]/45 font-mono">Loads everyone with a seat (or the whole party if no one is seated yet), rolling d20 + bonus. Edit any roll in the turn order.</div>
    </>
  );
}

// ── Sigil look ─────────────────────────────────────────────────────────────
function SigilSettingsPanel() {
  const { settings, updateSettings } = useGrid();
  const g = (k) => cget(settings, k);
  return (
    <>
      <ColorInput label="Current turn colour" value={g('sigilCurrent')} onChange={(v) => updateSettings({ sigilCurrent: v })} />
      <ColorInput label="Next-up colour" value={g('sigilNext')} onChange={(v) => updateSettings({ sigilNext: v })} />
      <Slider label="Sigil size" value={g('sigilSize')} min={40} max={220} onChange={(v) => updateSettings({ sigilSize: v })} fmt={(v) => `${v}px`} />
      <Check label="Show the next-up sigil" checked={g('showNextSigil')} onChange={(v) => updateSettings({ showNextSigil: v })} />
      <div className="text-[9px] text-[#caa055]/45 font-mono">The projector shows only the glowing sigils at seats — no text. Step the turn with the → / ← keys (rebind in Hotkeys). Monsters have no sigil; the next player in line still shows as next.</div>
    </>
  );
}

export function CampaignSections({ sectionFilter }) {
  return (
    <>
      <Section id="camp-table" title="Table Seats" icon={Armchair} sectionFilter={sectionFilter}><TableSeatsPanel /></Section>
      <Section id="camp-party" title="Party Roster" icon={Users} sectionFilter={sectionFilter}><PartyRosterPanel /></Section>
      <Section id="camp-sigils" title="Turn Sigils" icon={Sparkles} sectionFilter={sectionFilter}><SigilSettingsPanel /></Section>
    </>
  );
}

export default CampaignSections;
