import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

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
  maskRects: []
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

  const [selectedClipartId, setSelectedClipartId] = useState(null);
  const isUpdatingFromRemoteRef = useRef(false);
  const clipartDebounceRef = useRef(null);

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
    setSettings((prev) => ({
      ...prev,
      drawingPaths: [...(prev.drawingPaths || []), path]
    }));
    setUndoStack([]);
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
      scale: 300,
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

    return newLayer.id;
  }, []);

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
    setSettings((prev) => ({
      ...prev,
      placedCliparts: [...(prev.placedCliparts || []), newPlaced]
    }));
    return newPlaced.instanceId;
  }, []);

  const updatePlacedClipart = useCallback((instanceId, updates) => {
    setSettings((prev) => ({
      ...prev,
      placedCliparts: (prev.placedCliparts || []).map((cp) => {
        if (cp.instanceId === instanceId) {
          return { ...cp, ...updates };
        }
        return cp;
      })
    }));
  }, []);

  const removePlacedClipart = useCallback((instanceId) => {
    setSettings((prev) => ({
      ...prev,
      placedCliparts: (prev.placedCliparts || []).filter((cp) => cp.instanceId !== instanceId)
    }));
    setSelectedClipartId((curr) => (curr === instanceId ? null : curr));
  }, []);

  const clearAllCliparts = useCallback(() => {
    setSettings((prev) => ({ ...prev, placedCliparts: [] }));
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

  const addMaskPath = useCallback((path) => {
    setSettings((prev) => ({
      ...prev,
      maskPaths: [...(prev.maskPaths || []), path]
    }));
  }, []);

  const addMaskRect = useCallback((rect) => {
    setSettings((prev) => ({
      ...prev,
      maskRects: [...(prev.maskRects || []), rect]
    }));
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
    clearAllCliparts,
    selectedClipartId,
    setSelectedClipartId,
    clipartFavorites,
    toggleClipartFavorite,
    customCliparts,
    addCustomClipart,
    removeCustomClipart,
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
    deleteSavedMask
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
