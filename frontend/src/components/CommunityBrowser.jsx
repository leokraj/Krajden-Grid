import React, { useState } from 'react';
import { useGrid } from '../context/GridContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { X, Search, Download, Star, Sparkles, SlidersHorizontal } from 'lucide-react';

const COMMUNITY_CLIPARTS_PRESETS = [
  {
    id: 'comm_1',
    name: 'Chest of Holding',
    category: 'loot',
    image_data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23f59e0b" stroke-width="1.5"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2v9M3 11a5 5 0 0 1 18 0"/></svg>',
    downloads: 142,
    tags: ['dnd', 'item', 'gold']
  },
  {
    id: 'comm_2',
    name: 'Fireball Hazard',
    category: 'spell',
    image_data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23ef4444" stroke-width="1.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></svg>',
    downloads: 325,
    tags: ['spell', 'aoe', 'fire']
  },
  {
    id: 'comm_3',
    name: 'Acid Pool Trap',
    category: 'hazard',
    image_data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2322c55e" stroke-width="1.5"><path d="M12 3v18M3 12h18M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0"/></svg>',
    downloads: 84,
    tags: ['trap', 'slime', 'green']
  },
  {
    id: 'comm_4',
    name: 'Dragon Token',
    category: 'token',
    image_data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23a855f7" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8.35 15.35c.7-.7 1.8-.7 2.5 0l1.15 1.15M15.65 15.35a1.77 1.77 0 0 0-2.5 0l-1.15 1.15M12 8v3M10 9l2-2 2 2"/></svg>',
    downloads: 412,
    tags: ['creature', 'boss', 'monster']
  },
  {
    id: 'comm_5',
    name: 'Arcane Portal',
    category: 'spell',
    image_data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2306b6d4" stroke-width="1.5"><ellipse cx="12" cy="12" rx="6" ry="10"/></svg>',
    downloads: 231,
    tags: ['magic', 'teleport', 'blue']
  }
];

export const CommunityBrowser = ({ isOpen, onClose }) => {
  const { addCustomClipart } = useGrid();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [importedIds, setImportedIds] = useState([]);

  if (!isOpen) return null;

  const handleImport = (clipart) => {
    // Add custom clipart to local grid library
    const newClipart = {
      id: "clipart_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      name: clipart.name,
      category: clipart.category,
      image_data: clipart.image_data,
      isCommunity: true
    };
    addCustomClipart(newClipart);
    setImportedIds((prev) => [...prev, clipart.id]);
  };

  const filtered = COMMUNITY_CLIPARTS_PRESETS.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                          item.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" data-testid="community-browser-backdrop">
      <div className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden" data-testid="community-browser">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Community Assets</h2>
              <p className="text-[10px] text-gray-400">Discover and import custom tactical tokens shared by the community.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            data-testid="close-community-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-black/20 border-b border-white/5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chest, fire, trap, token..."
              className="pl-9 h-9 text-xs bg-black/40 border-white/10"
              data-testid="community-search-input"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['all', 'token', 'spell', 'hazard', 'loot'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-500 border-amber-500 text-black font-semibold'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                data-testid={`category-filter-${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3" data-testid="community-cliparts-grid">
          {filtered.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-gray-500 text-xs">
              No matching community assets found. Try searching with other tags!
            </div>
          ) : (
            filtered.map((item) => {
              const isImported = importedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-black/30 border border-white/5 rounded-xl hover:border-white/10 transition-all group"
                  data-testid={`community-item-${item.id}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center p-1.5 shrink-0 select-none">
                    <img
                      src={item.image_data}
                      alt={item.name}
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-200 truncate">{item.name}</div>
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400 capitalize mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 font-semibold tracking-wide border border-white/5">
                        {item.category}
                      </span>
                      <span className="flex items-center gap-0.5 font-mono text-gray-500">
                        <Download className="w-2.5 h-2.5" /> {item.downloads}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleImport(item)}
                    disabled={isImported}
                    size="sm"
                    variant={isImported ? "ghost" : "outline"}
                    className={`h-7 px-2 text-[10px] shrink-0 border-white/10 font-medium ${
                      isImported
                        ? 'text-emerald-400'
                        : 'hover:bg-amber-500 hover:border-amber-400 hover:text-black hover:font-bold'
                    }`}
                    data-testid={`import-btn-${item.id}`}
                  >
                    {isImported ? 'Imported' : 'Import'}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
export default CommunityBrowser;
