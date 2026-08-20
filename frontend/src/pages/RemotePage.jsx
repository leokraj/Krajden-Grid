import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { GridProvider, useGrid } from '../context/GridContext';
import { SessionProvider, useSession } from '../context/SessionContext';
import SessionContext from '../context/SessionContext';
import { GridCanvas } from '../components/GridCanvas';
import { EffectsDrawingOverlay } from '../components/EffectsLayer';
import { useAuth } from '../context/AuthContext';
import { CommunityBrowser } from '../components/CommunityBrowser';
import BackgroundLayersPanel from '../components/BackgroundLayersPanel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Grid3X3, Pencil, Ruler, Sticker, Image, Users, X,
  ChevronDown, ChevronUp, Circle, Triangle, Move, Eraser,
  Trash2, Undo2, Redo2, Minus, Lock, Unlock, Palette,
  Monitor, Smartphone, QrCode, Copy, Check, Upload, Search, Star, Download,
} from 'lucide-react';

const SYNCED_GRID_KEYS = [
  'gridEnabled', 'gridColor', 'lineThickness', 'opacity', 'showSubdivisions',
  'subdivisionCount', 'unitWidth', 'unitHeight', 'lockRatio', 'gridSize',
  'squareSize', 'screenWidth', 'screenHeight', 'backgroundColor',
  'backgroundEnabled', 'measureMultiplier',
];

// Bottom tab definitions
const TABS = [
  { id: 'grid', icon: Grid3X3, label: 'Grid' },
  { id: 'draw', icon: Pencil, label: 'Draw' },
  { id: 'measure', icon: Ruler, label: 'Measure' },
  { id: 'clipart', icon: Sticker, label: 'Clipart' },
  { id: 'layers', icon: Image, label: 'Layers' },
  { id: 'session', icon: Users, label: 'Session' },
];

// === DRAWER PANELS ===

const GridPanel = () => {
  const { settings, updateSettings, resetSettings } = useGrid();

  const handleGridSizeSlider = ([gridSize]) => {
    if (settings.lockRatio) {
      updateSettings({ gridSize });
    } else {
      const ratio = settings.unitHeight / settings.unitWidth;
      const newWidth = gridSize;
      const newHeight = Math.round(gridSize * ratio);
      updateSettings({ unitWidth: newWidth, unitHeight: newHeight, gridSize });
    }
  };

  const toggleLockRatio = () => {
    if (!settings.lockRatio) {
      const size = Math.min(settings.unitWidth, settings.unitHeight);
      updateSettings({ lockRatio: true, gridSize: size });
    } else {
      updateSettings({ lockRatio: false });
    }
  };

  return (
    <div className="space-y-4 p-4" data-testid="mobile-grid-panel">
      {/* Grid toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-sm">Grid Visible</Label>
        <Switch checked={settings.gridEnabled} onCheckedChange={(v) => updateSettings({ gridEnabled: v })} data-testid="mobile-grid-toggle" />
      </div>

      {/* Grid Size with Lock */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-gray-400">Grid Size</Label>
          <button
            onClick={toggleLockRatio}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              settings.lockRatio ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-400'
            }`}
            data-testid="mobile-lock-ratio"
          >
            {settings.lockRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {settings.lockRatio ? 'Squares' : 'Unlock'}
          </button>
        </div>
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-gray-300">{settings.lockRatio ? `${settings.gridSize}×${settings.gridSize}` : `${settings.unitWidth}×${settings.unitHeight}`}</span>
          </div>
          <input
            type="range"
            value={settings.lockRatio ? settings.gridSize : settings.unitWidth}
            onChange={(e) => handleGridSizeSlider([parseInt(e.target.value)])}
            min="5" max="200" step="1"
            className="w-full h-2 mt-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500"
            style={{ touchAction: 'none' }}
            data-testid="mobile-grid-size-slider"
          />
        </div>
        {!settings.lockRatio && (
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] mb-1"><span className="text-gray-400">X Units</span><span className="text-gray-500 font-mono">{settings.unitWidth}</span></div>
              <input type="range" min="5" max="200" step="1" value={settings.unitWidth} onChange={(e) => updateSettings({ unitWidth: parseInt(e.target.value) })} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500" style={{ touchAction: 'none' }} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1"><span className="text-gray-400">Y Units</span><span className="text-gray-500 font-mono">{settings.unitHeight}</span></div>
              <input type="range" min="5" max="200" step="1" value={settings.unitHeight} onChange={(e) => updateSettings({ unitHeight: parseInt(e.target.value) })} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500" style={{ touchAction: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {/* Grid color */}
      <div>
        <Label className="text-xs text-gray-400">Grid Color</Label>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={settings.gridColor} onChange={(e) => updateSettings({ gridColor: e.target.value })} className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent" />
          <span className="text-xs text-gray-500 font-mono">{settings.gridColor}</span>
        </div>
      </div>
      {/* Line thickness */}
      <div>
        <Label className="text-xs text-gray-400">Line Thickness: {settings.lineThickness}px</Label>
        <input
          type="range" min="0.1" max="5" step="0.1"
          value={settings.lineThickness}
          onChange={(e) => updateSettings({ lineThickness: parseFloat(e.target.value) })}
          className="w-full h-2 mt-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500"
          style={{ touchAction: 'none' }}
        />
      </div>
      {/* Opacity */}
      <div>
        <Label className="text-xs text-gray-400">Opacity: {Math.round(settings.opacity * 100)}%</Label>
        <input
          type="range" min="1" max="100" step="1"
          value={Math.round(settings.opacity * 100)}
          onChange={(e) => updateSettings({ opacity: parseInt(e.target.value) / 100 })}
          className="w-full h-2 mt-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500"
          style={{ touchAction: 'none' }}
        />
      </div>
      {/* Subdivisions */}
      <div className="flex items-center justify-between">
        <Label className="text-sm">Subdivisions</Label>
        <Switch checked={settings.showSubdivisions} onCheckedChange={(v) => updateSettings({ showSubdivisions: v })} />
      </div>
      {settings.showSubdivisions && (
        <div>
          <Label className="text-xs text-gray-400">Subdivision count: {settings.subdivisionCount}</Label>
          <input
            type="range" min="2" max="10" step="1"
            value={settings.subdivisionCount}
            onChange={(e) => updateSettings({ subdivisionCount: parseInt(e.target.value) })}
            className="w-full h-2 mt-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500"
            style={{ touchAction: 'none' }}
          />
        </div>
      )}
      {/* Background color */}
      <div>
        <Label className="text-xs text-gray-400">Background</Label>
        <div className="flex items-center gap-2 mt-1">
          <Switch checked={settings.backgroundEnabled !== false} onCheckedChange={(v) => updateSettings({ backgroundEnabled: v })} />
          {settings.backgroundEnabled !== false && (
            <input type="color" value={settings.backgroundColor || '#0A0A0A'} onChange={(e) => updateSettings({ backgroundColor: e.target.value })} className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent" />
          )}
        </div>
      </div>
      {/* Reset */}
      <Button onClick={resetSettings} variant="outline" size="sm" className="w-full mt-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10">
        <Trash2 className="w-3 h-3 mr-1" /> Reset All Settings
      </Button>
    </div>
  );
};

const DrawPanel = () => {
  const { settings, updateSettings, undoDrawing, redoDrawing, clearDrawings } = useGrid();
  const sessionContext = useContext(SessionContext);
  const broadcastUndoDrawing = sessionContext?.broadcastUndoDrawing;
  const broadcastRedoDrawing = sessionContext?.broadcastRedoDrawing;
  const broadcastClearAll = sessionContext?.broadcastClearAll;

  return (
    <div className="space-y-4 p-4" data-testid="mobile-draw-panel">
      {/* Drawing toggle */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => updateSettings({ drawingEnabled: !settings.drawingEnabled, eraserEnabled: false })}
          className={`flex-1 h-12 rounded-xl ${settings.drawingEnabled ? 'bg-amber-500 text-black font-semibold' : 'bg-white/5 text-gray-400'}`}
          data-testid="mobile-draw-toggle"
        >
          <Pencil className="w-5 h-5 mr-2" /> Draw
        </Button>
        <Button
          onClick={() => updateSettings({ eraserEnabled: !settings.eraserEnabled, drawingEnabled: false })}
          className={`flex-1 h-12 rounded-xl ${settings.eraserEnabled ? 'bg-orange-600 text-white' : 'bg-white/5 text-gray-400'}`}
          data-testid="mobile-eraser-toggle"
        >
          <Eraser className="w-5 h-5 mr-2" /> Erase
        </Button>
      </div>
      {/* Draw color */}
      {settings.drawingEnabled && (
        <>
          <div>
            <Label className="text-xs text-gray-400">Pen Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={settings.drawColor || '#ffffff'} onChange={(e) => updateSettings({ drawColor: e.target.value })} className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent" />
              <div className="flex gap-1">
                {['#ffffff', '#ff3b30', '#34c759', '#007AFF', '#ffcc00', '#ff9500'].map(c => (
                  <button key={c} onClick={() => updateSettings({ drawColor: c })} className="w-7 h-7 rounded-full border-2 transition-transform" style={{ backgroundColor: c, borderColor: settings.drawColor === c ? '#fff' : 'transparent', transform: settings.drawColor === c ? 'scale(1.15)' : 'scale(1)' }} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400">Pen Width: {settings.drawWidth || 2}px</Label>
            <input type="range" min="1" max="20" step="1" value={settings.drawWidth || 2} onChange={(e) => updateSettings({ drawWidth: parseInt(e.target.value) })} className="w-full h-2 mt-1 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500" style={{ touchAction: 'none' }} />
          </div>
        </>
      )}
      {settings.eraserEnabled && (
        <div>
          <Label className="text-xs text-gray-400">Eraser Size: {settings.eraserSize || 20}px</Label>
          <input type="range" min="5" max="100" step="5" value={settings.eraserSize || 20} onChange={(e) => updateSettings({ eraserSize: parseInt(e.target.value) })} className="w-full h-2 mt-1 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500" style={{ touchAction: 'none' }} />
        </div>
      )}
      {/* Undo/Redo/Clear */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => { undoDrawing?.(); broadcastUndoDrawing?.(); }} data-testid="mobile-undo-btn">
          <Undo2 className="w-4 h-4 mr-1" /> Undo
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => { redoDrawing?.(); broadcastRedoDrawing?.(); }} data-testid="mobile-redo-btn">
          <Redo2 className="w-4 h-4 mr-1" /> Redo
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-10 border-red-500/30 text-red-400" onClick={() => { clearDrawings(); broadcastClearAll?.(); }} data-testid="mobile-clear-btn">
          <Trash2 className="w-4 h-4 mr-1" /> Clear
        </Button>
      </div>
    </div>
  );
};

const MeasurePanel = () => {
  const { settings, updateSettings, clearMeasurements } = useGrid();
  const modes = [
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'radial', icon: Circle, label: 'Radial' },
    { id: 'cone', icon: Triangle, label: 'Cone' },
  ];

  return (
    <div className="space-y-4 p-4" data-testid="mobile-measure-panel">
      <div className="grid grid-cols-3 gap-2">
        {modes.map(m => (
          <Button
            key={m.id}
            onClick={() => updateSettings({ measureMode: settings.measureMode === m.id ? null : m.id, drawingEnabled: false, eraserEnabled: false })}
            className={`h-12 rounded-xl flex flex-col gap-0.5 ${settings.measureMode === m.id ? 'bg-[#007AFF] text-white' : 'bg-white/5 text-gray-400'}`}
            data-testid={`mobile-measure-${m.id}`}
          >
            <m.icon className="w-5 h-5" />
            <span className="text-[10px]">{m.label}</span>
          </Button>
        ))}
      </div>
      {/* Measure multiplier */}
      <div>
        <Label className="text-xs text-gray-400">Scale Multiplier: {settings.measureMultiplier || 1}x</Label>
        <input type="range" min="0.1" max="10" step="0.1" value={settings.measureMultiplier || 1} onChange={(e) => updateSettings({ measureMultiplier: parseFloat(e.target.value) })} className="w-full h-2 mt-1 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500" style={{ touchAction: 'none' }} />
      </div>
      {/* Measure color */}
      <div>
        <Label className="text-xs text-gray-400">Measure Color</Label>
        <input type="color" value={settings.measureColor || '#00F0FF'} onChange={(e) => updateSettings({ measureColor: e.target.value })} className="w-10 h-10 mt-1 rounded border-0 cursor-pointer bg-transparent" />
      </div>
      <Button onClick={clearMeasurements} variant="outline" size="sm" className="w-full text-xs border-red-500/30 text-red-400">
        <Trash2 className="w-3 h-3 mr-1" /> Clear All Measurements
      </Button>
    </div>
  );
};

// Built-in clipart items for mobile
const MOBILE_CLIPART_CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'custom', name: 'My Items' },
  { id: 'animated_fx', name: 'Animated FX' },
  { id: 'dnd_heroes', name: 'Heroes' },
  { id: 'dnd_monsters', name: 'Monsters' },
  { id: 'effects', name: 'Effects' },
  { id: 'markers', name: 'Markers' },
  { id: 'terrain', name: 'Terrain' },
  { id: 'status', name: 'Status' },
];

const BUILT_IN_CLIPARTS = [
  // D&D Hero Token Images (realistic circular/standard RPG tokens)
  { id: 'token_fighter', name: 'Fighter (Alistair)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Fighter&backgroundColor=b6e3f4' },
  { id: 'token_wizard', name: 'Wizard (Gandalf)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Wizard&backgroundColor=c0aede' },
  { id: 'token_rogue', name: 'Rogue (Sylas)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Rogue&backgroundColor=d1d4f9' },
  { id: 'token_cleric', name: 'Cleric (Vesper)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Cleric&backgroundColor=ffdfc4' },
  { id: 'token_ranger', name: 'Ranger (Lyra)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ranger&backgroundColor=ffd5dc' },
  { id: 'token_paladin', name: 'Paladin (Gideon)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Paladin&backgroundColor=f1f2f6' },
  { id: 'token_druid', name: 'Druid (Elowen)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Druid&backgroundColor=d2f1d2' },
  { id: 'token_bard', name: 'Bard (Lumina)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Bard&backgroundColor=ffd3b6' },
  { id: 'token_barbarian', name: 'Barbarian (Krog)', category: 'dnd_heroes', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Barbarian&backgroundColor=ffaaa5' },

  // D&D Monster Token Images (realistic circular/standard RPG tokens)
  { id: 'token_goblin', name: 'Goblin Scout', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=goblin&backgroundColor=c0d6e4' },
  { id: 'token_orc', name: 'Orc Berserker', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=orc&backgroundColor=e2f0d9' },
  { id: 'token_dragon', name: 'Red Dragon', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=dragon&backgroundColor=fce4d6' },
  { id: 'token_skeleton', name: 'Skeleton Warrior', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=skeleton&backgroundColor=f2f2f2' },
  { id: 'token_beholder', name: 'Beholder', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=beholder&backgroundColor=e1d5e7' },
  { id: 'token_lich', name: 'Lich Lord', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=lich&backgroundColor=d5e8d4' },
  { id: 'token_vampire', name: 'Vampire Noble', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=vampire&backgroundColor=fff2cc' },
  { id: 'token_golem', name: 'Stone Golem', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=golem&backgroundColor=dae8fc' },
  { id: 'token_mimic', name: 'Mimic Chest', category: 'dnd_monsters', type: 'image', imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=mimic&backgroundColor=ffe6cc' },

  // D&D Animated Spell & Effect Gifs (high-quality transparent background Giphy assets)
  { id: 'gif_fireball', name: 'Animated Fireball', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3g0Y2xrdjVpbmk4eHN1N3U5OHg4OHV6czhpMHVyN3B5ZnJhODRtNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o72F8t9TDi2xVnxOE/giphy.gif' },
  { id: 'gif_lightning', name: 'Animated Storm Spark', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNnd3bXFhcTVudThoYTd3eGlnaGZlajA5bnFpZzJpNGd5bHBidmJ3YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l2SpS8p3T4D078Mv6/giphy.gif' },
  { id: 'gif_portal', name: 'Animated Void Portal', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNmtpMDJqcmFvY243M3p2dGJ5cG1yMGR4cHVobmdkcW5scmsxdXhkeCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7qE1YN7aBOFPRw8E/giphy.gif' },
  { id: 'gif_poison', name: 'Animated Poison Cloud', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcmVhbDZnNzhiaXU1cjdxbmd6Yzd6ZXo4Y2V6eW9kdnBlN2dybnh2eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlRt7vQn0gD6tqw/giphy.gif' },
  { id: 'gif_sparkles', name: 'Animated Holy Sparkles', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWoxNHhpaTRiOTMyYm5xZ2I0eWVxZHpyOXQ0bXoxbHozOXByOWZwayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7qE4op16t6roNHit/giphy.gif' },
  { id: 'gif_water', name: 'Animated Water Splash', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNno1OHp0Z25pNm9idWhtOHdrbHZtZ2ZpZnYyOW0xdzQ5dm9ocHh0NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o6ozg0N0Cpx9741Q4/giphy.gif' },
  { id: 'gif_blood', name: 'Animated Blood Splat', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOGg5MG03amg3YWpvd2JkZjY3MWt6ZXUzZHl6ZHRhdnhmNGN5Zm4waiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlU7eS8Hq98E8x2/giphy.gif' },
  { id: 'gif_explosion', name: 'Animated Explosion', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOWl2aDhpZXB2MGJ6dnd5dzBzYzhwNnE0a3B3Yjd6NTVyZ3h0cG56cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7qE1YN7aBOFPRw8E/giphy.gif' },
  { id: 'gif_d20', name: 'Animated d20 Dice Roll', category: 'animated_fx', type: 'image', imageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdW5td24weXBnZG0zdW0xeWVmaHJxeGFoYWZ0OTRtbXg4MWZzNjBldCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l1Ktf6gqM385750C4/giphy.gif' },

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

const MobileClipartPanel = ({ onOpenCommunity }) => {
  const { customCliparts, addCustomClipart, addPlacedClipart, clipartFavorites, toggleClipartFavorite, removeCustomClipart } = useGrid();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [placedMsg, setPlacedMsg] = useState(null);
  const fileInputRef = useRef(null);

  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlNameInput, setUrlNameInput] = useState('');

  const handleAddFromUrl = () => {
    if (!urlInput.trim()) return;
    const name = urlNameInput.trim() || urlInput.split('/').pop()?.split('?')[0] || 'Custom Link';
    
    addCustomClipart({
      id: `custom_${Date.now()}_url`,
      name: name.replace(/\.[^/.]+$/, ''),
      category: 'custom',
      type: 'image',
      imageUrl: urlInput.trim(),
      isCustom: true,
    });
    
    setUrlInput('');
    setUrlNameInput('');
    setShowUrlForm(false);
  };

  const allCliparts = [...BUILT_IN_CLIPARTS, ...customCliparts];
  const filtered = allCliparts.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'all' || (category === 'custom' && item.isCustom) || item.category === category;
    return matchSearch && matchCat;
  });

  const handlePlace = (item) => {
    addPlacedClipart({
      ...item,
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 3),
      scale: 50,
      rotation: 0,
    });
    setPlacedMsg(item.name);
    setTimeout(() => setPlacedMsg(null), 1500);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

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
          addCustomClipart({
            id: `custom_${Date.now()}_${i}`,
            name: data.name || file.name.replace(/\.[^/.]+$/, ''),
            category: 'custom',
            type: 'image',
            imageUrl: data.url,
            isCustom: true,
          });
          continue; // successfully uploaded, proceed
        }
      } catch (err) {
        console.warn('Mobile upload failed, falling back to base64:', err);
      }

      // Fallback
      const reader = new FileReader();
      reader.onload = (ev) => {
        addCustomClipart({
          id: `custom_${Date.now()}_${i}_fb`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          category: 'custom',
          type: 'image',
          imageData: ev.target.result,
          isCustom: true,
        });
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-3 space-y-3" data-testid="mobile-clipart-panel">
      {/* Community + Upload + URL buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onOpenCommunity}
          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-medium active:bg-cyan-500/25 transition-colors"
          data-testid="mobile-community-btn"
        >
          <Users className="w-4 h-4" />
          Community
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,image/gif,.gif" multiple onChange={handleFileUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium active:bg-amber-500/25 transition-colors"
          data-testid="mobile-upload-clipart-btn"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
        <button
          onClick={() => setShowUrlForm(!showUrlForm)}
          className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl text-[11px] font-medium transition-colors ${showUrlForm ? 'bg-[#00F0FF]/25 border border-[#00F0FF] text-[#00F0FF]' : 'bg-purple-500/10 border border-purple-500/20 text-purple-400 active:bg-purple-500/25'}`}
        >
          <span className="text-sm">🔗</span>
          Link URL
        </button>
      </div>

      {showUrlForm && (
        <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2.5">
          <div>
            <label className="text-[9px] text-gray-400 uppercase tracking-widest block mb-1">Asset Link / URL (GIFs / Images)</label>
            <input
              type="text"
              placeholder="https://example.com/character.gif"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-[#00F0FF]/50"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400 uppercase tracking-widest block mb-1">Name</label>
            <input
              type="text"
              placeholder="e.g. Animated Fireball"
              value={urlNameInput}
              onChange={(e) => setUrlNameInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-[#00F0FF]/50"
            />
          </div>
          <button
            onClick={handleAddFromUrl}
            className="w-full py-1.5 bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/30 text-xs font-semibold rounded-lg active:bg-[#00F0FF]/40 transition-colors"
          >
            Add to Clipart Library
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <input
          type="text"
          placeholder="Search cliparts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-amber-500/50"
          data-testid="mobile-clipart-search"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-1 flex-wrap">
        {MOBILE_CLIPART_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
              category === cat.id
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-white/5 text-white/50 border border-transparent'
            }`}
          >
            {cat.name}
            {cat.id === 'custom' && customCliparts.length > 0 && ` (${customCliparts.length})`}
          </button>
        ))}
      </div>

      {/* Placed confirmation */}
      {placedMsg && (
        <div className="text-center text-xs text-green-400 bg-green-500/10 rounded-lg py-1.5 animate-pulse" data-testid="clipart-placed-msg">
          Placed "{placedMsg}" on grid
        </div>
      )}

      {/* Clipart grid */}
      <div className="grid grid-cols-4 gap-2 max-h-[35vh] overflow-y-auto">
        {filtered.map(item => (
          <button
            key={item.id}
            onClick={() => handlePlace(item)}
            className="relative aspect-square bg-white/5 rounded-xl flex flex-col items-center justify-center gap-0.5 active:bg-white/15 transition-colors border border-transparent active:border-amber-500/40"
            data-testid={`mobile-clipart-${item.id}`}
          >
            {item.type === 'emoji' ? (
              <span className="text-2xl">{item.emoji}</span>
            ) : (
              <img src={item.imageUrl || item.imageData} alt={item.name} className="w-10 h-10 object-contain rounded" />
            )}
            <span className="text-[8px] text-white/40 truncate w-full text-center px-1">{item.name}</span>
            {item.isCustom && (
              <button
                onClick={(e) => { e.stopPropagation(); removeCustomClipart(item.id); }}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-white/30 py-4 text-xs">
          {category === 'custom' ? 'No custom cliparts yet. Upload or import from Community.' : 'No cliparts found'}
        </div>
      )}

      <p className="text-[10px] text-white/30 text-center">Tap to place on grid</p>
    </div>
  );
};



const SessionPanel = () => {
  const { user } = useAuth();
  const { sessionCode, isHost, isConnected, participants, error, createSession, joinSession, leaveSession, getShareableLink } = useSession();
  const { settings } = useGrid();
  const [copied, setCopied] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHost = () => {
    setShowHostModal(true);
    setNameInput(user?.nickname || user?.name || 'Dungeon Master');
  };

  const handleCreate = () => {
    if (!nameInput.trim()) return;
    const gridSettings = {};
    ['gridEnabled','gridColor','lineThickness','opacity','showSubdivisions','subdivisionCount','unitWidth','unitHeight','lockRatio','gridSize','squareSize','screenWidth','screenHeight','backgroundColor','backgroundEnabled','measureMultiplier'].forEach(k => { gridSettings[k] = settings[k]; });
    createSession(nameInput.trim(), gridSettings, { width: window.innerWidth, height: window.innerHeight });
    setShowHostModal(false);
  };

  const handleJoin = () => {
    if (nameInput.trim() && codeInput.trim()) {
      joinSession(codeInput.trim().toUpperCase(), nameInput.trim());
      setShowJoinModal(false);
    }
  };

  // In a session: show session info
  if (sessionCode) {
    return (
      <div className="p-4 space-y-4" data-testid="mobile-session-panel">
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-center space-y-3">
          <p className="text-xs text-cyan-400 font-medium">{isHost ? 'You are hosting' : 'Connected to session'}</p>
          <p className="text-3xl font-mono font-bold tracking-[0.3em] text-white">{sessionCode}</p>
          <p className="text-xs text-gray-500">{1 + (participants.guests?.length || 0)} user(s) connected</p>

          {isHost && (
            <div className="space-y-2">
              <Button onClick={() => handleCopy(sessionCode)} variant="outline" size="sm" className="w-full text-xs" data-testid="mobile-copy-code">
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </Button>
              <Button onClick={() => handleCopy(`${backendUrl}/display`)} variant="outline" size="sm" className="w-full text-xs" data-testid="mobile-copy-display-link">
                <Monitor className="w-3.5 h-3.5 mr-1" />
                Copy Display URL
              </Button>
            </div>
          )}
        </div>

        <Button onClick={leaveSession} variant="outline" className="w-full h-10 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" data-testid="mobile-leave-session">
          Leave Session
        </Button>
      </div>
    );
  }

  // Not in session: show host/join
  return (
    <div className="p-4 space-y-3" data-testid="mobile-session-panel">
      {!isConnected && (
        <div className="text-center py-2">
          <p className="text-xs text-yellow-500 animate-pulse">Connecting to server...</p>
        </div>
      )}

      <Button onClick={handleHost} className="w-full h-12 text-sm bg-[#007AFF] hover:bg-[#0066CC] rounded-xl" disabled={!isConnected} data-testid="mobile-host-btn">
        <Users className="w-5 h-5 mr-2" />
        {user ? 'Host Session' : 'Sign in to Host'}
      </Button>

      <Button onClick={() => { setShowJoinModal(true); setNameInput(''); setCodeInput(''); }} variant="outline" className="w-full h-12 text-sm rounded-xl" disabled={!isConnected} data-testid="mobile-join-btn">
        Join Session
      </Button>

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}

      {user && (
        <p className="text-[10px] text-gray-600 text-center">Signed in as {user.nickname || user.name || user.email}</p>
      )}

      {/* Host modal */}
      {showHostModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4" onClick={() => setShowHostModal(false)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Host a Session</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-400">Your Name</Label>
                <Input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter name" className="mt-1 h-11" maxLength={20} autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} data-testid="mobile-host-name" />
              </div>
              <Button onClick={handleCreate} className="w-full h-11 bg-[#007AFF]" disabled={!nameInput.trim()} data-testid="mobile-create-session">
                Create Session
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Join modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4" onClick={() => setShowJoinModal(false)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Join a Session</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-400">Your Name</Label>
                <Input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter name" className="mt-1 h-11" maxLength={20} autoFocus data-testid="mobile-join-name" />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Session Code</Label>
                <Input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} placeholder="Enter code" className="mt-1 h-11 font-mono text-center text-xl tracking-widest" maxLength={6} onKeyDown={e => e.key === 'Enter' && handleJoin()} data-testid="mobile-join-code" />
              </div>
              <Button onClick={handleJoin} className="w-full h-11 bg-green-600 hover:bg-green-700" disabled={!nameInput.trim() || !codeInput.trim()} data-testid="mobile-join-confirm">
                Join Session
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// === MAIN REMOTE CONTENT ===

const RemoteContent = () => {
  const { settings, updateSettings, undoDrawing, redoDrawing, clearDrawings, clearMeasurements, addCustomClipart } = useGrid();
  const { sessionCode, isHost, isBlocked, participants, leaveSession } = useSession();
  const sessionContext = useContext(SessionContext);
  const broadcastGridSettings = sessionContext?.broadcastGridSettings;
  const broadcastHostDimensions = sessionContext?.broadcastHostDimensions;
  const remoteGridSettings = sessionContext?.remoteGridSettings;
  const hostDimensions = sessionContext?.hostDimensions;
  const clearAllEvent = sessionContext?.clearAllEvent;
  const isGuest = sessionCode && !isHost;

  const [activeTab, setActiveTab] = useState(null);
  const [showCommunityBrowser, setShowCommunityBrowser] = useState(false);
  const prevSettingsRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show banner if not already installed as standalone
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show a manual install hint if not in standalone mode
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isIOS && !isStandalone) {
      setShowInstallBanner(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setInstallPrompt(null);
  };

  // Broadcast grid settings when host changes them
  useEffect(() => {
    if (!sessionCode || !isHost || !broadcastGridSettings) return;
    const currentSynced = {};
    SYNCED_GRID_KEYS.forEach(k => { currentSynced[k] = settings[k]; });
    if (prevSettingsRef.current) {
      const changed = SYNCED_GRID_KEYS.some(k => settings[k] !== prevSettingsRef.current[k]);
      if (changed) broadcastGridSettings(currentSynced);
    }
    prevSettingsRef.current = { ...settings };
  }, [sessionCode, isHost, broadcastGridSettings, settings]);

  // Broadcast host dimensions
  useEffect(() => {
    if (!sessionCode || !isHost || !broadcastHostDimensions) return;
    broadcastHostDimensions(window.innerWidth, window.innerHeight);
  }, [sessionCode, isHost, broadcastHostDimensions]);

  // Guest: apply remote grid settings
  useEffect(() => {
    if (!isGuest || !remoteGridSettings) return;
    updateSettings(remoteGridSettings);
  }, [isGuest, remoteGridSettings, updateSettings]);

  // Clear all event
  const clearAllRef = useRef(0);
  useEffect(() => {
    if (clearAllEvent > 0 && clearAllEvent !== clearAllRef.current) {
      clearAllRef.current = clearAllEvent;
      clearDrawings();
      clearMeasurements();
    }
  }, [clearAllEvent, clearDrawings, clearMeasurements]);

  const toggleTab = (tabId) => {
    setActiveTab(prev => prev === tabId ? null : tabId);
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'grid': return <GridPanel />;
      case 'draw': return <DrawPanel />;
      case 'measure': return <MeasurePanel />;
      case 'clipart': return (
        <MobileClipartPanel onOpenCommunity={() => setShowCommunityBrowser(true)} />
      );
      case 'layers': return (
        <div className="h-[40vh] overflow-hidden" data-testid="mobile-layers-panel">
          <BackgroundLayersPanel />
        </div>
      );
      case 'session': return <SessionPanel />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0a0a]" data-testid="remote-page">
      {/* Top status bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-[#111] border-b border-white/8 z-50">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-300">Krajden Grid Remote</span>
        </div>
        {sessionCode ? (
          <div className="flex items-center gap-2">
            <div className="bg-green-500/20 border border-green-500/30 rounded-full px-2.5 py-0.5 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400 font-mono">{sessionCode}</span>
            </div>
            <span className="text-[10px] text-gray-500">{isHost ? 'Host' : 'Guest'} · {1 + (participants.guests?.length || 0)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-500">No session</span>
        )}
      </div>

      {/* Install PWA banner */}
      {showInstallBanner && (
        <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-amber-600/20 border-b border-amber-500/20 z-50" data-testid="pwa-install-banner">
          <div className="flex items-center gap-2 min-w-0">
            <Grid3X3 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-white truncate">
              {installPrompt ? 'Install Krajden Grid app' : 'Tap Share → Add to Home Screen'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {installPrompt && (
              <button onClick={handleInstall} className="px-3 py-1 rounded-full bg-amber-600 text-black text-xs font-bold" data-testid="pwa-install-btn">
                Install
              </button>
            )}
            <button onClick={() => setShowInstallBanner(false)} className="text-white/40 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden" style={{
        backgroundColor: settings.backgroundEnabled !== false ? settings.backgroundColor : '#0A0A0A',
      }}>
        {isGuest && hostDimensions ? (
          <div className="absolute inset-0">
            <GridCanvas interactive={true} fullscreen={true} className="absolute inset-0" />
            <EffectsDrawingOverlay />
          </div>
        ) : (
          <>
            <GridCanvas interactive={true} fullscreen={true} className="absolute inset-0" />
            <EffectsDrawingOverlay />
          </>
        )}

        {/* Mode indicator overlay */}
        {(settings.drawingEnabled || settings.eraserEnabled || (settings.measureMode && settings.liveMeasurement)) && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1 flex items-center gap-2">
            {settings.drawingEnabled && <><Pencil className="w-3 h-3 text-amber-400" /><span className="text-[10px] text-amber-300">Drawing</span></>}
            {settings.eraserEnabled && <><Eraser className="w-3 h-3 text-orange-400" /><span className="text-[10px] text-orange-300">Erasing</span></>}
            {settings.measureMode && settings.liveMeasurement && <><Ruler className="w-3 h-3 text-cyan-400" /><span className="text-[10px] text-cyan-300">{settings.measureMode}</span></>}
            <button onClick={() => updateSettings({ drawingEnabled: false, eraserEnabled: false, measureMode: null })} className="ml-1 text-white/40 hover:text-white"><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>

      {/* Drawer panel (slides up from bottom) */}
      {activeTab && (
        <div className="shrink-0 max-h-[45vh] overflow-y-auto bg-[#111114] border-t border-white/10 z-40" data-testid="mobile-drawer">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-[#111114] border-b border-white/8">
            <span className="text-xs font-semibold text-white capitalize">{activeTab}</span>
            <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-white" data-testid="mobile-drawer-close">
              <X className="w-4 h-4" />
            </button>
          </div>
          {renderPanel()}
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="shrink-0 bg-[#0d0d0f] border-t border-white/8 flex items-center justify-around px-1 py-1 z-50 safe-area-bottom" data-testid="mobile-tab-bar">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const hasMode = (tab.id === 'draw' && (settings.drawingEnabled || settings.eraserEnabled)) ||
                          (tab.id === 'measure' && settings.measureMode);
          return (
            <button
              key={tab.id}
              onClick={() => toggleTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-lg transition-colors min-w-[48px] ${
                isActive ? 'bg-white/10 text-white' : hasMode ? 'text-amber-400' : 'text-gray-500'
              }`}
              data-testid={`mobile-tab-${tab.id}`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[9px] font-medium">{tab.label}</span>
              {hasMode && !isActive && <div className="w-1 h-1 rounded-full bg-amber-400 -mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Community Browser modal */}
      <CommunityBrowser
        isOpen={showCommunityBrowser}
        onClose={() => setShowCommunityBrowser(false)}
        onImportClipart={(clipart) => {
          addCustomClipart(clipart);
          setShowCommunityBrowser(false);
        }}
      />
    </div>
  );
};

export function RemotePage() {
  const { isAuthenticated, loading } = useAuth();
  const isElectron = !!window.electronAPI?.isElectron;

  // On mobile web, skip auth gate — let users use it immediately
  return (
    <GridProvider>
      <SessionProvider>
        <RemoteContent />
      </SessionProvider>
    </GridProvider>
  );
}

export default RemotePage;
