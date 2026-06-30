import { useRef, useEffect, useState, useCallback, useContext, useMemo } from 'react';
import { useGrid } from '../context/GridContext';
import SessionContext from '../context/SessionContext';
import { PlacedClipart } from './ClipartLibrary';
import { PlacedBackgroundImage } from './PlacedBackgroundImage';

export const GridCanvas = ({ className = '', interactive = false, fullscreen = false }) => {
  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const { 
    settings, 
    addMeasurement, 
    addDrawingPath,
    eraseAt,
    setLiveMeasurement,
    pixelsPerUnitX, 
    pixelsPerUnitY, 
    calculateDistance,
    updatePlacedClipart,
    removePlacedClipart,
    selectedClipartId,
    setSelectedClipartId,
    addPlacedClipart,
    addMaskPath,
    addMaskRect,
    updateBackgroundLayer,
    removeBackgroundLayer,
    selectedBgLayerId,
    setSelectedBgLayerId,
  } = useGrid();
  
  // Session context (may not exist if not in SessionProvider)
  const sessionContext = useContext(SessionContext);
  const broadcastDrawPath = sessionContext?.broadcastDrawPath;
  const broadcastMeasurement = sessionContext?.broadcastMeasurement;
  const broadcastErase = sessionContext?.broadcastErase;
  const broadcastCursor = sessionContext?.broadcastCursor;
  const hideCursor = sessionContext?.hideCursor;
  const isBlocked = sessionContext?.isBlocked || false;
  const resetInactivityTimer = sessionContext?.resetInactivityTimer;
  const remoteDrawings = useMemo(() => sessionContext?.remoteDrawings || [], [sessionContext?.remoteDrawings]);
  const remoteCursors = useMemo(() => sessionContext?.remoteCursors || {}, [sessionContext?.remoteCursors]);
  const sessionCode = sessionContext?.sessionCode;
  const showMyCursor = sessionContext?.showMyCursor ?? true; // Default to true
  const sessionBackgroundImage = sessionContext?.sessionBackgroundImage;
  const isHost = sessionContext?.isHost || false;
  const lastEraseEvent = sessionContext?.lastEraseEvent;
  const remoteCliparts = useMemo(() => sessionContext?.remoteCliparts || [], [sessionContext?.remoteCliparts]);
  const broadcastAddClipart = sessionContext?.broadcastAddClipart;
  const broadcastUpdateClipart = sessionContext?.broadcastUpdateClipart;
  const broadcastRemoveClipart = sessionContext?.broadcastRemoveClipart;
  const remoteLiveMeasurements = useMemo(() => sessionContext?.remoteLiveMeasurements || {}, [sessionContext?.remoteLiveMeasurements]);
  const remoteLiveClipartMoves = useMemo(() => sessionContext?.remoteLiveClipartMoves || {}, [sessionContext?.remoteLiveClipartMoves]);
  const broadcastLiveMeasurement = sessionContext?.broadcastLiveMeasurement;
  const clearLiveMeasurement = sessionContext?.clearLiveMeasurement;
  const broadcastLiveClipartMove = sessionContext?.broadcastLiveClipartMove;
  const cursorTrails = useMemo(() => sessionContext?.cursorTrails || {}, [sessionContext?.cursorTrails]);
  const pingMarkers = useMemo(() => sessionContext?.pingMarkers || [], [sessionContext?.pingMarkers]);
  const remoteBgLayers = useMemo(() => sessionContext?.remoteBgLayers || [], [sessionContext?.remoteBgLayers]);
  const broadcastBgLayerAdd = sessionContext?.broadcastBgLayerAdd;
  const broadcastBgLayerUpdate = sessionContext?.broadcastBgLayerUpdate;
  const broadcastBgLayerRemove = sessionContext?.broadcastBgLayerRemove;
  const broadcastPing = sessionContext?.broadcastPing;
  const broadcastActivityStatus = sessionContext?.broadcastActivityStatus;
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 450 });
  const [currentDrawingPath, setCurrentDrawingPath] = useState([]);
  const [bgImage, setBgImage] = useState(null);
  const [sessionBgImage, setSessionBgImage] = useState(null);
  const liveMeasureThrottleRef = useRef(0);

  // Mask painting state
  const [isMaskPainting, setIsMaskPainting] = useState(false);
  const [currentMaskPath, setCurrentMaskPath] = useState([]);
  const [maskRectStart, setMaskRectStart] = useState(null);
  const [maskRectPreview, setMaskRectPreview] = useState(null);

  // Cursor circle position for tool size indicator
  const [cursorPos, setCursorPos] = useState(null);

  // Handle drop event for cliparts
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    
    try {
      const clipart = JSON.parse(data);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const newClipart = {
          ...clipart,
          x,
          y,
          scale: 50,
          rotation: 0,
        };
        const instanceId = addPlacedClipart(newClipart);
        
        // Broadcast to session if in one
        if (sessionCode && broadcastAddClipart) {
          console.log('[GridCanvas] Broadcasting clipart add:', instanceId, 'session:', sessionCode);
          broadcastAddClipart({ ...newClipart, instanceId });
        } else {
          console.log('[GridCanvas] Not broadcasting clipart - sessionCode:', sessionCode, 'broadcastAddClipart:', !!broadcastAddClipart);
        }
      }
    } catch (err) {
      console.error('Error dropping clipart:', err);
    }
  }, [addPlacedClipart, sessionCode, broadcastAddClipart]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Load local background image when data changes
  useEffect(() => {
    if (settings.backgroundImageData && settings.useBackgroundImage) {
      const img = new Image();
      img.onload = () => setBgImage(img);
      img.src = settings.backgroundImageData;
    } else {
      setBgImage(null);
    }
  }, [settings.backgroundImageData, settings.useBackgroundImage]);
  
  // Load session shared background image
  useEffect(() => {
    if (sessionBackgroundImage?.data) {
      const img = new Image();
      img.onload = () => setSessionBgImage(img);
      img.src = sessionBackgroundImage.data;
    } else {
      setSessionBgImage(null);
    }
  }, [sessionBackgroundImage]);

  // Handle erase events from session - apply to local drawings when host erases
  // This syncs the host's own erase action back to their local drawings
  useEffect(() => {
    if (!lastEraseEvent) return;
    
    // If the host erased, also erase from local drawings
    // This ensures the host's local drawings are also affected
    if (lastEraseEvent.isHost && isHost) {
      eraseAt(lastEraseEvent.x, lastEraseEvent.y, lastEraseEvent.radius);
    }
  }, [lastEraseEvent, isHost, eraseAt]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw background image with rotation and tiling
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    
    // Determine which background to show: session shared > local
    const imageToShow = sessionBgImage || bgImage;
    const imageSettings = sessionBackgroundImage ? {
      scale: sessionBackgroundImage.scale || 100,
      x: sessionBackgroundImage.x || 0,
      y: sessionBackgroundImage.y || 0,
      rotation: sessionBackgroundImage.rotation || 0,
      tile: sessionBackgroundImage.tile || false,
    } : {
      scale: settings.backgroundImageScale,
      x: settings.backgroundImageX,
      y: settings.backgroundImageY,
      rotation: settings.backgroundImageRotation || 0,
      tile: settings.backgroundImageTile || false,
    };
    const shouldShowImage = sessionBgImage ? true : (bgImage && settings.useBackgroundImage);

    if (imageToShow && shouldShowImage) {
      const scale = imageSettings.scale / 100;
      const imgWidth = imageToShow.width * scale;
      const imgHeight = imageToShow.height * scale;
      const rotation = imageSettings.rotation * Math.PI / 180;
      
      if (imageSettings.tile) {
        // Tile mode - repeat the image across the canvas
        ctx.save();
        
        // Create a pattern with the rotated image
        const patternCanvas = document.createElement('canvas');
        const patW = Math.max(1, Math.floor(imgWidth));
        const patH = Math.max(1, Math.floor(imgHeight));
        patternCanvas.width = patW;
        patternCanvas.height = patH;
        const patternCtx = patternCanvas.getContext('2d');
        
        if (rotation !== 0) {
          patternCtx.translate(patW / 2, patH / 2);
          patternCtx.rotate(rotation);
          patternCtx.translate(-patW / 2, -patH / 2);
        }
        patternCtx.drawImage(imageToShow, 0, 0, patW, patH);
        
        const pattern = ctx.createPattern(patternCanvas, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          
          // Apply offset
          ctx.translate(imageSettings.x, imageSettings.y);
          ctx.fillRect(-imageSettings.x, -imageSettings.y, width + Math.abs(imageSettings.x), height + Math.abs(imageSettings.y));
        }
        
        ctx.restore();
      } else {
        // Single image mode with rotation
        const centerX = width / 2 + imageSettings.x;
        const centerY = height / 2 + imageSettings.y;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.drawImage(imageToShow, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
        ctx.restore();
      }
    }
  }, [bgImage, sessionBgImage, sessionBackgroundImage, settings.useBackgroundImage, settings.backgroundImageScale, settings.backgroundImageX, settings.backgroundImageY, settings.backgroundImageRotation, settings.backgroundImageTile, canvasSize]);

  // Draw persistent drawings (local + remote)
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Draw all local saved paths
    const paths = settings.drawingPaths || [];
    paths.forEach(path => {
      if (path.points && path.points.length > 1) {
        ctx.strokeStyle = path.color || '#FF4444';
        ctx.lineWidth = path.thickness || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }
    });

    // Draw remote drawings from session
    remoteDrawings.forEach(path => {
      if (path.points && path.points.length > 1) {
        ctx.strokeStyle = path.color || '#FF4444';
        ctx.lineWidth = path.thickness || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }
    });

    // Draw current path being drawn
    if (settings.drawingEnabled && currentDrawingPath.length > 1) {
      ctx.strokeStyle = settings.drawingColor || '#FF4444';
      ctx.lineWidth = settings.drawingThickness || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(currentDrawingPath[0].x, currentDrawingPath[0].y);
      for (let i = 1; i < currentDrawingPath.length; i++) {
        ctx.lineTo(currentDrawingPath[i].x, currentDrawingPath[i].y);
      }
      ctx.stroke();
    }

    // Draw cursor trails
    Object.entries(cursorTrails).forEach(([sid, trail]) => {
      if (!trail || trail.length < 2) return;
      const cursor = remoteCursors[sid];
      if (!cursor) return;
      
      const now = Date.now();
      const maxAge = 600; // ms
      ctx.lineCap = 'round';
      
      for (let i = 1; i < trail.length; i++) {
        const age = now - trail[i].t;
        if (age > maxAge) continue;
        const alpha = Math.max(0, 1 - age / maxAge) * 0.4;
        const width = Math.max(1, (1 - age / maxAge) * 4);
        ctx.strokeStyle = (cursor.color || '#FFFFFF') + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
    });

    // Draw remote cursors - always visible when in session
    Object.entries(remoteCursors).forEach(([sid, cursor]) => {
      if (!cursor || cursor.x === undefined || cursor.y === undefined) return;
      const color = cursor.color || '#FFFFFF';
      
      // Cursor pointer triangle
      ctx.save();
      ctx.translate(cursor.x, cursor.y);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 16);
      ctx.lineTo(5, 12);
      ctx.lineTo(10, 18);
      ctx.lineTo(13, 16);
      ctx.lineTo(8, 10);
      ctx.lineTo(14, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      
      // Name label with background
      const label = cursor.name || 'Guest';
      ctx.font = 'bold 10px sans-serif';
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = color + '33';
      ctx.strokeStyle = color + '66';
      ctx.lineWidth = 1;
      const labelX = cursor.x + 16;
      const labelY = cursor.y + 16;
      ctx.beginPath();
      ctx.roundRect(labelX - 2, labelY - 9, textW + 6, 13, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(label, labelX + 1, labelY + 1);
      
      // Activity indicator dot
      if (cursor.clicking) {
        ctx.fillStyle = '#00FF00';
        ctx.beginPath();
        ctx.arc(cursor.x + 14, cursor.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw ping markers
    const now = Date.now();
    pingMarkers.forEach(ping => {
      const age = now - ping.timestamp;
      if (age > 3000) return;
      
      const alpha = Math.max(0, 1 - age / 3000);
      const pulseScale = 1 + Math.sin(age / 150) * 0.3;
      const radius = 20 * pulseScale;
      const color = ping.color || '#FFD700';
      
      // Outer ring (pulsing)
      ctx.strokeStyle = color + Math.round(alpha * 200).toString(16).padStart(2, '0');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner fill
      ctx.fillStyle = color + Math.round(alpha * 50).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Center dot
      ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Name label
      if (ping.user_name) {
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fillText(ping.user_name, ping.x + radius + 5, ping.y + 4);
      }
    });
  }, [settings.drawingPaths, settings.drawingEnabled, settings.drawingColor, settings.drawingThickness, currentDrawingPath, canvasSize, remoteDrawings, remoteCursors, cursorTrails, pingMarkers, settings.maskPaths, settings.maskRects, isMaskPainting, currentMaskPath, maskRectPreview]);

  // Draw grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;
    
    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas - transparent background
    ctx.clearRect(0, 0, width, height);

    if (!settings.gridEnabled) return;

    // Calculate scale factor (canvas size vs screen resolution)
    const scaleX = width / settings.screenWidth;
    const scaleY = height / settings.screenHeight;

    // Calculate cell sizes based on lock ratio mode
    let cellWidth, cellHeight, numCellsX, numCellsY;
    
    if (settings.lockRatio) {
      // Perfect squares mode - cells are square
      const gridSize = Math.max(1, settings.gridSize || 1);
      const cellSize = Math.max(5, Math.min(width, height) / gridSize);
      cellWidth = cellSize;
      cellHeight = cellSize;
      numCellsX = Math.min(500, Math.ceil(width / cellSize));
      numCellsY = Math.min(500, Math.ceil(height / cellSize));
    } else {
      // Normal mode
      cellWidth = Math.max(5, pixelsPerUnitX * scaleX);
      cellHeight = Math.max(5, pixelsPerUnitY * scaleY);
      numCellsX = Math.min(500, settings.unitWidth || 1);
      numCellsY = Math.min(500, settings.unitHeight || 1);
    }

    if (isNaN(numCellsX) || !isFinite(numCellsX)) numCellsX = 0;
    if (isNaN(numCellsY) || !isFinite(numCellsY)) numCellsY = 0;
    if (isNaN(cellWidth) || !isFinite(cellWidth)) cellWidth = 0;
    if (isNaN(cellHeight) || !isFinite(cellHeight)) cellHeight = 0;

    // Parse grid color and apply opacity
    const hexToRgba = (hex, alpha) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
      }
      return `rgba(212, 175, 55, ${alpha})`;
    };

    // Draw vertical lines
    if (cellWidth > 0) {
      for (let i = 0; i <= numCellsX; i++) {
        const x = i * cellWidth;
        const currentOpacity = settings.opacity;
        ctx.strokeStyle = hexToRgba(settings.gridColor || '#caa055', currentOpacity);
        ctx.lineWidth = settings.lineThickness;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw horizontal lines
    if (cellHeight > 0) {
      for (let i = 0; i <= numCellsY; i++) {
        const y = i * cellHeight;
        const currentOpacity = settings.opacity;
        ctx.strokeStyle = hexToRgba(settings.gridColor || '#caa055', currentOpacity);
        ctx.lineWidth = settings.lineThickness;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Draw subdivisions
    if (settings.showSubdivisions) {
      const subdivisionColor = hexToRgba(settings.gridColor || '#caa055', settings.opacity * 0.4);
      ctx.strokeStyle = subdivisionColor;
      ctx.lineWidth = settings.lineThickness * 0.5;
      
      const subdivisionCount = Math.max(1, Math.min(20, settings.subdivisionCount || 1));
      const subCellWidth = cellWidth / subdivisionCount;
      const subCellHeight = cellHeight / subdivisionCount;

      if (subCellWidth > 0 && subCellHeight > 0) {
        // Vertical subdivisions
        for (let i = 0; i < numCellsX; i++) {
          for (let j = 1; j < subdivisionCount; j++) {
            const x = i * cellWidth + j * subCellWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
        }

        // Horizontal subdivisions
        for (let i = 0; i < numCellsY; i++) {
          for (let j = 1; j < subdivisionCount; j++) {
            const y = i * cellHeight + j * subCellHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }
      }
    }

    // Apply grid mask - erase grid where mask is painted
    const maskPaths = settings.maskPaths || [];
    const maskRects = settings.maskRects || [];
    if (maskPaths.length > 0 || maskRects.length > 0 || maskRectPreview) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const mp of maskPaths) {
        if (!mp.points || mp.points.length < 2) continue;
        ctx.lineWidth = mp.size || 30;
        ctx.beginPath();
        ctx.moveTo(mp.points[0].x, mp.points[0].y);
        for (let i = 1; i < mp.points.length; i++) {
          ctx.lineTo(mp.points[i].x, mp.points[i].y);
        }
        ctx.stroke();
      }

      for (const mr of maskRects) {
        ctx.fillRect(mr.x, mr.y, mr.width, mr.height);
      }

      // Draw preview rect while dragging
      if (maskRectPreview) {
        ctx.fillRect(maskRectPreview.x, maskRectPreview.y, maskRectPreview.width, maskRectPreview.height);
      }

      // Draw current freehand mask stroke in progress
      if (isMaskPainting && currentMaskPath.length > 1) {
        ctx.lineWidth = settings.maskBrushSize || 30;
        ctx.beginPath();
        ctx.moveTo(currentMaskPath[0].x, currentMaskPath[0].y);
        for (let i = 1; i < currentMaskPath.length; i++) {
          ctx.lineTo(currentMaskPath[i].x, currentMaskPath[i].y);
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    // Draw measurement shapes
    if (isDrawing && startPoint && currentPoint && settings.measureMode) {
      const measureColor = '#FF4444';
      ctx.strokeStyle = measureColor;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255, 68, 68, 0.1)';

      if (settings.measureMode === 'line') {
        // Line measurement
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw endpoints
        ctx.fillStyle = measureColor;
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(currentPoint.x, currentPoint.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (settings.measureMode === 'radial') {
        // Radial/Circle measurement
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const radius = Math.sqrt(dx * dx + dy * dy);

        // Draw filled circle
        ctx.fillStyle = 'rgba(255, 68, 68, 0.15)';
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw radius line
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw center point
        ctx.fillStyle = measureColor;
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (settings.measureMode === 'cone') {
        // Cone measurement
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const baseAngle = Math.atan2(dy, dx);
        const halfAngle = (settings.coneAngle * Math.PI / 180) / 2;

        // Draw cone
        ctx.fillStyle = 'rgba(255, 68, 68, 0.15)';
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.arc(startPoint.x, startPoint.y, distance, baseAngle - halfAngle, baseAngle + halfAngle);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw center line
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw origin point
        ctx.fillStyle = measureColor;
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw angle arc indicator
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.5)';
        ctx.lineWidth = 1;
        const arcRadius = Math.min(40, distance * 0.3);
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, arcRadius, baseAngle - halfAngle, baseAngle + halfAngle);
        ctx.stroke();
      }
    }

    // Draw remote live measurements (measurements in progress from other users)
    if (sessionCode) {
      Object.values(remoteLiveMeasurements).forEach(m => {
        if (!m.startX && m.startX !== 0) return;
        const remoteMeasureColor = 'rgba(59, 130, 246, 0.7)'; // blue
        ctx.strokeStyle = remoteMeasureColor;
        ctx.lineWidth = 2;

        if (m.type === 'line') {
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(m.startX, m.startY);
          ctx.lineTo(m.endX, m.endY);
          ctx.stroke();
          ctx.setLineDash([]);
          // Endpoints
          ctx.fillStyle = remoteMeasureColor;
          ctx.beginPath();
          ctx.arc(m.startX, m.startY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(m.endX, m.endY, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (m.type === 'radial') {
          const dx = m.endX - m.startX;
          const dy = m.endY - m.startY;
          const radius = Math.sqrt(dx * dx + dy * dy);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
          ctx.beginPath();
          ctx.arc(m.startX, m.startY, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(m.startX, m.startY);
          ctx.lineTo(m.endX, m.endY);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (m.type === 'cone') {
          const dx = m.endX - m.startX;
          const dy = m.endY - m.startY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const baseAngle = Math.atan2(dy, dx);
          const halfAngle = ((m.coneAngle || 60) * Math.PI / 180) / 2;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
          ctx.beginPath();
          ctx.moveTo(m.startX, m.startY);
          ctx.arc(m.startX, m.startY, distance, baseAngle - halfAngle, baseAngle + halfAngle);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // Label
        if (m.user_name) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(m.user_name, m.endX + 10, m.endY - 8);
        }
      });
    }
  }, [settings, canvasSize, pixelsPerUnitX, pixelsPerUnitY, isDrawing, startPoint, currentPoint, sessionCode, remoteLiveMeasurements]);

  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    // Support both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
    const clientY = e.touches ? e.touches[0].clientY : (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (!interactive) return;
    
    // Block drawing/erasing if user is blocked in session
    if (isBlocked && (settings.eraserEnabled || settings.drawingEnabled || settings.measureMode)) {
      return;
    }
    
    const coords = getCanvasCoords(e);
    
    // Track activity for session
    if (resetInactivityTimer) {
      resetInactivityTimer();
    }
    
    // Mask painting mode
    if (settings.maskEnabled) {
      if (settings.maskTool === 'brush') {
        setIsMaskPainting(true);
        setCurrentMaskPath([coords]);
      } else if (settings.maskTool === 'rect') {
        setMaskRectStart(coords);
        setMaskRectPreview(null);
      }
      return;
    }
    
    // Eraser mode
    if (settings.eraserEnabled) {
      setIsErasing(true);
      eraseAt(coords.x, coords.y, settings.eraserSize || 20);
      if (broadcastErase) {
        broadcastErase(coords.x, coords.y, settings.eraserSize || 20);
      }
      if (sessionCode && broadcastCursor && showMyCursor) {
        broadcastCursor(coords.x, coords.y, true);
      }
      if (broadcastActivityStatus) broadcastActivityStatus('erasing');
      return;
    }
    
    // Drawing mode
    if (settings.drawingEnabled) {
      setIsDrawing(true);
      setCurrentDrawingPath([coords]);
      if (sessionCode && broadcastCursor && showMyCursor) {
        broadcastCursor(coords.x, coords.y, true);
      }
      if (broadcastActivityStatus) broadcastActivityStatus('drawing');
      return;
    }
    
    // Measure mode
    if (settings.measureMode) {
      setStartPoint(coords);
      setCurrentPoint(coords);
      setIsDrawing(true);
      if (sessionCode && broadcastCursor && showMyCursor) {
        broadcastCursor(coords.x, coords.y, true);
      }
      if (broadcastActivityStatus) broadcastActivityStatus('measuring');
    }
  }, [interactive, isBlocked, settings.measureMode, settings.drawingEnabled, settings.eraserEnabled, settings.eraserSize, settings.maskEnabled, settings.maskTool, settings.maskBrushSize, getCanvasCoords, eraseAt, broadcastErase, resetInactivityTimer, sessionCode, broadcastCursor, showMyCursor]);

  const handleMouseMove = useCallback((e) => {
    const coords = getCanvasCoords(e);
    
    // Track cursor position for tool size circle indicator
    setCursorPos({ x: coords.x, y: coords.y });
    
    // Determine if user is actively interacting (clicking/dragging)
    const isClicking = isDrawing || isErasing || isMaskPainting || !!maskRectStart;
    
    // Always broadcast cursor position to session for cursor trails
    if (sessionCode && broadcastCursor && showMyCursor) {
      broadcastCursor(coords.x, coords.y, isClicking);
    }
    
    // Mask brush painting
    if (isMaskPainting && settings.maskEnabled && settings.maskTool === 'brush') {
      setCurrentMaskPath(prev => [...prev, coords]);
      return;
    }
    
    // Mask rect dragging
    if (maskRectStart && settings.maskEnabled && settings.maskTool === 'rect') {
      setMaskRectPreview({
        x: Math.min(maskRectStart.x, coords.x),
        y: Math.min(maskRectStart.y, coords.y),
        width: Math.abs(coords.x - maskRectStart.x),
        height: Math.abs(coords.y - maskRectStart.y),
      });
      return;
    }
    
    // Eraser mode
    if (isErasing && settings.eraserEnabled) {
      eraseAt(coords.x, coords.y, settings.eraserSize || 20);
      // Broadcast erase to session
      if (broadcastErase) {
        broadcastErase(coords.x, coords.y, settings.eraserSize || 20);
      }
      return;
    }
    
    if (!isDrawing) return;
    
    // Drawing mode
    if (settings.drawingEnabled) {
      setCurrentDrawingPath(prev => [...prev, coords]);
      return;
    }
    
    // Measure mode - update live measurement for popup window
    setCurrentPoint(coords);
    
    if (startPoint && settings.measureMode) {
      // Calculate and send live measurement
      const scaleX = settings.screenWidth / canvasSize.width;
      const scaleY = settings.screenHeight / canvasSize.height;
      
      const screenStart = {
        x: startPoint.x * scaleX,
        y: startPoint.y * scaleY,
      };
      const screenEnd = {
        x: coords.x * scaleX,
        y: coords.y * scaleY,
      };
      
      const { unitDistance, rawUnitDistance } = calculateDistance(
        screenStart.x, screenStart.y,
        screenEnd.x, screenEnd.y
      );
      
      setLiveMeasurement({
        unitDistance: rawUnitDistance,
        pixelDistance: Math.sqrt(
          Math.pow(screenEnd.x - screenStart.x, 2) + Math.pow(screenEnd.y - screenStart.y, 2)
        ),
      });
      
      // Broadcast live measurement to session (throttled to 30fps)
      const now = Date.now();
      if (broadcastLiveMeasurement && now - liveMeasureThrottleRef.current > 33) {
        liveMeasureThrottleRef.current = now;
        broadcastLiveMeasurement({
          startX: startPoint.x,
          startY: startPoint.y,
          endX: coords.x,
          endY: coords.y,
          type: settings.measureMode,
          coneAngle: settings.measureMode === 'cone' ? settings.coneAngle : null,
          color: '#FF4444',
        });
      }
    }
  }, [isDrawing, isErasing, isMaskPainting, maskRectStart, startPoint, settings.drawingEnabled, settings.eraserEnabled, settings.eraserSize, settings.measureMode, settings.maskEnabled, settings.maskTool, settings.screenWidth, settings.screenHeight, canvasSize, getCanvasCoords, eraseAt, broadcastErase, sessionCode, broadcastCursor, showMyCursor, calculateDistance, setLiveMeasurement]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (sessionCode && hideCursor) {
      hideCursor();
    }
  }, [sessionCode, hideCursor]);

  const handleDoubleClick = useCallback((e) => {
    if (!sessionCode || !broadcastPing) return;
    const coords = getCanvasCoords(e);
    broadcastPing(coords.x, coords.y);
  }, [sessionCode, broadcastPing, getCanvasCoords]);

  const handleMouseUp = useCallback(() => {
    // Mask brush - save the path
    if (isMaskPainting && currentMaskPath.length > 1) {
      addMaskPath({ points: currentMaskPath, size: settings.maskBrushSize || 30 });
      setCurrentMaskPath([]);
      setIsMaskPainting(false);
      return;
    }
    if (isMaskPainting) {
      setCurrentMaskPath([]);
      setIsMaskPainting(false);
      return;
    }
    
    // Mask rect - save the rect
    if (maskRectStart && maskRectPreview) {
      addMaskRect(maskRectPreview);
      setMaskRectStart(null);
      setMaskRectPreview(null);
      return;
    }
    if (maskRectStart) {
      setMaskRectStart(null);
      setMaskRectPreview(null);
      return;
    }
    
    // Reset eraser state
    if (isErasing) {
      setIsErasing(false);
      if (broadcastActivityStatus) broadcastActivityStatus('idle');
      return;
    }
    
    if (!isDrawing) return;
    
    // Drawing mode - save the path
    if (settings.drawingEnabled && currentDrawingPath.length > 1) {
      const pathData = {
        points: currentDrawingPath,
        color: settings.drawingColor,
        thickness: settings.drawingThickness,
        timestamp: Date.now(),
      };
      addDrawingPath(pathData);
      
      // Broadcast to session
      if (broadcastDrawPath) {
        console.log('[GridCanvas] Broadcasting draw path, points:', currentDrawingPath.length);
        broadcastDrawPath(pathData);
      }
      
      setCurrentDrawingPath([]);
      setIsDrawing(false);
      if (broadcastActivityStatus) broadcastActivityStatus('idle');
      return;
    }
    
    // Measure mode
    if (!startPoint || !currentPoint) {
      setIsDrawing(false);
      return;
    }

    // Convert canvas coords to screen coords
    const scaleX = settings.screenWidth / canvasSize.width;
    const scaleY = settings.screenHeight / canvasSize.height;

    const screenStart = {
      x: startPoint.x * scaleX,
      y: startPoint.y * scaleY,
    };
    const screenEnd = {
      x: currentPoint.x * scaleX,
      y: currentPoint.y * scaleY,
    };

    const { pixelDistance, unitDistance } = calculateDistance(
      screenStart.x, screenStart.y,
      screenEnd.x, screenEnd.y
    );

    if (pixelDistance > 5) {
      const measurementData = {
        startX: screenStart.x,
        startY: screenStart.y,
        endX: screenEnd.x,
        endY: screenEnd.y,
        pixelDistance,
        unitDistance,
        type: settings.measureMode,
        coneAngle: settings.measureMode === 'cone' ? settings.coneAngle : null,
      };
      addMeasurement(measurementData);
      
      // Broadcast to session
      if (broadcastMeasurement) {
        broadcastMeasurement(measurementData);
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    
    // Clear live measurement
    setLiveMeasurement(null);
    if (clearLiveMeasurement) {
      clearLiveMeasurement();
    }
    
    // Set status back to idle
    if (broadcastActivityStatus) broadcastActivityStatus('idle');
    
    // Hide cursor when mouse is released
    if (sessionCode && hideCursor) {
      hideCursor();
    }
  }, [isDrawing, isErasing, isMaskPainting, currentMaskPath, maskRectStart, maskRectPreview, startPoint, currentPoint, settings, canvasSize, calculateDistance, addMeasurement, currentDrawingPath, addDrawingPath, addMaskPath, addMaskRect, broadcastDrawPath, broadcastMeasurement, setLiveMeasurement, sessionCode, hideCursor, clearLiveMeasurement, broadcastActivityStatus]);

  const getMeasurementInfo = useCallback(() => {
    if (!startPoint || !currentPoint) return null;

    const scaleX = settings.screenWidth / canvasSize.width;
    const scaleY = settings.screenHeight / canvasSize.height;
    
    const { unitDistance } = calculateDistance(
      startPoint.x * scaleX, startPoint.y * scaleY,
      currentPoint.x * scaleX, currentPoint.y * scaleY
    );

    const multiplierText = settings.measureMultiplier !== 1 ? ` (${settings.measureMultiplier}x)` : '';

    if (settings.measureMode === 'line') {
      return `${unitDistance.toFixed(2)} units${multiplierText}`;
    } else if (settings.measureMode === 'radial') {
      return `R: ${unitDistance.toFixed(2)} units${multiplierText}`;
    } else if (settings.measureMode === 'cone') {
      return `${unitDistance.toFixed(2)} units @ ${settings.coneAngle}°${multiplierText}`;
    }
    return null;
  }, [startPoint, currentPoint, settings, canvasSize, calculateDistance]);

  // Determine cursor style
  const getCursorStyle = () => {
    if (settings.maskEnabled && settings.maskTool === 'brush') return 'none';
    if (settings.eraserEnabled) return 'none';
    if (settings.drawingEnabled) return 'none';
    if (settings.maskEnabled) return 'crosshair';
    if (settings.measureMode) return 'crosshair';
    return 'default';
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full ${className}`}
      style={fullscreen ? { background: 'transparent' } : {}}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      data-testid="grid-canvas-container"
    >
      {/* Layer 0: Background image layers (below grid) */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ 
          zIndex: 0, 
          pointerEvents: (settings.drawingEnabled || settings.eraserEnabled || settings.measureMode || settings.maskEnabled) ? 'none' : 'auto',
        }}
        onClick={() => { setSelectedBgLayerId(null); setSelectedClipartId(null); }}
        data-testid="bg-layers-container"
      >
        {/* Local layers (host's own layers) */}
        {(settings.backgroundLayers || []).map((layer) => (
          <PlacedBackgroundImage
            key={layer.id}
            layer={layer}
            isSelected={selectedBgLayerId === layer.id}
            onSelect={() => { setSelectedBgLayerId(layer.id); setSelectedClipartId(null); }}
            onUpdate={(updates) => {
              updateBackgroundLayer(layer.id, updates);
              if (broadcastBgLayerUpdate) broadcastBgLayerUpdate(layer.id, updates);
            }}
            onDelete={() => {
              removeBackgroundLayer(layer.id);
              if (broadcastBgLayerRemove) broadcastBgLayerRemove(layer.id);
            }}
            canEdit={interactive && !isBlocked && !settings.drawingEnabled && !settings.eraserEnabled && !settings.measureMode && !settings.bgLayersLocked}
            disabled={settings.drawingEnabled || settings.eraserEnabled || !!settings.measureMode || settings.bgLayersLocked}
          />
        ))}
        {/* Remote layers (from session host, for guests) */}
        {remoteBgLayers.map((layer) => (
          <PlacedBackgroundImage
            key={`remote-${layer.id}`}
            layer={layer}
            isSelected={false}
            canEdit={false}
            disabled={true}
          />
        ))}
      </div>

      {/* Layer 1: Legacy background image (canvas) */}
      <canvas
        ref={bgCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ width: canvasSize.width, height: canvasSize.height, zIndex: 1 }}
        data-testid="bg-canvas"
      />
      
      {/* Layer 2: Grid */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ width: canvasSize.width, height: canvasSize.height, background: 'transparent', zIndex: 2 }}
        data-testid="grid-canvas"
      />
      
      {/* Layer 3: Cliparts (below drawings and measurements) */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ 
          zIndex: 3, 
          pointerEvents: 'none',
        }}
        data-testid="cliparts-layer"
      >
        {/* Local Placed Cliparts */}
        {settings.placedCliparts?.map((clipart) => (
          <PlacedClipart
            key={clipart.instanceId}
            clipart={clipart}
            isSelected={selectedClipartId === clipart.instanceId}
            onSelect={() => { setSelectedClipartId(clipart.instanceId); setSelectedBgLayerId(null); }}
            onUpdate={(updated) => {
              updatePlacedClipart(clipart.instanceId, updated);
              if (sessionCode && broadcastUpdateClipart) {
                broadcastUpdateClipart({ ...updated, instanceId: clipart.instanceId });
              }
            }}
            onLiveMove={(pos) => {
              // Broadcast live position during drag for real-time sync
              if (sessionCode && broadcastLiveClipartMove) {
                broadcastLiveClipartMove({ ...pos, instanceId: clipart.instanceId });
              }
            }}
            onDelete={() => {
              removePlacedClipart(clipart.instanceId);
              setSelectedClipartId(null);
              if (sessionCode && broadcastRemoveClipart) {
                broadcastRemoveClipart(clipart.instanceId);
              }
            }}
            canEdit={interactive && !isBlocked && !settings.drawingEnabled && !settings.eraserEnabled && !settings.measureMode}
            disabled={settings.drawingEnabled || settings.eraserEnabled || !!settings.measureMode}
            snapToGrid={settings.snapClipartsToGrid}
            gridCellWidth={settings.lockRatio ? settings.squareSize : settings.gridSize}
            gridCellHeight={settings.lockRatio ? settings.squareSize : settings.gridSize}
          />
        ))}
        
        {/* Remote Cliparts from Session */}
        {remoteCliparts?.map((clipart) => {
          // Apply live position override if another user is dragging this clipart
          const liveMove = remoteLiveClipartMoves[clipart.instanceId];
          const displayClipart = liveMove ? { ...clipart, ...liveMove } : clipart;
          return (
            <PlacedClipart
              key={`remote-${clipart.instanceId}`}
              clipart={displayClipart}
              isSelected={false}
              onSelect={() => {}}
              onUpdate={() => {}}
              onDelete={() => {}}
              canEdit={false}
              disabled={true}
              snapToGrid={false}
            />
          );
        })}
      </div>
      
      {/* Layer 4: Drawings (above cliparts) */}
      <canvas
        ref={drawingCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ width: canvasSize.width, height: canvasSize.height, zIndex: 4 }}
        data-testid="drawing-canvas"
      />
      
      {/* Layer 5: Measurement interaction layer (highest - captures all mouse events for measuring) */}
      {(settings.measureMode || settings.drawingEnabled || settings.eraserEnabled || settings.maskEnabled) && (
        <div
          className="absolute inset-0 w-full h-full"
          style={{ 
            zIndex: 10, 
            cursor: getCursorStyle(),
            background: 'rgba(0,0,0,0.005)',
            touchAction: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => { handleMouseUp(); handleMouseLeave(); }}
          onTouchStart={(e) => { e.preventDefault(); handleMouseDown(e); }}
          onTouchMove={(e) => { e.preventDefault(); handleMouseMove(e); }}
          onTouchEnd={(e) => { e.preventDefault(); handleMouseUp(e); }}
          onDoubleClick={handleDoubleClick}
          data-testid="interaction-layer"
        />
      )}
      
      {/* Layer 6: UI Elements (tooltips, indicators, cursors) */}
      {/* Measurement tooltip */}
      {interactive && settings.measureMode && isDrawing && startPoint && currentPoint && (
        <div
          className="absolute px-3 py-2 bg-black/90 text-white text-sm font-mono rounded-lg pointer-events-none border border-white/20"
          style={{
            left: Math.min(currentPoint.x + 15, canvasSize.width - 150),
            top: Math.max(currentPoint.y - 40, 10),
            zIndex: 100,
          }}
          data-testid="measurement-tooltip"
        >
          {getMeasurementInfo()}
        </div>
      )}
      
      {/* Drawing indicator */}
      {interactive && settings.drawingEnabled && !settings.eraserEnabled && (
        <div
          className="absolute top-2 left-2 px-3 py-1 bg-red-500/90 text-white text-xs font-medium rounded-full pointer-events-none"
          style={{ zIndex: 100 }}
          data-testid="drawing-indicator"
        >
          Drawing Mode
        </div>
      )}
      
      {/* Eraser indicator */}
      {interactive && settings.eraserEnabled && (
        <div
          className="absolute top-2 left-2 px-3 py-1 bg-orange-500/90 text-white text-xs font-medium rounded-full pointer-events-none"
          style={{ zIndex: 100 }}
          data-testid="eraser-indicator"
        >
          Eraser Mode
        </div>
      )}

      {/* Cursor circle — shows tool tip size */}
      {cursorPos && interactive && (settings.drawingEnabled || settings.eraserEnabled || (settings.maskEnabled && settings.maskTool === 'brush')) && (() => {
        let size = 0;
        let color = 'rgba(255,255,255,0.6)';
        if (settings.eraserEnabled) {
          size = settings.eraserSize || 20;
          color = 'rgba(255,160,60,0.7)';
        } else if (settings.maskEnabled && settings.maskTool === 'brush') {
          size = settings.maskBrushSize || 30;
          color = 'rgba(180,120,255,0.7)';
        } else if (settings.drawingEnabled) {
          size = (settings.drawWidth || 2) * (settings.drawingThickness || 1);
          color = settings.drawingColor || 'rgba(255,255,255,0.7)';
        }
        if (size < 2) return null;
        return (
          <div
            className="pointer-events-none absolute"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: size,
              height: size,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `1.5px solid ${color}`,
              zIndex: 200,
              opacity: 0.9,
              boxShadow: `0 0 0 1px rgba(0,0,0,0.3)`,
            }}
            data-testid="cursor-size-circle"
          />
        );
      })()}
    </div>
  );
};

export default GridCanvas;
