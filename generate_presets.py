import json
import base64

def make_token_svg(title, bg_color, border_color, icon_svg):
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="bg_{title.lower().replace(' ', '_')}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{bg_color}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="1"/>
    </radialGradient>
    <filter id="glow_{title.lower().replace(' ', '_')}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <circle cx="64" cy="64" r="60" fill="url(#bg_{title.lower().replace(' ', '_')})" stroke="{border_color}" stroke-width="4" filter="url(#glow_{title.lower().replace(' ', '_')})"/>
  <circle cx="64" cy="64" r="54" fill="none" stroke="{border_color}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.6"/>
  <g transform="translate(32, 32)">
    {icon_svg}
  </g>
  <text x="64" y="112" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">{title}</text>
</svg>'''
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode('utf-8')).decode('utf-8')

def make_animated_fx_svg(title, core_color, outer_color, anim_type):
    if anim_type == "fireball":
        body = f'''
        <circle cx="64" cy="64" r="50" fill="{outer_color}" opacity="0.4">
          <animate attributeName="r" values="42;56;42" dur="1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1s" repeatCount="indefinite"/>
        </circle>
        <circle cx="64" cy="64" r="36" fill="{core_color}">
          <animate attributeName="r" values="32;40;32" dur="0.8s" repeatCount="indefinite"/>
        </circle>
        <circle cx="64" cy="64" r="20" fill="#fef08a">
          <animate attributeName="r" values="16;24;16" dur="0.6s" repeatCount="indefinite"/>
        </circle>
        '''
    elif anim_type == "portal":
        body = f'''
        <g transform="translate(64,64)">
          <circle cx="0" cy="0" r="48" fill="none" stroke="{outer_color}" stroke-width="8" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite"/>
          </circle>
          <path d="M-30,-30 Q0,0 30,-30 Q0,0 30,30 Q0,0 -30,30 Q0,0 -30,-30" fill="{core_color}" opacity="0.6">
            <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="2s" repeatCount="indefinite"/>
          </path>
          <circle cx="0" cy="0" r="16" fill="#f472b6"/>
        </g>
        '''
    elif anim_type == "lightning":
        body = f'''
        <circle cx="64" cy="64" r="46" fill="{outer_color}" opacity="0.3">
          <animate attributeName="opacity" values="0.2;0.8;0.2;0.9;0.3" dur="0.8s" repeatCount="indefinite"/>
        </circle>
        <path d="M 64 12 L 40 60 L 68 56 L 52 116 L 88 52 L 60 56 Z" fill="{core_color}">
          <animate attributeName="opacity" values="1;0.4;1;0.2;1" dur="0.4s" repeatCount="indefinite"/>
        </path>
        '''
    elif anim_type == "shield":
        body = f'''
        <g transform="translate(64,64)">
          <path d="M 0 -44 L 38 -24 V 10 C 38 32 0 46 0 46 C 0 46 -38 32 -38 10 V -24 Z" fill="{core_color}" fill-opacity="0.5" stroke="{outer_color}" stroke-width="4">
            <animate attributeName="fill-opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite"/>
          </path>
          <circle cx="0" cy="0" r="20" fill="none" stroke="{outer_color}" stroke-width="2" stroke-dasharray="4,4">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite"/>
          </circle>
        </g>
        '''
    elif anim_type == "heal":
        body = f'''
        <circle cx="64" cy="64" r="48" fill="{outer_color}" opacity="0.25">
          <animate attributeName="r" values="40;52;40" dur="2s" repeatCount="indefinite"/>
        </circle>
        <path d="M 64 28 V 100 M 28 64 H 100" stroke="{core_color}" stroke-width="12" stroke-linecap="round"/>
        <circle cx="44" cy="40" r="4" fill="#ffffff">
          <animate attributeName="cy" values="70;30;70" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="84" cy="50" r="5" fill="#ffffff">
          <animate attributeName="cy" values="80;20;80" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
        </circle>
        '''
    else: # poison
        body = f'''
        <circle cx="64" cy="64" r="48" fill="{outer_color}" opacity="0.5">
          <animate attributeName="r" values="38;52;38" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="50" cy="54" r="22" fill="{core_color}" opacity="0.7">
          <animate attributeName="cx" values="44;56;44" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="78" cy="68" r="18" fill="{core_color}" opacity="0.7">
          <animate attributeName="cy" values="62;74;62" dur="1.8s" repeatCount="indefinite"/>
        </circle>
        '''

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <filter id="glow_fx" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <g filter="url(#glow_fx)">
    {body}
  </g>
  <text x="64" y="118" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">{title}</text>
</svg>'''
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode('utf-8')).decode('utf-8')

def make_map_svg(title, theme_color, grid_color, bg_pattern_type):
    if bg_pattern_type == "dungeon":
        bg_rects = '''<rect width="800" height="600" fill="#1e1b18"/>
        <g opacity="0.15">
          <rect x="50" y="50" width="300" height="200" fill="#38312b" stroke="#000" stroke-width="2"/>
          <rect x="450" y="100" width="300" height="400" fill="#2d2722" stroke="#000" stroke-width="2"/>
          <rect x="200" y="300" width="200" height="250" fill="#38312b" stroke="#000" stroke-width="2"/>
        </g>'''
    elif bg_pattern_type == "cavern":
        bg_rects = '''<rect width="800" height="600" fill="#0f172a"/>
        <path d="M 100 0 Q 200 150 150 300 T 250 600" stroke="#0284c7" stroke-width="60" fill="none" opacity="0.6"/>
        <path d="M 0 200 Q 300 250 500 200 T 800 350" stroke="#0369a1" stroke-width="40" fill="none" opacity="0.4"/>'''
    elif bg_pattern_type == "forest":
        bg_rects = '''<rect width="800" height="600" fill="#14532d"/>
        <path d="M 0 300 Q 400 200 800 300" stroke="#78350f" stroke-width="50" fill="none" opacity="0.7"/>
        <circle cx="150" cy="150" r="70" fill="#166534" opacity="0.8"/>
        <circle cx="650" cy="450" r="90" fill="#166534" opacity="0.8"/>'''
    elif bg_pattern_type == "docks":
        bg_rects = '''<rect width="800" height="600" fill="#0c4a6e"/>
        <rect x="0" y="0" width="300" height="600" fill="#78350f" opacity="0.8"/>
        <rect x="280" y="150" width="400" height="60" fill="#92400e" opacity="0.9"/>'''
    elif bg_pattern_type == "tavern":
        bg_rects = '''<rect width="800" height="600" fill="#451a03"/>
        <rect x="50" y="50" width="700" height="500" fill="#78350f" stroke="#27272a" stroke-width="8"/>'''
    else: # lava
        bg_rects = '''<rect width="800" height="600" fill="#18181b"/>
        <path d="M 0 100 Q 300 400 800 200" stroke="#dc2626" stroke-width="80" fill="none" opacity="0.8"/>'''

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="{grid_color}" stroke-width="1" opacity="0.3"/>
    </pattern>
  </defs>
  {bg_rects}
  <rect width="800" height="600" fill="url(#grid)"/>
  <rect x="20" y="20" width="220" height="36" rx="6" fill="#000000" opacity="0.75" stroke="{theme_color}" stroke-width="1.5"/>
  <text x="32" y="43" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" letter-spacing="1">{title}</text>
</svg>'''
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode('utf-8')).decode('utf-8')

# Icons
sword_icon = '<path d="M 32 8 L 40 16 L 24 32 L 16 24 Z M 16 24 L 8 40 L 4 40 L 4 36 L 24 16 Z M 4 40 L 12 48 M 8 56 L 24 40" stroke="#f59e0b" stroke-width="4" fill="none" stroke-linecap="round"/>'
wizard_icon = '<path d="M 32 4 L 40 24 L 60 32 L 40 40 L 32 60 L 24 40 L 4 32 L 24 24 Z" fill="#8b5cf6" stroke="#c084fc" stroke-width="2"/>'
rogue_icon = '<path d="M 12 8 L 52 48 M 52 8 L 12 48 M 32 4 L 32 60" stroke="#10b981" stroke-width="5" fill="none" stroke-linecap="round"/>'
cleric_icon = '<path d="M 32 8 L 32 56 M 8 32 L 56 32" stroke="#eab308" stroke-width="8" stroke-linecap="round"/>'
ranger_icon = '<path d="M 8 16 Q 32 32 8 48 M 8 16 L 56 32 L 8 48 M 32 32 L 56 32" stroke="#4ade80" stroke-width="4" fill="none" stroke-linecap="round"/>'
paladin_icon = '<path d="M 32 4 L 32 52 M 16 20 L 48 20 M 16 48 L 32 58 L 48 48" stroke="#e2e8f0" stroke-width="5" fill="none"/>'
druid_icon = '<path d="M 32 56 C 12 40 16 12 32 4 C 48 12 52 40 32 56 Z M 32 4 L 32 56" stroke="#86efac" stroke-width="4" fill="none"/>'
barbarian_icon = '<path d="M 8 8 Q 28 20 8 32 L 8 8 Z M 56 8 Q 36 20 56 32 L 56 8 Z M 32 4 L 32 60" stroke="#f87171" stroke-width="4" fill="none"/>'

dragon_icon = '<path d="M 32 8 C 48 8 56 24 56 36 C 56 48 40 56 32 56 C 24 56 8 48 8 36 C 8 24 16 8 32 8 Z" fill="#ef4444" stroke="#f87171" stroke-width="3"/>'
skeleton_icon = '<circle cx="32" cy="24" r="16" fill="#f8fafc"/><rect x="24" y="36" width="16" height="16" fill="#f8fafc"/><circle cx="24" cy="22" r="3" fill="#0f172a"/><circle cx="40" cy="22" r="3" fill="#0f172a"/>'
beholder_icon = '<circle cx="32" cy="32" r="24" fill="#a855f7"/><circle cx="32" cy="32" r="10" fill="#ffffff"/><circle cx="32" cy="32" r="5" fill="#000000"/>'
lich_icon = '<path d="M 16 20 Q 32 4 48 20 Q 56 44 32 58 Q 8 44 16 20 Z" fill="#10b981" stroke="#34d399" stroke-width="3"/><circle cx="24" cy="28" r="3" fill="#ffffff"/><circle cx="40" cy="28" r="3" fill="#ffffff"/>'
goblin_icon = '<path d="M 8 16 L 0 0 L 20 12 L 44 12 L 64 0 L 56 16 L 32 48 Z" fill="#84cc16"/>'
orc_icon = '<rect x="12" y="12" width="40" height="40" rx="8" fill="#65a30d" stroke="#84cc16" stroke-width="3"/>'

cliparts = [
    # Heroes
    { "id": "preset_hero_fighter", "name": "Knight Fighter Token", "category": "dnd_heroes", "type": "image", "imageUrl": make_token_svg("Fighter", "#b45309", "#f59e0b", sword_icon), "tags": ["dnd_heroes", "fighter", "hero"], "isVault": True },
    { "id": "preset_hero_wizard", "name": "Arcane Mage Token", "category": "dnd_heroes", "type": "image", "imageUrl": make_token_svg("Wizard", "#6b21a8", "#c084fc", wizard_icon), "tags": ["dnd_heroes", "wizard", "mage", "hero"], "isVault": True },
    { "id": "preset_hero_rogue", "name": "Shadow Rogue Token", "category": "dnd_heroes", "type": "image", "imageUrl": make_token_svg("Rogue", "#065f46", "#34d399", rogue_icon), "tags": ["dnd_heroes", "rogue", "hero"], "isVault": True },
    { "id": "preset_hero_cleric", "name": "Holy Cleric Token", "category": "dnd_heroes", "type": "image", "imageUrl": make_token_svg("Cleric", "#854d0e", "#fde047", cleric_icon), "tags": ["dnd_heroes", "cleric", "hero"], "isVault": True },
    { "id": "preset_hero_ranger", "name": "Elven Ranger Token", "category": "dnd_heroes", "type": "image", "imageUrl": make_token_svg("Ranger", "#14532d", "#4ade80", ranger_icon), "tags": ["dnd_heroes", "ranger", "hero"], "isVault": True },
    { "id": "preset_hero_paladin", "name": "Golden Paladin Token", "category": "dnd_heroes", "type": "image", "imageUrl": make_token_svg("Paladin", "#1e293b", "#e2e8f0", paladin_icon), "tags": ["dnd_heroes", "paladin", "hero"], "isVault": True },
    { "id": "preset_hero_druid", "name": "Nature Druid Token", "category": "dnd_heroes", "type": "image", "imageUrl": make_token_svg("Druid", "#143821", "#86efac", druid_icon), "tags": ["dnd_heroes", "druid", "hero"], "isVault": True },
    { "id": "preset_hero_barbarian", "name": "Berserker Barbarian Token", "category": "dnd_heroes", "type": "image", "imageUrl": make_token_svg("Barbarian", "#450a0a", "#f87171", barbarian_icon), "tags": ["dnd_heroes", "barbarian", "hero"], "isVault": True },

    # Monsters
    { "id": "preset_monster_dragon", "name": "Red Dragon Token", "category": "dnd_monsters", "type": "image", "imageUrl": make_token_svg("Red Dragon", "#991b1b", "#f87171", dragon_icon), "tags": ["dnd_monsters", "dragon", "boss"], "isVault": True },
    { "id": "preset_monster_skeleton", "name": "Skeleton Warrior Token", "category": "dnd_monsters", "type": "image", "imageUrl": make_token_svg("Skeleton", "#334155", "#94a3b8", skeleton_icon), "tags": ["dnd_monsters", "undead", "skeleton"], "isVault": True },
    { "id": "preset_monster_beholder", "name": "Beholder Overseer Token", "category": "dnd_monsters", "type": "image", "imageUrl": make_token_svg("Beholder", "#3b0764", "#a855f7", beholder_icon), "tags": ["dnd_monsters", "beholder", "aberration"], "isVault": True },
    { "id": "preset_monster_lich", "name": "Lich Necromancer Token", "category": "dnd_monsters", "type": "image", "imageUrl": make_token_svg("Lich Lord", "#064e3b", "#10b981", lich_icon), "tags": ["dnd_monsters", "lich", "undead"], "isVault": True },
    { "id": "preset_monster_goblin", "name": "Goblin Raider Token", "category": "dnd_monsters", "type": "image", "imageUrl": make_token_svg("Goblin", "#1a2e05", "#84cc16", goblin_icon), "tags": ["dnd_monsters", "goblin"], "isVault": True },
    { "id": "preset_monster_orc", "name": "Orc Commander Token", "category": "dnd_monsters", "type": "image", "imageUrl": make_token_svg("Orc", "#142804", "#65a30d", orc_icon), "tags": ["dnd_monsters", "orc"], "isVault": True },

    # Animated FX (GIF / Animated SVGs)
    { "id": "preset_fx_fireball", "name": "Animated Fireball FX", "category": "animated_fx", "type": "image", "imageUrl": make_animated_fx_svg("Fireball", "#f97316", "#dc2626", "fireball"), "tags": ["animated_fx", "fire", "spell", "gif"], "isVault": True },
    { "id": "preset_fx_shield", "name": "Animated Arcane Barrier FX", "category": "animated_fx", "type": "image", "imageUrl": make_animated_fx_svg("Barrier", "#06b6d4", "#67e8f9", "shield"), "tags": ["animated_fx", "shield", "spell", "gif"], "isVault": True },
    { "id": "preset_fx_portal", "name": "Animated Void Portal FX", "category": "animated_fx", "type": "image", "imageUrl": make_animated_fx_svg("Portal", "#a855f7", "#c084fc", "portal"), "tags": ["animated_fx", "portal", "spell", "gif"], "isVault": True },
    { "id": "preset_fx_lightning", "name": "Animated Lightning Spark FX", "category": "animated_fx", "type": "image", "imageUrl": make_animated_fx_svg("Lightning", "#eab308", "#fde047", "lightning"), "tags": ["animated_fx", "lightning", "spell", "gif"], "isVault": True },
    { "id": "preset_fx_heal", "name": "Animated Holy Heal FX", "category": "animated_fx", "type": "image", "imageUrl": make_animated_fx_svg("Holy Heal", "#10b981", "#34d399", "heal"), "tags": ["animated_fx", "heal", "spell", "gif"], "isVault": True },
    { "id": "preset_fx_poison", "name": "Animated Poison Cloud FX", "category": "animated_fx", "type": "image", "imageUrl": make_animated_fx_svg("Poison Cloud", "#84cc16", "#a3e635", "poison"), "tags": ["animated_fx", "poison", "spell", "gif"], "isVault": True },
]

battlemaps = [
    { "id": "preset_map_catacombs_001", "name": "Catacombs 0001", "theme": "Dungeon", "url": make_map_svg("CATACOMBS 0001", "#f59e0b", "#ffffff", "dungeon"), "description": "Tactical Dungeon Catacombs Map", "created_at": "2026-07-29T18:00:00.000Z", "isVault": True },
    { "id": "preset_map_cavern_001", "name": "Cavern River 0001", "theme": "Cavern", "url": make_map_svg("CAVERN RIVER 0001", "#38bdf8", "#38bdf8", "cavern"), "description": "Subterranean Cavern & River Map", "created_at": "2026-07-29T18:00:00.000Z", "isVault": True },
    { "id": "preset_map_docks_001", "name": "Docks 0001", "theme": "Urban", "url": make_map_svg("DOCKS 0001", "#fbbf24", "#67e8f9", "docks"), "description": "Waterfront Harbor & Wooden Pier Map", "created_at": "2026-07-29T18:00:00.000Z", "isVault": True },
    { "id": "preset_map_forest_001", "name": "Forest Crossing 0001", "theme": "Wilderness", "url": make_map_svg("FOREST CROSSING 0001", "#4ade80", "#86efac", "forest"), "description": "Lush Woodland Dirt Path Battle Map", "created_at": "2026-07-29T18:00:00.000Z", "isVault": True },
    { "id": "preset_map_tavern_001", "name": "Tavern Hall 0001", "theme": "Urban", "url": make_map_svg("TAVERN HALL 0001", "#f59e0b", "#fde047", "tavern"), "description": "Warm Oak Tavern & Hearth Map", "created_at": "2026-07-29T18:00:00.000Z", "isVault": True },
    { "id": "preset_map_lava_001", "name": "Lava Chasm 0001", "theme": "Dungeon", "url": make_map_svg("LAVA CHASM 0001", "#ef4444", "#f87171", "lava"), "description": "Volcanic Obsidian & Lava Chasm Map", "created_at": "2026-07-29T18:00:00.000Z", "isVault": True }
]

if os.path.exists('uploads/vault_cliparts.json'):
    try:
        with open('uploads/vault_cliparts.json', 'r') as f:
            v_items = json.load(f)
            if isinstance(v_items, list) and len(v_items) > 0:
                cliparts = v_items
    except Exception as e:
        pass

content = f'''// Default Vault Presets loaded from Vault storage (SVG vector data URIs guarantee high reliability)
export const DEFAULT_VAULT_CLIPARTS = {json.dumps(cliparts, indent=2)};

export const DEFAULT_VAULT_BATTLEMAPS = {json.dumps(battlemaps, indent=2)};
'''

with open('frontend/src/data/vaultPresets.js', 'w') as f:
    f.write(content)

import os
os.makedirs('uploads', exist_ok=True)

# Merge cliparts safely without overwriting user uploads
cliparts_file = 'uploads/vault_cliparts.json'
existing_cliparts = []
if os.path.exists(cliparts_file):
    try:
        with open(cliparts_file, 'r') as f:
            existing_cliparts = json.load(f)
    except Exception as e:
        existing_cliparts = []

existing_ids = {item.get('id') for item in existing_cliparts if isinstance(item, dict) and item.get('id')}
for c in cliparts:
    if c.get('id') not in existing_ids:
        existing_cliparts.append(c)

with open(cliparts_file, 'w') as f:
    json.dump(existing_cliparts, f, indent=2)

# Merge battlemaps safely without overwriting user uploads
maps_file = 'uploads/vault_battlemaps.json'
existing_maps = []
if os.path.exists(maps_file):
    try:
        with open(maps_file, 'r') as f:
            existing_maps = json.load(f)
    except Exception as e:
        existing_maps = []

existing_map_ids = {item.get('id') for item in existing_maps if isinstance(item, dict) and item.get('id')}
for m in battlemaps:
    if m.get('id') not in existing_map_ids:
        existing_maps.append(m)

with open(maps_file, 'w') as f:
    json.dump(existing_maps, f, indent=2)

print("Successfully updated frontend/src/data/vaultPresets.js and safely merged uploads/vault_cliparts.json/vault_battlemaps.json")
