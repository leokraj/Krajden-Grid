// Campaign profiles, table seats and initiative sigils — shared helpers.

export const CAMPAIGN_DEFAULTS = {
  sigilCurrent: '#ffd24a',
  sigilNext: '#4aa3ff',
  sigilSize: 90,
  showNextSigil: true,
};

export const PERSISTED_KEYS = [
  'campaigns', 'activeCampaignId', 'tableLayouts', 'activeTableId',
  'sigilCurrent', 'sigilNext', 'sigilSize', 'showNextSigil',
];
export const STORAGE_KEY = 'krajden_campaign_data';

export const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const makeSeats = (count) => Array.from({ length: count }, (_, i) => ({ n: i + 1, x: null, y: null }));
export const makeTable = (name = 'My table', count = 8) => ({ id: uid('tbl'), name, seats: makeSeats(count) });
export const makeCampaign = (name = 'My campaign') => ({ id: uid('camp'), name, party: [] });

export const cget = (settings, key) => (settings[key] === undefined ? CAMPAIGN_DEFAULTS[key] : settings[key]);

export function getActiveTable(settings) {
  const tables = settings.tableLayouts || [];
  return tables.find((t) => t.id === settings.activeTableId) || tables[0] || null;
}
export function getActiveCampaign(settings) {
  const camps = settings.campaigns || [];
  return camps.find((c) => c.id === settings.activeCampaignId) || camps[0] || null;
}

// d20 + bonus
export const rollInitiative = (bonus = 0) => Math.floor(Math.random() * 20) + 1 + (parseInt(bonus, 10) || 0);

// Which placed seat belongs to a combatant? Linked by charId (set when loaded
// from the party roster) or, failing that, by matching the character's name.
export function seatForCombatant(combatant, campaign, table) {
  if (!combatant || !campaign || !table) return null;
  const nm = (combatant.name || '').toLowerCase().trim();
  const ch = campaign.party.find((p) => p.id === combatant.charId)
    || campaign.party.find((p) => p.name.toLowerCase().trim() === nm);
  if (!ch || ch.seat == null) return null;
  const seat = table.seats.find((s) => s.n === ch.seat);
  return seat && seat.x != null && seat.y != null ? { ...seat, char: ch } : null;
}

// Current-turn seat and the next *player* seat in line (monsters have no seat).
export function resolveSigils(settings, list, turn) {
  const table = getActiveTable(settings);
  const campaign = getActiveCampaign(settings);
  const out = { current: null, next: null };
  if (!table || !campaign || !list || !list.length || turn == null || turn < 0) return out;
  const cur = list[turn];
  out.current = seatForCombatant(cur, campaign, table);
  for (let i = 1; i < list.length; i++) {
    const s = seatForCombatant(list[(turn + i) % list.length], campaign, table);
    if (s && (!out.current || s.n !== out.current.n)) { out.next = s; break; }
  }
  return out;
}
