import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGrid, TOKEN_SIZE_PRESETS, DND_CONDITIONS } from '../context/GridContext';
import { toast } from 'sonner';
import { getBuiltinEffectsForCategory, effectSelectionPatch } from './EffectsLayer';
import { subscribeEffects } from '../lib/firebase';
import {
  Ruler,
  Minus,
  Circle,
  Triangle,
  XCircle,
  Radio,
  Image,
  PenTool,
  Eraser,
  Trash2,
  X,
  Sparkles,
  MapPin,
  Layers,
  Grid,
  Flame,
  CloudFog,
  Map as MapIcon
} from 'lucide-react';

export function RadialContextMenu() {
  const { 
    radialMenuOpen, radialMenuPos, closeRadialMenu, settings, updateSettings,
    addPing, clearDrawings, clearPings, radialMenuConfig, setShowClipartLibrary,
    broadcastPing, sessionCode, selectedClipartIds = [],
    groupSelectedCliparts, ungroupSelectedCliparts,
    setTokenLabel, toggleTokenStatus, bringTokenToFront, sendTokenToBack,
    updatePlacedClipart,
  } = useGrid();

  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [showLabelEdit, setShowLabelEdit] = useState(false);
  // Which effect category was picked in the 2nd-level Effects submenu,
  // waiting on the 3rd-level tool submenu to finish the selection.
  const [pendingEffectCategory, setPendingEffectCategory] = useState(null);
  const menuRef = useRef(null);

  // Vault effects live in Firestore, so only subscribe while the final
  // (effect list) step is showing the Vault category.
  const [vaultEffects, setVaultEffects] = useState([]);
  const vaultListOpen = radialMenuOpen && activeSubMenu === 'effectsList' && pendingEffectCategory === 'vault';
  useEffect(() => {
    if (!vaultListOpen) return;
    const unsubscribe = subscribeEffects((fx) => { if (Array.isArray(fx)) setVaultEffects(fx); });
    return () => unsubscribe?.();
  }, [vaultListOpen]);

  // Token being right-clicked (if any)
  const tokenInstanceId = radialMenuPos?.tokenInstanceId || null;
  const activeToken = tokenInstanceId
    ? (settings.placedCliparts || []).find(cp => cp.instanceId === tokenInstanceId)
    : null;

  // Close on Escape or click outside
  useEffect(() => {
    if (!radialMenuOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeRadialMenu();
      }
    };

    const handlePointerDownOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeRadialMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [radialMenuOpen, closeRadialMenu]);

  if (!radialMenuOpen || !radialMenuPos) return null;

  // Actions execution helpers
  const handleMeasureSelect = (mode) => {
    if (mode === 'off') {
      updateSettings({ measureMode: null });
      toast.info('Measurement mode turned off');
    } else {
      updateSettings({ measureMode: mode });
      toast.success(`Measure Tool set to ${mode.toUpperCase()}`);
    }
    closeRadialMenu();
  };

  const handleDrawSelect = (action) => {
    if (action === 'draw') {
      updateSettings({ drawingEnabled: true, eraserEnabled: false });
      toast.success('Drawing Pen active');
    } else if (action === 'erase') {
      updateSettings({ drawingEnabled: true, eraserEnabled: true });
      toast.success('Eraser Tool active');
    } else if (action === 'clear') {
      clearDrawings();
      toast.success('Drawings cleared');
    } else if (action === 'off') {
      updateSettings({ drawingEnabled: false, eraserEnabled: false });
      toast.info('Drawing mode turned off');
    }
    closeRadialMenu();
  };

  const handleBeaconSelect = () => {
    updateSettings({ pingMode: true });
    toast.info('Beacon Mode Active (Left click map to drop beacon)');
    closeRadialMenu();
  };

  // 2nd-level: pick an effect category — Rivers / Lights / Static / Area /
  // Vault — which opens the 3rd-level tool submenu rather than committing
  // anything yet.
  const EFFECT_CATEGORIES = [
    { key: 'river', label: 'Rivers', emoji: '🌊' },
    { key: 'light', label: 'Lights', emoji: '🕯️' },
    { key: 'static', label: 'Static', emoji: '🩸' },
    { key: 'area', label: 'Area', emoji: '🔥' },
    { key: 'vault', label: 'Vault', emoji: '⭐' },
  ];

  // 3rd-level: pick the mask/paint tool — this is what actually commits
  // the selection (effect category + tool) and turns Painting Mode on.
  const EFFECT_TOOLS = [
    { id: 'brush', label: 'Brush', emoji: '🖌️' },
    { id: 'marquee', label: 'Marquee', emoji: '🔲' },
    { id: 'lasso', label: 'Lasso', emoji: '🪢' },
    { id: 'eraser', label: 'Eraser', emoji: '🧹' },
  ];

  const handleEffectCategorySelect = (categoryKey) => {
    setPendingEffectCategory(categoryKey);
    setActiveSubMenu('effectsTool');
  };

  const handleEffectToolSelect = (toolId) => {
    updateSettings({
      effectsEnabled: true,
      effectTool: toolId,
      // A transient "command" the Effects panel watches for: it opens the
      // right tab/category group, scrolls into view, then clears this
      // itself. Keeps this radial menu decoupled from the panel's own
      // (locally-held) tab/group state.
      effectsRadialTarget: { category: pendingEffectCategory, ts: Date.now() },
    });
    // Final step: choose the actual effect from a list. The menu stays open.
    setActiveSubMenu('effectsList');
  };

  const handleEffectPick = (eff) => {
    updateSettings(effectSelectionPatch(eff));
    toast.success(`Active: "${eff.name}" — Draw on map!`);
    closeRadialMenu();
  };

  const effectListItems = pendingEffectCategory === 'vault'
    ? vaultEffects
    : getBuiltinEffectsForCategory(pendingEffectCategory);

  const handleEffectsOff = () => {
    updateSettings({ effectsEnabled: false });
    toast.info('Effects Painting Mode turned off');
    closeRadialMenu();
  };

  const handleLibrarySelect = () => {
    // The Token Library is a floating window. The radial menu lives in the
    // Grid window, so in the desktop app ask Electron to open the library's
    // own window directly (setShowClipartLibrary only reaches panels that
    // live in this same window).
    if (window.electronAPI?.openClipartWindow) {
      window.electronAPI.openClipartWindow();
    } else {
      if (setShowClipartLibrary) setShowClipartLibrary(true);
      const elem = document.getElementById('section-clipart');
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    }
    toast.success('Opened Token & Clipart Library');
    closeRadialMenu();
  };

  // Map Importer = the Battle Maps & Layers window.
  const handleMapImporterSelect = () => {
    if (window.electronAPI?.openLayersWindow) {
      window.electronAPI.openLayersWindow();
    } else {
      const elem = document.getElementById('section-bgimage');
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    }
    toast.success('Opened Map Importer');
    closeRadialMenu();
  };

  // Grid Mask: erase the grid under a brush / rectangle / circle.
  const handleMaskSelect = (tool) => {
    updateSettings({
      maskEnabled: true, maskTool: tool,
      measureMode: false, drawingEnabled: false, eraserEnabled: false, pingMode: false,
      effectsEnabled: false, atmoTool: null,
    });
    toast.success(`Grid Mask: ${tool}. Right-click to exit.`);
    closeRadialMenu();
  };
  const handleMaskOff = () => {
    updateSettings({ maskEnabled: false });
    closeRadialMenu();
  };

  // Fog of War (painted fog): pick reveal/re-cover + brush/rect/circle.
  const handleFogTool = (tool) => {
    updateSettings({
      fogEnabled: true, atmoTool: tool,
      measureMode: false, drawingEnabled: false, eraserEnabled: false, pingMode: false,
      maskEnabled: false, effectsEnabled: false,
    });
    closeRadialMenu();
  };
  const handleFogAll = (reveal) => {
    const ops = settings.fogOps || [];
    updateSettings({
      fogEnabled: true,
      fogOps: reveal
        ? [...ops, { id: `fog_${Date.now()}`, mode: 'reveal', kind: 'rect', x: -5000, y: -5000, w: 20000, h: 20000, soft: 0 }]
        : [],
    });
    closeRadialMenu();
  };
  const handleFogOff = () => {
    updateSettings({ fogEnabled: false, atmoTool: null });
    closeRadialMenu();
  };

  const selectedCliparts = (settings.placedCliparts || []).filter(cp => selectedClipartIds.includes(cp.instanceId));
  const isGrouped = selectedCliparts.length > 0 && selectedCliparts.some(cp => cp.groupId);

  const handleGroupToggle = () => {
    if (isGrouped) {
      if (ungroupSelectedCliparts) ungroupSelectedCliparts();
      toast.success('Ungrouped selected tokens');
      closeRadialMenu();
    } else if (selectedClipartIds.length >= 2) {
      if (groupSelectedCliparts) groupSelectedCliparts();
      toast.success(`Grouped ${selectedClipartIds.length} tokens together`);
      closeRadialMenu();
    } else {
      toast.info('Shift-click or drag a selection box on the grid to select multiple tokens to group.');
    }
  };

  // Screen constraint check so menu doesn't render off-screen
  const menuWidth = 320;
  const menuHeight = 320;
  const clampedX = Math.max(menuWidth / 2 + 10, Math.min(window.innerWidth - menuWidth / 2 - 10, radialMenuPos.x));
  const clampedY = Math.max(menuHeight / 2 + 10, Math.min(window.innerHeight - menuHeight / 2 - 10, radialMenuPos.y));

  // All buttons are the same size and sit evenly spaced on one ring.
  const RING_R = 108;
  const BTN = 52;
  const slotKeys = ['measure', 'group', 'beacon', 'effects', 'library', 'maps', 'fog', 'draw', 'mask', ...(activeToken ? ['token'] : [])];
  const slot = (key) => {
    const i = Math.max(0, slotKeys.indexOf(key));
    const ang = (i / slotKeys.length) * Math.PI * 2 - Math.PI / 2;
    return {
      width: BTN, height: BTN,
      left: `calc(50% + ${(Math.cos(ang) * RING_R).toFixed(1)}px - ${BTN / 2}px)`,
      top: `calc(50% + ${(Math.sin(ang) * RING_R).toFixed(1)}px - ${BTN / 2}px)`,
    };
  };

  // Portal to <body> so the menu sits above the fog / weather / spell layers
  // (they are fixed overlays; inside the grid canvas this menu was trapped
  // under their stacking context).
  return createPortal(
    <div style={{ zIndex: 100000 }} className="fixed inset-0 pointer-events-auto bg-black/20 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-150">
      <div 
        ref={menuRef}
        className="absolute select-none transform -translate-x-1/2 -translate-y-1/2"
        style={{ left: clampedX, top: clampedY }}
      >
        {/* Background Outer Ring Halo */}
        <div className="w-80 h-80 rounded-full border border-[#caa055]/30 bg-[#111214]/90 shadow-[0_0_50px_rgba(202,160,85,0.25)] backdrop-blur-md relative flex items-center justify-center p-3">
          
          {/* Decorative Ring Slices & Pattern */}
          <div className="absolute inset-2 rounded-full border border-[#caa055]/15 pointer-events-none" />
          <div className="absolute rounded-full border border-[#caa055]/20 pointer-events-none" style={{ width: RING_R * 2, height: RING_R * 2, left: `calc(50% - ${RING_R}px)`, top: `calc(50% - ${RING_R}px)` }} />

          {/* Quadrant Crosshair Lines */}

          {/* MAIN QUADRANT 1: TOP (Measure Submenu) */}
          <div 
            style={slot('measure')} className="absolute flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('measure')}
            onClick={() => setActiveSubMenu(activeSubMenu === 'measure' ? null : 'measure')}
            data-testid="radial-top-measure"
          >
            <div className={`w-full h-full rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${activeSubMenu === 'measure' ? 'bg-[#caa055]/30 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110' : 'bg-black/60 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20'}`}>
              <Ruler className="w-5 h-5 text-[#caa055]" />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">Measure</span>
            </div>
          </div>

          {/* MAIN QUADRANT 2: RIGHT (Beacon / Ping) */}
          <div 
            style={slot('beacon')} className="absolute flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('beacon')}
            onClick={handleBeaconSelect}
            data-testid="radial-right-beacon"
          >
            <div className="w-full h-full rounded-full border bg-black/60 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 flex flex-col items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-[0_0_15px_#caa055]">
              <Radio className="w-5 h-5 text-[#caa055] animate-pulse" />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">Beacon</span>
            </div>
          </div>

          {/* MAIN QUADRANT 3: BOTTOM (Token & Clipart Library) */}
          <div 
            style={slot('library')} className="absolute flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('library')}
            onClick={handleLibrarySelect}
            data-testid="radial-bottom-library"
          >
            <div className="w-full h-full rounded-full border bg-black/60 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 flex flex-col items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-[0_0_15px_#caa055]">
              <Image className="w-5 h-5 text-[#caa055]" />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">Library</span>
            </div>
          </div>

          {/* MAIN QUADRANT 4: LEFT (Draw Submenu) */}
          <div 
            style={slot('draw')} className="absolute flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('draw')}
            onClick={() => setActiveSubMenu(activeSubMenu === 'draw' ? null : 'draw')}
            data-testid="radial-left-draw"
          >
            <div className={`w-full h-full rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${activeSubMenu === 'draw' ? 'bg-[#caa055]/30 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110' : 'bg-black/60 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20'}`}>
              <PenTool className="w-5 h-5 text-[#caa055]" />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">Draw</span>
            </div>
          </div>

          {/* CORNER: TOP-LEFT — Token options (visible when right-clicking a token) */}
          {activeToken && (
            <div
              style={slot('token')} className="absolute flex flex-col items-center cursor-pointer z-10"
              onClick={() => setActiveSubMenu(activeSubMenu === 'token' ? null : 'token')}
              title="Token Options"
            >
              <div className={`w-full h-full rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${
                activeSubMenu === 'token'
                  ? 'bg-[#caa055]/40 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110'
                  : 'bg-black/80 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 hover:scale-105'
              }`}>
                <span className="text-base">🎭</span>
                <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider">Token</span>
              </div>
            </div>
          )}

          {/* CORNER ACTION: TOP-RIGHT (Group / Ungroup Tokens) */}
          <div 
            style={slot('group')} className="absolute flex flex-col items-center group cursor-pointer z-10"
            onClick={handleGroupToggle}
            data-testid="radial-corner-group"
            title={isGrouped ? "Ungroup Selected Tokens" : "Group Selected Tokens"}
          >
            <div className={`w-full h-full rounded-full border flex flex-col items-center justify-center transition-all duration-200 relative ${
              selectedClipartIds.length > 1 || isGrouped 
                ? 'bg-[#caa055]/40 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110' 
                : 'bg-black/80 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 hover:scale-105'
            }`}>
              <Layers className={`w-5 h-5 ${isGrouped ? 'text-amber-300' : 'text-[#caa055]'}`} />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">
                {isGrouped ? 'Ungroup' : 'Group'}
              </span>
              {selectedClipartIds.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#caa055] text-black text-[7px] font-bold px-1.5 py-0.2 rounded-full shadow border border-white">
                  {selectedClipartIds.length}
                </span>
              )}
            </div>
          </div>

          {/* CORNER: BOTTOM-RIGHT — Effects Painting Mode (opens category submenu) */}
          <div
            style={slot('effects')} className="absolute flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('effects')}
            onClick={() => setActiveSubMenu(['effects', 'effectsTool', 'effectsList'].includes(activeSubMenu) ? null : 'effects')}
            data-testid="radial-corner-effects"
            title="Effects Painting Mode"
          >
            <div className={`w-full h-full rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${
              settings.effectsEnabled
                ? 'bg-[#caa055]/40 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110'
                : 'bg-black/80 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 hover:scale-105'
            }`}>
              <Flame className="w-5 h-5 text-[#caa055]" />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider">Effects</span>
            </div>
          </div>

          {/* OUTER RING: GRID MASK (between Measure and the Token corner) */}
          <div
            className="absolute flex flex-col items-center cursor-pointer z-10"
            style={slot('mask')}
            onMouseEnter={() => setActiveSubMenu('mask')}
            onClick={() => setActiveSubMenu(activeSubMenu === 'mask' ? null : 'mask')}
            data-testid="radial-mask"
            title="Grid Mask"
          >
            <div className={`w-full h-full rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${
              settings.maskEnabled || activeSubMenu === 'mask'
                ? 'bg-[#caa055]/40 border-[#caa055] shadow-[0_0_12px_#caa055] scale-110'
                : 'bg-black/80 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 hover:scale-105'
            }`}>
              <Grid className="w-5 h-5 text-[#caa055]" />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider leading-none mt-0.5">Mask</span>
            </div>
          </div>

          {/* OUTER RING: MAP IMPORTER (between Library and the Fog corner) */}
          <div
            className="absolute flex flex-col items-center cursor-pointer z-10"
            style={slot('maps')}
            onMouseEnter={() => setActiveSubMenu('mapimport')}
            onClick={handleMapImporterSelect}
            data-testid="radial-map-importer"
            title="Map Importer"
          >
            <div className="w-full h-full rounded-full border bg-black/80 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 hover:scale-105 flex flex-col items-center justify-center transition-all duration-200">
              <MapIcon className="w-5 h-5 text-[#caa055]" />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider leading-none mt-0.5">Maps</span>
            </div>
          </div>

          {/* CORNER: BOTTOM-LEFT — Fog of War */}
          <div
            style={slot('fog')} className="absolute flex flex-col items-center cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('fog')}
            onClick={() => setActiveSubMenu(activeSubMenu === 'fog' ? null : 'fog')}
            data-testid="radial-corner-fog"
            title="Fog of War"
          >
            <div className={`w-full h-full rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${
              settings.fogEnabled || activeSubMenu === 'fog'
                ? 'bg-[#caa055]/40 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110'
                : 'bg-black/80 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 hover:scale-105'
            }`}>
              <CloudFog className="w-5 h-5 text-[#caa055]" />
              <span className="text-[7px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider">Fog</span>
            </div>
          </div>

          {/* CENTER HUB EMBLEM */}
          <div 
            onClick={closeRadialMenu}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-[#caa055]/30 to-black border-2 border-[#caa055] shadow-[0_0_20px_rgba(202,160,85,0.4)] flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform z-20 group"
            title="Close Radial Menu"
          >
            <Sparkles className="w-5 h-5 text-[#caa055] group-hover:rotate-12 transition-transform" />
            <span className="text-[8px] font-cinzel font-bold text-[#caa055] tracking-widest uppercase mt-0.5">Menu</span>
          </div>

          {/* DYNAMIC SUB-MENUS */}

          {/* TOP SUBMENU: MEASURE SUB-MENU (Line on Left, Radial on Top, Cone on Right, Off on Bottom) */}
          {activeSubMenu === 'measure' && (
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 flex items-center justify-center w-72 h-20 bg-black/80 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-2 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150">
              <div className="relative w-full h-full flex items-center justify-around px-2">
                
                {/* Line (Left) */}
                <button
                  onClick={() => handleMeasureSelect('line')}
                  className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${settings.measureMode === 'line' ? 'bg-[#caa055] text-black border-white font-bold' : 'border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20'}`}
                  title="Line Measurement"
                  data-testid="radial-measure-line"
                >
                  <Minus className="w-5 h-5 rotate-45" />
                  <span className="text-[8px] font-bold uppercase mt-0.5">Line</span>
                </button>

                {/* Radial / Circle (Top) */}
                <button
                  onClick={() => handleMeasureSelect('radial')}
                  className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${settings.measureMode === 'radial' ? 'bg-[#caa055] text-black border-white font-bold' : 'border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20'}`}
                  title="Radial Circle Measurement"
                  data-testid="radial-measure-circle"
                >
                  <Circle className="w-5 h-5" />
                  <span className="text-[8px] font-bold uppercase mt-0.5">Radial</span>
                </button>

                {/* Cone (Right) */}
                <button
                  onClick={() => handleMeasureSelect('cone')}
                  className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${settings.measureMode === 'cone' ? 'bg-[#caa055] text-black border-white font-bold' : 'border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20'}`}
                  title="Cone Measurement"
                  data-testid="radial-measure-cone"
                >
                  <Triangle className="w-5 h-5" />
                  <span className="text-[8px] font-bold uppercase mt-0.5">Cone</span>
                </button>

                {/* Off (Bottom / Deactivate) */}
                <button
                  onClick={() => handleMeasureSelect('off')}
                  className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${!settings.measureMode ? 'bg-red-500/30 text-red-300 border-red-500' : 'border-red-500/30 text-red-400 hover:bg-red-500/20'}`}
                  title="Turn Measure Off"
                  data-testid="radial-measure-off"
                >
                  <XCircle className="w-5 h-5" />
                  <span className="text-[8px] font-bold uppercase mt-0.5">Off</span>
                </button>
              </div>
            </div>
          )}

          {/* LEFT SUBMENU: DRAW SUB-MENU (Draw, Erase, Clear, Off) */}
          {activeSubMenu === 'draw' && (
            <div className="absolute -left-28 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-24 h-64 bg-black/80 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-2 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150 space-y-2">
              
              {/* Draw (Pen) */}
              <button
                onClick={() => handleDrawSelect('draw')}
                className={`w-full flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer ${settings.drawingEnabled && !settings.eraserEnabled ? 'bg-[#caa055] text-black border-white font-bold' : 'border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20'}`}
                title="Pen Drawing Mode"
                data-testid="radial-draw-pen"
              >
                <PenTool className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Draw</span>
              </button>

              {/* Erase */}
              <button
                onClick={() => handleDrawSelect('erase')}
                className={`w-full flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer ${settings.drawingEnabled && settings.eraserEnabled ? 'bg-[#caa055] text-black border-white font-bold' : 'border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20'}`}
                title="Eraser Tool"
                data-testid="radial-draw-erase"
              >
                <Eraser className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Erase</span>
              </button>

              {/* Clear */}
              <button
                onClick={() => handleDrawSelect('clear')}
                className="w-full flex items-center gap-2 p-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                title="Clear All Drawings"
                data-testid="radial-draw-clear"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Clear</span>
              </button>

              {/* Off */}
              <button
                onClick={() => handleDrawSelect('off')}
                className={`w-full flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer ${!settings.drawingEnabled ? 'bg-red-500/30 text-red-300 border-red-500' : 'border-red-500/30 text-red-400 hover:bg-red-500/20'}`}
                title="Turn Off Drawing"
                data-testid="radial-draw-off"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Off</span>
              </button>
            </div>
          )}

          {/* TOKEN SUBMENU */}
          {activeSubMenu === 'token' && activeToken && (
            <div className="absolute -left-52 top-1/2 -translate-y-1/2 w-48 bg-black/90 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-3 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150 space-y-2 max-h-80 overflow-y-auto">
              
              <p className="text-[9px] text-[#caa055] font-bold uppercase tracking-wider">Token Label</p>
              {showLabelEdit ? (
                <div className="flex gap-1">
                  <input autoFocus value={labelInput}
                    onChange={e => setLabelInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { setTokenLabel(activeToken.instanceId, labelInput); setShowLabelEdit(false); toast.success('Label set'); }
                      if (e.key === 'Escape') setShowLabelEdit(false);
                    }}
                    placeholder="Enter label..."
                    className="flex-1 bg-black/60 border border-[#caa055]/30 rounded px-2 py-1 text-[10px] text-white" />
                  <button onClick={() => { setTokenLabel(activeToken.instanceId, labelInput); setShowLabelEdit(false); toast.success('Label set'); }}
                    className="text-[#caa055] text-[10px] px-2 border border-[#caa055]/40 rounded hover:bg-[#caa055]/20">✓</button>
                </div>
              ) : (
                <button onClick={() => { setLabelInput(activeToken.label || ''); setShowLabelEdit(true); }}
                  className="w-full text-left text-[10px] border border-[#caa055]/20 rounded px-2 py-1 text-white/60 hover:bg-white/5 truncate">
                  {activeToken.label || '(no label — click to set)'}
                </button>
              )}

              <p className="text-[9px] text-[#caa055] font-bold uppercase tracking-wider pt-1">Size Preset</p>
              <div className="grid grid-cols-2 gap-1">
                {(TOKEN_SIZE_PRESETS || []).map((preset) => (
                  <button key={preset.label}
                    onClick={() => {
                      updatePlacedClipart?.(activeToken.instanceId, { scale: 50 * preset.multiplier });
                      toast.success(`Set to ${preset.label}`);
                    }}
                    className="text-[8px] border border-[#caa055]/20 rounded px-1.5 py-1 text-white/70 hover:bg-[#caa055]/20 hover:text-[#caa055] transition-all">
                    {preset.label}
                  </button>
                ))}
              </div>

              <p className="text-[9px] text-[#caa055] font-bold uppercase tracking-wider pt-1">Layer Order</p>
              <div className="flex gap-1">
                <button onClick={() => { bringTokenToFront?.(activeToken.instanceId); toast.success('Brought to front'); closeRadialMenu(); }}
                  className="flex-1 text-[9px] border border-[#caa055]/20 rounded px-2 py-1 text-white/70 hover:bg-[#caa055]/20 transition-all">↑ Front</button>
                <button onClick={() => { sendTokenToBack?.(activeToken.instanceId); toast.success('Sent to back'); closeRadialMenu(); }}
                  className="flex-1 text-[9px] border border-[#caa055]/20 rounded px-2 py-1 text-white/70 hover:bg-[#caa055]/20 transition-all">↓ Back</button>
              </div>

              <p className="text-[9px] text-[#caa055] font-bold uppercase tracking-wider pt-1">Conditions</p>
              <div className="flex flex-wrap gap-1">
                {(DND_CONDITIONS || []).map((status) => {
                  const active = (activeToken.statuses || []).includes(status);
                  return (
                    <button key={status}
                      onClick={() => toggleTokenStatus?.(activeToken.instanceId, status)}
                      className={`text-[8px] rounded px-1.5 py-0.5 border transition-all ${
                        active ? 'bg-[#caa055] text-black border-[#caa055] font-bold' : 'border-white/20 text-white/50 hover:border-[#caa055]/50'
                      }`}>
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TOP-LEFT SUBMENU: GRID MASK */}
          {activeSubMenu === 'mask' && (
            <div className="absolute top-0 -left-32 flex flex-col items-center justify-center w-28 bg-black/85 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-2 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150 space-y-1.5">
              <button onClick={() => handleMaskSelect('brush')} className="w-full flex items-center gap-1.5 p-1.5 rounded-lg border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[9px] uppercase font-bold cursor-pointer transition-all" data-testid="radial-mask-brush"><span>🖌️</span><span>Brush</span></button>
              <button onClick={() => handleMaskSelect('rect')} className="w-full flex items-center gap-1.5 p-1.5 rounded-lg border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[9px] uppercase font-bold cursor-pointer transition-all" data-testid="radial-mask-rect"><span>▭</span><span>Rectangle</span></button>
              <button onClick={() => handleMaskSelect('circle')} className="w-full flex items-center gap-1.5 p-1.5 rounded-lg border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[9px] uppercase font-bold cursor-pointer transition-all" data-testid="radial-mask-circle"><span>◯</span><span>Circle</span></button>
              {settings.maskEnabled && (
                <button onClick={handleMaskOff} className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/20 text-[9px] uppercase font-bold cursor-pointer" data-testid="radial-mask-off">
                  <XCircle className="w-3.5 h-3.5" /><span>Off</span>
                </button>
              )}
            </div>
          )}

          {/* BOTTOM-LEFT SUBMENU: FOG OF WAR */}
          {activeSubMenu === 'fog' && (
            <div className="absolute bottom-0 -left-32 flex flex-col items-center justify-center w-28 bg-black/85 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-2 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150 space-y-1.5">
              <div className="w-full grid grid-cols-2 gap-1">
                <button onClick={() => updateSettings({ fogMode: 'reveal' })} className={`p-1 rounded-md border text-[8px] uppercase font-bold ${(settings.fogMode || 'reveal') === 'reveal' ? 'bg-[#caa055]/30 border-[#caa055] text-[#f1d9a0]' : 'border-[#caa055]/30 text-[#caa055]'}`} data-testid="radial-fog-reveal">Reveal</button>
                <button onClick={() => updateSettings({ fogMode: 'hide' })} className={`p-1 rounded-md border text-[8px] uppercase font-bold ${settings.fogMode === 'hide' ? 'bg-[#caa055]/30 border-[#caa055] text-[#f1d9a0]' : 'border-[#caa055]/30 text-[#caa055]'}`} data-testid="radial-fog-hide">Cover</button>
              </div>
              <button onClick={() => handleFogTool('fog-brush')} className="w-full flex items-center gap-1.5 p-1.5 rounded-lg border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[9px] uppercase font-bold cursor-pointer transition-all" data-testid="radial-fog-brush"><span>🖌️</span><span>Brush</span></button>
              <button onClick={() => handleFogTool('fog-rect')} className="w-full flex items-center gap-1.5 p-1.5 rounded-lg border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[9px] uppercase font-bold cursor-pointer transition-all" data-testid="radial-fog-rect"><span>▭</span><span>Rectangle</span></button>
              <button onClick={() => handleFogTool('fog-circle')} className="w-full flex items-center gap-1.5 p-1.5 rounded-lg border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[9px] uppercase font-bold cursor-pointer transition-all" data-testid="radial-fog-circle"><span>◯</span><span>Circle</span></button>
              <div className="w-full grid grid-cols-2 gap-1">
                <button onClick={() => handleFogAll(true)} className="p-1 rounded-md border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[8px] uppercase font-bold" data-testid="radial-fog-reveal-all">Show all</button>
                <button onClick={() => handleFogAll(false)} className="p-1 rounded-md border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[8px] uppercase font-bold" data-testid="radial-fog-cover-all">Cover all</button>
              </div>
              {settings.fogEnabled && (
                <button onClick={handleFogOff} className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/20 text-[9px] uppercase font-bold cursor-pointer" data-testid="radial-fog-off">
                  <XCircle className="w-3.5 h-3.5" /><span>Fog off</span>
                </button>
              )}
            </div>
          )}

          {/* BOTTOM-RIGHT SUBMENU (LEVEL 2): EFFECTS CATEGORY */}
          {activeSubMenu === 'effects' && (
            <div className="absolute bottom-0 -right-32 flex flex-col items-center justify-center w-28 bg-black/85 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-2 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150 space-y-1.5">
              {EFFECT_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => handleEffectCategorySelect(cat.key)}
                  className="w-full flex items-center gap-1.5 p-1.5 rounded-lg border border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20 text-[9px] uppercase font-bold cursor-pointer transition-all"
                  data-testid={`radial-effects-cat-${cat.key}`}
                >
                  <span className="text-xs leading-none">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
              {settings.effectsEnabled && (
                <button
                  onClick={handleEffectsOff}
                  className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/20 text-[9px] uppercase font-bold cursor-pointer"
                  data-testid="radial-effects-off"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Off</span>
                </button>
              )}
            </div>
          )}

          {/* BOTTOM-RIGHT SUBMENU (LEVEL 3): PAINT TOOL — reached after a category is picked */}
          {activeSubMenu === 'effectsTool' && (
            <div className="absolute bottom-0 -right-32 flex flex-col items-center justify-center w-28 bg-black/85 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-2 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150 space-y-1.5">
              <button
                onClick={() => setActiveSubMenu('effects')}
                className="w-full flex items-center justify-center gap-1 p-1 rounded-lg text-[8px] uppercase font-bold text-[#caa055]/60 hover:text-[#caa055] cursor-pointer"
                data-testid="radial-effects-tool-back"
              >
                ← Back
              </button>
              {EFFECT_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleEffectToolSelect(tool.id)}
                  className={`w-full flex items-center gap-1.5 p-1.5 rounded-lg border transition-all cursor-pointer text-[9px] uppercase font-bold ${
                    settings.effectTool === tool.id && settings.effectsEnabled
                      ? 'bg-[#caa055] text-black border-white'
                      : 'border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20'
                  }`}
                  data-testid={`radial-effects-tool-${tool.id}`}
                >
                  <span className="text-xs leading-none">{tool.emoji}</span>
                  <span>{tool.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* BOTTOM-RIGHT SUBMENU (LEVEL 4, LAST): scrollable list of effects in the chosen category */}
          {activeSubMenu === 'effectsList' && (
            <div className="absolute bottom-0 -right-44 flex flex-col w-40 max-h-72 bg-black/90 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-2 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setActiveSubMenu('effectsTool')}
                className="w-full flex items-center justify-center p-1 text-[8px] uppercase font-bold text-[#caa055]/60 hover:text-[#caa055] cursor-pointer shrink-0"
                data-testid="radial-effects-list-back"
              >
                ← Back
              </button>
              <div className="overflow-y-auto space-y-1 pr-0.5">
                {effectListItems.length === 0 && (
                  <p className="text-[9px] text-white/50 text-center py-3">
                    {pendingEffectCategory === 'vault' ? 'No vault effects found' : 'No effects'}
                  </p>
                )}
                {effectListItems.map((eff) => (
                  <button
                    key={eff.id}
                    onClick={() => handleEffectPick(eff)}
                    className={`w-full flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                      settings.activeEffectId === eff.id
                        ? 'bg-[#caa055] text-black border-white'
                        : 'border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/20'
                    }`}
                    title={eff.description || eff.name}
                    data-testid={`radial-effect-${eff.id}`}
                  >
                    <span className="text-xs leading-none shrink-0">{eff.emoji || '✨'}</span>
                    <span className="text-[9px] font-bold uppercase truncate">{eff.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RIGHT SUBMENU: BEACON */}
          {activeSubMenu === 'beacon' && (
            <div className="absolute -right-28 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-28 bg-black/85 border border-[#caa055]/50 rounded-2xl backdrop-blur-md p-2 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150 space-y-2">
              <button
                onClick={handleBeaconSelect}
                className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-[#caa055] text-black font-bold text-[9px] uppercase tracking-wider hover:bg-[#e2b563] cursor-pointer shadow-lg"
              >
                <Radio className="w-4 h-4" />
                <span>Beacon Mode</span>
              </button>
              {settings.pingMode && (
                <button
                  onClick={() => { updateSettings({ pingMode: false }); closeRadialMenu(); toast.info('Exited Beacon Mode'); }}
                  className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-black/40 text-[9px] uppercase font-bold cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Exit Mode</span>
                </button>
              )}
              <button
                onClick={() => { clearPings(); closeRadialMenu(); toast.success('Cleared all map beacons'); }}
                className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/20 text-[9px] uppercase font-bold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Beacons</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
