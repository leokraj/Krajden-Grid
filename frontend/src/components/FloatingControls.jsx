import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useGrid } from '../context/GridContext';
import SessionContext from '../context/SessionContext';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DiceRollerPanel } from './DiceRollerPanel';
import { InitiativeTrackerPanel } from './InitiativeTrackerPanel';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { SessionControls } from './SessionControls';
import { ClipartLibrary } from './ClipartLibrary';
import { CommunityBrowser } from './CommunityBrowser';
import BackgroundLayersPanel from './BackgroundLayersPanel';
import SceneEditorPanel from './SceneEditorPanel';
import { FloatingWindow } from './FloatingWindow';
import { EffectsControlPanel } from './EffectsLayer';
import { CustomizationModal } from './CustomizationModal';
import { 
  Grid3X3, 
  Ruler, 
  RotateCcw, 
  X, 
  Minus,
  GripVertical,
  Circle,
  Triangle,
  Move,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  Lock,
  Unlock,
  Calculator,
  Pencil,
  Image,
  Trash2,
  Upload,
  Eraser,
  RotateCw,
  Grid2X2,
  ExternalLink,
  Sticker,
  Globe,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Dices,
  Sword,
  Keyboard,
  Settings,
  Zap,
  Radio,
  MapPin,
  Film,
} from 'lucide-react';

export const FloatingControls = ({ onClose }) => {
  const { 
    settings, 
    updateSettings, 
    resetSettings, 
    clearDrawings, 
    setBackgroundImage, 
    clearBackgroundImage,
    clearAllCliparts,
    clipartFavorites,
    toggleClipartFavorite,
    customCliparts,
    addCustomClipart,
    removeCustomClipart,
    addPlacedClipart,
    clearMask,
    savedMasks,
    saveMask,
    loadMask,
    deleteSavedMask,
    toggleBgLayersLocked,
    pings,
    addPing,
    removePing,
    clearPings,
    showClipartLibrary,
    setShowClipartLibrary,
  } = useGrid();
  
  // Session context for clipart sync and VTT tools
  const sessionContext = useContext(SessionContext);
  const sessionCode = sessionContext?.sessionCode;
  const isHost = sessionContext?.isHost !== false; // Default to true if not in session to let them control the tools
  const isGuest = sessionCode && !sessionContext?.isHost;
  const broadcastAddClipart = sessionContext?.broadcastAddClipart;
  const broadcastClearAllCliparts = sessionContext?.broadcastClearAllCliparts;
  const broadcastBackgroundImage = sessionContext?.broadcastBackgroundImage;
  const clearSessionBackground = sessionContext?.clearSessionBackground;
  const broadcastClearAll = sessionContext?.broadcastClearAll;

  // VTT synchronized hooks
  const diceRolls = sessionContext?.diceRolls || [];
  const initiativeList = sessionContext?.initiativeList || [];
  const currentTurnIndex = sessionContext?.currentTurnIndex !== undefined ? sessionContext?.currentTurnIndex : -1;
  const broadcastRollDice = sessionContext?.broadcastRollDice;
  const broadcastUpdateInitiative = sessionContext?.broadcastUpdateInitiative;
  const broadcastClearDiceRolls = sessionContext?.broadcastClearDiceRolls;
  const userName = sessionContext?.userName || 'Host';

  // Standalone offline fallbacks
  const [localDiceRolls, setLocalDiceRolls] = useState([]);
  const [localInitiativeList, setLocalInitiativeList] = useState([]);
  const [localCurrentTurnIndex, setLocalCurrentTurnIndex] = useState(-1);

  const finalDiceRolls = sessionCode ? diceRolls : localDiceRolls;
  const finalInitiativeList = sessionCode ? initiativeList : localInitiativeList;
  const finalCurrentTurnIndex = sessionCode ? currentTurnIndex : localCurrentTurnIndex;

  const handleRollDice = useCallback((rollData) => {
    if (sessionCode && broadcastRollDice) {
      broadcastRollDice(rollData);
    } else {
      const rollRecord = {
        id: `roll_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: userName,
        timestamp: new Date().toISOString(),
        ...rollData
      };
      setLocalDiceRolls((prev) => [...prev, rollRecord].slice(-50));
    }
  }, [sessionCode, broadcastRollDice, userName]);

  const handleClearDiceRolls = useCallback(() => {
    if (sessionCode && broadcastClearDiceRolls) {
      broadcastClearDiceRolls();
    } else {
      setLocalDiceRolls([]);
    }
  }, [sessionCode, broadcastClearDiceRolls]);

  const handleUpdateInitiative = useCallback((list, turnIndex) => {
    if (sessionCode && broadcastUpdateInitiative) {
      broadcastUpdateInitiative(list, turnIndex);
    } else {
      setLocalInitiativeList(list);
      setLocalCurrentTurnIndex(turnIndex);
    }
  }, [sessionCode, broadcastUpdateInitiative]);
  
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [measurementPopup, setMeasurementPopup] = useState(null);
  const [showCommunityBrowser, setShowCommunityBrowser] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showScenePanel, setShowScenePanel] = useState(false);
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [maskSaveName, setMaskSaveName] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({
    geometry: true,
    measure: true,
    ping: true,
    draw: true,
    mask: true,
    appearance: true,
    bgcolor: true,
    resolution: true,
    clipart: true,
    bgimage: true,
    scenes: true,
    dice: true,
    initiative: true,
    session: true,
  });
  const [undockedPanels, setUndockedPanels] = useState({
    layers: false,
    clipart: false,
    scenes: false,
  });
  const [displays, setDisplays] = useState([]);
  const [currentDisplayId, setCurrentDisplayId] = useState(null);

  useEffect(() => {
    if (window.electronAPI?.getDisplays) {
      const fetchDisplays = async () => {
        try {
          const list = await window.electronAPI.getDisplays();
          setDisplays(list);
          const currentId = await window.electronAPI.getCurrentDisplayId();
          setCurrentDisplayId(currentId);
        } catch (err) {
          console.error('Failed to fetch displays from electron:', err);
        }
      };

      fetchDisplays();

      if (window.electronAPI.on) {
        const cleanupDisplayUpdate = window.electronAPI.on('display-updated', (data) => {
          if (data && data.displayId !== undefined) {
            setCurrentDisplayId(data.displayId);
          }
        });
        return () => {
          if (typeof cleanupDisplayUpdate === 'function') {
            cleanupDisplayUpdate();
          }
        };
      }
    }
  }, []);

  const handleSelectDisplay = async (displayId) => {
    if (window.electronAPI?.setDisplayId) {
      try {
        const success = await window.electronAPI.setDisplayId(displayId);
        if (success) {
          setCurrentDisplayId(displayId);
        }
      } catch (err) {
        console.error('Failed to set display in electron:', err);
      }
    }
  };

  const fileInputRef = useRef(null);
  const isElectronWindow = !!window.electronAPI?.isElectron && new URLSearchParams(window.location.search).get('mode') === 'controls';

  const getButtonClass = (isActive) => 
    isActive
      ? "bg-[#caa055] text-[#111214] border border-[#caa055]/30 font-cinzel font-bold text-[10px] tracking-wider hover:bg-[#d5b271] h-8 px-3 rounded-[4px] cursor-pointer"
      : "border border-[#caa055]/20 hover:border-[#caa055]/50 hover:bg-[#caa055]/5 text-[#caa055]/80 hover:text-white font-cinzel font-semibold text-[10px] tracking-wider bg-black/10 h-8 px-3 rounded-[4px] cursor-pointer transition-all duration-200";

  const toggleSection = (id) => setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleInputChange = (field, value) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      if (settings.lockRatio && (field === 'unitWidth' || field === 'unitHeight')) {
        // When locked, update both to keep square cells
        updateSettings({ unitWidth: numValue, unitHeight: numValue, gridSize: numValue });
      } else {
        updateSettings({ [field]: numValue });
      }
    }
  };

  const handleGridSizeSlider = (value) => {
    const gridSize = value[0];
    if (settings.lockRatio) {
      // Perfect squares mode - gridSize represents number of squares
      updateSettings({ gridSize });
    } else {
      // Maintain aspect ratio when adjusting
      const ratio = settings.unitHeight / settings.unitWidth;
      const newWidth = gridSize;
      const newHeight = Math.round(gridSize * ratio);
      updateSettings({ unitWidth: newWidth, unitHeight: newHeight, gridSize });
    }
  };

  const toggleLockRatio = () => {
    const newLockRatio = !settings.lockRatio;
    if (newLockRatio) {
      // When locking, use a reasonable default for perfect squares
      const size = Math.min(settings.unitWidth, settings.unitHeight);
      updateSettings({ lockRatio: true, gridSize: size });
    } else {
      updateSettings({ lockRatio: false });
    }
  };

  // Toggle drawing mode
  const toggleDrawingMode = () => {
    const newDrawingEnabled = !settings.drawingEnabled;
    if (newDrawingEnabled) {
      updateSettings({ drawingEnabled: true, measureMode: false, eraserEnabled: false });
    } else {
      updateSettings({ drawingEnabled: false, eraserEnabled: false });
    }
  };

  // Handle image file upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target.result;
        setBackgroundImage(imageData);
        // Broadcast to session
        if (sessionCode && broadcastBackgroundImage) {
          broadcastBackgroundImage(imageData);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target.result;
        setBackgroundImage(imageData);
        if (sessionCode && broadcastBackgroundImage) {
          broadcastBackgroundImage(imageData);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [setBackgroundImage, sessionCode, broadcastBackgroundImage]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Open measurement popup window
  const openMeasurementPopup = useCallback(() => {
    // Close existing popup if open
    if (measurementPopup && !measurementPopup.closed) {
      measurementPopup.focus();
      return;
    }
    
    const popup = window.open(
      '/measurement-popup.html',
      'Krajden Grid Measurement',
      'width=300,height=200,resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no'
    );
    
    if (popup) {
      setMeasurementPopup(popup);
      
      // Clean up when popup is closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setMeasurementPopup(null);
        }
      }, 500);
    }
  }, [measurementPopup]);

  // Send measurement data to popup
  useEffect(() => {
    if (measurementPopup && !measurementPopup.closed && settings.liveMeasurement) {
      measurementPopup.postMessage({
        type: 'measurement',
        measureMode: settings.measureMode,
        value: settings.liveMeasurement.unitDistance * settings.measureMultiplier,
        multiplier: settings.measureMultiplier,
        coneAngle: settings.coneAngle,
      }, '*');
    }
  }, [measurementPopup, settings.liveMeasurement, settings.measureMode, settings.measureMultiplier, settings.coneAngle]);

  const measureModes = [
    { id: 'line', icon: Move, label: 'Line' },
    { id: 'radial', icon: Circle, label: 'Radial' },
    { id: 'cone', icon: Triangle, label: 'Cone' },
  ];

  const coneAngles = [45, 53, 60, 90];
  const multiplierPresets = [1, 1.5, 2, 5, 10];
  const drawingColors = ['#FF4444', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];

  const backgroundPresets = [
    { color: '#000000', label: 'Black' },
    { color: '#1a1a1a', label: 'Dark' },
    { color: '#2d2d2d', label: 'Gray' },
    { color: '#ffffff', label: 'White' },
    { color: '#0a192f', label: 'Navy' },
    { color: '#1a1a2e', label: 'Purple' },
  ];

  if (isMinimized) {
    return (
      <div
        className={isElectronWindow ? "border border-[#caa055]/20 rounded-[6px] shadow-2xl bg-[#111214]" : "fixed z-[9999] border border-[#caa055]/20 rounded-[6px] shadow-2xl cursor-move bg-[#111214]"}
        style={isElectronWindow ? { WebkitAppRegion: 'drag' } : { left: position.x, top: position.y }}
        onMouseDown={isElectronWindow ? undefined : handleMouseDown}
        onMouseMove={isElectronWindow ? undefined : handleMouseMove}
        onMouseUp={isElectronWindow ? undefined : handleMouseUp}
        onMouseLeave={isElectronWindow ? undefined : handleMouseUp}
        data-testid="floating-controls-minimized"
      >
        <div className="drag-handle flex items-center gap-2 p-2" style={isElectronWindow ? { WebkitAppRegion: 'no-drag' } : undefined}>
          <GripVertical className="w-4 h-4 text-slate-muted" />
          <Grid3X3 className="w-5 h-5 text-[#caa055]" />
          <span className="font-mono text-sm font-bold text-[#caa055]">KG</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(false)}
            className="h-6 w-6 p-0 ml-2"
          >
            <Move className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 text-slate-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div
      className={isElectronWindow 
        ? "rounded-[6px] shadow-2xl w-full h-screen overflow-hidden border border-[#caa055]/20 bg-[#111214]" 
        : "fixed z-[9999] rounded-[6px] shadow-2xl w-[320px] max-h-[90vh] overflow-hidden border border-[#caa055]/20 bg-[#111214]/95 backdrop-blur-md"}
      style={isElectronWindow 
        ? undefined
        : { left: position.x, top: position.y }}
      onMouseDown={isElectronWindow ? undefined : handleMouseDown}
      onMouseMove={isElectronWindow ? undefined : handleMouseMove}
      onMouseUp={isElectronWindow ? undefined : handleMouseUp}
      onMouseLeave={isElectronWindow ? undefined : handleMouseUp}
      data-testid="floating-controls"
    >
      {/* Header */}
      <div className="drag-handle flex items-center justify-between p-3 bg-[#caa055]/5 border-b border-[#caa055]/20 cursor-move" style={isElectronWindow ? { WebkitAppRegion: 'drag' } : undefined}>
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-slate-muted" />
          <Grid3X3 className="w-5 h-5 text-[#caa055]" />
          <span className="font-cinzel text-xs font-bold tracking-widest">
            <span className="text-white">KRAJDEN </span>
            <span className="text-[#caa055]">GRID</span>
          </span>
        </div>
        <div className="flex items-center gap-1" style={isElectronWindow ? { WebkitAppRegion: 'no-drag' } : undefined}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(true)}
            className="h-6 w-6 p-0 text-slate-muted hover:text-white"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={isElectronWindow ? () => window.close() : onClose}
            className="h-6 w-6 p-0 text-slate-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className={`p-4 space-y-4 overflow-y-auto ${isElectronWindow ? 'max-h-[calc(100vh-50px)]' : 'max-h-[calc(90vh-50px)]'}`} id="floating-controls-scroll" data-testid="floating-controls-panel">
        
        {isGuest && (
          <div className="text-[10px] text-[#caa055]/70 bg-[#caa055]/5 border border-[#caa055]/20 rounded-[4px] px-2 py-1.5 uppercase font-mono tracking-wider">
            Guest mode — Grid & background synced from host
          </div>
        )}

        <Separator className="bg-[#caa055]/20" />

        {/* Fullscreen Button (browser only) */}
        {!window.electronAPI?.isElectron && (
          <Button
            onClick={toggleFullscreen}
            className="w-full h-10 rounded-[4px] bg-[#caa055] hover:bg-[#d5b271] text-[#1c1d1f] font-bold tracking-[0.14em] font-cinzel text-xs flex items-center justify-center gap-1.5 border border-[#caa055]/30 shadow-md shadow-[#caa055]/5 cursor-pointer transition-all duration-200"
            data-testid="fullscreen-btn"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                EXIT FULL SCREEN
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                ENTER FULL SCREEN
              </>
            )}
          </Button>
        )}

        {!window.electronAPI?.isElectron && <Separator className="bg-[#caa055]/15" />}

        {/* Host-only Top Sections: Resolution, Grid Layout, Grid Appearance, Grid Mask */}
        {!isGuest && (
          <>
            {/* Resolution */}
            <div className="space-y-3" id="section-resolution">
              <button onClick={() => toggleSection('resolution')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-[#caa055]/80" />
                  Resolution
                </span>
                {collapsedSections.resolution ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
              </button>
              {!collapsedSections.resolution && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                    <div className="space-y-1 text-left">
                      <Label className="text-[9px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Width (px)</Label>
                      <Input
                        type="number"
                        value={settings.screenWidth}
                        onChange={(e) => handleInputChange('screenWidth', e.target.value)}
                        className="h-8 text-xs font-mono bg-black/40 border-[#caa055]/20 text-[#F3EEE7]"
                        data-testid="screen-width-floating"
                      />
                    </div>
                    <div className="space-y-1 text-left">
                      <Label className="text-[9px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Height (px)</Label>
                      <Input
                        type="number"
                        value={settings.screenHeight}
                        onChange={(e) => handleInputChange('screenHeight', e.target.value)}
                        className="h-8 text-xs font-mono bg-black/40 border-[#caa055]/20 text-[#F3EEE7]"
                        data-testid="screen-height-floating"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap bg-black/15 border border-[#caa055]/5 rounded-[4px] p-2.5">
                    {[
                      { w: 1920, h: 1080 },
                      { w: 2560, h: 1440 },
                      { w: 1280, h: 720 },
                    ].map((res) => (
                      <button
                        key={`${res.w}x${res.h}`}
                        onClick={() => updateSettings({ screenWidth: res.w, screenHeight: res.h })}
                        className={`text-[9px] font-mono font-semibold tracking-wider h-6 px-2.5 rounded-[4px] border border-[#caa055]/20 text-[#caa055]/80 hover:text-white hover:border-[#caa055]/60 hover:bg-[#caa055]/5 cursor-pointer bg-black/10`}
                      >
                        {res.w}×{res.h}
                      </button>
                    ))}
                  </div>

                  {/* Electron Monitor Selection */}
                  {!!window.electronAPI && displays.length > 0 && (
                    <div className="space-y-2 bg-black/20 border border-[#caa055]/15 rounded-[4px] p-3 mt-3">
                      <Label className="text-[9px] uppercase tracking-[0.12em] text-[#caa055] font-cinzel font-bold block mb-1">
                        Active Monitor / Screen
                      </Label>
                      <div className="space-y-1.5">
                        {displays.map((display) => {
                          const isActive = currentDisplayId?.toString() === display.id.toString();
                          return (
                            <button
                              key={display.id}
                              onClick={() => handleSelectDisplay(display.id)}
                              className={`w-full flex items-center justify-between text-left p-2 rounded-[4px] border transition-all text-xs cursor-pointer ${
                                isActive
                                  ? 'bg-[#caa055]/10 border-[#caa055] text-white font-semibold'
                                  : 'bg-black/30 border-[#caa055]/10 hover:border-[#caa055]/30 text-[#caa055]/70 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Monitor className={`w-3.5 h-3.5 ${isActive ? 'text-[#caa055]' : 'text-[#caa055]/50'}`} />
                                <span className="font-sans text-[11px]">{display.name}</span>
                              </div>
                              {isActive ? (
                                <span className="text-[8px] font-mono bg-[#caa055] text-[#111214] font-bold px-1.5 py-0.5 rounded-[2px] tracking-wider uppercase">
                                  Active
                                </span>
                              ) : (
                                display.isPrimary && (
                                  <span className="text-[8px] font-mono border border-[#caa055]/20 text-[#caa055]/60 px-1.5 py-0.5 rounded-[2px] tracking-wider uppercase">
                                    Primary
                                  </span>
                                )
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[8.5px] text-slate-muted font-sans leading-normal">
                        Select which screen/monitor the transparent tabletop grid overlay should be displayed on.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <Separator className="bg-[#caa055]/15" />
            </div>

            {/* Grid Layout */}
            <div className="space-y-3" id="section-geometry">
              <button onClick={() => toggleSection('geometry')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
                  <Grid3X3 className="w-3.5 h-3.5 text-[#caa055]/80" />
                  Grid Layout
                </span>
                {collapsedSections.geometry ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
              </button>
              {!collapsedSections.geometry && (
                <div className="space-y-3.5 pt-1">
                  {/* Grid line toggle */}
                  <div className="flex items-center justify-between p-3 rounded-[4px] bg-black/25 border border-[#caa055]/10">
                    <div className="flex items-center gap-2">
                      <Grid3X3 className="w-4 h-4 text-[#caa055]" />
                      <span className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Grid lines</span>
                    </div>
                    <Switch
                      checked={settings.gridEnabled}
                      onCheckedChange={(checked) => updateSettings({ gridEnabled: checked })}
                      data-testid="grid-toggle-floating"
                    />
                  </div>

                  {/* Square Grid Ratio lock */}
                  <div className="flex items-center justify-between p-3 rounded-[4px] bg-black/25 border border-[#caa055]/10">
                    <div className="space-y-0.5 text-left pr-2">
                      <Label className="text-[10px] text-slate-cool uppercase tracking-wider font-outfit font-semibold">Square Grid Ratio</Label>
                      <p className="text-[9px] text-slate-muted leading-relaxed">Lock perfect 1:1 squares</p>
                    </div>
                    <Switch
                      checked={settings.lockRatio}
                      onCheckedChange={toggleLockRatio}
                      data-testid="lock-ratio-switch"
                    />
                  </div>

                  {/* Grid size controls */}
                  {settings.lockRatio ? (
                    <div className="space-y-2.5 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold">Grid Dimensions (Count)</span>
                        <span className="text-[#caa055]/80 font-medium font-sans text-xs">{settings.gridSize || 40} cells</span>
                      </div>
                      <Slider
                        value={[settings.gridSize || 40]}
                        onValueChange={handleGridSizeSlider}
                        min={5}
                        max={150}
                        step={1}
                        className="h-4"
                        data-testid="grid-size-slider"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                      <div className="space-y-1.5 text-left">
                        <Label className="text-[9px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Cell Width (px)</Label>
                        <Input
                          type="number"
                          value={settings.unitWidth || 50}
                          onChange={(e) => updateSettings({ unitWidth: parseInt(e.target.value) || 50 })}
                          className="font-mono text-xs h-8 bg-black/40 border-[#caa055]/20 text-[#F3EEE7] mb-1.5"
                        />
                        <Slider
                          value={[settings.unitWidth || 50]}
                          onValueChange={([val]) => updateSettings({ unitWidth: val })}
                          min={5}
                          max={200}
                          step={1}
                          className="h-4"
                          data-testid="unit-width-slider"
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <Label className="text-[9px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Cell Height (px)</Label>
                        <Input
                          type="number"
                          value={settings.unitHeight || 50}
                          onChange={(e) => updateSettings({ unitHeight: parseInt(e.target.value) || 50 })}
                          className="font-mono text-xs h-8 bg-black/40 border-[#caa055]/20 text-[#F3EEE7] mb-1.5"
                        />
                        <Slider
                          value={[settings.unitHeight || 50]}
                          onValueChange={([val]) => updateSettings({ unitHeight: val })}
                          min={5}
                          max={200}
                          step={1}
                          className="h-4"
                          data-testid="unit-height-slider"
                        />
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-[#caa055]/70 font-mono p-2.5 bg-black/40 border border-[#caa055]/10 rounded-[4px] leading-relaxed">
                    {settings.lockRatio ? (
                      <>Cell: {(Math.min(settings.screenWidth, settings.screenHeight) / (settings.gridSize || 40)).toFixed(1)} × {(Math.min(settings.screenWidth, settings.screenHeight) / (settings.gridSize || 40)).toFixed(1)} px (square)</>
                    ) : (
                      <>Cell: {(settings.screenWidth / (settings.unitWidth || 50)).toFixed(1)} × {(settings.screenHeight / (settings.unitHeight || 50)).toFixed(1)} px</>
                    )}
                  </div>
                </div>
              )}
              <Separator className="bg-[#caa055]/15" />
            </div>

            {/* Grid Appearance */}
            <div className="space-y-3" id="section-appearance">
              <button onClick={() => toggleSection('appearance')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
                  <Grid3X3 className="w-3.5 h-3.5 text-[#caa055]/80" />
                  Grid Appearance
                </span>
                {collapsedSections.appearance ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
              </button>
              {!collapsedSections.appearance && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                    <Label className="text-[10px] text-slate-cool uppercase tracking-wider font-outfit font-semibold flex-1">Color</Label>
                    <Input
                      type="text"
                      value={settings.gridColor}
                      onChange={(e) => updateSettings({ gridColor: e.target.value })}
                      className="w-20 h-8 text-xs font-mono bg-black/40 border-[#caa055]/20 text-[#F3EEE7]"
                    />
                    <Input
                      type="color"
                      value={settings.gridColor}
                      onChange={(e) => updateSettings({ gridColor: e.target.value })}
                      className="w-8 h-8 p-0.5 cursor-pointer bg-black/40 border-[#caa055]/20"
                      data-testid="grid-color-floating"
                    />
                  </div>

                  <div className="space-y-1 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold">Thickness</span>
                      <span className="text-slate-muted font-mono">{settings.lineThickness.toFixed(1)}px</span>
                    </div>
                    <Slider
                      value={[settings.lineThickness * 10]}
                      onValueChange={([value]) => updateSettings({ lineThickness: value / 10 })}
                      min={1}
                      max={50}
                      step={1}
                      className="h-4"
                    />
                  </div>

                  <div className="space-y-1 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold">Opacity</span>
                      <span className="text-slate-muted font-mono">{Math.round(settings.opacity * 100)}%</span>
                    </div>
                    <Slider
                      value={[settings.opacity * 100]}
                      onValueChange={([value]) => updateSettings({ opacity: value / 100 })}
                      min={5}
                      max={100}
                      step={5}
                      className="h-4"
                    />
                  </div>
                </div>
              )}
              <Separator className="bg-[#caa055]/15" />
            </div>

            {/* Grid Mask */}
            <div className="space-y-3" id="section-mask">
              <button onClick={() => toggleSection('mask')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
                  <Grid3X3 className="w-3.5 h-3.5 text-[#caa055]/80" />
                  Grid Mask
                </span>
                {collapsedSections.mask ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
              </button>
              {!collapsedSections.mask && (
                <div className="space-y-3 pt-1">
                  {/* Mask Mode Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-[4px] bg-black/25 border border-[#caa055]/10">
                    <span className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Mask Mode</span>
                    <Switch
                      checked={settings.maskEnabled}
                      onCheckedChange={(v) => updateSettings({ maskEnabled: v, drawingEnabled: false, eraserEnabled: false, measureMode: false })}
                      data-testid="mask-mode-toggle"
                    />
                  </div>

                  {settings.maskEnabled && (
                    <div className="space-y-3 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                      {/* Tool Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Tool</Label>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => updateSettings({ maskTool: 'brush' })}
                            className={`flex-1 ${getButtonClass(settings.maskTool === 'brush')}`}
                            data-testid="mask-tool-brush"
                          >
                            Brush
                          </button>
                          <button
                            onClick={() => updateSettings({ maskTool: 'rect' })}
                            className={`flex-1 ${getButtonClass(settings.maskTool === 'rect')}`}
                            data-testid="mask-tool-rect"
                          >
                            Rectangle
                          </button>
                          <button
                            onClick={() => updateSettings({ maskTool: 'circle' })}
                            className={`flex-1 ${getButtonClass(settings.maskTool === 'circle')}`}
                            data-testid="mask-tool-circle"
                          >
                            Circle
                          </button>
                        </div>
                      </div>

                      {/* Brush/Circle Size */}
                      {(settings.maskTool === 'brush' || settings.maskTool === 'circle') && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-slate-cool font-outfit font-semibold">
                              {settings.maskTool === 'circle' ? 'Circle Radius' : 'Brush Size'}
                            </Label>
                            <span className="text-xs text-slate-muted font-mono">{settings.maskBrushSize}px</span>
                          </div>
                          <Slider
                            value={[settings.maskBrushSize]}
                            onValueChange={([v]) => updateSettings({ maskBrushSize: v })}
                            min={5}
                            max={300}
                            step={1}
                            data-testid="mask-brush-size"
                          />
                        </div>
                      )}

                      {/* Clear Mask */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearMask}
                        className="w-full h-8 text-xs border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 font-cinzel tracking-wider"
                        data-testid="clear-mask-btn"
                      >
                        Clear Mask
                      </Button>
                    </div>
                  )}

                  {/* Save Mask */}
                  <div className="space-y-1.5 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                    <Label className="text-[10px] text-slate-cool uppercase tracking-wider font-outfit font-semibold">Save / Load Masks</Label>
                    <div className="flex gap-1">
                      <Input
                        value={maskSaveName}
                        onChange={(e) => setMaskSaveName(e.target.value)}
                        placeholder="Mask name..."
                        className="h-8 text-xs bg-black/40 border-[#caa055]/20 text-[#F3EEE7] flex-1"
                        data-testid="mask-save-name"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (maskSaveName.trim()) {
                            saveMask(maskSaveName.trim());
                            setMaskSaveName('');
                          }
                        }}
                        className="h-8 text-xs px-3 border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/5"
                        disabled={!maskSaveName.trim()}
                        data-testid="save-mask-btn"
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  {/* Saved Masks List */}
                  {savedMasks.length > 0 && (
                    <div className="space-y-1 max-h-[120px] overflow-y-auto bg-black/25 border border-[#caa055]/10 rounded-[4px] p-2">
                      {savedMasks.map((mask, i) => (
                        <div key={i} className="flex items-center gap-1 bg-[#caa055]/5 border border-[#caa055]/10 rounded-[4px] px-2 py-1">
                          <button
                            onClick={() => loadMask(i)}
                            className="flex-1 text-left text-xs text-[#caa055]/80 hover:text-[#caa055] truncate font-outfit font-medium"
                            title={`${mask.name} (${mask.resolution.screenWidth}x${mask.resolution.screenHeight} @ ${mask.resolution.gridSize}px)`}
                            data-testid={`load-mask-${i}`}
                          >
                            {mask.name}
                          </button>
                          <span className="text-[9px] text-[#caa055]/40 font-mono shrink-0">{mask.resolution.gridSize}px</span>
                          <button
                            onClick={() => deleteSavedMask(i)}
                            className="text-[#caa055]/40 hover:text-red-400 shrink-0 p-0.5"
                            data-testid={`delete-mask-${i}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Separator className="bg-[#caa055]/15" />
            </div>

            {/* Effects Tool */}
            <div className="space-y-3" id="section-effects">
              <button onClick={() => toggleSection('effects')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
                  <span className="text-base leading-none">✨</span>
                  Effects Tool
                </span>
                {collapsedSections.effects ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
              </button>
              {!collapsedSections.effects && (
                <EffectsControlPanel />
              )}
              <Separator className="bg-[#caa055]/15" />
            </div>
          </>
        )}

        {/* Measure Tools */}
        <div className="space-y-3" id="section-measure">
          <button onClick={() => toggleSection('measure')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Ruler className="w-3.5 h-3.5 text-[#caa055]/80" />
              Measure Tool
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-slate-muted">M KEY</span>
              {collapsedSections.measure ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
            </div>
          </button>
          {!collapsedSections.measure && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => updateSettings({ measureMode: false })}
                  className={getButtonClass(!settings.measureMode)}
                  data-testid="measure-off"
                >
                  Off
                </button>
                {measureModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => updateSettings({ measureMode: mode.id })}
                    className={getButtonClass(settings.measureMode === mode.id)}
                    data-testid={`measure-${mode.id}`}
                  >
                    <span className="flex items-center justify-center gap-0.5">
                      <mode.icon className="w-2.5 h-2.5" />
                      <span>{mode.label}</span>
                    </span>
                  </button>
                ))}
              </div>

              {settings.measureMode === 'cone' && (
                <div className="space-y-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-2.5">
                  <Label className="text-[10px] text-slate-cool uppercase tracking-wider font-outfit font-semibold">Cone Angle</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {coneAngles.map((angle) => (
                      <button
                        key={angle}
                        onClick={() => updateSettings({ coneAngle: angle })}
                        className={getButtonClass(settings.coneAngle === angle)}
                        data-testid={`cone-angle-${angle}`}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {settings.measureMode && (
                <div className="space-y-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-2.5">
                  <Label className="text-[10px] text-slate-cool uppercase tracking-wider font-outfit font-semibold flex items-center gap-1">
                    <Calculator className="w-3 h-3 text-[#caa055]" />
                    Multiplier: {settings.measureMultiplier}x
                  </Label>
                  <div className="flex gap-1 flex-wrap">
                    {multiplierPresets.map((mult) => (
                      <button
                        key={mult}
                        onClick={() => updateSettings({ measureMultiplier: mult })}
                        className={getButtonClass(settings.measureMultiplier === mult)}
                        data-testid={`multiplier-${mult}`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    value={settings.measureMultiplier}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        updateSettings({ measureMultiplier: val });
                      }
                    }}
                    className="h-8 text-xs font-mono bg-black/40 border-[#caa055]/20 text-[#F3EEE7]"
                    placeholder="Custom multiplier"
                    step="0.1"
                    min="0.1"
                    data-testid="multiplier-custom"
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openMeasurementPopup}
                    className="w-full h-8 text-xs mt-2 border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/5"
                    data-testid="open-measurement-popup"
                  >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    Pop-out Live Measurement
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="bg-[#caa055]/15" />

        {/* Map Beacons & Pings Section */}
        <div className="space-y-3" id="section-ping">
          <button onClick={() => toggleSection('ping')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Radio className={`w-3.5 h-3.5 text-[#caa055]/80 ${settings.pingMode ? 'animate-pulse' : ''}`} />
              Map Beacons & Pings
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-slate-muted">P KEY</span>
              {collapsedSections.ping ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
            </div>
          </button>
          {!collapsedSections.ping && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between p-3 rounded-[4px] bg-black/25 border border-[#caa055]/10">
                <div className="flex items-center gap-2">
                  <Radio className={`w-4 h-4 ${settings.pingMode ? 'text-[#caa055]' : 'text-slate-cool'}`} />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold block">Ping Beacon Mode</span>
                    <span className="text-[9px] text-slate-muted">Click map to drop beacon (or Alt+Click anytime)</span>
                  </div>
                </div>
                <Switch
                  checked={!!settings.pingMode}
                  onCheckedChange={(val) => updateSettings({ pingMode: val })}
                  data-testid="ping-mode-toggle"
                />
              </div>

              {/* Beacon Color & Label Controls */}
              <div className="grid grid-cols-2 gap-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-2.5">
                <div>
                  <Label className="text-[9px] text-slate-cool uppercase tracking-wider font-outfit font-semibold mb-1 block">Beacon Color</Label>
                  <div className="flex gap-1.5 items-center flex-wrap pt-0.5">
                    {['#FFD700', '#FF4444', '#00F0FF', '#00FF66', '#FF00FF', '#FFFFFF'].map((colorHex) => (
                      <button
                        key={colorHex}
                        onClick={() => updateSettings({ pingColor: colorHex })}
                        className={`w-5 h-5 rounded-full border cursor-pointer transition-transform ${settings.pingColor === colorHex ? 'scale-125 border-white shadow-lg' : 'border-black/40 opacity-80 hover:opacity-100'}`}
                        style={{ backgroundColor: colorHex }}
                        title={colorHex}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-[9px] text-slate-cool uppercase tracking-wider font-outfit font-semibold mb-1 block">Beacon Label</Label>
                  <Input
                    type="text"
                    value={settings.pingLabel || ''}
                    onChange={(e) => updateSettings({ pingLabel: e.target.value })}
                    placeholder="e.g. Danger / Trap"
                    className="h-7 text-[11px] bg-black/40 border-[#caa055]/20 text-[#F3EEE7]"
                  />
                </div>
              </div>

              {/* Active Pings Summary & Clear All */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-slate-muted font-mono">
                  Active Beacons: <strong className="text-[#caa055]">{pings?.length || 0}</strong>
                </span>
                {pings && pings.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearPings}
                    className="h-7 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10 font-cinzel rounded-[4px]"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear All Beacons
                  </Button>
                )}
              </div>

              {/* Active Pings Pill List */}
              {pings && pings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {pings.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-black/40 border border-[#caa055]/20 text-[10px]"
                    >
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: p.color || '#FFD700' }} />
                      <span className="text-slate-200 font-mono font-medium truncate max-w-[80px]">
                        {p.name || `Beacon #${idx + 1}`}
                      </span>
                      <button
                        onClick={() => removePing(p.id)}
                        className="text-slate-400 hover:text-red-400 cursor-pointer ml-1 text-xs font-bold"
                        title="Delete this beacon"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="bg-[#caa055]/15" />

        {/* Drawing Mode */}
        <div className="space-y-3" id="section-draw">
          <button onClick={() => toggleSection('draw')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Pencil className="w-3.5 h-3.5 text-[#caa055]/80" />
              Drawing Mode
            </span>
            {collapsedSections.draw ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
          </button>
          {!collapsedSections.draw && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between p-3 rounded-[4px] bg-black/25 border border-[#caa055]/10">
                <div className="flex items-center gap-2">
                  <Pencil className={`w-4 h-4 ${settings.drawingEnabled && !settings.eraserEnabled ? 'text-[#caa055]' : 'text-slate-cool'}`} />
                  <span className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Draw on Screen</span>
                </div>
                <Switch
                  checked={settings.drawingEnabled}
                  onCheckedChange={toggleDrawingMode}
                  data-testid="drawing-toggle"
                />
              </div>

              {settings.drawingEnabled && (
                <div className="space-y-3 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                  {/* Drawing / Eraser / Clear All */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => updateSettings({ eraserEnabled: false })}
                      className={getButtonClass(!settings.eraserEnabled)}
                      data-testid="draw-mode-btn"
                    >
                      Draw
                    </button>
                    <button
                      onClick={() => updateSettings({ eraserEnabled: true })}
                      className={getButtonClass(settings.eraserEnabled)}
                      data-testid="eraser-mode-btn"
                    >
                      Eraser
                    </button>
                    <button
                      onClick={() => {
                        clearDrawings();
                        if (sessionCode && broadcastClearAll) {
                          broadcastClearAll();
                        }
                      }}
                      className="border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 font-cinzel font-semibold text-[10px] tracking-wider h-8 px-3 rounded-[4px] cursor-pointer transition-all duration-200"
                      data-testid="clear-drawings-btn"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Drawing controls */}
                  {!settings.eraserEnabled && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-slate-cool uppercase tracking-wider font-outfit font-semibold flex-1">Pen Color</Label>
                        <div className="flex gap-1">
                          {drawingColors.map((color) => (
                            <button
                              key={color}
                              onClick={() => updateSettings({ drawingColor: color })}
                              className={`w-5 h-5 rounded-[4px] border transition-all ${
                                settings.drawingColor === color 
                                  ? 'border-[#caa055] scale-110 ring-2 ring-[#caa055]/30' 
                                  : 'border-white/20 hover:border-white/40'
                              }`}
                              style={{ backgroundColor: color }}
                              data-testid={`drawing-color-${color.replace('#', '')}`}
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold">Pen Thickness</span>
                          <span className="text-slate-muted font-mono">{settings.drawingThickness}px</span>
                        </div>
                        <Slider
                          value={[settings.drawingThickness]}
                          onValueChange={([value]) => updateSettings({ drawingThickness: value })}
                          min={1}
                          max={100}
                          step={1}
                          className="h-4"
                          data-testid="drawing-thickness-slider"
                        />
                      </div>
                    </div>
                  )}

                  {/* Eraser controls */}
                  {settings.eraserEnabled && (
                    <div className="pt-1">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-cool font-outfit uppercase tracking-wider font-semibold">Eraser Size</span>
                        <span className="text-slate-muted font-mono">{settings.eraserSize || 20}px</span>
                      </div>
                      <Slider
                        value={[settings.eraserSize || 20]}
                        onValueChange={([value]) => updateSettings({ eraserSize: value })}
                        min={5}
                        max={50}
                        step={1}
                        className="h-4"
                        data-testid="eraser-size-slider"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="bg-[#caa055]/15" />

        {/* Background Color */}
        {!isGuest && (
          <div className="space-y-2" id="section-bgcolor">
            <button onClick={() => toggleSection('bgcolor')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-[#caa055]/80" />
                Background Color
              </span>
              <div className="flex items-center gap-1.5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSettings({ backgroundEnabled: !settings.backgroundEnabled });
                  }}
                  className={`h-6 w-6 rounded flex items-center justify-center transition-colors cursor-pointer ${settings.backgroundEnabled !== false ? 'text-[#caa055]' : 'text-slate-muted'}`}
                  title={settings.backgroundEnabled !== false ? 'Hide background' : 'Show background'}
                  data-testid="bg-toggle"
                >
                  {settings.backgroundEnabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </div>
                {collapsedSections.bgcolor ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
              </div>
            </button>
            {!collapsedSections.bgcolor && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                  <Input
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(e) => updateSettings({ backgroundColor: e.target.value })}
                    className="w-10 h-8 p-0.5 cursor-pointer bg-black/40 border-[#caa055]/20"
                    data-testid="bg-color-picker"
                  />
                  <Input
                    type="text"
                    value={settings.backgroundColor}
                    onChange={(e) => updateSettings({ backgroundColor: e.target.value })}
                    className="flex-1 h-8 text-xs font-mono bg-black/40 border-[#caa055]/20 text-[#F3EEE7]"
                    data-testid="bg-color-hex"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                  {backgroundPresets.map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => updateSettings({ backgroundColor: preset.color })}
                      className={`w-7 h-7 rounded-[4px] border transition-all ${
                        settings.backgroundColor === preset.color 
                          ? 'border-[#caa055] scale-110 ring-2 ring-[#caa055]/30' 
                          : 'border-white/20 hover:border-white/40'
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.label}
                      data-testid={`bg-preset-${preset.label.toLowerCase()}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Token Library */}
        <div className="space-y-3" id="section-clipart">
          <button onClick={() => toggleSection('clipart')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Sticker className="w-3.5 h-3.5 text-[#caa055]/80" />
              Token Library
            </span>
            {collapsedSections.clipart ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
          </button>
          {!collapsedSections.clipart && (
            <div className="space-y-3.5 pt-1">
              {undockedPanels.clipart ? (
                <div className="space-y-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (window.electronAPI?.openClipartWindow) {
                        try {
                          window.electronAPI.openClipartWindow();
                        } catch (e) {
                          setShowClipartLibrary(true);
                        }
                      } else {
                        setShowClipartLibrary(true);
                      }
                    }}
                    className="w-full h-9 text-xs border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/5 font-cinzel tracking-wider"
                    data-testid="open-clipart-library-btn"
                  >
                    <Sticker className="w-3.5 h-3.5 mr-2" />
                    Open Token Library (Floating)
                  </Button>
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUndockedPanels(prev => ({ ...prev, clipart: false }));
                        setShowClipartLibrary(false);
                      }}
                      className="h-7 text-[10px] text-[#caa055] hover:text-[#d5b271] hover:bg-white/5 font-cinzel"
                    >
                      <Minimize2 className="w-3 h-3 mr-1" /> Dock Token Library
                    </Button>
                  </div>
                </div>
              ) : (
                <ClipartLibrary
                  isOpen={true}
                  isDocked={true}
                  onDockChange={(docked) => {
                    if (window.electronAPI?.isElectron) {
                      try {
                        window.electronAPI.openClipartWindow();
                        setUndockedPanels(prev => ({ ...prev, clipart: true }));
                      } catch (e) {
                        setUndockedPanels(prev => ({ ...prev, clipart: !docked }));
                        if (!docked) {
                          setShowClipartLibrary(true);
                        }
                      }
                    } else {
                      setUndockedPanels(prev => ({ ...prev, clipart: !docked }));
                      if (!docked) {
                        setShowClipartLibrary(true);
                      }
                    }
                  }}
                  onClose={() => {}}
                  onSelectClipart={(item) => {
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const centerX = Math.max(400, viewportWidth / 2);
                    const centerY = viewportHeight / 2;
                    
                    const newClipart = {
                      ...item,
                      x: centerX,
                      y: centerY,
                      scale: 50,
                      rotation: 0,
                    };
                    const instanceId = addPlacedClipart(newClipart);
                    
                    if (sessionCode && broadcastAddClipart) {
                      broadcastAddClipart({ ...newClipart, instanceId });
                    }
                  }}
                  favorites={clipartFavorites}
                  onToggleFavorite={toggleClipartFavorite}
                  customCliparts={customCliparts}
                  onAddCustomClipart={addCustomClipart}
                  onRemoveCustomClipart={removeCustomClipart}
                />
              )}

              <Button
                variant="outline"
                onClick={() => {
                  if (window.electronAPI?.openCommunityWindow) {
                    window.electronAPI.openCommunityWindow();
                  } else {
                    setShowCommunityBrowser(true);
                  }
                }}
                className="w-full h-8 text-xs border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/5 font-cinzel tracking-wider"
                data-testid="open-community-browser-btn"
              >
                <Globe className="w-3.5 h-3.5 mr-2" />
                Browse Community
              </Button>
              
              {/* Snap to Grid toggle */}
              <div className="flex items-center justify-between p-3 rounded-[4px] bg-black/25 border border-[#caa055]/10">
                <div className="flex items-center gap-2">
                  <Grid2X2 className="w-4 h-4 text-[#caa055]" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-cool font-outfit font-semibold">Snap to Grid</span>
                </div>
                <Switch
                  checked={settings.snapClipartsToGrid}
                  onCheckedChange={(checked) => updateSettings({ snapClipartsToGrid: checked })}
                  data-testid="snap-to-grid-toggle"
                />
              </div>
              
              {settings.placedCliparts?.length > 0 && (
                <div className="space-y-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-2.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-muted">
                    <span>{settings.placedCliparts.length} token(s) on grid</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearAllCliparts();
                      if (sessionCode && broadcastClearAllCliparts) {
                        broadcastClearAllCliparts();
                      }
                    }}
                    className="w-full h-8 text-xs text-red-400 border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 font-cinzel tracking-wider"
                    data-testid="clear-all-cliparts-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Clear All Tokens
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="bg-[#caa055]/15" />

        {/* Map Importer */}
        {!isGuest && (
        <div className="space-y-3" id="section-bgimage">
          <div className="flex items-center justify-between w-full border-b border-[#caa055]/12 pb-2 mt-1">
            <button onClick={() => toggleSection('bgimage')} className="flex items-center gap-2 text-left flex-1 bg-transparent hover:opacity-90 transition-opacity">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
                <Image className="w-3.5 h-3.5 text-[#caa055]/80" />
                Map Importer
              </span>
              {collapsedSections.bgimage ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
            </button>
            {(settings.backgroundLayers || []).length > 0 && (
              <button
                onClick={toggleBgLayersLocked}
                className={`p-1 rounded transition-colors ${
                  settings.bgLayersLocked
                    ? 'bg-[#caa055]/20 text-[#caa055]'
                    : 'text-slate-muted hover:text-[#caa055] hover:bg-[#caa055]/5'
                }`}
                title={settings.bgLayersLocked ? 'Unlock Map Importer' : 'Lock Map Importer'}
                data-testid="lock-layers-inline-btn"
              >
                {settings.bgLayersLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          {!collapsedSections.bgimage && (
            <div className="space-y-3 pt-1">
              {undockedPanels.layers ? (
                <div className="space-y-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (window.electronAPI?.openLayersWindow) {
                        window.electronAPI.openLayersWindow();
                      } else {
                        setShowLayersPanel(prev => !prev);
                      }
                    }}
                    className="w-full h-9 text-xs border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/5 font-cinzel tracking-wider"
                    data-testid="open-layers-btn"
                  >
                    <Image className="w-3.5 h-3.5 mr-2" />
                    {showLayersPanel ? 'Hide Floating Importer' : 'Show Floating Importer'}
                  </Button>
                  <p className="text-[10px] text-slate-muted text-center font-outfit">
                    Map Importer window is currently undocked.
                  </p>
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUndockedPanels(prev => ({ ...prev, layers: false }));
                        setShowLayersPanel(true);
                      }}
                      className="h-7 text-[10px] text-[#caa055] hover:text-[#d5b271] hover:bg-white/5 font-cinzel"
                    >
                      <Minimize2 className="w-3 h-3 mr-1" /> Dock Map Importer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (window.electronAPI?.openLayersWindow) {
                        window.electronAPI.openLayersWindow();
                        setUndockedPanels(prev => ({ ...prev, layers: true }));
                      } else {
                        setShowLayersPanel(prev => !prev);
                      }
                    }}
                    className="w-full h-9 text-xs border-[#caa055]/30 text-[#caa055] hover:bg-[#caa055]/5 font-cinzel tracking-wider"
                    data-testid="open-layers-btn"
                  >
                    <Image className="w-3.5 h-3.5 mr-2" />
                    {showLayersPanel ? 'Close Map Importer' : 'Open Map Importer'}
                  </Button>
                  <p className="text-[10px] text-slate-muted text-center font-outfit">
                    {(settings.backgroundLayers || []).length}/5 layers · PNG transparency supported
                  </p>

                  {/* Inline layers panel for web mode */}
                  {showLayersPanel && !window.electronAPI?.isElectron && (
                    <div className="border border-[#caa055]/20 rounded-[4px] overflow-hidden mt-2">
                      <BackgroundLayersPanel onUndock={() => setUndockedPanels(prev => ({ ...prev, layers: true }))} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        <Separator className="bg-[#caa055]/15" />

        {/* Scene Editor & Manager */}
        <div id="section-scenes" className="space-y-3">
          <button onClick={() => toggleSection('scenes')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Film className="w-3.5 h-3.5 text-[#caa055]/80" />
              Scene Editor & Scenes
            </span>
            {collapsedSections.scenes ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
          </button>
          {!collapsedSections.scenes && (
            <div className="space-y-2 pt-1">
              {undockedPanels.scenes ? (
                <div className="space-y-2 bg-black/15 border border-[#caa055]/5 rounded-[4px] p-3 text-center">
                  <p className="text-[10px] text-slate-muted font-outfit">
                    Scene Editor window is currently undocked.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUndockedPanels(prev => ({ ...prev, scenes: false }));
                      setShowScenePanel(true);
                    }}
                    className="h-7 text-[10px] text-[#caa055] hover:text-[#d5b271] hover:bg-white/5 font-cinzel"
                  >
                    <Minimize2 className="w-3 h-3 mr-1" /> Dock Scene Editor
                  </Button>
                </div>
              ) : (
                <div className="border border-[#caa055]/20 rounded-[4px] overflow-hidden">
                  <SceneEditorPanel onUndock={() => setUndockedPanels(prev => ({ ...prev, scenes: true }))} />
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="bg-[#caa055]/15" />

        {/* Dice Roller */}
        <div id="section-dice" className="space-y-3">
          <button onClick={() => toggleSection('dice')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Dices className="w-3.5 h-3.5 text-[#caa055]/80" />
              Virtual Dice Roller
            </span>
            {collapsedSections.dice ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
          </button>
          {!collapsedSections.dice && (
            <div className="pt-1">
              <DiceRollerPanel
                diceRolls={finalDiceRolls}
                broadcastRollDice={handleRollDice}
                broadcastClearDiceRolls={handleClearDiceRolls}
                userName={userName}
                isHost={isHost}
              />
            </div>
          )}
        </div>

        <Separator className="bg-[#caa055]/15" />

        {/* Initiative Tracker */}
        <div id="section-initiative" className="space-y-3">
          <button onClick={() => toggleSection('initiative')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Sword className="w-3.5 h-3.5 text-[#caa055]/80" />
              Initiative & Turn order
            </span>
            {collapsedSections.initiative ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
          </button>
          {!collapsedSections.initiative && (
            <div className="pt-1">
              <InitiativeTrackerPanel
                initiativeList={finalInitiativeList}
                currentTurnIndex={finalCurrentTurnIndex}
                broadcastUpdateInitiative={handleUpdateInitiative}
                userName={userName}
                isHost={isHost}
              />
            </div>
          )}
        </div>

        <Separator className="bg-[#caa055]/15" />

        {/* Collaborative Session */}
        <div id="section-session" className="space-y-3">
          <button onClick={() => toggleSection('session')} className="flex items-center justify-between w-full text-left border-b border-[#caa055]/12 pb-2 mt-1 bg-transparent hover:opacity-90 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] font-cinzel text-[#caa055] flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#caa055]/80" />
              Collaborative Session
            </span>
            {collapsedSections.session ? <ChevronRight className="w-3.5 h-3.5 text-[#caa055]/60" /> : <ChevronDown className="w-3.5 h-3.5 text-[#caa055]/60" />}
          </button>
          {!collapsedSections.session && (
            <div className="pt-1">
              <SessionControls />
            </div>
          )}
        </div>

        <Separator className="bg-[#caa055]/15" />

        {/* Customization & Hotkeys / Macros Setting Tab */}
        <div className="pt-1">
          <Button
            onClick={() => setShowCustomizationModal(true)}
            className="w-full h-9 text-xs bg-gradient-to-r from-[#caa055]/20 via-[#caa055]/30 to-[#caa055]/20 hover:from-[#caa055]/40 hover:to-[#caa055]/40 border border-[#caa055]/50 text-[#caa055] font-cinzel font-bold tracking-wider rounded-[4px] cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-[#caa055]/20"
            data-testid="open-customization-btn"
          >
            <Keyboard className="w-4 h-4 text-[#caa055]" />
            <span>⚙️ Hotkeys & Macros Settings</span>
          </Button>
        </div>

        {/* Reset */}
        <Button 
          variant="outline" 
          onClick={resetSettings} 
          className="w-full h-9 text-xs border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 font-cinzel tracking-wider rounded-[4px] cursor-pointer mt-1"
          data-testid="reset-floating"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>

    {/* Customization Workshop Modal */}
    <CustomizationModal
      isOpen={showCustomizationModal}
      onClose={() => setShowCustomizationModal(false)}
    />
    
    {/* Clipart Library Modal (Floating Window) */}
    {showClipartLibrary && (
      <ClipartLibrary
        isOpen={true}
        onClose={() => setShowClipartLibrary(false)}
        isDocked={false}
        onDockChange={(docked) => {
          setUndockedPanels(prev => ({ ...prev, clipart: !docked }));
          if (docked) {
            setShowClipartLibrary(false);
          }
        }}
        onSelectClipart={(item) => {
          // Place clipart in center of viewport (accounting for control panel on left)
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          // Offset to account for control panel (~340px) and place in visible grid area
          const centerX = Math.max(400, viewportWidth / 2);
          const centerY = viewportHeight / 2;
          
          const newClipart = {
            ...item,
            x: centerX,
            y: centerY,
            scale: 50,
            rotation: 0,
          };
          const instanceId = addPlacedClipart(newClipart);
          
          // Broadcast to session if in one
          if (sessionCode && broadcastAddClipart) {
            broadcastAddClipart({ ...newClipart, instanceId });
          }
          // Don't close library - let user add multiple cliparts
        }}
        favorites={clipartFavorites}
        onToggleFavorite={toggleClipartFavorite}
        customCliparts={customCliparts}
        onAddCustomClipart={addCustomClipart}
        onRemoveCustomClipart={removeCustomClipart}
      />
    )}

    {/* Map Background Layers (Floating Window) */}
    {showLayersPanel && undockedPanels.layers && !window.electronAPI?.isElectron && (
      <FloatingWindow
        title="🗺️ Map Background Layers"
        onClose={() => setShowLayersPanel(false)}
        onDock={() => {
          setUndockedPanels(prev => ({ ...prev, layers: false }));
        }}
        initialPosition={{ x: 420, y: 150 }}
        width="320px"
        dataTestId="layers-floating-window"
      >
        <BackgroundLayersPanel />
      </FloatingWindow>
    )}

    {/* Scene Editor (Floating Window) */}
    {showScenePanel && undockedPanels.scenes && (
      <FloatingWindow
        title="🎬 Scene Editor & Manager"
        onClose={() => setShowScenePanel(false)}
        onDock={() => {
          setUndockedPanels(prev => ({ ...prev, scenes: false }));
        }}
        initialPosition={{ x: 450, y: 120 }}
        width="360px"
        dataTestId="scenes-floating-window"
      >
        <SceneEditorPanel />
      </FloatingWindow>
    )}

    {/* Community Browser */}
    <CommunityBrowser
      isOpen={showCommunityBrowser}
      onClose={() => setShowCommunityBrowser(false)}
      onImportClipart={(item) => {
        addCustomClipart(item);
      }}
    />
  </>
  );
};

export default FloatingControls;
