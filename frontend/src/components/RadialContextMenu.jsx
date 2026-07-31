import React, { useState, useEffect, useRef } from 'react';
import { useGrid } from '../context/GridContext';
import { toast } from 'sonner';
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
  Grid
} from 'lucide-react';
import { toast } from 'sonner';

export function RadialContextMenu() {
  const { 
    radialMenuOpen, radialMenuPos, closeRadialMenu, settings, updateSettings,
    addPing, clearDrawings, clearPings, radialMenuConfig, setShowClipartLibrary,
    broadcastPing, sessionCode, selectedClipartIds = [],
    groupSelectedCliparts, ungroupSelectedCliparts,
    setTokenLabel, toggleTokenStatus, bringTokenToFront, sendTokenToBack,
    updatePlacedClipart, TOKEN_SIZE_PRESETS, DND_CONDITIONS,
  } = useGrid();

  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [showLabelEdit, setShowLabelEdit] = useState(false);
  const menuRef = useRef(null);

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

  const handleLibrarySelect = () => {
    if (setShowClipartLibrary) {
      setShowClipartLibrary(true);
    }
    const elem = document.getElementById('section-clipart');
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    toast.success('Opened Token & Clipart Library');
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

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto bg-black/20 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-150">
      <div 
        ref={menuRef}
        className="absolute select-none transform -translate-x-1/2 -translate-y-1/2"
        style={{ left: clampedX, top: clampedY }}
      >
        {/* Background Outer Ring Halo */}
        <div className="w-80 h-80 rounded-full border border-[#caa055]/30 bg-[#111214]/90 shadow-[0_0_50px_rgba(202,160,85,0.25)] backdrop-blur-md relative flex items-center justify-center p-3">
          
          {/* Decorative Ring Slices & Pattern */}
          <div className="absolute inset-2 rounded-full border border-[#caa055]/15 pointer-events-none" />
          <div className="absolute inset-16 rounded-full border border-[#caa055]/20 pointer-events-none" />

          {/* Quadrant Crosshair Lines */}
          <div className="absolute w-full h-[1px] bg-[#caa055]/20 pointer-events-none" />
          <div className="absolute h-full w-[1px] bg-[#caa055]/20 pointer-events-none" />

          {/* MAIN QUADRANT 1: TOP (Measure Submenu) */}
          <div 
            className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('measure')}
            onClick={() => setActiveSubMenu(activeSubMenu === 'measure' ? null : 'measure')}
            data-testid="radial-top-measure"
          >
            <div className={`w-14 h-14 rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${activeSubMenu === 'measure' ? 'bg-[#caa055]/30 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110' : 'bg-black/60 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20'}`}>
              <Ruler className="w-6 h-6 text-[#caa055]" />
              <span className="text-[9px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">Measure</span>
            </div>
          </div>

          {/* MAIN QUADRANT 2: RIGHT (Beacon / Ping) */}
          <div 
            className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('beacon')}
            onClick={handleBeaconSelect}
            data-testid="radial-right-beacon"
          >
            <div className="w-14 h-14 rounded-full border bg-black/60 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 flex flex-col items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-[0_0_15px_#caa055]">
              <Radio className="w-6 h-6 text-[#caa055] animate-pulse" />
              <span className="text-[9px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">Beacon</span>
            </div>
          </div>

          {/* MAIN QUADRANT 3: BOTTOM (Token & Clipart Library) */}
          <div 
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('library')}
            onClick={handleLibrarySelect}
            data-testid="radial-bottom-library"
          >
            <div className="w-14 h-14 rounded-full border bg-black/60 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 flex flex-col items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-[0_0_15px_#caa055]">
              <Image className="w-6 h-6 text-[#caa055]" />
              <span className="text-[9px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">Library</span>
            </div>
          </div>

          {/* MAIN QUADRANT 4: LEFT (Draw Submenu) */}
          <div 
            className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10"
            onMouseEnter={() => setActiveSubMenu('draw')}
            onClick={() => setActiveSubMenu(activeSubMenu === 'draw' ? null : 'draw')}
            data-testid="radial-left-draw"
          >
            <div className={`w-14 h-14 rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${activeSubMenu === 'draw' ? 'bg-[#caa055]/30 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110' : 'bg-black/60 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20'}`}>
              <PenTool className="w-6 h-6 text-[#caa055]" />
              <span className="text-[9px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">Draw</span>
            </div>
          </div>

          {/* CORNER: TOP-LEFT — Token options (visible when right-clicking a token) */}
          {activeToken && (
            <div
              className="absolute top-6 left-6 flex flex-col items-center cursor-pointer z-10"
              onClick={() => setActiveSubMenu(activeSubMenu === 'token' ? null : 'token')}
              title="Token Options"
            >
              <div className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${
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
            className="absolute top-6 right-6 flex flex-col items-center group cursor-pointer z-10"
            onClick={handleGroupToggle}
            data-testid="radial-corner-group"
            title={isGrouped ? "Ungroup Selected Tokens" : "Group Selected Tokens"}
          >
            <div className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all duration-200 relative ${
              selectedClipartIds.length > 1 || isGrouped 
                ? 'bg-[#caa055]/40 border-[#caa055] shadow-[0_0_15px_#caa055] scale-110' 
                : 'bg-black/80 border-[#caa055]/40 hover:border-[#caa055] hover:bg-[#caa055]/20 hover:scale-105'
            }`}>
              <Layers className={`w-5 h-5 ${isGrouped ? 'text-amber-300' : 'text-[#caa055]'}`} />
              <span className="text-[7.5px] font-cinzel font-bold text-[#caa055] uppercase tracking-wider mt-0.5">
                {isGrouped ? 'Ungroup' : 'Group'}
              </span>
              {selectedClipartIds.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#caa055] text-black text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow border border-white">
                  {selectedClipartIds.length}
                </span>
              )}
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
    </div>
  );
}
