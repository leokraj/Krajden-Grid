import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import SessionContext from '../context/SessionContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
  Minimize2
} from 'lucide-react';

// D&D Hero Token Images (realistic circular/standard RPG tokens)
const DND_HERO_TOKENS = [
  { id: 'token_fighter', name: 'Fighter (Alistair)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_wizard', name: 'Wizard (Gandalf)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1514894780887-121968d00567?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_rogue', name: 'Rogue (Sylas)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1535663116191-497793d58da3?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_cleric', name: 'Cleric (Vesper)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_ranger', name: 'Ranger (Lyra)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_paladin', name: 'Paladin (Gideon)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_druid', name: 'Druid (Elowen)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_bard', name: 'Bard (Lumina)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_barbarian', name: 'Barbarian (Krog)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1558224494-ef3b3b7a1704?w=128&auto=format&fit=crop&q=80' },
];

// D&D Monster Token Images (realistic circular/standard RPG tokens)
// D&D Monster Token Images (realistic circular/standard RPG tokens)
const DND_MONSTER_TOKENS = [
  { id: 'token_goblin', name: 'Goblin Scout', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_orc', name: 'Orc Berserker', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_dragon', name: 'Red Dragon', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_skeleton', name: 'Skeleton Warrior', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_beholder', name: 'Beholder', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_lich', name: 'Lich Lord', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_vampire', name: 'Vampire Noble', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_golem', name: 'Stone Golem', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=128&auto=format&fit=crop&q=80' },
  { id: 'token_mimic', name: 'Mimic Chest', category: 'dnd_monsters', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1519074002996-a69e7ac46a42?w=128&auto=format&fit=crop&q=80' },
];

// D&D Animated Spell & Effect Gifs (high-quality transparent background Giphy assets)
const DND_ANIMATED_EFFECTS = [
  { id: 'gif_fireball', name: 'Animated Fireball', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3g0Y2xrdjVpbmk4eHN1N3U5OHg4OHV6czhpMHVyN3B5ZnJhODRtNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o72F8t9TDi2xVnxOE/giphy.gif' },
  { id: 'gif_lightning', name: 'Animated Storm Spark', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNnd3bXFhcTVudThoYTd3eGlnaGZlajA5bnFpZzJpNGd5bHBidmJ3YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l2SpS8p3T4D078Mv6/giphy.gif' },
  { id: 'gif_portal', name: 'Animated Void Portal', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNmtpMDJqcmFvY243M3p2dGJ5cG1yMGR4cHVobmdkcW5scmsxdXhkeCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7qE1YN7aBOFPRw8E/giphy.gif' },
  { id: 'gif_poison', name: 'Animated Poison Cloud', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcmVhbDZnNzhiaXU1cjdxbmd6Yzd6ZXo4Y2V6eW9kdnBlN2dybnh2eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlRt7vQn0gD6tqw/giphy.gif' },
  { id: 'gif_sparkles', name: 'Animated Holy Sparkles', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWoxNHhpaTRiOTMyYm5xZ2I0eWVxZHpyOXQ0bXoxbHozOXByOWZwayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7qE4op16t6roNHit/giphy.gif' },
  { id: 'gif_water', name: 'Animated Water Splash', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNno1OHp0Z25pNm9idWhtOHdrbHZtZ2ZpZnYyOW0xdzQ5dm9ocHh0NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o6ozg0N0Cpx9741Q4/giphy.gif' },
  { id: 'gif_blood', name: 'Animated Blood Splat', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOGg5MG03amg3YWpvd2JkZjY3MWt6ZXUzZHl6ZHRhdnhmNGN5Zm4waiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlU7eS8Hq98E8x2/giphy.gif' },
  { id: 'gif_explosion', name: 'Animated Explosion', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOWl2aDhpZXB2MGJ6dnd5dzBzYzhwNnE0a3B3Yjd6NTVyZ3h0cG56cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7qE1YN7aBOFPRw8E/giphy.gif' },
  { id: 'gif_d20', name: 'Animated d20 Dice Roll', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdW5td24weXBnZG0zdW0xeWVmaHJxeGFoYWZ0OTRtbXg4MWZzNjBldCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l1Ktf6gqM385750C4/giphy.gif' }
];

// Default clipart items - Gaming/D&D themed
const DEFAULT_CLIPARTS = [
  ...DND_HERO_TOKENS,
  ...DND_MONSTER_TOKENS,
  ...DND_ANIMATED_EFFECTS,
  
  // Fire & Effects
  { id: 'fire', name: 'Fire', category: 'effects', emoji: '🔥', type: 'emoji' },
  { id: 'smoke', name: 'Smoke Cloud', category: 'effects', emoji: '💨', type: 'emoji' },
  { id: 'explosion', name: 'Explosion', category: 'effects', emoji: '💥', type: 'emoji' },
  { id: 'lightning', name: 'Lightning Strike', category: 'effects', emoji: '⚡', type: 'emoji' },
  { id: 'sparkles', name: 'Magic Sparkles', category: 'effects', emoji: '✨', type: 'emoji' },
  { id: 'ice', name: 'Ice/Frost', category: 'effects', emoji: '❄️', type: 'emoji' },
  { id: 'poison', name: 'Poison Cloud', category: 'effects', emoji: '☠️', type: 'emoji' },
  { id: 'water', name: 'Water Splash', category: 'effects', emoji: '💧', type: 'emoji' },
  { id: 'portal', name: 'Portal', category: 'effects', emoji: '🌀', type: 'emoji' },
  { id: 'shield_fx', name: 'Force Shield', category: 'effects', emoji: '🛡️', type: 'emoji' },
  
  // Markers & Targets
  { id: 'target', name: 'Target', category: 'markers', emoji: '🎯', type: 'emoji' },
  { id: 'skull', name: 'Skull Marker', category: 'markers', emoji: '💀', type: 'emoji' },
  { id: 'flag', name: 'Flag', category: 'markers', emoji: '🚩', type: 'emoji' },
  { id: 'pin', name: 'Pin', category: 'markers', emoji: '📍', type: 'emoji' },
  { id: 'star_marker', name: 'Star', category: 'markers', emoji: '⭐', type: 'emoji' },
  { id: 'warning', name: 'Warning', category: 'markers', emoji: '⚠️', type: 'emoji' },
  { id: 'eye', name: 'Eye', category: 'markers', emoji: '👁️', type: 'emoji' },
  { id: 'crosshair', name: 'Crosshair', category: 'markers', emoji: '➕', type: 'emoji' },
  
  // Terrain & Objects
  { id: 'tree', name: 'Tree', category: 'terrain', emoji: '🌲', type: 'emoji' },
  { id: 'rock', name: 'Rock', category: 'terrain', emoji: '🪨', type: 'emoji' },
  { id: 'castle', name: 'Castle', category: 'terrain', emoji: '🏰', type: 'emoji' },
  { id: 'house', name: 'House', category: 'terrain', emoji: '🏠', type: 'emoji' },
  { id: 'tent', name: 'Tent', category: 'terrain', emoji: '⛺', type: 'emoji' },
  { id: 'treasure', name: 'Treasure', category: 'terrain', emoji: '💎', type: 'emoji' },
  { id: 'chest', name: 'Chest', category: 'terrain', emoji: '📦', type: 'emoji' },
  { id: 'door', name: 'Door', category: 'terrain', emoji: '🚪', type: 'emoji' },
  
  // Status Effects
  { id: 'heart', name: 'Health', category: 'status', emoji: '❤️', type: 'emoji' },
  { id: 'broken_heart', name: 'Damage', category: 'status', emoji: '💔', type: 'emoji' },
  { id: 'sleep', name: 'Sleep', category: 'status', emoji: '😴', type: 'emoji' },
  { id: 'dizzy', name: 'Stunned', category: 'status', emoji: '😵', type: 'emoji' },
  { id: 'rage', name: 'Rage', category: 'status', emoji: '😡', type: 'emoji' },
  { id: 'shield_status', name: 'Protected', category: 'status', emoji: '🔰', type: 'emoji' },
  { id: 'hourglass', name: 'Slowed', category: 'status', emoji: '⏳', type: 'emoji' },
  { id: 'bolt', name: 'Hasted', category: 'status', emoji: '🏃', type: 'emoji' },
];

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'favorites', name: 'Favorites' },
  { id: 'animated_fx', name: 'Animated FX' },
  { id: 'dnd_heroes', name: 'D&D Heroes' },
  { id: 'dnd_monsters', name: 'D&D Monsters' },
  { id: 'custom', name: 'My Uploads' },
  { id: 'effects', name: 'Effects' },
  { id: 'markers', name: 'Markers' },
  { id: 'terrain', name: 'Terrain' },
  { id: 'status', name: 'Status' },
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

  // Combine default and custom cliparts
  const allCliparts = [...DEFAULT_CLIPARTS, ...customCliparts];

  // Filter cliparts based on search and category
  const filteredCliparts = allCliparts.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = 
      selectedCategory === 'all' ||
      (selectedCategory === 'favorites' && favorites.includes(item.id)) ||
      (selectedCategory === 'custom' && item.isCustom) ||
      item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle single or batch file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const customItem = {
            id: `custom_${Date.now()}_${index}`,
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
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        ? "w-full bg-white/2 border border-white/10 rounded-xl flex flex-col overflow-hidden h-[380px]"
        : isElectronWindow 
          ? "w-full h-screen bg-[#1a1a1a] flex flex-col"
          : "fixed z-[9998] bg-[#1a1a1a]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl w-[320px] max-h-[600px] flex flex-col"}
      style={(isDocked || isElectronWindow) ? undefined : { left: position.x, top: position.y }}
      onMouseDown={(isDocked || isElectronWindow) ? undefined : handleMouseDown}
      data-testid="clipart-library-window"
    >
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
              onClick={() => onSelectClipart?.(item)}
              className="relative group aspect-square bg-white/5 rounded-lg flex items-center justify-center cursor-grab hover:bg-white/10 transition-colors border border-transparent hover:border-cyan-500/40"
              title={`${item.name} - Drag to grid or click to place`}
            >
              {item.type === 'emoji' ? (
                <span className="text-2xl">{item.emoji}</span>
              ) : (
                <img 
                  src={item.imageUrl || item.imageData} 
                  alt={item.name}
                  className="w-10 h-10 object-contain rounded"
                />
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
              
              {/* Delete button for custom items */}
              {item.isCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomClipart?.(item.id);
                  }}
                  className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
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
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, clipX: 0, clipY: 0 });
  const [localScale, setLocalScale] = useState(clipart.scale || 50);
  const [localRotation, setLocalRotation] = useState(clipart.rotation || 0);
  const [isAdjusting, setIsAdjusting] = useState(false);
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
    onSelect?.();
    setIsDragging(true);
    setDragOffset({ dx: 0, dy: 0 });
    dragStartRef.current = { x: e.clientX, y: e.clientY, clipX: clipart.x, clipY: clipart.y };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setDragOffset({ dx, dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const newX = dragStartRef.current.clipX + dragOffset.dx;
    const newY = dragStartRef.current.clipY + dragOffset.dy;
    const pos = snapToGrid ? snapPosition(newX, newY) : { x: newX, y: newY };
    if (dragOffset.dx !== 0 || dragOffset.dy !== 0) {
      onUpdate?.({ ...clipart, x: pos.x, y: pos.y });
    }
    setDragOffset({ dx: 0, dy: 0 });
  }, [isDragging, dragOffset, snapToGrid, snapPosition, clipart, onUpdate]);

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

  const commitChanges = useCallback(() => {
    setIsAdjusting(false);
    onUpdate?.({ ...clipart, scale: localScale, rotation: localRotation });
  }, [clipart, localScale, localRotation, onUpdate]);

  const size = localScale;
  const rotation = localRotation;
  const posX = clipart.x + (isDragging ? dragOffset.dx : 0);
  const posY = clipart.y + (isDragging ? dragOffset.dy : 0);
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
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
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
            width: size + 20, 
            height: size + 20, 
            left: -10, 
            top: -10,
          }} 
        />
      )}

      <div
        style={{ 
          width: size, 
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
        className={`${isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-transparent rounded' : ''} ${isActiveTurn ? 'border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] rounded-full' : ''}`}
      >
        {clipart.type === 'emoji' ? (
          <span style={{ fontSize: `${size * 0.8}px`, lineHeight: 1 }}>{clipart.emoji}</span>
        ) : (
          <img 
            src={clipart.imageUrl || clipart.imageData} 
            alt={clipart.name}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover', 
              borderRadius: (clipart.category === 'tokens' || clipart.category === 'dnd_heroes' || clipart.category === 'dnd_monsters' || clipart.id.startsWith('token_')) ? '50%' : '4px',
              border: (clipart.category === 'tokens' || clipart.category === 'dnd_heroes' || clipart.category === 'dnd_monsters' || clipart.id.startsWith('token_')) ? '2px solid rgba(255, 255, 255, 0.5)' : 'none',
              boxShadow: (clipart.category === 'tokens' || clipart.category === 'dnd_heroes' || clipart.category === 'dnd_monsters' || clipart.id.startsWith('token_')) ? '0 4px 10px rgba(0,0,0,0.4)' : 'none'
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
          className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/95 rounded-xl px-3 py-2 shadow-xl border border-white/20 whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Desktop: Scale slider */}
          {!isTouch && (
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-cyan-400" />
              <input
                type="range" min="20" max="500" step="1"
                value={localScale}
                onChange={(e) => { setIsAdjusting(true); setLocalScale(parseInt(e.target.value)); }}
                onMouseUp={commitChanges}
                className="w-28 h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((localScale - 20) / 480) * 100}%, #374151 ${((localScale - 20) / 480) * 100}%, #374151 100%)` }}
              />
              <span className="text-xs text-white font-mono w-10 text-right">{localScale}px</span>
            </div>
          )}
          
          {/* Desktop: Rotation slider */}
          {!isTouch && (
            <div className="flex items-center gap-2 pl-3 border-l border-white/20">
              <RotateCw className="w-4 h-4 text-cyan-400" />
              <input
                type="range" min="0" max="360" step="1"
                value={localRotation}
                onChange={(e) => { setIsAdjusting(true); setLocalRotation(parseInt(e.target.value)); }}
                onMouseUp={commitChanges}
                className="w-20 h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${(localRotation / 360) * 100}%, #374151 ${(localRotation / 360) * 100}%, #374151 100%)` }}
              />
              <span className="text-xs text-white font-mono w-8">{localRotation}°</span>
            </div>
          )}

          {/* Mobile: gesture hint */}
          {isTouch && (
            <span className="text-[10px] text-white/40 px-1">Pinch to resize · 2-finger rotate</span>
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
