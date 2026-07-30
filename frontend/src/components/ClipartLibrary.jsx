import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import SessionContext from '../context/SessionContext';
import { DEFAULT_VAULT_CLIPARTS } from '../data/vaultPresets';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

export const getFallbackTokenSvg = (name = 'Token') => {
  const initial = (name || 'Token').trim().charAt(0).toUpperCase() || 'T';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="#1e293b" stroke="#38bdf8" stroke-width="3"/>
    <circle cx="32" cy="32" r="25" fill="none" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4,2"/>
    <text x="32" y="39" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const resolveAssetUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.origin === 'null')) {
    const backendHost = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
    return `${backendHost}${url.startsWith('/') ? url : '/' + url}`;
  }
  return url.startsWith('/') ? url : `/${url}`;
};

export const isGifAsset = (item) => {
  if (!item) return false;
  const url = String(item.imageUrl || item.url || item.imageData || item.image_data || item.src || '').toLowerCase();
  const cat = String(item.category || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  const id = String(item.id || '').toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags.map(t => String(t).toLowerCase()) : [];

  return (
    cat === 'animated_fx' ||
    cat === 'gif' ||
    cat === 'gifs' ||
    item.type === 'gif' ||
    id.startsWith('gif_') ||
    tags.includes('animated_fx') ||
    tags.includes('gif') ||
    tags.includes('gifs') ||
    url.includes('.gif') ||
    url.startsWith('data:image/gif') ||
    name.includes('gif') ||
    name.includes('animated')
  );
};

export const isTokenAsset = (item) => {
  if (!item) return false;
  if (isGifAsset(item)) return false;
  const cat = String(item.category || '').toLowerCase();
  const id = String(item.id || '').toLowerCase();
  return (
    cat === 'tokens' ||
    cat === 'dnd_heroes' ||
    cat === 'dnd_monsters' ||
    cat === 'hero_tokens' ||
    cat === 'monster_tokens' ||
    id.startsWith('token_') ||
    id.startsWith('preset_hero_') ||
    id.startsWith('preset_monster_')
  );
};
import { 
  X, 
  Star,
  Upload,
  Search,
  RotateCw,
  Maximize2,
  Trash2,
  GripVertical,
  ExternalLink,
  Minimize2,
  Layers
} from 'lucide-react';

// Helper to generate crisp, dark fantasy circular RPG tokens (SVG data URLs)
const makeTokenSvg = (ringColor, bg1, bg2, label, iconSvg) => {
  const labelClean = label.replace(/[^a-z0-9]/gi, '_');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <radialGradient id="bg_${labelClean}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="100%" stop-color="${bg2}" />
      </radialGradient>
      <linearGradient id="ring_${labelClean}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${ringColor}" />
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.8" />
        <stop offset="100%" stop-color="${ringColor}" />
      </linearGradient>
      <filter id="shadow_${labelClean}">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.8"/>
      </filter>
    </defs>
    <!-- Metallic Beveled Ring -->
    <circle cx="60" cy="60" r="58" fill="url(#ring_${labelClean})" stroke="#000" stroke-width="2"/>
    <circle cx="60" cy="60" r="51" fill="#090a0c" stroke="${ringColor}" stroke-dasharray="3,2" stroke-width="1.5"/>
    <!-- Inner Background Field -->
    <circle cx="60" cy="60" r="48" fill="url(#bg_${labelClean})"/>
    <circle cx="60" cy="60" r="46" fill="none" stroke="${ringColor}" stroke-opacity="0.3" stroke-width="1"/>
    <!-- Icon/Symbol -->
    <g transform="translate(60, 48)" filter="url(#shadow_${labelClean})">
      ${iconSvg}
    </g>
    <!-- Class/Monster Badge Banner -->
    <rect x="20" y="88" width="80" height="18" rx="4" fill="#08090b" stroke="${ringColor}" stroke-width="1.2"/>
    <text x="60" y="100.5" fill="${ringColor}" font-family="Cinzel, Georgia, serif, sans-serif" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="1">${label.toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// D&D Hero Token Images (realistic dark fantasy RPG tokens)
const DND_HERO_TOKENS = [
  { 
    id: 'token_fighter', 
    name: 'Fighter (Alistair)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#d4af37', '#3a1c1c', '#150808', 'Fighter', `<g fill="none" stroke="#d4af37" stroke-width="2.5" stroke-linecap="round"><path d="M-16,-16 L16,16 M-12,-16 L-16,-12 M12,16 L16,12 M-16,16 L16,-16 M-16,12 L-12,16 M16,-12 L12,-16"/></g>`)
  },
  { 
    id: 'token_wizard', 
    name: 'Wizard (Gandalf)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#38bdf8', '#1e1b4b', '#09081a', 'Wizard', `<g fill="none" stroke="#38bdf8" stroke-width="2.2"><circle cx="0" cy="-12" r="7" fill="#38bdf8" fill-opacity="0.3"/><path d="M0,2 L0,20 M-6,-12 L6,-12 M0,-19 L0,-5"/></g>`)
  },
  { 
    id: 'token_rogue', 
    name: 'Rogue (Sylas)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#a3e635', '#142a18', '#071009', 'Rogue', `<g fill="none" stroke="#a3e635" stroke-width="2.2"><path d="M-10,-16 L0,-4 L-10,16 M10,-16 L0,-4 L10,16"/></g>`)
  },
  { 
    id: 'token_cleric', 
    name: 'Cleric (Vesper)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#facc15', '#332308', '#110c03', 'Cleric', `<g fill="none" stroke="#facc15" stroke-width="2.2"><path d="M-12,-14 Q0,-18 12,-14 Q12,2 0,16 Q-12,2 -12,-14 Z"/><circle cx="0" cy="-1" r="4" fill="#facc15"/></g>`)
  },
  { 
    id: 'token_ranger', 
    name: 'Ranger (Lyra)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#4ade80', '#112e1a', '#051109', 'Ranger', `<g fill="none" stroke="#4ade80" stroke-width="2.2"><path d="M-12,-16 Q0,0 -12,16 M-12,-16 L12,0 L-12,16 M-16,0 L12,0"/></g>`)
  },
  { 
    id: 'token_paladin', 
    name: 'Paladin (Gideon)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#e2e8f0', '#1e293b', '#080c14', 'Paladin', `<g fill="none" stroke="#e2e8f0" stroke-width="2.2"><path d="M0,-16 L0,16 M-8,-8 L8,-8 M-6,10 L0,18 L6,10"/></g>`)
  },
  { 
    id: 'token_druid', 
    name: 'Druid (Elowen)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#86efac', '#143821', '#06140b', 'Druid', `<g fill="none" stroke="#86efac" stroke-width="2.2"><path d="M0,16 C-14,4 -12,-14 0,-18 C12,-14 14,4 0,16 Z M0,-18 L0,16"/></g>`)
  },
  { 
    id: 'token_bard', 
    name: 'Bard (Lumina)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#f472b6', '#3b0764', '#120221', 'Bard', `<g fill="none" stroke="#f472b6" stroke-width="2.2"><path d="M-9,-14 Q0,-6 9,-14 Q7,10 -9,10 Z M-3,-8 L-3,7 M0,-6 L0,8 M3,-8 L3,7"/></g>`)
  },
  { 
    id: 'token_barbarian', 
    name: 'Barbarian (Krog)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#f87171', '#450a0a', '#170303', 'Barbarian', `<g fill="none" stroke="#f87171" stroke-width="2.2"><path d="M-14,-14 Q-2,-6 -14,2 L-14,-14 Z M14,-14 Q2,-6 14,2 L14,-14 Z M0,-18 L0,18"/></g>`)
  },
  { 
    id: 'token_sorcerer', 
    name: 'Sorcerer (Ignis)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#fb923c', '#431407', '#170602', 'Sorcerer', `<g fill="none" stroke="#fb923c" stroke-width="2.2"><path d="M0,14 Q-10,2 -3,-8 Q-10,-14 0,-20 Q10,-14 3,-8 Q10,2 0,14 Z" fill="#fb923c" fill-opacity="0.3"/></g>`)
  },
  { 
    id: 'token_warlock', 
    name: 'Warlock (Malakor)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#c084fc', '#2e1065', '#0f0424', 'Warlock', `<g fill="none" stroke="#c084fc" stroke-width="2.2"><path d="M-14,0 Q0,-12 14,0 Q0,12 -14,0 Z"/><circle cx="0" cy="0" r="4" fill="#c084fc"/></g>`)
  },
  { 
    id: 'token_monk', 
    name: 'Monk (Shen)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#fbbf24', '#3b2f05', '#120e01', 'Monk', `<g fill="none" stroke="#fbbf24" stroke-width="2.2"><circle cx="0" cy="0" r="13"/><path d="M0,-13 A6.5,6.5 0 0,1 0,0 A6.5,6.5 0 0,0 0,13"/></g>`)
  },
  { 
    id: 'token_artificer', 
    name: 'Artificer (Tink)', 
    category: 'dnd_heroes', 
    type: 'image', 
    imageUrl: makeTokenSvg('#2dd4bf', '#042f2e', '#011212', 'Artificer', `<g fill="none" stroke="#2dd4bf" stroke-width="2.2"><path d="M-5,-12 L5,-12 L5,-5 L10,7 Q12,14 0,14 Q-12,14 -10,7 L-5,-5 Z"/></g>`)
  },
];

// D&D Monster Token Images (realistic dark fantasy RPG tokens)
const DND_MONSTER_TOKENS = [
  { 
    id: 'token_dragon', 
    name: 'Red Dragon (Ancient)', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#ef4444', '#450a0a', '#110101', 'Red Dragon', `<g fill="none" stroke="#ef4444" stroke-width="2.2"><path d="M-12,12 Q-14,-10 0,-18 Q14,-10 12,12 Q0,16 -12,12 Z M-8,-8 L-14,-16 M8,-8 L14,-16"/><circle cx="0" cy="0" r="3" fill="#ef4444"/></g>`)
  },
  { 
    id: 'token_beholder', 
    name: 'Beholder', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#a855f7', '#3b0764', '#10011f', 'Beholder', `<g fill="none" stroke="#a855f7" stroke-width="2.2"><circle cx="0" cy="2" r="10"/><circle cx="0" cy="2" r="4" fill="#a855f7"/><path d="M-10,-4 L-14,-14 M-4,-8 L-6,-16 M4,-8 L6,-16 M10,-4 L14,-14"/></g>`)
  },
  { 
    id: 'token_illithid', 
    name: 'Mind Flayer (Illithid)', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#818cf8', '#1e1b4b', '#070617', 'Illithid', `<g fill="none" stroke="#818cf8" stroke-width="2.2"><path d="M-10,-12 Q0,-18 10,-12 Q8,0 0,14 Q-8,0 -10,-12 Z M-6,0 Q-8,14 -4,18 M-2,2 Q-2,14 0,18 M2,2 Q2,14 0,18 M6,0 Q8,14 4,18"/></g>`)
  },
  { 
    id: 'token_lich', 
    name: 'Lich Lord', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#10b981', '#064e3b', '#011710', 'Lich Lord', `<g fill="none" stroke="#10b981" stroke-width="2.2"><path d="M-8,-6 Q0,-14 8,-6 Q10,4 0,12 Q-10,4 -8,-6 Z M-10,-14 L-4,-6 L0,-16 L4,-6 L10,-14"/><circle cx="-3" cy="-2" r="2" fill="#10b981"/><circle cx="3" cy="-2" r="2" fill="#10b981"/></g>`)
  },
  { 
    id: 'token_goblin', 
    name: 'Goblin Scout', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#84cc16', '#1a2e05', '#080e01', 'Goblin', `<g fill="none" stroke="#84cc16" stroke-width="2.2"><path d="M-12,-4 L-18,-14 L-6,-6 L6,-6 L18,-14 L12,-4 L0,12 Z"/><circle cx="-4" cy="-2" r="2" fill="#84cc16"/><circle cx="4" cy="-2" r="2" fill="#84cc16"/></g>`)
  },
  { 
    id: 'token_orc', 
    name: 'Orc Berserker', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#65a30d', '#142804', '#060c01', 'Orc', `<g fill="none" stroke="#65a30d" stroke-width="2.2"><path d="M-10,-10 L10,-10 L12,4 L0,14 L-12,4 Z M-6,8 L-6,2 M6,8 L6,2"/></g>`)
  },
  { 
    id: 'token_skeleton', 
    name: 'Skeleton Warrior', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#cbd5e1', '#0f172a', '#030712', 'Skeleton', `<g fill="none" stroke="#cbd5e1" stroke-width="2.2"><path d="M-8,-10 Q0,-16 8,-10 Q10,2 0,10 Q-10,2 -8,-10 Z M-6,10 L6,10 M-4,14 L4,14"/><circle cx="-3" cy="-4" r="2" fill="#cbd5e1"/><circle cx="3" cy="-4" r="2" fill="#cbd5e1"/></g>`)
  },
  { 
    id: 'token_vampire', 
    name: 'Vampire Noble', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#f43f5e', '#4c0519', '#140106', 'Vampire', `<g fill="none" stroke="#f43f5e" stroke-width="2.2"><path d="M-16,-10 Q0,-18 16,-10 Q8,4 0,14 Q-8,4 -16,-10 Z M-4,4 L-2,10 M4,4 L2,10"/></g>`)
  },
  { 
    id: 'token_golem', 
    name: 'Stone Golem', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#94a3b8', '#1e293b', '#070b12', 'Stone Golem', `<g fill="none" stroke="#94a3b8" stroke-width="2.5"><rect x="-10" y="-12" width="20" height="24" rx="3"/><line x1="-6" y1="-4" x2="6" y2="-4"/><line x1="-3" y1="4" x2="3" y2="4"/></g>`)
  },
  { 
    id: 'token_mimic', 
    name: 'Mimic Chest', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#d97706', '#451a03', '#140701', 'Mimic', `<g fill="none" stroke="#d97706" stroke-width="2.2"><rect x="-12" y="-8" width="24" height="18" rx="2"/><path d="M-12,-8 Q0,-14 12,-8 M-8,2 Q0,16 8,2"/></g>`)
  },
  { 
    id: 'token_owlbear', 
    name: 'Owlbear', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#b45309', '#3f1a02', '#120700', 'Owlbear', `<g fill="none" stroke="#b45309" stroke-width="2.2"><circle cx="0" cy="-2" r="11"/><path d="M-6,-4 L-2,-1 L-6,2 M6,-4 L2,-1 L6,2 M-2,2 L0,8 L2,2"/></g>`)
  },
  { 
    id: 'token_kobold', 
    name: 'Kobold Trapper', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#f97316', '#431407', '#120401', 'Kobold', `<g fill="none" stroke="#f97316" stroke-width="2.2"><path d="M-10,10 L-14,-10 L0,-16 L14,-10 L10,10 Z"/></g>`)
  },
  { 
    id: 'token_demon', 
    name: 'Demon Lord', 
    category: 'dnd_monsters', 
    type: 'image', 
    imageUrl: makeTokenSvg('#dc2626', '#450a0a', '#140101', 'Demon Lord', `<g fill="none" stroke="#dc2626" stroke-width="2.2"><path d="M-8,-6 Q0,-12 8,-6 Q10,6 0,14 Q-10,6 -8,-6 Z M-8,-6 L-16,-16 M8,-6 L16,-16"/></g>`)
  },
];

// D&D Dungeon Props & Objects
const DND_DUNGEON_PROPS = [
  { id: 'dnd_chest', name: 'Treasure Chest', category: 'dnd_dungeon', emoji: '📦', type: 'emoji' },
  { id: 'dnd_door', name: 'Dungeon Iron Door', category: 'dnd_dungeon', emoji: '🚪', type: 'emoji' },
  { id: 'dnd_altar', name: 'Arcane Altar', category: 'dnd_dungeon', emoji: '🏛️', type: 'emoji' },
  { id: 'dnd_campfire', name: 'Rest Campfire', category: 'dnd_dungeon', emoji: '🔥', type: 'emoji' },
  { id: 'dnd_tome', name: 'Spellbook Tome', category: 'dnd_dungeon', emoji: '📖', type: 'emoji' },
  { id: 'dnd_trap', name: 'Trap Trigger', category: 'dnd_dungeon', emoji: '⚡', type: 'emoji' },
  { id: 'dnd_barrel', name: 'Dungeon Barrel', category: 'dnd_dungeon', emoji: '🛢️', type: 'emoji' },
  { id: 'dnd_tomb', name: 'Sarcophagus', category: 'dnd_dungeon', emoji: '⚰️', type: 'emoji' },
  { id: 'dnd_torch', name: 'Wall Torch', category: 'dnd_dungeon', emoji: '🕯️', type: 'emoji' },
];

// D&D 5e Conditions & Status Badges
const DND_CONDITIONS = [
  { id: 'cond_concentration', name: 'Concentration', category: 'dnd_conditions', emoji: '✨', type: 'emoji' },
  { id: 'cond_poisoned', name: 'Poisoned', category: 'dnd_conditions', emoji: '☠️', type: 'emoji' },
  { id: 'cond_stunned', name: 'Stunned', category: 'dnd_conditions', emoji: '😵', type: 'emoji' },
  { id: 'cond_charmed', name: 'Charmed', category: 'dnd_conditions', emoji: '💖', type: 'emoji' },
  { id: 'cond_paralyzed', name: 'Paralyzed', category: 'dnd_conditions', emoji: '⚡', type: 'emoji' },
  { id: 'cond_blinded', name: 'Blinded', category: 'dnd_conditions', emoji: '👁️‍🗨️', type: 'emoji' },
  { id: 'cond_restrained', name: 'Restrained', category: 'dnd_conditions', emoji: '⛓️', type: 'emoji' },
  { id: 'cond_frightened', name: 'Frightened', category: 'dnd_conditions', emoji: '😱', type: 'emoji' },
  { id: 'cond_bleeding', name: 'Bleeding', category: 'dnd_conditions', emoji: '🩸', type: 'emoji' },
  { id: 'cond_unconscious', name: 'Unconscious', category: 'dnd_conditions', emoji: '💤', type: 'emoji' },
];

// Default clipart items - populated strictly with Vault assets
const DEFAULT_CLIPARTS = DEFAULT_VAULT_CLIPARTS.map(item => ({
  ...item,
  isVault: true
}));

const CATEGORIES = [
  { id: 'all', name: 'All D&D Assets' },
  { id: 'vault', name: 'Vault Assets ⭐' },
  { id: 'favorites', name: 'Favorites' },
  { id: 'animated_fx', name: 'Animated FX' },
  { id: 'dnd_heroes', name: 'Hero Tokens' },
  { id: 'dnd_monsters', name: 'Monster Tokens' },
  { id: 'dnd_dungeon', name: 'Dungeon Props' },
  { id: 'dnd_conditions', name: '5e Conditions' },
  { id: 'custom', name: 'My Uploads' },
];

export const ClipartLibrary = ({ 
  isOpen, 
  onClose, 
  onSelectClipart,
  favorites = [],
  onToggleFavorite,
  customCliparts = [],
  onAddCustomClipart,
  onRemoveCustomClipart,
  isDocked = false,
  onDockChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [draggedItem, setDraggedItem] = useState(null);
  const fileInputRef = useRef(null);
  const isElectronWindow = !!window.electronAPI?.isElectron && new URLSearchParams(window.location.search).get('mode') === 'clipart';

  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlNameInput, setUrlNameInput] = useState('');

  const handleAddFromUrl = () => {
    if (!urlInput.trim()) return;
    const name = urlNameInput.trim() || urlInput.split('/').pop()?.split('?')[0] || 'Custom Link';
    
    const customItem = {
      id: `custom_${Date.now()}_url`,
      name: name.replace(/\.[^/.]+$/, ''),
      category: 'custom',
      type: 'image',
      imageUrl: urlInput.trim(),
      isCustom: true,
      width: 128,
      height: 128,
    };

    onAddCustomClipart?.(customItem);
    setUrlInput('');
    setUrlNameInput('');
    setShowUrlForm(false);
  };
  
  // Draggable window state
  const [position, setPosition] = useState({ x: 360, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Global admin added cliparts & GIFs
  const [globalAdminCliparts, setGlobalAdminCliparts] = useState([]);

  useEffect(() => {
    const fetchGlobalCliparts = async () => {
      try {
        const res = await fetch('/api/library/cliparts');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.cliparts)) {
            setGlobalAdminCliparts(data.cliparts);
          }
        }
      } catch (e) {
        // silent catch
      }
    };

    fetchGlobalCliparts();

    const handleUpdate = () => fetchGlobalCliparts();
    window.addEventListener('krajden_library_updated', handleUpdate);
    
    // Poll every 5 seconds so any tokens added in admin page appear immediately
    const interval = setInterval(fetchGlobalCliparts, 5000);

    return () => {
      window.removeEventListener('krajden_library_updated', handleUpdate);
      clearInterval(interval);
    };
  }, [isOpen]);

  // Standardize & normalize clipart item properties (imageUrl, url, imageData, image_data, src)
  const normalizeClipartItem = useCallback((item, isDefaultVault = false) => {
    if (!item) return null;
    const url = item.imageUrl || item.url || item.imageData || item.image_data || item.src || '';
    const isVault = item.isVault !== undefined ? Boolean(item.isVault) : (isDefaultVault || !item.isCustom);
    const category = item.category || 'animated_fx';
    return {
      ...item,
      id: String(item.id || `clipart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
      name: String(item.name || 'Untitled Token').trim(),
      category: String(category).trim(),
      type: item.type || (item.emoji ? 'emoji' : 'image'),
      imageUrl: url,
      imageData: item.imageData || (url.startsWith('data:') ? url : undefined),
      isVault,
      isCustom: Boolean(item.isCustom),
      tags: Array.isArray(item.tags) ? item.tags : [category],
    };
  }, []);

  // Tag global admin cliparts as Vault assets
  const taggedGlobalAdmin = globalAdminCliparts.map(g => normalizeClipartItem({ ...g, isVault: true }, true));
  const normalizedCustom = customCliparts.map(c => normalizeClipartItem({ ...c, isCustom: true }));
  const normalizedDefault = DEFAULT_CLIPARTS.map(d => normalizeClipartItem(d, true));

  // Combine admin vault, user custom, and default cliparts with deduplication
  const clipartMap = new Map();
  [...taggedGlobalAdmin, ...normalizedCustom, ...normalizedDefault].forEach(item => {
    if (item && item.id && !clipartMap.has(item.id)) {
      clipartMap.set(item.id, item);
    }
  });
  const allCliparts = Array.from(clipartMap.values());

  // Delete an item directly from the Global Vault
  const handleDeleteVaultItem = async (itemId) => {
    try {
      await fetch(`/api/admin/library/clipart/${itemId}`, { method: 'DELETE' });
      setGlobalAdminCliparts(prev => prev.filter(i => i.id !== itemId));
      toast.success('Removed asset from vault');
    } catch (e) {
      toast.error('Failed to delete vault asset');
    }
  };

  // Filter cliparts based on search and category
  const filteredCliparts = allCliparts.filter(item => {
    const nameStr = (item.name || '').toLowerCase();
    const searchStr = searchQuery.trim().toLowerCase();
    const matchesSearch = searchStr === '' || nameStr.includes(searchStr);
    
    if (!matchesSearch) return false;
    
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'vault') {
      return item.isVault || item.id?.startsWith('admin_clipart_') || item.id?.startsWith('preset_') || item.id?.startsWith('token_') || item.id?.startsWith('gif_') || item.id?.startsWith('dnd_') || item.id?.startsWith('cond_');
    }
    if (selectedCategory === 'favorites') return favorites.includes(item.id);
    if (selectedCategory === 'custom') return item.isCustom;
    
    const cat = (item.category || '').toLowerCase();
    const tags = Array.isArray(item.tags) ? item.tags.map(t => String(t).toLowerCase()) : [];
    const urlStr = (item.imageUrl || item.url || '').toLowerCase();

    if (selectedCategory === 'animated_fx') {
      return (
        cat === 'animated_fx' ||
        cat === 'gif' ||
        cat === 'gifs' ||
        item.id?.startsWith('gif_') ||
        tags.includes('animated_fx') ||
        tags.includes('gif') ||
        tags.includes('gifs') ||
        urlStr.includes('.gif') ||
        urlStr.startsWith('data:image/gif') ||
        nameStr.includes('gif') ||
        nameStr.includes('animated') ||
        nameStr.includes('fx') ||
        nameStr.includes('spell') ||
        nameStr.includes('aura') ||
        nameStr.includes('portal') ||
        nameStr.includes('fireball') ||
        nameStr.includes('lightning')
      );
    }

    if (selectedCategory === 'dnd_heroes') {
      return (
        cat === 'dnd_heroes' ||
        cat === 'hero_tokens' ||
        cat === 'heroes' ||
        tags.includes('dnd_heroes') ||
        tags.includes('hero') ||
        (item.id?.startsWith('token_') && ['fighter','wizard','rogue','cleric','ranger','paladin','druid','bard','barbarian','sorcerer','warlock','monk','artificer'].some(h => item.id.includes(h) || nameStr.includes(h)))
      );
    }

    if (selectedCategory === 'dnd_monsters') {
      return (
        cat === 'dnd_monsters' ||
        cat === 'monster_tokens' ||
        cat === 'monsters' ||
        tags.includes('dnd_monsters') ||
        tags.includes('monster') ||
        (item.id?.startsWith('token_') && ['dragon','beholder','illithid','lich','goblin','orc','skeleton','vampire','golem','mimic','owlbear','kobold','demon'].some(m => item.id.includes(m) || nameStr.includes(m)))
      );
    }

    if (selectedCategory === 'dnd_dungeon') {
      return cat === 'dnd_dungeon' || cat === 'dungeon_props' || cat === 'props' || tags.includes('dnd_dungeon') || item.id?.startsWith('dnd_');
    }

    if (selectedCategory === 'dnd_conditions') {
      return cat === 'dnd_conditions' || cat === 'conditions' || tags.includes('dnd_conditions') || item.id?.startsWith('cond_');
    }

    return cat === selectedCategory || tags.includes(selectedCategory);
  });

  const handleDragStart = (e, item) => {
    const normalized = normalizeClipartItem(item);
    setDraggedItem(normalized);
    e.dataTransfer.setData('application/json', JSON.stringify(normalized));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const [isDragOver, setIsDragOver] = useState(false);

  // Helper to process files (from file input or drag-and-drop)
  const processFiles = async (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const backendUrl = window.location.origin;
        const res = await fetch(`${backendUrl}/api/cliparts/upload`, {
          method: 'POST',
          body: formData
        });
        
        if (res.ok) {
          const data = await res.json();
          const img = new Image();
          img.onload = () => {
            const customItem = {
              id: `custom_${Date.now()}_${i}`,
              name: data.name || file.name.replace(/\.[^/.]+$/, ''),
              category: 'custom',
              type: 'image',
              imageUrl: data.url,
              width: img.width,
              height: img.height,
              isCustom: true,
            };
            onAddCustomClipart?.(customItem);
          };
          img.src = data.url;
          successCount++;
          continue;
        }
      } catch (err) {
        console.warn('Backend upload failed, falling back to base64:', err);
      }

      // Fallback to base64
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const customItem = {
              id: `custom_${Date.now()}_${i}_fb`,
              name: file.name.replace(/\.[^/.]+$/, ''),
              category: 'custom',
              type: 'image',
              imageData: event.target.result,
              width: img.width,
              height: img.height,
              isCustom: true,
            };
            onAddCustomClipart?.(customItem);
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully added ${successCount} GIF(s)/Token(s) to your library!`);
    }
    if (failCount > 0) {
      toast.error(`Failed to add ${failCount} file(s).`);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle single or batch file upload from input
  const handleFileUpload = (e) => {
    processFiles(e.target.files);
  };

  const handleLibraryDragOver = (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleLibraryDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleLibraryDrop = (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      setIsDragOver(false);
      processFiles(e.dataTransfer.files);
    }
  };

  // Handle window dragging
  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 260)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 400)),
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isDocked && !isOpen) return null;

  return (
    <div 
      className={isDocked 
        ? "relative w-full bg-white/2 border border-white/10 rounded-xl flex flex-col overflow-hidden h-[380px]"
        : isElectronWindow 
          ? "relative w-full h-full bg-[#0d0d0f] flex flex-col"
          : "relative fixed z-[9998] bg-[#0d0d0f]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl w-[320px] max-h-[600px] flex flex-col"}
      style={(isDocked || isElectronWindow) ? undefined : { left: position.x, top: position.y }}
      onMouseDown={(isDocked || isElectronWindow) ? undefined : handleMouseDown}
      onDragOver={handleLibraryDragOver}
      onDragLeave={handleLibraryDragLeave}
      onDrop={handleLibraryDrop}
      data-testid="clipart-library-window"
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-cyan-950/90 backdrop-blur-md border-2 border-dashed border-cyan-400 rounded-xl flex flex-col items-center justify-center p-4 text-center pointer-events-none">
          <Upload className="w-10 h-10 text-cyan-400 animate-bounce mb-2" />
          <p className="text-sm font-bold text-white">Drop GIF or Token Files Here!</p>
          <p className="text-xs text-cyan-200/80 mt-1">They will be automatically saved directly into your Token Library</p>
        </div>
      )}
      {/* Header */}
      <div 
        className={`${(!isDocked && !isElectronWindow) ? "drag-handle cursor-move bg-white/5" : "bg-white/2"} flex items-center justify-between p-2 border-b border-white/10 rounded-t-xl`} 
        style={isElectronWindow ? { WebkitAppRegion: 'drag' } : undefined}
      >
        <div className="flex items-center gap-1.5 select-none">
          {!isDocked && !isElectronWindow && <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-xs font-semibold text-white">📚 Token Library</span>
        </div>
        <div className="flex items-center gap-0.5">
          {onDockChange && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDockChange(!isDocked)}
              className="h-5 w-5 text-white/60 hover:text-white hover:bg-white/10"
              title={isDocked ? "Undock / Detach window" : "Dock back to Main Menu"}
            >
              {isDocked ? <ExternalLink className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </Button>
          )}
          {!isDocked && (
            <Button
              variant="ghost"
              size="icon"
              onClick={isElectronWindow ? () => window.close() : onClose}
              className="h-5 w-5 text-white/60 hover:text-white hover:bg-white/10"
              style={isElectronWindow ? { WebkitAppRegion: 'no-drag' } : undefined}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Search, File Upload & URL Import */}
      <div className="p-2 border-b border-white/10 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
          <Input
            placeholder="Search cliparts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/gif,.gif"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 text-xs border-white/10 hover:bg-white/10 flex items-center justify-center cursor-pointer text-white"
          >
            <Upload className="w-3 h-3 mr-1" />
            File Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUrlForm(!showUrlForm)}
            className={`h-7 text-xs flex items-center justify-center cursor-pointer ${showUrlForm ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30' : 'border-white/10 hover:bg-white/10 text-white'}`}
          >
            <span className="text-[10px] mr-1">🔗</span>
            Link / GIF URL
          </Button>
        </div>

        {showUrlForm && (
          <div className="p-2 bg-black/40 border border-white/5 rounded space-y-2">
            <div>
              <label className="text-[9px] text-gray-400 uppercase tracking-widest block mb-0.5">Asset URL (supports .gif, .png, .jpg)</label>
              <Input
                type="text"
                placeholder="e.g. https://example.com/spell.gif"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-[9px] text-gray-400 uppercase tracking-widest block mb-0.5">Clipart Name</label>
              <Input
                type="text"
                placeholder="e.g. Fire Elemental"
                value={urlNameInput}
                onChange={(e) => setUrlNameInput(e.target.value)}
                className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
              />
            </div>
            <Button
              size="sm"
              onClick={handleAddFromUrl}
              className="w-full h-6 bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/25 hover:bg-[#00F0FF]/30 hover:text-white cursor-pointer text-[10px] font-semibold"
            >
              Add Clipart to Library
            </Button>
          </div>
        )}

        <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-2 text-[10px] text-cyan-200/90 leading-relaxed flex gap-2 items-start mt-1">
          <span className="text-[12px] shrink-0">💡</span>
          <div>
            <strong className="text-cyan-400">GIF Library Tip:</strong> You can select <span className="font-semibold text-white underline decoration-cyan-400/40">multiple</span> files or animated GIFs at once in the <strong className="text-white">File Upload</strong> dialog to instantly batch-add them! Transparent GIFs look best as tokens.
          </div>
        </div>
      </div>

      {/* Categories - All visible with wrapping */}
      <div className="p-2 border-b border-white/10 flex gap-1 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors whitespace-nowrap ${
              selectedCategory === cat.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
            }`}
          >
            {cat.id === 'favorites' && '* '}
            {cat.name}
          </button>
        ))}
      </div>

      {/* Clipart Grid - Compact */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-1.5">
          {filteredCliparts.map(item => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onClick={() => onSelectClipart?.(normalizeClipartItem(item))}
              className="relative group aspect-square bg-white/5 rounded-lg flex items-center justify-center cursor-grab hover:bg-white/10 transition-colors border border-transparent hover:border-cyan-500/40"
              title={`${item.name} - Drag to grid or click to place`}
            >
              {item.type === 'emoji' ? (
                <span className="text-2xl">{item.emoji}</span>
              ) : (
                <img 
                  src={resolveAssetUrl(item.imageUrl || item.imageData || item.url || item.src)} 
                  alt={item.name}
                  className={`w-10 h-10 ${isTokenAsset(item) ? 'object-cover rounded-full border border-white/30' : 'object-contain rounded'}`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getFallbackTokenSvg(item.name);
                  }}
                  referrerPolicy="no-referrer"
                />
              )}
              
              {/* Vault badge */}
              {item.isVault && (
                <span className="absolute top-0.5 left-0.5 bg-yellow-500/80 text-black text-[7px] font-bold px-1 rounded shadow" title="Vault Asset">
                  VAULT
                </span>
              )}

              {/* Favorite button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite?.(item.id);
                }}
                className={`absolute top-0 right-0 w-4 h-4 rounded-full flex items-center justify-center transition-opacity ${
                  favorites.includes(item.id)
                    ? 'opacity-100 text-yellow-400'
                    : 'opacity-0 group-hover:opacity-100 text-white/40 hover:text-yellow-400'
                }`}
              >
                <Star className="w-2.5 h-2.5" fill={favorites.includes(item.id) ? 'currentColor' : 'none'} />
              </button>
              
              {/* Delete button for custom or vault items */}
              {(item.isCustom || item.isVault) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.isVault) {
                      handleDeleteVaultItem(item.id);
                    } else {
                      onRemoveCustomClipart?.(item.id);
                    }
                  }}
                  className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity bg-black/80"
                  title="Remove asset"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {filteredCliparts.length === 0 && (
          <div className="text-center text-white/40 py-4 text-xs">
            No cliparts found
          </div>
        )}
      </div>

      {/* Footer hint - Compact */}
      <div className="p-2 border-t border-white/10 text-center text-[10px] text-white/40">
        Drag onto grid or click to place
      </div>
    </div>
  );
};

// Placed clipart on canvas - shows controls when selected
// Supports pinch-to-zoom and two-finger rotate on mobile (same as PlacedBackgroundImage)

const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const getClipartTouchDistance = (t1, t2) =>
  Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

const getClipartTouchAngle = (t1, t2) =>
  Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

export const PlacedClipart = ({
  clipart,
  isSelected,
  onSelect,
  onUpdate,
  onLiveMove,
  onDelete,
  canEdit = true,
  disabled = false,
  snapToGrid = false,
  gridCellWidth = 50,
  gridCellHeight = 50,
  groupDragOffset = null,
  onDragStartExtra,
  onDragMoveExtra,
  onDragEndExtra,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, clipX: 0, clipY: 0 });
  const [localScale, setLocalScale] = useState(clipart.scale || 50);
  const [localRotation, setLocalRotation] = useState(clipart.rotation || 0);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const clipSize = localScale;
  const clipRotation = localRotation;
  const containerRef = useRef(null);
  const toolbarRef = useRef(null);
  const liveMoveThrottleRef = useRef(0);

  // Pinch/rotate gesture state
  const gestureRef = useRef({ active: false, startDist: 0, startAngle: 0, startScale: 0, startRotation: 0 });

  // Sync local state with clipart prop when not adjusting
  useEffect(() => {
    if (!isAdjusting) {
      setLocalScale(clipart.scale || 50);
      setLocalRotation(clipart.rotation || 0);
    }
  }, [clipart.scale, clipart.rotation, isAdjusting]);

  const snapPosition = useCallback((x, y) => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / gridCellWidth) * gridCellWidth,
      y: Math.round(y / gridCellHeight) * gridCellHeight,
    };
  }, [snapToGrid, gridCellWidth, gridCellHeight]);

  // === MOUSE DRAG (desktop) ===
  const handleMouseDown = (e) => {
    if (!canEdit || disabled) return;
    e.stopPropagation();
    onSelect?.(e);
    setIsDragging(true);
    setDragOffset({ dx: 0, dy: 0 });
    dragStartRef.current = { x: e.clientX, y: e.clientY, clipX: clipart.x, clipY: clipart.y };
    if (onDragStartExtra) onDragStartExtra(clipart);
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setDragOffset({ dx, dy });
    if (onDragMoveExtra) onDragMoveExtra(dx, dy);
  }, [isDragging, onDragMoveExtra]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const newX = dragStartRef.current.clipX + dragOffset.dx;
    const newY = dragStartRef.current.clipY + dragOffset.dy;
    const pos = snapToGrid ? snapPosition(newX, newY) : { x: newX, y: newY };
    if (dragOffset.dx !== 0 || dragOffset.dy !== 0) {
      onUpdate?.({ ...clipart, x: pos.x, y: pos.y });
    }
    if (onDragEndExtra) onDragEndExtra(dragOffset.dx, dragOffset.dy);
    setDragOffset({ dx: 0, dy: 0 });
  }, [isDragging, dragOffset, snapToGrid, snapPosition, clipart, onUpdate, onDragEndExtra]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // === TOUCH: 1-finger drag + 2-finger pinch/rotate ===
  const handleTouchStart = (e) => {
    if (!canEdit || disabled) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect?.();

    if (e.touches.length === 2) {
      // Start pinch/rotate
      setIsDragging(false);
      gestureRef.current = {
        active: true,
        startDist: getClipartTouchDistance(e.touches[0], e.touches[1]),
        startAngle: getClipartTouchAngle(e.touches[0], e.touches[1]),
        startScale: localScale,
        startRotation: localRotation,
      };
      setIsAdjusting(true);
    } else if (e.touches.length === 1) {
      // Single-finger drag
      setIsDragging(true);
      setDragOffset({ dx: 0, dy: 0 });
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        clipX: clipart.x,
        clipY: clipart.y,
      };
    }
  };

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && gestureRef.current.active) {
      e.preventDefault();
      const newDist = getClipartTouchDistance(e.touches[0], e.touches[1]);
      const newAngle = getClipartTouchAngle(e.touches[0], e.touches[1]);
      const scaleFactor = newDist / gestureRef.current.startDist;
      const newScale = Math.max(20, Math.min(500, Math.round(gestureRef.current.startScale * scaleFactor)));
      const angleDiff = newAngle - gestureRef.current.startAngle;
      const newRotation = Math.round((gestureRef.current.startRotation + angleDiff + 360) % 360);
      setLocalScale(newScale);
      setLocalRotation(newRotation);
    } else if (isDragging && e.touches.length === 1) {
      setDragOffset({
        dx: e.touches[0].clientX - dragStartRef.current.x,
        dy: e.touches[0].clientY - dragStartRef.current.y,
      });
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback((e) => {
    if (gestureRef.current.active && (!e.touches || e.touches.length < 2)) {
      gestureRef.current.active = false;
      setIsAdjusting(false);
      onUpdate?.({ ...clipart, scale: localScale, rotation: localRotation });
    }
    if (isDragging && (!e.touches || e.touches.length === 0)) {
      setIsDragging(false);
      const newX = dragStartRef.current.clipX + dragOffset.dx;
      const newY = dragStartRef.current.clipY + dragOffset.dy;
      const pos = snapToGrid ? snapPosition(newX, newY) : { x: newX, y: newY };
      if (dragOffset.dx !== 0 || dragOffset.dy !== 0) {
        onUpdate?.({ ...clipart, x: pos.x, y: pos.y });
        if (onLiveMove) onLiveMove({ x: pos.x, y: pos.y, scale: clipart.scale, rotation: clipart.rotation });
      }
      setDragOffset({ dx: 0, dy: 0 });
    }
  }, [isDragging, dragOffset, snapToGrid, snapPosition, clipart, onUpdate, onLiveMove, localScale, localRotation]);

  // Register touch listeners with passive: false
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !canEdit || disabled) return;
    const opts = { passive: false };
    const wrappedTouchStart = (e) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target)) return;
      handleTouchStart(e);
    };
    const wrappedTouchMove = (e) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target)) return;
      handleTouchMove(e);
    };
    const wrappedTouchEnd = (e) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target)) return;
      handleTouchEnd(e);
    };
    el.addEventListener('touchstart', wrappedTouchStart, opts);
    el.addEventListener('touchmove', wrappedTouchMove, opts);
    el.addEventListener('touchend', wrappedTouchEnd);
    return () => {
      el.removeEventListener('touchstart', wrappedTouchStart, opts);
      el.removeEventListener('touchmove', wrappedTouchMove);
      el.removeEventListener('touchend', wrappedTouchEnd);
    };
  });

  const valuesRef = useRef({ scale: localScale, rotation: localRotation });
  useEffect(() => {
    valuesRef.current = { scale: localScale, rotation: localRotation };
  }, [localScale, localRotation]);

  const commitChanges = useCallback(() => {
    setIsAdjusting(false);
    onUpdate?.({ ...clipart, scale: valuesRef.current.scale, rotation: valuesRef.current.rotation });
  }, [clipart, onUpdate]);

  // Handle global/window mouseup and touchend when adjusting to prevent "stuck" sliders
  useEffect(() => {
    if (!isAdjusting) return;

    const handleWindowMouseUp = () => {
      commitChanges();
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchend', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchend', handleWindowMouseUp);
    };
  }, [isAdjusting, commitChanges]);

  const effectiveDx = isDragging ? dragOffset.dx : (groupDragOffset ? groupDragOffset.dx : 0);
  const effectiveDy = isDragging ? dragOffset.dy : (groupDragOffset ? groupDragOffset.dy : 0);
  const posX = clipart.x + effectiveDx;
  const posY = clipart.y + effectiveDy;
  const isTouch = isTouchDevice();

  const sessionContext = useContext(SessionContext);
  const initiativeList = sessionContext?.initiativeList || [];
  const currentTurnIndex = sessionContext?.currentTurnIndex !== undefined ? sessionContext?.currentTurnIndex : -1;
  const activeCombatant = initiativeList && currentTurnIndex >= 0 ? initiativeList[currentTurnIndex] : null;
  const isActiveTurn = activeCombatant && clipart.name && activeCombatant.name && clipart.name.toLowerCase().trim() === activeCombatant.name.toLowerCase().trim();
  const matchingCombatant = initiativeList.find(c => c.name && clipart.name && c.name.toLowerCase().trim() === clipart.name.toLowerCase().trim());
  const activeConditions = matchingCombatant?.conditions || [];

  return (
    <div
      ref={containerRef}
      className={`absolute select-none ${isSelected ? 'z-20' : 'z-10'} ${disabled ? '' : 'cursor-move'}`}
      style={{
        left: posX,
        top: posY,
        transform: `translate(-50%, -50%) rotate(${clipRotation}deg)`,
        transformOrigin: 'center center',
        pointerEvents: disabled ? 'none' : 'auto',
        touchAction: 'none',
        willChange: isDragging ? 'left, top' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Active Turn Glowing Ring Indicator */}
      {isActiveTurn && (
        <div 
          className="absolute inset-0 rounded-full bg-cyan-400/20 ring-4 ring-cyan-400/60 animate-pulse -z-10 blur-sm" 
          style={{ 
            width: clipSize + 20, 
            height: clipSize + 20, 
            left: -10, 
            top: -10,
          }} 
        />
      )}

      <div
        style={{ 
          width: clipSize, 
          height: clipSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
        className={`${isActiveTurn ? 'border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] rounded-full' : ''}`}
      >
        {/* Group Badge Indicator */}
        {clipart.groupId && (
          <div 
            className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-[#caa055] text-black flex items-center justify-center shadow z-30 border border-black" 
            title="Grouped Token"
          >
            <Layers className="w-2.5 h-2.5 text-black" />
          </div>
        )}
        {clipart.type === 'emoji' ? (
          <span style={{ fontSize: `${clipSize * 0.8}px`, lineHeight: 1 }}>{clipart.emoji}</span>
        ) : (
          <img 
            src={resolveAssetUrl(clipart.imageUrl || clipart.imageData || clipart.url || clipart.src)} 
            alt={clipart.name}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = getFallbackTokenSvg(clipart.name);
            }}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: isTokenAsset(clipart) ? 'cover' : 'contain', 
              borderRadius: isTokenAsset(clipart) ? '50%' : '4px',
              border: isTokenAsset(clipart) ? '2px solid rgba(255, 255, 255, 0.5)' : 'none',
              boxShadow: isTokenAsset(clipart) ? '0 4px 10px rgba(0,0,0,0.4)' : 'none'
            }}
            draggable={false}
            referrerPolicy="no-referrer"
          />
        )}

        {/* HP Bar Overlay */}
        {matchingCombatant && matchingCombatant.maxHp > 0 && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[85%] h-1.5 bg-black/80 rounded overflow-hidden border border-white/10 z-10">
            <div 
              className={`h-full ${matchingCombatant.currentHp / matchingCombatant.maxHp < 0.3 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, (matchingCombatant.currentHp / matchingCombatant.maxHp) * 100))}%` }}
            />
          </div>
        )}

        {/* Condition Indicator Badges */}
        {activeConditions.length > 0 && (
          <div className="absolute -top-3 -right-3 flex flex-wrap gap-0.5 max-w-[40px] z-10">
            {activeConditions.map((cond, cIdx) => (
              <span 
                key={cIdx} 
                className="h-4 w-4 rounded-full bg-purple-600 border border-white/20 flex items-center justify-center text-[8px] font-bold text-white shadow-md cursor-help"
                title={cond}
              >
                {cond[0]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Controls when selected */}
      {isSelected && canEdit && !isDragging && (
        <div
          ref={toolbarRef}
          className="absolute -top-14 left-1/2 flex items-center gap-2 bg-black/95 rounded-xl px-3 py-2 shadow-xl border border-white/20 whitespace-nowrap"
          style={{
            transform: `translateX(-50%) rotate(${-clipRotation}deg)`,
            transformOrigin: 'bottom center',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Scale slider */}
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-cyan-400" />
            <input
              type="range" min="20" max="500" step="1"
              value={localScale}
              onMouseDown={() => setIsAdjusting(true)}
              onTouchStart={() => setIsAdjusting(true)}
              onChange={(e) => { setLocalScale(parseInt(e.target.value)); }}
              className="w-28 h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((localScale - 20) / 480) * 100}%, #374151 ${((localScale - 20) / 480) * 100}%, #374151 100%)` }}
            />
            <span className="text-xs text-white font-mono w-10 text-right">{localScale}px</span>
          </div>
          
          {/* Rotation slider */}
          <div className="flex items-center gap-2 pl-3 border-l border-white/20">
            <RotateCw className="w-4 h-4 text-cyan-400" />
            <input
              type="range" min="0" max="360" step="1"
              value={localRotation}
              onMouseDown={() => setIsAdjusting(true)}
              onTouchStart={() => setIsAdjusting(true)}
              onChange={(e) => { setLocalRotation(parseInt(e.target.value)); }}
              className="w-20 h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${(localRotation / 360) * 100}%, #374151 ${(localRotation / 360) * 100}%, #374151 100%)` }}
            />
            <span className="text-xs text-white font-mono w-8">{localRotation}°</span>
          </div>

          {/* Mobile: gesture hint (shows only if touch is available) */}
          {isTouch && (
            <span className="text-[10px] text-white/40 px-1 border-l border-white/20 hidden md:inline">Pinch to resize · 2-finger rotate</span>
          )}
          
          {/* Delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onDelete?.(); }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 active:bg-red-500/30 text-red-400 ml-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ClipartLibrary;
