import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { appDebugStore } from '../lib/debugStore';

// Module-level constants — defined outside component to avoid bundler initialization issues
export const TOKEN_SIZE_PRESETS = [
  { label: 'Tiny (½×½)', multiplier: 0.5 },
  { label: 'Small (1×1)', multiplier: 1 },
  { label: 'Medium (1×1)', multiplier: 1 },
  { label: 'Large (2×2)', multiplier: 2 },
  { label: 'Huge (3×3)', multiplier: 3 },
  { label: 'Gargantuan (4×4)', multiplier: 4 },
];

export const DND_CONDITIONS = [
  'Blinded','Charmed','Deafened','Exhaustion','Frightened',
  'Grappled','Incapacitated','Invisible','Paralyzed','Petrified',
  'Poisoned','Prone','Restrained','Stunned','Unconscious',
  'Concentrating','Bleeding',
];

export const DEFAULT_ACTIONS = [
  { id: 'toggle_grid', name: 'Toggle Grid', category: 'Grid & Canvas', defaultHotkey: 'G', description: 'Show or hide grid lines' },
  { id: 'toggle_measure', name: 'Toggle Measurement Mode', category: 'Grid & Canvas', defaultHotkey: 'M', description: 'Enable distance & cone measuring tools' },
  { id: 'clear_measurements', name: 'Clear All Measurements', category: 'Grid & Canvas', defaultHotkey: 'Shift+M', description: 'Remove active measurements from canvas' },
  { id: 'toggle_subdivisions', name: 'Toggle Grid Subdivisions', category: 'Grid & Canvas', defaultHotkey: 'S', description: 'Show or hide grid cell subdivisions' },
  
  { id: 'toggle_ping_mode', name: 'Toggle Ping Mode', category: 'Grid & Canvas', defaultHotkey: 'P', description: 'Enable clicking on map to place animated ping beacon' },
  { id: 'clear_pings', name: 'Clear All Map Pings', category: 'Grid & Canvas', defaultHotkey: 'Shift+P', description: 'Remove all ping beacons from map' },
  
  { id: 'toggle_drawing', name: 'Toggle Drawing Mode', category: 'Drawing & Fog', defaultHotkey: 'D', description: 'Enable or disable drawing tools' },
  { id: 'toggle_eraser', name: 'Toggle Eraser Mode', category: 'Drawing & Fog', defaultHotkey: 'E', description: 'Switch between drawing pen and eraser' },
  { id: 'clear_drawings', name: 'Clear All Drawings', category: 'Drawing & Fog', defaultHotkey: 'Ctrl+D', description: 'Erase all pen lines from canvas' },
  { id: 'clear_mask', name: 'Clear Fog of War', category: 'Drawing & Fog', defaultHotkey: 'Ctrl+Shift+M', description: 'Clear all fog of war mask shapes' },
  
  { id: 'clear_cliparts', name: 'Clear All Tokens', category: 'Tokens & Map', defaultHotkey: 'Ctrl+Shift+K', description: 'Remove all placed cliparts and tokens' },
  { id: 'clear_background', name: 'Clear Background Image', category: 'Tokens & Map', defaultHotkey: 'Ctrl+Shift+B', description: 'Remove active background map' },
  
  { id: 'roll_d20', name: 'Quick Roll 1d20', category: 'Dice & Combat', defaultHotkey: 'R', description: 'Roll a d20 in virtual dice roller' },
  { id: 'next_turn', name: 'Next Initiative Turn', category: 'Dice & Combat', defaultHotkey: 'N', description: 'Advance turn in initiative tracker' },
  { id: 'prev_turn', name: 'Previous Initiative Turn', category: 'Dice & Combat', defaultHotkey: 'P', description: 'Go back one turn in initiative tracker' },
  
  { id: 'toggle_controls', name: 'Toggle Control Dashboard', category: 'System & View', defaultHotkey: 'Ctrl+Shift+C', description: 'Show or hide floating control panel' },
  { id: 'reset_settings', name: 'Reset Grid Settings', category: 'System & View', defaultHotkey: 'Alt+R', description: 'Restore default grid settings' },
];

const DEFAULT_MACROS = [
  {
    id: 'macro_clear_all',
    name: 'Clear Canvas & Reset',
    hotkey: 'Ctrl+Shift+R',
    description: 'Clears all drawings, measurements, and fog of war',
    steps: [
      { actionId: 'clear_drawings' },
      { actionId: 'clear_measurements' },
      { actionId: 'clear_mask' }
    ]
  },
  {
    id: 'macro_combat_ready',
    name: 'Combat Start Routine',
    hotkey: 'Ctrl+Shift+S',
    description: 'Rolls 1d20 and enables measurement mode',
    steps: [
      { actionId: 'roll_d20' },
      { actionId: 'toggle_measure' }
    ]
  }
];

function formatKeyboardEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let key = e.key;
  if (!key) return '';

  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    return '';
  }

  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  else if (key.startsWith('Arrow')) key = key.replace('Arrow', '');

  parts.push(key);
  return parts.join('+');
}

const defaultSettings = {
  screenWidth: 1920,
  screenHeight: 1080,
  unitWidth: 66,
  unitHeight: 33,
  gridColor: '#caa055',
  lineThickness: 1,
  opacity: 0.3,
  showSubdivisions: false,
  subdivisionCount: 2,
  gridEnabled: true,
  measureMode: false,
  coneAngle: 90,
  selectedMonitor: 0,
  showControls: true,
  backgroundColor: '#1a1a1a',
  measureMultiplier: 1,
  lockRatio: true,
  gridSize: 50,
  squareSize: 30,
  drawingEnabled: false,
  drawingColor: '#FF4444',
  drawingThickness: 3,
  drawingPaths: [],
  eraserEnabled: false,
  eraserSize: 20,
  backgroundImage: null,
  backgroundImageData: null,
  backgroundImageScale: 100,
  backgroundImageX: 0,
  backgroundImageY: 0,
  backgroundImageRotation: 0,
  backgroundImageLockAspect: true,
  backgroundImageTile: false,
  useBackgroundImage: false,
  backgroundLayers: [],
  bgLayersLocked: false,
  liveMeasurement: null,
  placedCliparts: [],
  snapClipartsToGrid: false,
  maskEnabled: false,
  maskTool: 'brush',
  maskBrushSize: 30,
  maskPaths: [],
  maskRects: [],
  pingMode: false,
  pingColor: '#FFD700',
  pingLabel: '',
  // Scene layer visibility — which saved scenes' items are currently hidden.
  // Lives in settings (not separate state) so it syncs across windows via
  // the existing settings-update broadcast, same as everything else here.
  hiddenSceneIds: [],
  // Effects Reverse-Mask Painting tool
  effectsEnabled: false,
  effectPaths: [],
  activeEffectId: null,
  activeEffectUrl: null,
  effectTool: 'brush', // 'brush' | 'marquee' | 'bezier' | 'eraser'
  effectBrushSize: 60,
  effectTile: true,
  effectTileScale: 100,
  effectOpacity: 0.9,
  effectSpeed: 1,
  effectBlendMode: 'normal', // 'normal' | 'screen' | 'lighter' | 'overlay'
  effectInvert: false,
  effectFeather: 4,
  // Fog of war shape tools (rect + circle in addition to freehand brush)
  maskShapeTool: null,
  maskShapeRadius: 80,
};

const GridContext = createContext(undefined);

export const GridProvider = ({ children }) => {
  const [initialState] = useState(() => {
    try {
      const saved = localStorage.getItem('overgrid_grid_state');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed._ts && (Date.now() - parsed._ts > 600000)) {
        localStorage.removeItem('overgrid_grid_state');
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  });

  const [settings, setSettings] = useState(() => {
    let initial = defaultSettings;
    if (initialState && initialState.settings) {
      initial = { ...defaultSettings, ...initialState.settings };
    }
    if (initial.gridColor === '#00F0FF' || initial.gridColor === '#00f0ff' || !initial.gridColor) {
      initial.gridColor = '#caa055';
    }
    return initial;
  });

  const [measurements, setMeasurements] = useState(() => {
    return (initialState && initialState.measurements) || [];
  });

  const [presets, setPresets] = useState([]);

  const [clipartFavorites, setClipartFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('overgrid_clipart_library');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.favorites || [];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [customCliparts, setCustomCliparts] = useState(() => {
    try {
      const saved = localStorage.getItem('overgrid_clipart_library');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.customCliparts || [];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Scenes State Management
  const [scenes, setScenes] = useState(() => {
    try {
      const saved = localStorage.getItem('overgrid_scenes');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load scenes from localStorage:", e);
    }
    return [];
  });

  const [activeSceneId, setActiveSceneId] = useState(() => {
    try {
      return localStorage.getItem('overgrid_active_scene_id') || null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('overgrid_scenes', JSON.stringify(scenes));
    } catch (e) {
      console.warn("Failed to persist scenes:", e);
    }
  }, [scenes]);

  useEffect(() => {
    try {
      if (activeSceneId) {
        localStorage.setItem('overgrid_active_scene_id', activeSceneId);
      } else {
        localStorage.removeItem('overgrid_active_scene_id');
      }
    } catch (e) {
      console.warn("Failed to persist activeSceneId:", e);
    }
  }, [activeSceneId]);

  // PINGS & MAP BEACONS STATE
  const [pings, setPings] = useState(() => {
    try {
      const saved = localStorage.getItem('overgrid_pings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const addPing = useCallback((x, y, color = null, label = null) => {
    const newPing = {
      id: 'ping_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      x,
      y,
      color: color || settings.pingColor || '#FFD700',
      name: label !== null && label !== undefined ? label : (settings.pingLabel || ''),
      timestamp: Date.now()
    };
    setPings(prev => {
      const updated = [...prev, newPing];
      try {
        localStorage.setItem('overgrid_pings', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    appDebugStore.log({ category: 'ping', message: `Placed a ping${newPing.name ? ` "${newPing.name}"` : ''}`, detail: `at (${Math.round(x)}, ${Math.round(y)})` });
    return newPing;
  }, [settings.pingColor, settings.pingLabel]);

  const removePing = useCallback((id) => {
    setPings(prev => {
      const updated = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem('overgrid_pings', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const clearPings = useCallback(() => {
    setPings([]);
    try {
      localStorage.setItem('overgrid_pings', JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const [selectedClipartIds, setSelectedClipartIds] = useState([]);

  const selectedClipartId = useMemo(() => (
    selectedClipartIds.length > 0 ? selectedClipartIds[0] : null
  ), [selectedClipartIds]);

  const setSelectedClipartId = useCallback((val) => {
    if (val === null || val === undefined) {
      setSelectedClipartIds([]);
    } else if (Array.isArray(val)) {
      setSelectedClipartIds(val);
    } else if (typeof val === 'function') {
      setSelectedClipartIds((prev) => {
        const first = prev.length > 0 ? prev[0] : null;
        const res = val(first);
        if (res === null || res === undefined) return [];
        if (Array.isArray(res)) return res;
        return [res];
      });
    } else {
      setSelectedClipartIds([val]);
    }
  }, []);
  const isUpdatingFromRemoteRef = useRef(false);
  const clipartDebounceRef = useRef(null);

  // One-time migration: some effects/drawings/masks may have been created
  // before id-generation existed on their respective add-functions, and
  // still lack a stable `id` to this day (they were never re-drawn). The
  // eye-toggle visibility system needs every item to have one — without
  // this, a scene's saved effect *count* looks right, but items lacking
  // an id are silently skipped when matching against the hidden-items
  // lookup, so toggling visibility appears to work for some items but not
  // others. This backfills ids directly onto the live grid data (not just
  // at save time), so the fix applies immediately, once, on load.
  useEffect(() => {
    const needsId = (arr) => (arr || []).some(item => !item.id);
    const backfill = (arr, prefix) => (arr || []).map(item =>
      item.id ? item : { ...item, id: `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2,7)}` }
    );
    setSettings((prev) => {
      const needsMigration =
        needsId(prev.effectPaths) || needsId(prev.drawingPaths) ||
        needsId(prev.maskPaths) || needsId(prev.maskRects);
      if (!needsMigration) return prev;
      const next = {
        ...prev,
        effectPaths: backfill(prev.effectPaths, 'eff'),
        drawingPaths: backfill(prev.drawingPaths, 'draw'),
        maskPaths: backfill(prev.maskPaths, 'mask'),
        maskRects: backfill(prev.maskRects, 'maskrect'),
      };
      if (window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: {
          effectPaths: next.effectPaths, drawingPaths: next.drawingPaths,
          maskPaths: next.maskPaths, maskRects: next.maskRects,
        }});
      }
      appDebugStore.log({ category: 'migration', message: 'Backfilled missing ids on legacy items', detail: 'effects/drawings/masks now have stable ids for visibility toggling' });
      return next;
    });
    // Intentionally run only once on mount — this is a one-time backfill,
    // not something that should re-run as settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync favorites & custom cliparts to localStorage safely
  useEffect(() => {
    if (clipartDebounceRef.current) clearTimeout(clipartDebounceRef.current);
    clipartDebounceRef.current = setTimeout(() => {
      let count = 20;
      let success = false;
      while (count >= 0 && !success) {
        try {
          const slicedCliparts = count > 0 ? customCliparts.slice(-count) : [];
          const data = { favorites: clipartFavorites, customCliparts: slicedCliparts };
          localStorage.setItem('overgrid_clipart_library', JSON.stringify(data));
          success = true;
        } catch (e) {
          const isQuota = e.name === 'QuotaExceededError' || 
                          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || 
                          e.code === 22 || 
                          String(e).includes('quota') || 
                          String(e).includes('Quota');
          if (isQuota && count > 0) {
            count = Math.floor(count / 2);
          } else {
            console.warn('Unable to save custom cliparts to localStorage:', e.message || e);
            break;
          }
        }
      }
    }, 1000);
    return () => {
      if (clipartDebounceRef.current) clearTimeout(clipartDebounceRef.current);
    };
  }, [clipartFavorites, customCliparts]);

  // Periodic persistence of grid state to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stateToSave = {};
        const excludeKeys = new Set([
          "backgroundImage",
          "backgroundImageData",
          "backgroundLayers",
          "liveMeasurement",
          "maskPaths",
          "maskRects"
        ]);
        for (const [key, val] of Object.entries(settings)) {
          if (!excludeKeys.has(key)) {
            stateToSave[key] = val;
          }
        }
        const data = {
          settings: stateToSave,
          measurements,
          placedCliparts: (settings.placedCliparts || []).slice(-50),
          _ts: Date.now()
        };
        const str = JSON.stringify(data);
        if (new Blob([str]).size < 4194304) {
          localStorage.setItem('overgrid_grid_state', str);
        }
      } catch (e) {
        console.error("Failed to save grid state:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [settings, measurements]);

  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: newSettings });
      }
      return updated;
    });
  }, []);

  // Listen for electron settings updates
  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;
    return window.electronAPI.on("settings-update", (data) => {
      if (data.settings) {
        isUpdatingFromRemoteRef.current = true;
        setSettings((prev) => ({ ...prev, ...data.settings }));
        isUpdatingFromRemoteRef.current = false;
      }
    });
  }, []);

  // Listen for localStorage changes to sync cliparts and scenes across child windows.
  // Without this, a scene saved/toggled in the Controls window never reaches
  // the Grid window's `scenes` state — meaning the eye toggle's visibility
  // filter (which needs each hidden scene's saved item ids) silently has
  // nothing to match against and hides nothing.
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'overgrid_clipart_library') {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            if (parsed.favorites) setClipartFavorites(parsed.favorites);
            if (parsed.customCliparts) setCustomCliparts(parsed.customCliparts);
          }
        } catch (err) {
          console.error('Failed to parse storage update:', err);
        }
      } else if (e.key === 'overgrid_scenes') {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setScenes(parsed);
            appDebugStore.log({ category: 'sync', message: 'Synced scenes from another window', detail: `${parsed.length} scene(s)` });
          }
        } catch (err) {
          console.error('Failed to parse scenes storage update:', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  const addMeasurement = useCallback((measurement) => {
    setMeasurements((prev) => [...prev, { ...measurement, id: Date.now().toString() }]);
  }, []);

  const removeMeasurement = useCallback((id) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMeasurements = useCallback(() => {
    setMeasurements([]);
  }, []);

  const [undoStack, setUndoStack] = useState([]);

  const addDrawingPath = useCallback((path) => {
    const tagged = { ...path, id: path.id || `draw_${Date.now()}_${Math.random().toString(36).substring(2,7)}` };
    setSettings((prev) => {
      const nextPaths = [...(prev.drawingPaths || []), tagged];
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { drawingPaths: nextPaths } });
      }
      return { ...prev, drawingPaths: nextPaths };
    });
    setUndoStack([]);
    appDebugStore.log({ category: 'drawing', message: 'Drew a stroke', detail: `points: ${(path.points || []).length}, color: ${path.color || 'default'}` });
  }, []);

  const clearDrawings = useCallback(() => {
    updateSettings({ drawingPaths: [] });
    setUndoStack([]);
  }, [updateSettings]);

  const undoDrawing = useCallback(() => {
    setSettings((prev) => {
      const paths = prev.drawingPaths || [];
      if (paths.length === 0) return prev;
      const last = paths[paths.length - 1];
      setUndoStack((u) => [...u, last]);
      return { ...prev, drawingPaths: paths.slice(0, -1) };
    });
  }, []);

  const redoDrawing = useCallback(() => {
    setUndoStack((prevStack) => {
      if (prevStack.length === 0) return prevStack;
      const last = prevStack[prevStack.length - 1];
      setSettings((prev) => ({
        ...prev,
        drawingPaths: [...(prev.drawingPaths || []), last]
      }));
      return prevStack.slice(0, -1);
    });
  }, []);

  const eraseAt = useCallback((x, y, radius) => {
    setSettings((prev) => {
      const paths = prev.drawingPaths || [];
      const updatedPaths = paths.map((path) => {
        if (!path.points) return path;
        const remainingPoints = path.points.filter((pt) => {
          const dx = pt.x - x;
          const dy = pt.y - y;
          return Math.sqrt(dx * dx + dy * dy) > radius;
        });
        if (remainingPoints.length < 2) return null;
        return { ...path, points: remainingPoints };
      }).filter(Boolean);
      return { ...prev, drawingPaths: updatedPaths };
    });
  }, []);

  const setBackgroundImage = useCallback((data) => {
    updateSettings({ backgroundImageData: data, useBackgroundImage: !!data });
  }, [updateSettings]);

  const clearBackgroundImage = useCallback(() => {
    updateSettings({ backgroundImageData: null, useBackgroundImage: false });
  }, [updateSettings]);

  const [selectedBgLayerId, setSelectedBgLayerId] = useState(null);

  const addBackgroundLayer = useCallback((imageData, name, options = {}) => {
    const newLayer = {
      id: "bglayer_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      name: name || "Layer " + (Date.now() % 1000),
      imageData: options.type === "video" ? null : imageData,
      videoUrl: options.type === "video" ? options.videoUrl : null,
      type: options.type || "image",
      isYouTube: options.isYouTube || false,
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2),
      scale: options.initialScale || Math.max(window.innerWidth || 1920, 1920),
      rotation: 0,
      opacity: 100,
      visible: true
    };

    setSettings((prev) => {
      if (prev.backgroundLayers.length >= 5) return prev;
      const updated = [...prev.backgroundLayers, newLayer];
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { backgroundLayers: updated } });
      }
      return { ...prev, backgroundLayers: updated };
    });

    appDebugStore.log({ category: 'background', message: `Added map/background layer "${newLayer.name}"`, detail: `type: ${newLayer.type}, id: ${newLayer.id}` });
    return newLayer.id;
  }, []);

  // NOTE: updateBackgroundLayer is deliberately NOT logged — like clipart
  // updates, it fires continuously during drag/resize (many times per
  // second), which would flood the log with noise.
  const updateBackgroundLayer = useCallback((id, updates) => {
    setSettings((prev) => {
      const updated = prev.backgroundLayers.map((layer) => {
        if (layer.id === id) {
          return { ...layer, ...updates };
        }
        return layer;
      });
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { backgroundLayers: updated } });
      }
      return { ...prev, backgroundLayers: updated };
    });
  }, []);

  const removeBackgroundLayer = useCallback((id) => {
    setSettings((prev) => {
      const updated = prev.backgroundLayers.filter((layer) => layer.id !== id);
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { backgroundLayers: updated } });
      }
      return { ...prev, backgroundLayers: updated };
    });
    setSelectedBgLayerId((curr) => (curr === id ? null : curr));
    appDebugStore.log({ category: 'background', message: 'Removed a map/background layer', detail: `id: ${id}` });
  }, []);

  const reorderBackgroundLayers = useCallback((fromIndex, toIndex) => {
    setSettings((prev) => {
      const updated = [...prev.backgroundLayers];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { backgroundLayers: updated } });
      }
      return { ...prev, backgroundLayers: updated };
    });
  }, []);

  const clearAllBackgroundLayers = useCallback(() => {
    setSettings((prev) => {
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { backgroundLayers: [] } });
      }
      return { ...prev, backgroundLayers: [] };
    });
    setSelectedBgLayerId(null);
  }, []);

  const loadBackgroundLayers = useCallback((layers) => {
    const formattedLayers = layers.map((l, i) => {
      return {
        id: "bglayer_" + Date.now() + "_" + i + "_" + Math.random().toString(36).substr(2, 6),
        name: l.name || "Layer " + (i + 1),
        imageData: l.imageData,
        videoUrl: l.videoUrl || null,
        type: l.type || "image",
        isYouTube: l.isYouTube || false,
        x: l.x ?? Math.round(window.innerWidth / 2),
        y: l.y ?? Math.round(window.innerHeight / 2),
        scale: l.scale ?? 300,
        rotation: l.rotation ?? 0,
        opacity: l.opacity ?? 100,
        visible: l.visible ?? true
      };
    });
    setSettings((prev) => {
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { backgroundLayers: formattedLayers } });
      }
      return { ...prev, backgroundLayers: formattedLayers };
    });
    setSelectedBgLayerId(null);
  }, []);

  const toggleBgLayersLocked = useCallback(() => {
    setSettings((prev) => {
      const nextLocked = !prev.bgLayersLocked;
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { bgLayersLocked: nextLocked } });
      }
      return { ...prev, bgLayersLocked: nextLocked };
    });
    setSelectedBgLayerId(null);
  }, []);

  const setLiveMeasurement = useCallback((lm) => {
    setSettings((prev) => ({ ...prev, liveMeasurement: lm }));
  }, []);

  const addPlacedClipart = useCallback((clipart) => {
    const newPlaced = {
      ...clipart,
      instanceId: "clipart_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      x: clipart.x || 100,
      y: clipart.y || 100,
      scale: clipart.scale || 50,
      rotation: clipart.rotation || 0
    };
    setSettings((prev) => {
      const nextPlaced = [...(prev.placedCliparts || []), newPlaced];
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { placedCliparts: nextPlaced } });
      }
      return {
        ...prev,
        placedCliparts: nextPlaced
      };
    });
    appDebugStore.log({ category: 'clipart', message: `Placed "${clipart.name || clipart.label || 'token'}"`, detail: `id: ${newPlaced.instanceId}` });
    return newPlaced.instanceId;
  }, []);

  // NOTE: updatePlacedClipart is deliberately NOT logged — it fires continuously
  // during drag/resize/rotate (many times per second), which would flood the
  // debug log with noise. Only discrete actions (place, remove) are logged.
  const updatePlacedClipart = useCallback((instanceId, updates) => {
    setSettings((prev) => {
      const nextPlaced = (prev.placedCliparts || []).map((cp) => {
        if (cp.instanceId === instanceId) {
          return { ...cp, ...updates };
        }
        return cp;
      });
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { placedCliparts: nextPlaced } });
      }
      return {
        ...prev,
        placedCliparts: nextPlaced
      };
    });
  }, []);

  const removePlacedClipart = useCallback((instanceId) => {
    setSettings((prev) => {
      const nextPlaced = (prev.placedCliparts || []).filter((cp) => cp.instanceId !== instanceId);
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { placedCliparts: nextPlaced } });
      }
      return { ...prev, placedCliparts: nextPlaced };
    });
    setSelectedClipartId((curr) => (curr === instanceId ? null : curr));
    appDebugStore.log({ category: 'clipart', message: 'Removed a token', detail: `id: ${instanceId}` });
  }, []);

  // ── Token label ────────────────────────────────────────────────────────────
  const setTokenLabel = useCallback((instanceId, label) => {
    setSettings((prev) => ({
      ...prev,
      placedCliparts: (prev.placedCliparts || []).map((cp) =>
        cp.instanceId === instanceId ? { ...cp, label: label ?? '' } : cp
      ),
    }));
  }, []);

  // ── Token status conditions ────────────────────────────────────────────────
  const toggleTokenStatus = useCallback((instanceId, status) => {
    setSettings((prev) => ({
      ...prev,
      placedCliparts: (prev.placedCliparts || []).map((cp) => {
        if (cp.instanceId !== instanceId) return cp;
        const current = cp.statuses || [];
        const next = current.includes(status)
          ? current.filter((s) => s !== status)
          : [...current, status];
        return { ...cp, statuses: next };
      }),
    }));
  }, []);

  // ── Token z-order ──────────────────────────────────────────────────────────
  const bringTokenToFront = useCallback((instanceId) => {
    setSettings((prev) => {
      const placed = [...(prev.placedCliparts || [])];
      const idx = placed.findIndex((cp) => cp.instanceId === instanceId);
      if (idx === -1 || idx === placed.length - 1) return prev;
      const [item] = placed.splice(idx, 1);
      placed.push(item);
      return { ...prev, placedCliparts: placed };
    });
  }, []);

  const sendTokenToBack = useCallback((instanceId) => {
    setSettings((prev) => {
      const placed = [...(prev.placedCliparts || [])];
      const idx = placed.findIndex((cp) => cp.instanceId === instanceId);
      if (idx <= 0) return prev;
      const [item] = placed.splice(idx, 1);
      placed.unshift(item);
      return { ...prev, placedCliparts: placed };
    });
  }, []);

  // ── Effects tool ───────────────────────────────────────────────────────────
  const addEffectPath = useCallback((effectPath) => {
    setSettings((prev) => {
      const newPath = {
        ...effectPath,
        id: effectPath.id || `eff_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
      };
      const nextPaths = [...(prev.effectPaths || []), newPath];
      // This broadcast was missing entirely — effects added in the Grid
      // window never reached other windows' settings.effectPaths at all,
      // which is why the Scene Editor (living in the detached Controls
      // window) always captured 0 effects even with effects visibly on
      // the grid: it was reading its own, never-updated local copy.
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { effectPaths: nextPaths } });
      }
      return { ...prev, effectPaths: nextPaths };
    });
  }, []);

  const updateEffectPath = useCallback((id, updates) => {
    setSettings((prev) => {
      const nextPaths = (prev.effectPaths || []).map((e) => e.id === id ? { ...e, ...updates } : e);
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { effectPaths: nextPaths } });
      }
      return { ...prev, effectPaths: nextPaths };
    });
  }, []);

  const removeEffectPath = useCallback((id) => {
    setSettings((prev) => {
      const nextPaths = (prev.effectPaths || []).filter((e) => e.id !== id);
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { effectPaths: nextPaths } });
      }
      return { ...prev, effectPaths: nextPaths };
    });
  }, []);

  const undoLastEffectPath = useCallback(() => {
    setSettings((prev) => {
      const paths = prev.effectPaths || [];
      if (paths.length === 0) return prev;
      const nextPaths = paths.slice(0, paths.length - 1);
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { effectPaths: nextPaths } });
      }
      return { ...prev, effectPaths: nextPaths };
    });
  }, []);

  const clearEffectPaths = useCallback(() => {
    setSettings((prev) => {
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { effectPaths: [] } });
      }
      return { ...prev, effectPaths: [] };
    });
  }, []);

  const groupSelectedCliparts = useCallback(() => {
    if (selectedClipartIds.length < 2) return null;
    const groupId = 'group_' + Date.now();
    setSettings((prev) => {
      const nextPlaced = (prev.placedCliparts || []).map((cp) => {
        if (selectedClipartIds.includes(cp.instanceId)) {
          return { ...cp, groupId };
        }
        return cp;
      });
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { placedCliparts: nextPlaced } });
      }
      return {
        ...prev,
        placedCliparts: nextPlaced
      };
    });
    return groupId;
  }, [selectedClipartIds]);

  const ungroupSelectedCliparts = useCallback(() => {
    if (selectedClipartIds.length === 0) return;
    setSettings((prev) => {
      const targetGroupIds = new Set(
        (prev.placedCliparts || [])
          .filter((cp) => selectedClipartIds.includes(cp.instanceId) && cp.groupId)
          .map((cp) => cp.groupId)
      );

      const nextPlaced = (prev.placedCliparts || []).map((cp) => {
        if (selectedClipartIds.includes(cp.instanceId) || (cp.groupId && targetGroupIds.has(cp.groupId))) {
          const { groupId, ...rest } = cp;
          return rest;
        }
        return cp;
      });
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { placedCliparts: nextPlaced } });
      }
      return {
        ...prev,
        placedCliparts: nextPlaced
      };
    });
  }, [selectedClipartIds]);

  const updateMultiplePlacedCliparts = useCallback((updatesMap) => {
    setSettings((prev) => {
      const nextPlaced = (prev.placedCliparts || []).map((cp) => {
        if (updatesMap[cp.instanceId]) {
          return { ...cp, ...updatesMap[cp.instanceId] };
        }
        return cp;
      });
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { placedCliparts: nextPlaced } });
      }
      return {
        ...prev,
        placedCliparts: nextPlaced
      };
    });
  }, []);

  const clearAllCliparts = useCallback(() => {
    setSettings((prev) => {
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { placedCliparts: [] } });
      }
      return { ...prev, placedCliparts: [] };
    });
    setSelectedClipartId(null);
  }, []);

  const toggleClipartFavorite = useCallback((id) => {
    setClipartFavorites((prev) => {
      if (prev.includes(id)) {
        return prev.filter((fid) => fid !== id);
      }
      return [...prev, id];
    });
  }, []);

  const addCustomClipart = useCallback((clipart) => {
    setCustomCliparts((prev) => [...prev, clipart]);
  }, []);

  const removeCustomClipart = useCallback((id) => {
    setCustomCliparts((prev) => prev.filter((cp) => cp.id !== id));
  }, []);

  // Backfills a missing `id` on any item — needed because some items may
  // have been created before id-generation was added to their respective
  // add-functions, and the eye-toggle visibility system requires every
  // item to have a stable id to match against. Without this, a scene's
  // saved effect *count* looks correct, but items lacking an id are
  // silently skipped when building the hidden-items lookup, so toggling
  // visibility appears to work for some items and not others.
  const backfillIds = (arr, prefix) => (arr || []).map(item =>
    item.id ? item : { ...item, id: `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2,7)}` }
  );

  // Keeps a synchronous, always-current mirror of the content fields
  // captureCanvasData needs, written to localStorage on every settings
  // change. This exists specifically because the Grid window and the
  // (usually detached) Controls window are separate processes syncing
  // over an async IPC broadcast — if you draw an effect and click Save
  // quickly in the Controls window, that broadcast may not have arrived
  // yet, so the effect just drawn gets skipped while the *previous* one
  // (which had time to propagate) saves fine. localStorage writes/reads
  // are synchronous and shared across windows of the same origin with no
  // broadcast delay, so reading from here instead of `settings` directly
  // at save-time sidesteps the race entirely.
  useEffect(() => {
    try {
      localStorage.setItem('overgrid_live_snapshot', JSON.stringify({
        placedCliparts: settings.placedCliparts || [],
        drawingPaths: settings.drawingPaths || [],
        maskPaths: settings.maskPaths || [],
        maskRects: settings.maskRects || [],
        backgroundLayers: settings.backgroundLayers || [],
        effectPaths: settings.effectPaths || [],
      }));
    } catch (e) {}
  }, [settings.placedCliparts, settings.drawingPaths, settings.maskPaths,
      settings.maskRects, settings.backgroundLayers, settings.effectPaths]);

  const captureCanvasData = useCallback(() => {
    // Prefer the synchronous localStorage mirror over `settings` directly —
    // see the comment on the effect above for why.
    let liveSnapshot = null;
    try {
      const raw = localStorage.getItem('overgrid_live_snapshot');
      if (raw) liveSnapshot = JSON.parse(raw);
    } catch (e) {}
    const src = liveSnapshot || settings;

    return {
      placedCliparts: JSON.parse(JSON.stringify(src.placedCliparts || [])),
      drawingPaths: JSON.parse(JSON.stringify(backfillIds(src.drawingPaths, 'draw'))),
      maskPaths: JSON.parse(JSON.stringify(backfillIds(src.maskPaths, 'mask'))),
      maskRects: JSON.parse(JSON.stringify(backfillIds(src.maskRects, 'maskrect'))),
      backgroundLayers: JSON.parse(JSON.stringify(src.backgroundLayers || [])),
      backgroundImage: settings.backgroundImage || null,
      backgroundImageData: settings.backgroundImageData || null,
      backgroundImageScale: settings.backgroundImageScale ?? 100,
      backgroundImageX: settings.backgroundImageX ?? 0,
      backgroundImageY: settings.backgroundImageY ?? 0,
      backgroundImageRotation: settings.backgroundImageRotation ?? 0,
      useBackgroundImage: !!settings.useBackgroundImage,
      measurements: JSON.parse(JSON.stringify(measurements || [])),
      gridType: settings.gridType,
      gridColor: settings.gridColor,
      gridSize: settings.gridSize,
      gridOpacity: settings.gridOpacity,
      backgroundColor: settings.backgroundColor,
      lineThickness: settings.lineThickness,
      opacity: settings.opacity,
      // Effects and pings are part of the scene
      effectPaths: JSON.parse(JSON.stringify(backfillIds(src.effectPaths, 'eff'))),
      pingsSnapshot: JSON.parse(JSON.stringify(pings || [])),
    };
  }, [settings, measurements, pings]);

  const saveNewScene = useCallback((name, description = '') => {
    const data = captureCanvasData();
    const sceneName = name?.trim() || `Scene ${scenes.length + 1}`;
    const newScene = {
      id: 'scene_' + Date.now(),
      name: sceneName,
      description: description || '',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data,
    };

    setScenes((prev) => [
      ...prev.map((s) => ({ ...s, active: false })),
      newScene,
    ]);
    setActiveSceneId(newScene.id);
    appDebugStore.log({
      category: 'scene-save',
      message: `Saved new scene "${sceneName}"`,
      detail: `tokens: ${(data.placedCliparts||[]).length}, drawings: ${(data.drawingPaths||[]).length}, masks: ${(data.maskPaths||[]).length + (data.maskRects||[]).length}, backgrounds: ${(data.backgroundLayers||[]).length}, effects: ${data.effectPaths.length}${data.effectPaths.length ? ' (' + data.effectPaths.map(e => e.category || e.shaderName || 'video').join(', ') + ')' : ''}`,
    });
    toast.success(`Saved scene: "${sceneName}" (${data.effectPaths.length} effect${data.effectPaths.length === 1 ? '' : 's'})`);
    return newScene;
  }, [captureCanvasData, scenes.length]);

  const updateActiveScene = useCallback(() => {
    if (!activeSceneId) {
      toast.error('No active scene selected. Click "Save New Scene" first.');
      return;
    }
    const data = captureCanvasData();
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id === activeSceneId) {
          return {
            ...s,
            updatedAt: Date.now(),
            data,
          };
        }
        return s;
      })
    );
    appDebugStore.log({
      category: 'scene-save',
      message: `Updated active scene with current canvas`,
      detail: `tokens: ${(data.placedCliparts||[]).length}, drawings: ${(data.drawingPaths||[]).length}, masks: ${(data.maskPaths||[]).length + (data.maskRects||[]).length}, backgrounds: ${(data.backgroundLayers||[]).length}, effects: ${data.effectPaths.length}${data.effectPaths.length ? ' (' + data.effectPaths.map(e => e.category || e.shaderName || 'video').join(', ') + ')' : ''}`,
    });
    toast.success(`Active scene updated with current canvas changes (${data.effectPaths.length} effect${data.effectPaths.length === 1 ? '' : 's'}).`);
  }, [activeSceneId, captureCanvasData]);

  const updateScene = useCallback((id, updates) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s))
    );
    if (updates?.data) {
      appDebugStore.log({
        category: 'scene-save',
        message: `Overwrote scene with current canvas ("Save Here")`,
        detail: `effects: ${(updates.data.effectPaths || []).length}`,
      });
    }
  }, []);

  // Scene loading now asks Replace vs Merge before touching the grid.
  // `loadScene(sceneId)` just queues the request; `performSceneLoad` does the
  // actual work once the user picks a mode via the confirmation prompt.
  const SCENE_MERGE_OPTION = 'Merge with Current Grid';
  const [pendingSceneLoad, setPendingSceneLoad] = useState(null); // { sceneId } | null

  const loadScene = useCallback((sceneId) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    setPendingSceneLoad({ sceneId });
  }, [scenes]);

  const cancelLoadScene = useCallback(() => setPendingSceneLoad(null), []);

  const performSceneLoad = useCallback((sceneId, mode = 'replace') => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        active: s.id === sceneId,
      }))
    );
    setActiveSceneId(sceneId);

    const d = scene.data || {};

    if (mode === 'merge') {
      // Merge: append the incoming scene's content on top of what's already on
      // the grid instead of replacing it. Grid-level appearance settings
      // (color, size, background color, line thickness, opacity) are left
      // untouched — merge only adds items, it never changes the look of the
      // grid itself. Each merged item is tagged with sceneId so it can later
      // be traced back to (and independently shown/hidden for) its source scene.
      const tag = (arr) => (arr || []).map(item => ({ ...item, sceneId }));

      if (d.measurements) {
        setMeasurements((prev) => [...prev, ...tag(d.measurements)]);
      }

      setSettings((prev) => {
        const nextSettings = {
          ...prev,
          placedCliparts: [...(prev.placedCliparts || []), ...tag(d.placedCliparts)],
          drawingPaths: [...(prev.drawingPaths || []), ...tag(d.drawingPaths)],
          maskPaths: [...(prev.maskPaths || []), ...tag(d.maskPaths)],
          maskRects: [...(prev.maskRects || []), ...tag(d.maskRects)],
          backgroundLayers: [...(prev.backgroundLayers || []), ...tag(d.backgroundLayers)],
          effectPaths: [...(prev.effectPaths || []), ...tag(d.effectPaths)],
        };
        if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
          window.electronAPI.broadcast("settings-update", { settings: nextSettings });
        }
        return nextSettings;
      });

      if (d.pingsSnapshot) {
        setPings((prev) => {
          const merged = [...prev, ...tag(d.pingsSnapshot)];
          try { localStorage.setItem('overgrid_pings', JSON.stringify(merged)); } catch(e) {}
          return merged;
        });
      }

      const mergedCount = (d.effectPaths || []).length;
      appDebugStore.log({
        category: 'scene-load',
        message: `Merged scene "${scene.name}" onto grid`,
        detail: `added tokens: ${(d.placedCliparts||[]).length}, drawings: ${(d.drawingPaths||[]).length}, masks: ${(d.maskPaths||[]).length + (d.maskRects||[]).length}, backgrounds: ${(d.backgroundLayers||[]).length}, effects: ${mergedCount}${mergedCount ? ' (' + (d.effectPaths||[]).map(e => e.category || e.shaderName || 'video').join(', ') + ')' : ''}`,
      });
      toast.success(`Merged scene: "${scene.name}" (${mergedCount} effect${mergedCount === 1 ? '' : 's'} added)`);
      setPendingSceneLoad(null);
      return;
    }

    // Replace (default/original behavior) — full swap of grid content
    if (d.measurements) {
      setMeasurements(d.measurements);
    } else {
      setMeasurements([]);
    }

    setSettings((prev) => {
      const nextSettings = {
        ...prev,
        placedCliparts: d.placedCliparts || [],
        drawingPaths: d.drawingPaths || [],
        maskPaths: d.maskPaths || [],
        maskRects: d.maskRects || [],
        backgroundLayers: d.backgroundLayers || [],
        backgroundImage: d.backgroundImage || null,
        backgroundImageData: d.backgroundImageData || null,
        backgroundImageScale: d.backgroundImageScale ?? prev.backgroundImageScale,
        backgroundImageX: d.backgroundImageX ?? prev.backgroundImageX,
        backgroundImageY: d.backgroundImageY ?? prev.backgroundImageY,
        backgroundImageRotation: d.backgroundImageRotation ?? prev.backgroundImageRotation,
        useBackgroundImage: d.useBackgroundImage ?? prev.useBackgroundImage,
        effectPaths: d.effectPaths || [],
      };
      if (d.gridType) nextSettings.gridType = d.gridType;
      if (d.gridColor) nextSettings.gridColor = d.gridColor;
      if (d.gridSize) nextSettings.gridSize = d.gridSize;
      if (d.backgroundColor) nextSettings.backgroundColor = d.backgroundColor;
      if (d.lineThickness !== undefined) nextSettings.lineThickness = d.lineThickness;
      if (d.opacity !== undefined) nextSettings.opacity = d.opacity;

      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: nextSettings });
      }
      return nextSettings;
    });

    // Restore pings from scene snapshot
    if (d.pingsSnapshot) {
      setPings(d.pingsSnapshot);
      try { localStorage.setItem('overgrid_pings', JSON.stringify(d.pingsSnapshot)); } catch(e) {}
    }

    const loadedEffectCount = (d.effectPaths || []).length;
    const loadedEffectIds = (d.effectPaths || []).map(e => e.id || '(no id)');
    appDebugStore.log({
      category: 'scene-load',
      message: `Replaced grid with scene "${scene.name}"`,
      detail: `tokens: ${(d.placedCliparts||[]).length}, drawings: ${(d.drawingPaths||[]).length}, masks: ${(d.maskPaths||[]).length + (d.maskRects||[]).length}, backgrounds: ${(d.backgroundLayers||[]).length}, effects: ${loadedEffectCount}${loadedEffectCount ? ' (' + (d.effectPaths||[]).map(e => e.category || e.shaderName || 'video').join(', ') + ')' : ''} | loaded effect ids: [${loadedEffectIds.join(', ')}]${loadedEffectIds.includes('(no id)') ? ' ⚠️ one or more effects have no id — they were saved before the id-backfill fix and should be deleted and re-drawn' : ''}`,
    });
    toast.success(`Loaded scene: "${scene.name}" (${loadedEffectCount} effect${loadedEffectCount === 1 ? '' : 's'})`);
    setPendingSceneLoad(null);
  }, [scenes]);

  // Pure layer-visibility toggle — the "eye" button. Hides/shows exactly the
  // items that were on the grid when this scene was SAVED (its snapshot),
  // regardless of when each item was created or which scene was active at
  // creation time. This never loads, replaces, or merges anything — it's a
  // pure show/hide, like a layer visibility toggle in an image editor.
  const toggleSceneVisibility = useCallback((sceneId) => {
    setSettings((prev) => {
      const hidden = prev.hiddenSceneIds || [];
      const isHidden = hidden.includes(sceneId);
      const next = isHidden ? hidden.filter(id => id !== sceneId) : [...hidden, sceneId];
      const scene = scenes.find(s => s.id === sceneId);
      const d = scene?.data || {};
      // Log the ACTUAL ids from the saved snapshot, plus the ids currently
      // live on the grid — if these don't overlap, that's the exact
      // mismatch that causes "debug says it's there but it's not showing".
      // Compare against the synchronous localStorage mirror (not
      // prev.effectPaths directly) — that mirror is written immediately on
      // every change and read the same way regardless of which window this
      // toggle was clicked from, so it's not subject to the IPC broadcast
      // lag that prev.effectPaths can still have.
      let liveSnapshot = null;
      try {
        const raw = localStorage.getItem('overgrid_live_snapshot');
        if (raw) liveSnapshot = JSON.parse(raw);
      } catch (e) {}
      const savedEffectIds = (d.effectPaths || []).map(e => e.id || '(no id)');
      const liveEffectIds = ((liveSnapshot || prev).effectPaths || []).map(e => e.id || '(no id)');
      const matchingIds = savedEffectIds.filter(id => liveEffectIds.includes(id));
      appDebugStore.log({
        category: 'scene-visibility',
        message: `${isHidden ? 'Showed' : 'Hid'} scene "${scene?.name || sceneId}"`,
        detail: `tokens: ${(d.placedCliparts||[]).length}, drawings: ${(d.drawingPaths||[]).length}, masks: ${(d.maskPaths||[]).length + (d.maskRects||[]).length}, backgrounds: ${(d.backgroundLayers||[]).length}, effects: ${(d.effectPaths||[]).length} | saved effect ids: [${savedEffectIds.join(', ')}] | live effect ids on grid: [${liveEffectIds.join(', ')}] | matching: ${matchingIds.length}/${savedEffectIds.length}${matchingIds.length < savedEffectIds.length ? ' ⚠️ MISMATCH — some saved ids have no matching live effect, so they cannot be hidden/shown' : ''}`,
      });
      const nextSettings = { ...prev, hiddenSceneIds: next };
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { hiddenSceneIds: next } });
      }
      return nextSettings;
    });
  }, [scenes]);

  // Derived lookup: for every hidden scene, collect the exact item ids that
  // were captured in its snapshot, grouped by item type. GridCanvas.jsx and
  // EffectsLayer.jsx use these Sets to filter what actually renders.
  const hiddenItemKeys = useMemo(() => {
    const cliparts = new Set(), effects = new Set(), drawings = new Set(),
          maskPaths = new Set(), maskRects = new Set(), backgrounds = new Set();
    (settings.hiddenSceneIds || []).forEach(sceneId => {
      const scene = scenes.find(s => s.id === sceneId);
      const d = scene?.data || {};
      (d.placedCliparts || []).forEach(c => c.instanceId && cliparts.add(c.instanceId));
      (d.effectPaths || []).forEach(e => e.id && effects.add(e.id));
      (d.drawingPaths || []).forEach(p => p.id && drawings.add(p.id));
      (d.maskPaths || []).forEach(p => p.id && maskPaths.add(p.id));
      (d.maskRects || []).forEach(r => r.id && maskRects.add(r.id));
      (d.backgroundLayers || []).forEach(l => l.id && backgrounds.add(l.id));
    });
    return { cliparts, effects, drawings, maskPaths, maskRects, backgrounds };
  }, [scenes, settings.hiddenSceneIds]);

  const toggleSceneActive = useCallback((sceneId) => {
    const target = scenes.find((s) => s.id === sceneId);
    if (!target) return;

    if (target.active) {
      // Toggle OFF
      setScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, active: false } : s))
      );
      if (activeSceneId === sceneId) {
        setActiveSceneId(null);
        setMeasurements([]);
        setSettings((prev) => ({
          ...prev,
          placedCliparts: [],
          drawingPaths: [],
          maskPaths: [],
          maskRects: [],
          backgroundLayers: [],
          backgroundImage: null,
          backgroundImageData: null,
          useBackgroundImage: false,
        }));
      }
      toast.info(`Disabled scene: "${target.name}"`);
    } else {
      // Toggle ON
      loadScene(sceneId);
    }
  }, [scenes, activeSceneId, loadScene]);

  const deleteScene = useCallback((sceneId) => {
    setScenes((prev) => prev.filter((s) => s.id !== sceneId));
    if (activeSceneId === sceneId) {
      setActiveSceneId(null);
    }
    toast.success('Scene deleted');
  }, [activeSceneId]);

  const duplicateScene = useCallback((sceneId) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const cloned = {
      ...JSON.parse(JSON.stringify(scene)),
      id: 'scene_' + Date.now(),
      name: `${scene.name} (Copy)`,
      active: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setScenes((prev) => [...prev, cloned]);
    toast.success(`Duplicated scene: "${cloned.name}"`);
  }, [scenes]);

  const clearCanvasState = useCallback(() => {
    setActiveSceneId(null);
    setScenes((prev) => prev.map((s) => ({ ...s, active: false })));
    setMeasurements([]);
    setSettings((prev) => ({
      ...prev,
      placedCliparts: [],
      drawingPaths: [],
      maskPaths: [],
      maskRects: [],
      backgroundLayers: [],
      backgroundImage: null,
      backgroundImageData: null,
      useBackgroundImage: false,
      effectPaths: [], // was missing — effects used to survive "Blank Canvas"
    }));
    appDebugStore.log({ category: 'scene-load', message: 'Blank Canvas — cleared all grid content' });
    toast.info('Canvas cleared');
  }, []);

  const exportScenes = useCallback(() => {
    // Refresh the active scene's data with a fresh capture before exporting
    // — without this, exporting right after drawing something (without an
    // explicit "Overwrite" first) would silently export stale, previously-
    // saved data instead of what's actually on the grid right now.
    const scenesToExport = scenes.map(s =>
      s.id === activeSceneId ? { ...s, data: captureCanvasData() } : s
    );
    const jsonStr = JSON.stringify(scenesToExport, null, 2);
    const totalEffects = scenesToExport.reduce((sum, s) => sum + ((s.data?.effectPaths || []).length), 0);
    const largeEffects = [];
    scenesToExport.forEach(s => {
      (s.data?.effectPaths || []).forEach(e => {
        const urlLen = (e.effectUrl || '').length;
        if (urlLen > 500_000) largeEffects.push(`"${s.name}": ${(urlLen/1024/1024).toFixed(1)}MB effect (${e.category || e.shaderName || 'unknown'})`);
      });
    });
    appDebugStore.log({
      category: 'scene-export',
      message: `Exported ${scenesToExport.length} scene(s) to file`,
      detail: `total effects across all scenes: ${totalEffects}, JSON size: ${(jsonStr.length/1024).toFixed(0)}KB${largeEffects.length ? ', large effects: ' + largeEffects.join('; ') : ''}`,
    });
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `overgrid_scenes_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Exported ${scenesToExport.length} scene(s) to JSON file (${totalEffects} total effects)`);
  }, [scenes, activeSceneId, captureCanvasData]);

  const exportSingleScene = useCallback((sceneId) => {
    const found = scenes.find(s => s.id === sceneId);
    if (!found) return;
    // Same freshness fix as exportScenes — if this is the currently active
    // scene, refresh its data with a live capture before exporting.
    const scene = sceneId === activeSceneId ? { ...found, data: captureCanvasData() } : found;
    const effectCount = (scene.data?.effectPaths || []).length;
    const jsonStr = JSON.stringify([scene], null, 2);
    appDebugStore.log({
      category: 'scene-export',
      message: `Exported single scene "${scene.name}" to file`,
      detail: `tokens: ${(scene.data?.placedCliparts||[]).length}, drawings: ${(scene.data?.drawingPaths||[]).length}, effects: ${effectCount}, JSON size: ${(jsonStr.length/1024).toFixed(0)}KB`,
    });
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const safeName = scene.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadAnchor.setAttribute("download", `krajden_scene_${safeName}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Exported "${scene.name}" (${effectCount} effect${effectCount === 1 ? '' : 's'}) to file`);
  }, [scenes, activeSceneId, captureCanvasData]);

  const importScenes = useCallback((importedData) => {
    try {
      const parsed = typeof importedData === 'string' ? JSON.parse(importedData) : importedData;
      if (Array.isArray(parsed)) {
        // Regenerate fresh ids for every imported scene and its nested
        // items. Without this, re-importing a previously-exported file (or
        // any id collision with an existing scene) means the imported
        // scene inherits whatever hidden/visible state already exists for
        // that id in settings.hiddenSceneIds — so it can appear to import
        // successfully (correct data, correct effect count) while actually
        // rendering nothing, because it silently came in already hidden.
        const freshId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
        const rekeyItems = (arr, prefix) => (arr || []).map(item => ({ ...item, id: freshId(prefix) }));
        const rekeyed = parsed.map(scene => ({
          ...scene,
          id: freshId('scene'),
          data: scene.data ? {
            ...scene.data,
            effectPaths: rekeyItems(scene.data.effectPaths, 'eff'),
            drawingPaths: rekeyItems(scene.data.drawingPaths, 'draw'),
            maskPaths: rekeyItems(scene.data.maskPaths, 'mask'),
            maskRects: rekeyItems(scene.data.maskRects, 'maskrect'),
          } : scene.data,
        }));
        const totalEffects = rekeyed.reduce((sum, s) => sum + ((s.data?.effectPaths || []).length), 0);
        appDebugStore.log({
          category: 'scene-import',
          message: `Imported ${rekeyed.length} scene(s) from file`,
          detail: `total effects in imported file: ${totalEffects}${rekeyed.map(s => ` "${s.name}": ${(s.data?.effectPaths||[]).length} effects`).join(',')} | fresh ids assigned to avoid inheriting stale hidden/visible state from any id collision`,
        });
        setScenes((prev) => [...prev, ...rekeyed]);
        toast.success(`Imported ${rekeyed.length} scene(s) (${totalEffects} total effects)`);
      } else {
        appDebugStore.log({ category: 'scene-import', message: 'Import failed — file was not a scene array', detail: `got type: ${typeof parsed}` });
        toast.error('Invalid scene format');
      }
    } catch (e) {
      toast.error('Failed to import scenes');
    }
  }, []);

  const addMaskPath = useCallback((path) => {
    const tagged = { ...path, id: path.id || `mask_${Date.now()}_${Math.random().toString(36).substring(2,7)}` };
    setSettings((prev) => {
      const nextPaths = [...(prev.maskPaths || []), tagged];
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { maskPaths: nextPaths } });
      }
      return { ...prev, maskPaths: nextPaths };
    });
    appDebugStore.log({ category: 'mask', message: 'Painted a fog of war stroke' });
  }, []);

  const addMaskRect = useCallback((rect) => {
    const tagged = { ...rect, id: rect.id || `maskrect_${Date.now()}_${Math.random().toString(36).substring(2,7)}` };
    setSettings((prev) => {
      const nextRects = [...(prev.maskRects || []), tagged];
      if (!isUpdatingFromRemoteRef.current && window.electronAPI?.isElectron) {
        window.electronAPI.broadcast("settings-update", { settings: { maskRects: nextRects } });
      }
      return { ...prev, maskRects: nextRects };
    });
    appDebugStore.log({ category: 'mask', message: 'Added a fog of war rectangle' });
  }, []);

  const clearMask = useCallback(() => {
    updateSettings({ maskPaths: [], maskRects: [] });
  }, [updateSettings]);

  const [savedMasks, setSavedMasks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("overgrid_saved_masks") || "[]");
    } catch (e) {
      return [];
    }
  });

  const saveMask = useCallback((name) => {
    const newMask = {
      name,
      resolution: {
        screenWidth: settings.screenWidth,
        screenHeight: settings.screenHeight,
        gridSize: settings.gridSize
      },
      maskPaths: settings.maskPaths || [],
      maskRects: settings.maskRects || [],
      savedAt: Date.now()
    };
    setSavedMasks((prev) => {
      const updated = [...prev, newMask];
      localStorage.setItem("overgrid_saved_masks", JSON.stringify(updated));
      return updated;
    });
  }, [settings.screenWidth, settings.screenHeight, settings.gridSize, settings.maskPaths, settings.maskRects]);

  const loadMask = useCallback((index) => {
    const mask = savedMasks[index];
    if (mask) {
      updateSettings({ maskPaths: mask.maskPaths, maskRects: mask.maskRects });
    }
  }, [savedMasks, updateSettings]);

  const deleteSavedMask = useCallback((index) => {
    setSavedMasks((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem("overgrid_saved_masks", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getPixelsPerUnit = useCallback(() => {
    if (settings.lockRatio) {
      const scale = Math.min(settings.screenWidth / settings.gridSize, settings.screenHeight / settings.gridSize);
      return { x: scale, y: scale };
    }
    return {
      x: settings.screenWidth / settings.unitWidth,
      y: settings.screenHeight / settings.unitHeight
    };
  }, [settings.lockRatio, settings.screenWidth, settings.screenHeight, settings.gridSize, settings.unitWidth, settings.unitHeight]);

  // HOTKEYS & MACROS SYSTEM
  const [customHotkeys, setCustomHotkeys] = useState(() => {
    try {
      const saved = localStorage.getItem('overgrid_hotkeys');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    const defaults = {};
    DEFAULT_ACTIONS.forEach(action => {
      defaults[action.id] = action.defaultHotkey;
    });
    return defaults;
  });

  const [macros, setMacros] = useState(() => {
    try {
      const saved = localStorage.getItem('overgrid_macros');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_MACROS;
  });

  const [recordingMacro, setRecordingMacro] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState([]);

  const updateHotkey = useCallback((actionId, newHotkey) => {
    setCustomHotkeys((prev) => {
      const updated = { ...prev, [actionId]: newHotkey };
      try {
        localStorage.setItem('overgrid_hotkeys', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const resetHotkeysToDefault = useCallback(() => {
    const defaults = {};
    DEFAULT_ACTIONS.forEach(action => {
      defaults[action.id] = action.defaultHotkey;
    });
    setCustomHotkeys(defaults);
    try {
      localStorage.setItem('overgrid_hotkeys', JSON.stringify(defaults));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveMacro = useCallback((macroObj) => {
    setMacros((prev) => {
      const index = prev.findIndex(m => m.id === macroObj.id);
      let updated;
      if (index >= 0) {
        updated = [...prev];
        updated[index] = macroObj;
      } else {
        updated = [...prev, macroObj];
      }
      try {
        localStorage.setItem('overgrid_macros', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const deleteMacro = useCallback((macroId) => {
    setMacros((prev) => {
      const updated = prev.filter(m => m.id !== macroId);
      try {
        localStorage.setItem('overgrid_macros', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const startMacroRecording = useCallback(() => {
    setRecordingMacro(true);
    setRecordedSteps([]);
    toast.info('🔴 Live Macro Recording Started! Actions will be captured.');
  }, []);

  const stopMacroRecording = useCallback(() => {
    setRecordingMacro(false);
    const steps = [...recordedSteps];
    return steps;
  }, [recordedSteps]);

  // RADIAL CONTEXT MENU STATE
  const [radialMenuOpen, setRadialMenuOpen] = useState(false);
  const [radialMenuPos, setRadialMenuPos] = useState(null); // { x, y, mapX, mapY }
  const [showClipartLibrary, setShowClipartLibrary] = useState(false);

  const [radialMenuConfig, setRadialMenuConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('overgrid_radial_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      enabled: true,
      holdDelay: 150,
      topAction: 'measure',
      rightAction: 'beacon',
      bottomAction: 'library',
      leftAction: 'draw'
    };
  });

  const openRadialMenu = useCallback((pos) => {
    if (!radialMenuConfig.enabled) return;
    setRadialMenuPos(pos);
    setRadialMenuOpen(true);
  }, [radialMenuConfig.enabled]);

  const closeRadialMenu = useCallback(() => {
    setRadialMenuOpen(false);
    setRadialMenuPos(null);
  }, []);

  const updateRadialConfig = useCallback((updates) => {
    setRadialMenuConfig(prev => {
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem('overgrid_radial_config', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const resetRadialConfig = useCallback(() => {
    const defaultConfig = {
      enabled: true,
      holdDelay: 150,
      topAction: 'measure',
      rightAction: 'beacon',
      bottomAction: 'library',
      leftAction: 'draw'
    };
    setRadialMenuConfig(defaultConfig);
    try {
      localStorage.setItem('overgrid_radial_config', JSON.stringify(defaultConfig));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Execute a single action by actionId
  const executeAction = useCallback((actionId) => {
    if (recordingMacro) {
      setRecordedSteps(prev => [...prev, { actionId }]);
    }

    switch (actionId) {
      case 'toggle_grid':
        updateSettings({ gridEnabled: !settings.gridEnabled });
        toast.info(`Grid ${!settings.gridEnabled ? 'Enabled' : 'Disabled'}`);
        break;
      case 'toggle_measure':
        updateSettings({ measureMode: !settings.measureMode });
        toast.info(`Measurement Tool ${!settings.measureMode ? 'Active' : 'Deactivated'}`);
        break;
      case 'clear_measurements':
        clearMeasurements();
        toast.success('Cleared all measurements from canvas');
        break;
      case 'toggle_subdivisions':
        updateSettings({ showSubdivisions: !settings.showSubdivisions });
        toast.info(`Subdivisions ${!settings.showSubdivisions ? 'Enabled' : 'Disabled'}`);
        break;
      case 'toggle_ping_mode':
        updateSettings({ pingMode: !settings.pingMode });
        toast.info(`Ping Beacon Mode ${!settings.pingMode ? 'Active (Click map to drop ping)' : 'Deactivated'}`);
        break;
      case 'clear_pings':
        clearPings();
        toast.success('Cleared all ping beacons');
        break;
      case 'toggle_drawing':
        updateSettings({ drawingEnabled: !settings.drawingEnabled });
        toast.info(`Drawing Mode ${!settings.drawingEnabled ? 'Enabled' : 'Disabled'}`);
        break;
      case 'toggle_eraser':
        updateSettings({ eraserEnabled: !settings.eraserEnabled });
        toast.info(`Eraser ${!settings.eraserEnabled ? 'Active' : 'Inactive'}`);
        break;
      case 'clear_drawings':
        clearDrawings();
        toast.success('Cleared all drawings');
        break;
      case 'clear_mask':
        clearMask();
        toast.success('Cleared Fog of War');
        break;
      case 'clear_cliparts':
        clearAllCliparts();
        toast.success('Cleared all tokens');
        break;
      case 'clear_background':
        clearBackgroundImage();
        toast.success('Cleared background image');
        break;
      case 'roll_d20':
        const roll = Math.floor(Math.random() * 20) + 1;
        toast.success(`🎲 Quick Roll 1d20: Result = ${roll}`, {
          duration: 4000,
        });
        break;
      case 'next_turn':
        toast.info('⏩ Next turn in initiative order');
        break;
      case 'prev_turn':
        toast.info('⏪ Previous turn in initiative order');
        break;
      case 'toggle_controls':
        updateSettings({ showControls: !settings.showControls });
        toast.info(`Controls Dashboard ${!settings.showControls ? 'Visible' : 'Hidden'}`);
        break;
      case 'reset_settings':
        resetSettings();
        toast.success('Reset grid settings to defaults');
        break;
      default:
        console.warn('Unknown action:', actionId);
        break;
    }
  }, [settings, updateSettings, clearMeasurements, clearDrawings, clearMask, clearAllCliparts, clearBackgroundImage, resetSettings, recordingMacro, clearPings]);

  // Execute a macro sequentially
  const executeMacro = useCallback((macroOrId) => {
    const macroObj = typeof macroOrId === 'string'
      ? macros.find(m => m.id === macroOrId)
      : macroOrId;

    if (!macroObj || !macroObj.steps || macroObj.steps.length === 0) {
      toast.error('Cannot run macro: Macro is empty or invalid');
      return;
    }

    toast.success(`⚡ Running Macro: "${macroObj.name}"`);
    macroObj.steps.forEach((step, idx) => {
      setTimeout(() => {
        executeAction(step.actionId);
      }, idx * 100);
    });
  }, [macros, executeAction]);

  // Global Keydown Hotkey Interceptor
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
         activeElement.tagName === 'TEXTAREA' ||
         activeElement.tagName === 'SELECT' ||
         activeElement.isContentEditable)
      ) {
        return;
      }

      const combo = formatKeyboardEvent(e);
      if (!combo) return;

      // 1. Check if combo matches any Macro hotkey
      const matchedMacro = macros.find(m => m.hotkey && m.hotkey.toUpperCase() === combo.toUpperCase());
      if (matchedMacro) {
        e.preventDefault();
        executeMacro(matchedMacro);
        return;
      }

      // 2. Check if combo matches any Action hotkey
      for (const actionId of Object.keys(customHotkeys)) {
        const boundHotkey = customHotkeys[actionId];
        if (boundHotkey && boundHotkey.toUpperCase() === combo.toUpperCase()) {
          e.preventDefault();
          executeAction(actionId);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [customHotkeys, macros, executeAction, executeMacro]);

  const { x: pixelsPerUnitX, y: pixelsPerUnitY } = getPixelsPerUnit();

  const pixelToUnit = useCallback((px, py) => {
    return { x: px / pixelsPerUnitX, y: py / pixelsPerUnitY };
  }, [pixelsPerUnitX, pixelsPerUnitY]);

  const unitToPixel = useCallback((ux, uy) => {
    return { x: ux * pixelsPerUnitX, y: uy * pixelsPerUnitY };
  }, [pixelsPerUnitX, pixelsPerUnitY]);

  const calculateDistance = useCallback((x1, y1, x2, y2) => {
    const pixelDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const u1 = pixelToUnit(x1, y1);
    const u2 = pixelToUnit(x2, y2);
    const rawUnitDistance = Math.sqrt(Math.pow(u2.x - u1.x, 2) + Math.pow(u2.y - u1.y, 2));
    return {
      pixelDistance,
      unitDistance: rawUnitDistance * settings.measureMultiplier,
      rawUnitDistance
    };
  }, [pixelToUnit, settings.measureMultiplier]);

  const value = {
    settings,
    updateSettings,
    resetSettings,
    measurements,
    addMeasurement,
    removeMeasurement,
    clearMeasurements,
    addDrawingPath,
    clearDrawings,
    undoDrawing,
    redoDrawing,
    eraseAt,
    setBackgroundImage,
    clearBackgroundImage,
    setLiveMeasurement,
    presets,
    setPresets,
    pixelToUnit,
    unitToPixel,
    calculateDistance,
    pixelsPerUnitX,
    pixelsPerUnitY,
    addPlacedClipart,
    updatePlacedClipart,
    removePlacedClipart,
    setTokenLabel,
    toggleTokenStatus,
    bringTokenToFront,
    sendTokenToBack,
    addEffectPath,
    updateEffectPath,
    removeEffectPath,
    undoLastEffectPath,
    clearEffectPaths,
    clearAllCliparts,
    selectedClipartId,
    setSelectedClipartId,
    selectedClipartIds,
    setSelectedClipartIds,
    groupSelectedCliparts,
    ungroupSelectedCliparts,
    updateMultiplePlacedCliparts,
    clipartFavorites,
    toggleClipartFavorite,
    customCliparts,
    addCustomClipart,
    removeCustomClipart,
    scenes,
    activeSceneId,
    captureCanvasData,
    saveNewScene,
    updateActiveScene,
    updateScene,
    loadScene,
    pendingSceneLoad,
    performSceneLoad,
    cancelLoadScene,
    toggleSceneActive,
    toggleSceneVisibility,
    hiddenItemKeys,
    deleteScene,
    duplicateScene,
    clearCanvasState,
    exportScenes,
    exportSingleScene,
    importScenes,
    addBackgroundLayer,
    updateBackgroundLayer,
    removeBackgroundLayer,
    reorderBackgroundLayers,
    clearAllBackgroundLayers,
    loadBackgroundLayers,
    toggleBgLayersLocked,
    selectedBgLayerId,
    setSelectedBgLayerId,
    addMaskPath,
    addMaskRect,
    clearMask,
    savedMasks,
    saveMask,
    loadMask,
    deleteSavedMask,
    customHotkeys,
    updateHotkey,
    resetHotkeysToDefault,
    macros,
    saveMacro,
    deleteMacro,
    executeAction,
    executeMacro,
    recordingMacro,
    startMacroRecording,
    stopMacroRecording,
    recordedSteps,
    pings,
    addPing,
    removePing,
    clearPings,
    radialMenuOpen,
    radialMenuPos,
    openRadialMenu,
    closeRadialMenu,
    radialMenuConfig,
    updateRadialConfig,
    resetRadialConfig,
    showClipartLibrary,
    setShowClipartLibrary,
    sceneMergeOption: SCENE_MERGE_OPTION,
    openSectionWindow: (section, title) => window?.electronAPI?.openSectionWindow?.(section, title)
  };

  return (
    <GridContext.Provider value={value}>
      {children}
    </GridContext.Provider>
  );
};

export const useGrid = () => {
  const context = useContext(GridContext);
  if (context === undefined) {
    throw new Error('useGrid must be used within a GridProvider');
  }
  return context;
};
