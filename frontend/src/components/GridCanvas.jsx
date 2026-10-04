import { useRef, useEffect, useState, useCallback, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import { useGrid } from '../context/GridContext';
import SessionContext from '../context/SessionContext';
import { PlacedClipart } from './ClipartLibrary';
import { PlacedBackgroundImage } from './PlacedBackgroundImage';
import { RadialContextMenu } from './RadialContextMenu';

export const GridCanvas = ({ className = '', interactive = true, fullscreen = false }) => {
  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const containerRef = useRef(null);
  // A right-click that exits an active tool (measure/draw/erase/ping) sets
  // this ref so the native 'contextmenu' event from that SAME click doesn't
  // also open the radial menu. It has to be a ref, not state: React's state
  // update from the mousedown handler can commit and re-render — removing
  // the measure-mode interaction overlay the mousedown fired on — before the
  // browser dispatches 'contextmenu' for that same right-click, so by the
  // time onContextMenu runs it can see settings.measureMode already false
  // and, finding "no active tool", open the radial menu right after exiting
  // one. A ref read synchronously at the top of onContextMenu sidesteps that
  // render-timing race entirely.
  const suppressNextContextMenuRef = useRef(false);
  const { 
    settings, 
    updateSettings,
    measurements,
    addMeasurement, 
    addDrawingPath,
    clearDrawings,
    eraseAt,
    setLiveMeasurement,
    pixelsPerUnitX, 
    pixelsPerUnitY, 
    updatePlacedClipart,
    removePlacedClipart,
    selectedClipartId,
    setSelectedClipartId,
    selectedClipartIds = [],
    setSelectedClipartIds,
    updateMultiplePlacedCliparts,
    addPlacedClipart,
    addMaskPath,
    addMaskRect,
    updateBackgroundLayer,
    removeBackgroundLayer,
    selectedBgLayerId,
    setSelectedBgLayerId,
    pings,
    addPing,
    removePing,
    clearPings,
    clearMeasurements,
    openRadialMenu,
    addCustomClipart,
    addBackgroundLayer,
    hiddenItemKeys,
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
  const remoteMeasurements = useMemo(() => sessionContext?.remoteMeasurements || [], [sessionContext?.remoteMeasurements]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [measureWaypoints, setMeasureWaypoints] = useState([]);
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

  // Marquee selection box state & Group drag state
  const [marqueeState, setMarqueeState] = useState({ active: false, start: null, current: null, isShift: false });
  const [groupDragOffset, setGroupDragOffset] = useState({ dx: 0, dy: 0 });
  const groupDragStartPositionsRef = useRef({});

  // Physical cell sizes matching exactly how the grid is drawn on the canvas
  const physicalCellSize = useMemo(() => {
    const width = canvasSize.width;
    const height = canvasSize.height;

    let cellWidth, cellHeight;
    if (settings.lockRatio) {
      const gridSize = Math.max(1, settings.gridSize || 1);
      const cellSize = Math.max(5, Math.min(width, height) / gridSize);
      cellWidth = cellSize;
      cellHeight = cellSize;
    } else {
      // Normal mode cell sizes on canvas
      const pxPerUnitX = settings.screenWidth / (settings.unitWidth || 1);
      const pxPerUnitY = settings.screenHeight / (settings.unitHeight || 1);
      const scaleX = width / settings.screenWidth;
      const scaleY = height / settings.screenHeight;
      cellWidth = Math.max(5, pxPerUnitX * scaleX);
      cellHeight = Math.max(5, pxPerUnitY * scaleY);
    }
    return { cellWidth, cellHeight };
  }, [canvasSize, settings]);

  const handleClipartSelect = useCallback((clipart, e) => {
    if (setSelectedBgLayerId) setSelectedBgLayerId(null);
    if (setSelectedClipartId) setSelectedClipartId(clipart.instanceId);
    const isShift = e && e.shiftKey;

    if (isShift) {
      if (setSelectedClipartIds) {
        setSelectedClipartIds(prev => {
          if (prev.includes(clipart.instanceId)) {
            return prev.filter(id => id !== clipart.instanceId);
          } else {
            return [...prev, clipart.instanceId];
          }
        });
      }
    } else {
      if (clipart.groupId) {
        const groupMembers = (settings.placedCliparts || [])
          .filter(cp => cp.groupId === clipart.groupId)
          .map(cp => cp.instanceId);
        if (setSelectedClipartIds) setSelectedClipartIds(groupMembers);
      } else {
        if (selectedClipartIds.includes(clipart.instanceId) && selectedClipartIds.length > 1) {
          // Keep current selection for group dragging
        } else {
          if (setSelectedClipartIds) setSelectedClipartIds([clipart.instanceId]);
        }
      }
    }
  }, [setSelectedBgLayerId, setSelectedClipartId, setSelectedClipartIds, settings.placedCliparts, selectedClipartIds]);

  const handleGroupDragStart = useCallback((leadClipart) => {
    const allCliparts = settings.placedCliparts || [];
    let targets = [];

    if (leadClipart.groupId) {
      targets = allCliparts.filter(cp => cp.groupId === leadClipart.groupId);
    } else if (selectedClipartIds.includes(leadClipart.instanceId) && selectedClipartIds.length > 1) {
      targets = allCliparts.filter(cp => selectedClipartIds.includes(cp.instanceId));
    } else {
      targets = [leadClipart];
    }

    const startMap = {};
    targets.forEach(cp => {
      startMap[cp.instanceId] = { x: cp.x, y: cp.y };
    });
    groupDragStartPositionsRef.current = startMap;
    setGroupDragOffset({ dx: 0, dy: 0 });
  }, [settings.placedCliparts, selectedClipartIds]);

  const handleGroupDragMove = useCallback((dx, dy) => {
    setGroupDragOffset({ dx, dy });
  }, []);

  const handleGroupDragEnd = useCallback((dx, dy) => {
    const startMap = groupDragStartPositionsRef.current;
    const instanceIds = Object.keys(startMap);

    if (instanceIds.length > 0 && (dx !== 0 || dy !== 0)) {
      const updatesMap = {};
      instanceIds.forEach(id => {
        const startPos = startMap[id];
        let newX = startPos.x + dx;
        let newY = startPos.y + dy;

        if (settings.snapClipartsToGrid && physicalCellSize) {
          newX = Math.round(newX / physicalCellSize.cellWidth) * physicalCellSize.cellWidth;
          newY = Math.round(newY / physicalCellSize.cellHeight) * physicalCellSize.cellHeight;
        }

        updatesMap[id] = { x: newX, y: newY };

        if (sessionCode && broadcastUpdateClipart) {
          broadcastUpdateClipart({ instanceId: id, x: newX, y: newY });
        }
      });

      if (updateMultiplePlacedCliparts) {
        updateMultiplePlacedCliparts(updatesMap);
      }
    }

    groupDragStartPositionsRef.current = {};
    setGroupDragOffset({ dx: 0, dy: 0 });
  }, [settings.snapClipartsToGrid, physicalCellSize, sessionCode, broadcastUpdateClipart, updateMultiplePlacedCliparts]);

  // Animation frame loop for continuous beacon ping animations
  const [animTime, setAnimTime] = useState(0);
  useEffect(() => {
    const allActivePings = [...(pings || []), ...(pingMarkers || [])];
    if (allActivePings.length === 0) return;

    let reqId;
    const animate = () => {
      setAnimTime(Date.now());
      reqId = requestAnimationFrame(animate);
    };
    reqId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqId);
  }, [pings, pingMarkers]);

  // Calculate accurate, non-distorted grid distance based on the physical grid on the canvas
  const calculateAccurateDistance = useCallback((x1, y1, x2, y2) => {
    const { cellWidth, cellHeight } = physicalCellSize;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    
    const dx_cells = cellWidth > 0 ? dx / cellWidth : 0;
    const dy_cells = cellHeight > 0 ? dy / cellHeight : 0;
    const rawUnitDistance = Math.sqrt(dx_cells * dx_cells + dy_cells * dy_cells);

    return {
      pixelDistance,
      unitDistance: rawUnitDistance * (settings.measureMultiplier || 1),
      rawUnitDistance
    };
  }, [physicalCellSize, settings.measureMultiplier]);

  // Combine local and remote saved measurements
  const allSavedMeasurements = useMemo(() => {
    const map = new Map();
    (measurements || []).forEach(m => { if (m && m.id) map.set(m.id, m); });
    (remoteMeasurements || []).forEach(m => { if (m && m.id) map.set(m.id, m); });
    return Array.from(map.values());
  }, [measurements, remoteMeasurements]);

  // Helper function to render a measurement tape (active or saved)
  const drawMeasurementTape = useCallback((ctx, m, isLive = false) => {
    if (!m) return;
    const waypoints = m.waypoints || (m.startX !== undefined ? [{ x: m.startX, y: m.startY }, { x: m.endX, y: m.endY }] : []);
    if (waypoints.length < 2) return;

    const isSaved = !isLive;
    const strokeColor = isLive ? '#FF4444' : (m.color || '#FFD700');
    const badgeBg = 'rgba(18, 19, 22, 0.92)';
    const badgeBorder = isLive ? 'rgba(255, 68, 68, 0.8)' : 'rgba(255, 215, 0, 0.8)';
    const textColor = isLive ? '#FF7777' : '#FFD700';

    ctx.save();
    ctx.lineWidth = isLive ? 2.5 : 3;
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;

    if (m.type === 'line' || !m.type) {
      // Glow effect for saved tapes
      if (isSaved) {
        ctx.save();
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 4;
        ctx.strokeStyle = strokeColor + '88';
        ctx.beginPath();
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
          ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Line segments
      ctx.setLineDash(isLive ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(waypoints[0].x, waypoints[0].y);
      for (let i = 1; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint nodes & segment badges
      let accumDist = 0;
      waypoints.forEach((pt, idx) => {
        // Waypoint dot
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, idx === 0 || idx === waypoints.length - 1 ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        if (idx > 0) {
          const prevPt = waypoints[idx - 1];
          const { unitDistance } = calculateAccurateDistance(prevPt.x, prevPt.y, pt.x, pt.y);
          accumDist += unitDistance;

          const midX = (prevPt.x + pt.x) / 2;
          const midY = (prevPt.y + pt.y) / 2;
          const labelText = `${unitDistance.toFixed(1)}u`;

          ctx.font = 'bold 10px monospace';
          const textWidth = ctx.measureText(labelText).width;
          const padding = 4;

          ctx.fillStyle = badgeBg;
          ctx.strokeStyle = badgeBorder;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(midX - textWidth / 2 - padding, midY - 8, textWidth + padding * 2, 16, 4);
          } else {
            ctx.rect(midX - textWidth / 2 - padding, midY - 8, textWidth + padding * 2, 16);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, midX, midY);
        }
      });

      // Total tape length badge at final waypoint
      const lastPt = waypoints[waypoints.length - 1];
      const displayTotal = m.totalDistance || accumDist || m.unitDistance || 0;
      const totalText = isLive ? `Tape: ${displayTotal.toFixed(2)}u` : `Tape: ${displayTotal.toFixed(2)} units`;
      ctx.font = 'bold 11px sans-serif';
      const totalWidth = ctx.measureText(totalText).width;

      ctx.fillStyle = badgeBg;
      ctx.strokeStyle = badgeBorder;
      ctx.lineWidth = 1.5;
      const tPad = 6;
      const badgeX = lastPt.x + 10;
      const badgeY = lastPt.y - 10;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, totalWidth + tPad * 2, 20, 6);
      } else {
        ctx.rect(badgeX, badgeY, totalWidth + tPad * 2, 20);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(totalText, badgeX + tPad, badgeY + 10);

    } else if (m.type === 'radial') {
      const startPt = waypoints[0];
      const endPt = waypoints[waypoints.length - 1];
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      const radius = Math.sqrt(dx * dx + dy * dy);

      ctx.fillStyle = isLive ? 'rgba(255, 68, 68, 0.15)' : 'rgba(255, 215, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(startPt.x, startPt.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      ctx.lineTo(endPt.x, endPt.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(startPt.x, startPt.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.type === 'cone') {
      const startPt = waypoints[0];
      const endPt = waypoints[waypoints.length - 1];
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const baseAngle = Math.atan2(dy, dx);
      const halfAngle = ((m.coneAngle || settings.coneAngle || 60) * Math.PI / 180) / 2;

      ctx.fillStyle = isLive ? 'rgba(255, 68, 68, 0.15)' : 'rgba(255, 215, 0, 0.15)';
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      ctx.arc(startPt.x, startPt.y, distance, baseAngle - halfAngle, baseAngle + halfAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(startPt.x, startPt.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [calculateAccurateDistance, settings.coneAngle]);

  // Handle drop event for cliparts and direct file drops
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

    // Handle dropped files directly onto the map (GIFs, images)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;

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
            
            // Save to custom clipart library
            addCustomClipart?.(customItem);

            // Place on map canvas at drop position
            const newClipart = {
              ...customItem,
              x: dropX + index * 20,
              y: dropY + index * 20,
              scale: 50,
              rotation: 0,
            };
            const instanceId = addPlacedClipart(newClipart);

            if (sessionCode && broadcastAddClipart) {
              broadcastAddClipart({ ...newClipart, instanceId });
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
      return;
    }

    // Handle dropping clipart items from the library
    let rawData = '';
    try {
      rawData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain') || '';
    } catch (err) {
      console.warn('[GridCanvas] dataTransfer read warning:', err);
    }

    let clipart = null;
    if (rawData) {
      try {
        clipart = JSON.parse(rawData);
      } catch (err) {
        console.warn('[GridCanvas] JSON parse error on drop:', err);
      }
    }
    if (!clipart && typeof window !== 'undefined' && window.__draggedClipartItem) {
      clipart = window.__draggedClipartItem;
    }
    if (!clipart) return;

    // Maps are tagged isMap:true at drag-start (see BackgroundLayersPanel.jsx)
    // and must go through addBackgroundLayer — the same function double-click
    // uses — so a dragged map gets the same correct default scale (~1920px,
    // adjustable up to 5000px) instead of being treated as a small token.
    if (clipart.isMap) {
      addBackgroundLayer(clipart.url, clipart.name);
      return;
    }

    try {
      const url = clipart.imageUrl || clipart.url || clipart.imageData || clipart.image_data || clipart.src || '';
      const newClipart = {
        ...clipart,
        imageUrl: url,
        imageData: clipart.imageData || (url.startsWith('data:') ? url : undefined),
        x: dropX,
        y: dropY,
        scale: clipart.scale || 50,
        rotation: clipart.rotation || 0,
      };
      const instanceId = addPlacedClipart(newClipart);
      
      // Broadcast to session if in one
      if (sessionCode && broadcastAddClipart) {
        console.log('[GridCanvas] Broadcasting clipart add:', instanceId, 'session:', sessionCode);
        broadcastAddClipart({ ...newClipart, instanceId });
      }
    } catch (err) {
      console.error('Error dropping clipart:', err);
    }
  }, [addPlacedClipart, sessionCode, broadcastAddClipart, addCustomClipart, addBackgroundLayer]);

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

    // Draw all local saved paths (skip any that belong to a hidden scene layer)
    const paths = (settings.drawingPaths || []).filter(p => !hiddenItemKeys?.drawings?.has(p.id));
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
      
      const currentNow = Date.now();
      const maxAge = 600; // ms
      ctx.lineCap = 'round';
      
      for (let i = 1; i < trail.length; i++) {
        const age = currentNow - trail[i].t;
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

    // Draw animated spinning glowing rune circle pings
    const animNow = animTime || Date.now();
    const allPings = [...(pings || []), ...(pingMarkers || [])];
    
    allPings.forEach(ping => {
      const color = ping.color || '#FFD700';
      const labelText = (ping.name ?? ping.label ?? '').trim();

      ctx.save();
      ctx.translate(ping.x, ping.y);

      // Setup glowing aura
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 + Math.sin(animNow / 150) * 4;

      // 1. Expanding Pulse Wave (Aura expanding outwards)
      const pulseWaveRadius = ((animNow / 18) % 52) + 8;
      const pulseWaveAlpha = Math.max(0, 1 - pulseWaveRadius / 52);
      ctx.strokeStyle = color + Math.round(pulseWaveAlpha * 220).toString(16).padStart(2, '0');
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, pulseWaveRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Spinning Outer Rune Ring (Clockwise rotation)
      const rotAngle1 = (animNow / 1200) % (Math.PI * 2);
      ctx.save();
      ctx.rotate(rotAngle1);

      // Outer boundary double circle
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();

      // 8 Rotating Radial Rune Ticks & Sigil Nodes around outer ring
      const numTicks = 8;
      for (let i = 0; i < numTicks; i++) {
        const tickAngle = (i * Math.PI * 2) / numTicks;
        ctx.save();
        ctx.rotate(tickAngle);

        // Radial tick line crossing the double ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(26, 0);
        ctx.stroke();

        // Rune dot or diamond on alternating ticks
        if (i % 2 === 0) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(22, 0, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();

      // 3. Counter-Rotating Inner Arcane Star / Hexagram Sigil (Counter-clockwise rotation)
      const rotAngle2 = (-animNow / 900) % (Math.PI * 2);
      ctx.save();
      ctx.rotate(rotAngle2);

      // Inner 6-pointed rune star
      ctx.strokeStyle = color + 'CC';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const numPoints = 6;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i * Math.PI * 2) / numPoints;
        const rad = 14;
        const px = Math.cos(angle) * rad;
        const py = Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Inverted inner triangle
      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) {
        const angle = ((i + 0.5) * Math.PI * 2) / numPoints;
        const rad = 14;
        const px = Math.cos(angle) * rad;
        const py = Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // 4. Center Glowing Pulsing Rune Jewel
      const jewelPulse = 1 + Math.sin(animNow / 180) * 0.22;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -6 * jewelPulse);
      ctx.lineTo(5 * jewelPulse, 0);
      ctx.lineTo(0, 6 * jewelPulse);
      ctx.lineTo(-5 * jewelPulse, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore(); // Restore translate(ping.x, ping.y)

      // 5. Beacon Badge Label
      if (labelText) {
        ctx.font = 'bold 11px sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const badgePaddingX = 6;
        const badgeHeight = 16;
        const badgeX = ping.x + 22;
        const badgeY = ping.y - 8;

        // Badge background
        ctx.fillStyle = 'rgba(17, 18, 20, 0.88)';
        ctx.strokeStyle = color + 'AA';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(badgeX, badgeY, textWidth + badgePaddingX * 2 + 12, badgeHeight, 4);
        } else {
          ctx.rect(badgeX, badgeY, textWidth + badgePaddingX * 2 + 12, badgeHeight);
        }
        ctx.fill();
        ctx.stroke();

        // Beacon dot in badge
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(badgeX + 8, badgeY + badgeHeight / 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(labelText, badgeX + 15, badgeY + 12);
      }
    });

    // Render all saved/kept measurement tapes on the map
    allSavedMeasurements.forEach(m => {
      drawMeasurementTape(ctx, m, false);
    });

    // Render active measurement tape in progress
    if (settings.measureMode && measureWaypoints.length > 0 && currentPoint) {
      const activeTape = {
        type: settings.measureMode,
        waypoints: [...measureWaypoints, currentPoint],
        coneAngle: settings.coneAngle,
      };
      drawMeasurementTape(ctx, activeTape, true);
    }

    // Render remote live measurements from session
    if (sessionCode) {
      Object.values(remoteLiveMeasurements).forEach(m => {
        if (!m) return;
        drawMeasurementTape(ctx, m, true);
      });
    }
  }, [settings, canvasSize, remoteDrawings, remoteCursors, cursorTrails, pingMarkers, pings, animTime, isMaskPainting, currentMaskPath, maskRectPreview, currentDrawingPath, allSavedMeasurements, measureWaypoints, currentPoint, remoteLiveMeasurements, sessionCode, drawMeasurementTape]);

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
    let { cellWidth, cellHeight } = physicalCellSize;
    let numCellsX, numCellsY;
    
    if (settings.lockRatio) {
      numCellsX = Math.min(500, Math.ceil(width / cellWidth));
      numCellsY = Math.min(500, Math.ceil(height / cellHeight));
    } else {
      // Normal mode
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

    // Apply grid mask - erase grid where mask is painted (skip hidden scene layers)
    const maskPaths = (settings.maskPaths || []).filter(p => !hiddenItemKeys?.maskPaths?.has(p.id));
    const maskRects = (settings.maskRects || []).filter(r => !hiddenItemKeys?.maskRects?.has(r.id));
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
        if (mr.type === 'circle' && mr.cx !== undefined) {
          ctx.beginPath();
          ctx.arc(mr.cx, mr.cy, mr.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(mr.x, mr.y, mr.width || mr.w, mr.height || mr.h);
        }
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
  }, [settings, canvasSize, pixelsPerUnitX, pixelsPerUnitY, isDrawing, startPoint, currentPoint, sessionCode, remoteLiveMeasurements, physicalCellSize]);

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

    // When effects painting mode is active, let the EffectsDrawingOverlay handle all clicks
    if (settings.effectsEnabled) return;

    // Track activity for session
    if (resetInactivityTimer) {
      resetInactivityTimer();
    }

    const canvasCoords = getCanvasCoords(e);
    const coords = canvasCoords;

    // Measure mode interaction
    if (settings.measureMode) {
      // Left click (button 0): Start measuring or add a breakpoint
      if (e.button === 0) {
        if (measureWaypoints.length === 0) {
          setMeasureWaypoints([canvasCoords]);
          setCurrentPoint(canvasCoords);
          setIsDrawing(true);
          if (broadcastActivityStatus) broadcastActivityStatus('measuring');
        } else {
          const lastPt = measureWaypoints[measureWaypoints.length - 1];
          const dx = canvasCoords.x - lastPt.x;
          const dy = canvasCoords.y - lastPt.y;
          if (Math.sqrt(dx * dx + dy * dy) > 3) {
            setMeasureWaypoints(prev => [...prev, canvasCoords]);
            setCurrentPoint(canvasCoords);
          }
        }
        return;
      }

      // Middle click (button 1): Pin / keep the measurement tape & start new one
      if (e.button === 1) {
        e.preventDefault();
        if (measureWaypoints.length > 0) {
          let allPoints = [...measureWaypoints];
          if (currentPoint) {
            const last = allPoints[allPoints.length - 1];
            const dx = currentPoint.x - last.x;
            const dy = currentPoint.y - last.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
              allPoints.push(currentPoint);
            }
          }

          if (allPoints.length >= 2) {
            let totalDistance = 0;
            let totalPixelDistance = 0;
            const segmentDistances = [];

            for (let i = 0; i < allPoints.length - 1; i++) {
              const p1 = allPoints[i];
              const p2 = allPoints[i + 1];
              const { unitDistance, pixelDistance } = calculateAccurateDistance(p1.x, p1.y, p2.x, p2.y);
              segmentDistances.push(unitDistance);
              totalDistance += unitDistance;
              totalPixelDistance += pixelDistance;
            }

            const scaleX = settings.screenWidth / canvasSize.width;
            const scaleY = settings.screenHeight / canvasSize.height;

            const screenWaypoints = allPoints.map(pt => ({
              x: pt.x * scaleX,
              y: pt.y * scaleY,
            }));

            const measurementData = {
              id: Date.now().toString(),
              type: settings.measureMode,
              waypoints: allPoints,
              screenWaypoints,
              startX: allPoints[0].x,
              startY: allPoints[0].y,
              endX: allPoints[allPoints.length - 1].x,
              endY: allPoints[allPoints.length - 1].y,
              pixelDistance: totalPixelDistance,
              unitDistance: totalDistance,
              totalDistance,
              segmentDistances,
              coneAngle: settings.measureMode === 'cone' ? settings.coneAngle : null,
              color: '#FFD700',
              timestamp: Date.now(),
            };

            addMeasurement(measurementData);
            if (broadcastMeasurement) {
              broadcastMeasurement(measurementData);
            }
          }

          // Reset active measurement state for new measurement
          setMeasureWaypoints([]);
          setCurrentPoint(null);
          setIsDrawing(false);
          setLiveMeasurement(null);
          if (clearLiveMeasurement) clearLiveMeasurement();
          if (broadcastActivityStatus) broadcastActivityStatus('idle');
        }
        return;
      }

      // Right click (button 2): Reset active tool, clear pinned measurements & turn off measure mode
      if (e.button === 2) {
        e.preventDefault();
        suppressNextContextMenuRef.current = true;
        // Safety net: if 'contextmenu' never fires for this gesture (e.g. a
        // touch-emulated right-click on some platforms), don't leave the
        // flag stuck true and silently eat the next real right-click.
        setTimeout(() => { suppressNextContextMenuRef.current = false; }, 50);
        setMeasureWaypoints([]);
        setCurrentPoint(null);
        setIsDrawing(false);
        setLiveMeasurement(null);
        if (clearLiveMeasurement) clearLiveMeasurement();
        if (broadcastActivityStatus) broadcastActivityStatus('idle');
        if (clearMeasurements) clearMeasurements();
        updateSettings({ measureMode: false });
        return;
      }
    }

    // Check if user clicked directly on an existing ping beacon to delete it
    const allExistingPings = [...(pings || []), ...(pingMarkers || [])];
    const clickedPing = allExistingPings.find(p => {
      const dx = p.x - canvasCoords.x;
      const dy = p.y - canvasCoords.y;
      return Math.sqrt(dx * dx + dy * dy) <= 22;
    });

    // Middle click (button 1): Clear all ping beacons & exit Beacon Mode
    if (e.button === 1) {
      e.preventDefault();
      if (clearPings) clearPings();
      if (settings.pingMode) {
        updateSettings({ pingMode: false });
      }
      toast.success('Cleared all beacons');
      return;
    }

    // Handle Right Click
    if (e.button === 2) {
      e.preventDefault();
      if (settings.pingMode) {
        suppressNextContextMenuRef.current = true;
        // Safety net: if 'contextmenu' never fires for this gesture (e.g. a
        // touch-emulated right-click on some platforms), don't leave the
        // flag stuck true and silently eat the next real right-click.
        setTimeout(() => { suppressNextContextMenuRef.current = false; }, 50);
        updateSettings({ pingMode: false });
        toast.info('Exited Beacon Mode');
        return;
      }

      if (openRadialMenu) {
        openRadialMenu({
          x: e.clientX,
          y: e.clientY,
          mapX: canvasCoords.x,
          mapY: canvasCoords.y
        });
      }
      return;
    }
    
    // Drawing tool mode / Eraser mode controls:
    // Left click (button 0): draw (or erase if eraser mode selected)
    // Middle click (button 1): erase
    // Right click (button 2): clear drawings & exit tool
    if ((settings.drawingEnabled || settings.eraserEnabled) && !isBlocked) {
      if (e.button === 2) {
        e.preventDefault();
        suppressNextContextMenuRef.current = true;
        // Safety net: if 'contextmenu' never fires for this gesture (e.g. a
        // touch-emulated right-click on some platforms), don't leave the
        // flag stuck true and silently eat the next real right-click.
        setTimeout(() => { suppressNextContextMenuRef.current = false; }, 50);
        setIsDrawing(false);
        setIsErasing(false);
        setCurrentDrawingPath([]);
        if (clearDrawings) clearDrawings();
        updateSettings({ drawingEnabled: false, eraserEnabled: false });
        if (broadcastActivityStatus) broadcastActivityStatus('idle');
        return;
      }

      if (e.button === 1) {
        e.preventDefault();
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

      if (e.button === 0) {
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

        if (settings.drawingEnabled) {
          setIsDrawing(true);
          setCurrentDrawingPath([coords]);
          if (sessionCode && broadcastCursor && showMyCursor) {
            broadcastCursor(coords.x, coords.y, true);
          }
          if (broadcastActivityStatus) broadcastActivityStatus('drawing');
          return;
        }
      }
    }

    // Alt+Click: permanent ping beacon (stays until manually cleared)
    if (e.button === 0 && e.altKey) {
      if (addPing) addPing(coords.x, coords.y, settings.pingColor, settings.pingLabel || '');
      if (sessionCode && broadcastPing) {
        broadcastPing(coords.x, coords.y, settings.pingColor || '#FFD700', settings.pingLabel || '');
      }
      return;
    }

    // Ping mode click: 3-second disappearing ping
    if (e.button === 0 && settings.pingMode) {
      if (sessionCode && broadcastPing) {
        broadcastPing(coords.x, coords.y, settings.pingColor || '#FFD700', settings.pingLabel || '');
      }
      if (addPing && removePing) {
        const ping = addPing(coords.x, coords.y, settings.pingColor, settings.pingLabel || '');
        if (ping?.id) setTimeout(() => removePing(ping.id), 3000);
      }
      return;
    }
    
    // Mask painting mode
    if (settings.maskEnabled) {
      if (settings.maskTool === 'brush') {
        setIsMaskPainting(true);
        setCurrentMaskPath([coords]);
      } else if (settings.maskTool === 'rect') {
        setMaskRectStart(coords);
        setMaskRectPreview(null);
      } else if (settings.maskTool === 'circle') {
        // Circle fog: add a circle mask rect with type='circle'
        const r = settings.maskBrushSize || 80;
        addMaskRect({ x: coords.x - r, y: coords.y - r, w: r * 2, h: r * 2, type: 'circle', cx: coords.x, cy: coords.y, r });
      }
      return;
    }

    // Start Marquee Box Selection if left clicking on empty canvas space
    if (e.button === 0 && !settings.drawingEnabled && !settings.eraserEnabled && !settings.maskEnabled && !settings.measureMode && !settings.pingMode) {
      setMarqueeState({
        active: true,
        start: coords,
        current: coords,
        isShift: e.shiftKey
      });
    }
  }, [interactive, isBlocked, settings, updateSettings, pings, pingMarkers, removePing, addPing, clearPings, clearDrawings, clearMeasurements, broadcastPing, getCanvasCoords, eraseAt, broadcastErase, resetInactivityTimer, sessionCode, broadcastCursor, showMyCursor, measureWaypoints, currentPoint, calculateAccurateDistance, addMeasurement, broadcastMeasurement, setLiveMeasurement, clearLiveMeasurement, broadcastActivityStatus, openRadialMenu, canvasSize]);

  const handleMouseMove = useCallback((e) => {
    const coords = getCanvasCoords(e);

    // When effects painting mode is active, pass mouse events to EffectsDrawingOverlay
    if (settings.effectsEnabled) {
      // Still track cursor for the brush size indicator
      setCursorPos({ x: coords.x, y: coords.y });
      return;
    }

    // Track cursor position for tool size circle indicator
    setCursorPos({ x: coords.x, y: coords.y });

    // Active marquee drag selection box
    if (marqueeState.active) {
      setMarqueeState(prev => ({ ...prev, current: coords }));
      return;
    }
    
    // Determine if user is actively interacting (clicking/dragging)
    const isClicking = isDrawing || isErasing || isMaskPainting || !!maskRectStart || measureWaypoints.length > 0;
    
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
      if (broadcastErase) {
        broadcastErase(coords.x, coords.y, settings.eraserSize || 20);
      }
      return;
    }
    
    // Measure mode - update active trailing line and live distance
    if (settings.measureMode && measureWaypoints.length > 0) {
      setCurrentPoint(coords);

      let totalUnitDistance = 0;
      let totalPixelDistance = 0;

      for (let i = 0; i < measureWaypoints.length - 1; i++) {
        const p1 = measureWaypoints[i];
        const p2 = measureWaypoints[i + 1];
        const { unitDistance, pixelDistance } = calculateAccurateDistance(p1.x, p1.y, p2.x, p2.y);
        totalUnitDistance += unitDistance;
        totalPixelDistance += pixelDistance;
      }

      const lastWay = measureWaypoints[measureWaypoints.length - 1];
      const activeDist = calculateAccurateDistance(lastWay.x, lastWay.y, coords.x, coords.y);
      totalUnitDistance += activeDist.unitDistance;
      totalPixelDistance += activeDist.pixelDistance;

      setLiveMeasurement({
        unitDistance: totalUnitDistance,
        pixelDistance: totalPixelDistance,
        activeSegmentDistance: activeDist.unitDistance,
        waypointCount: measureWaypoints.length,
      });

      const now = Date.now();
      if (broadcastLiveMeasurement && now - liveMeasureThrottleRef.current > 33) {
        liveMeasureThrottleRef.current = now;
        broadcastLiveMeasurement({
          waypoints: [...measureWaypoints, coords],
          startX: measureWaypoints[0].x,
          startY: measureWaypoints[0].y,
          endX: coords.x,
          endY: coords.y,
          type: settings.measureMode,
          coneAngle: settings.measureMode === 'cone' ? settings.coneAngle : null,
          color: '#FF4444',
          unitDistance: totalUnitDistance,
        });
      }
      return;
    }

    if (!isDrawing) return;
    
    // Drawing mode
    if (settings.drawingEnabled) {
      setCurrentDrawingPath(prev => [...prev, coords]);
      return;
    }
  }, [isDrawing, isErasing, isMaskPainting, maskRectStart, measureWaypoints, marqueeState.active, settings.drawingEnabled, settings.eraserEnabled, settings.eraserSize, settings.measureMode, settings.maskEnabled, settings.maskTool, getCanvasCoords, eraseAt, broadcastErase, sessionCode, broadcastCursor, showMyCursor, calculateAccurateDistance, setLiveMeasurement, broadcastLiveMeasurement]);

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
    // When effects painting mode is active, let EffectsDrawingOverlay handle mouse up
    if (settings.effectsEnabled) return;

    // Process Marquee Box Selection
    if (marqueeState.active) {
      if (marqueeState.start && marqueeState.current) {
        const minX = Math.min(marqueeState.start.x, marqueeState.current.x);
        const maxX = Math.max(marqueeState.start.x, marqueeState.current.x);
        const minY = Math.min(marqueeState.start.y, marqueeState.current.y);
        const maxY = Math.max(marqueeState.start.y, marqueeState.current.y);

        if (maxX - minX > 5 && maxY - minY > 5) {
          const foundCliparts = (settings.placedCliparts || []).filter(cp => {
            return cp.x >= minX && cp.x <= maxX && cp.y >= minY && cp.y <= maxY;
          });
          const foundIds = foundCliparts.map(cp => cp.instanceId);

          if (marqueeState.isShift) {
            if (setSelectedClipartIds) {
              setSelectedClipartIds(prev => Array.from(new Set([...prev, ...foundIds])));
            }
          } else {
            if (setSelectedClipartIds) {
              setSelectedClipartIds(foundIds);
            }
          }

          if (foundIds.length > 0) {
            toast.info(`Selected ${foundIds.length} token(s). Right-click to open Radial Menu to Group.`);
          }
        } else if (!marqueeState.isShift) {
          if (setSelectedClipartIds) setSelectedClipartIds([]);
        }
      }
      setMarqueeState({ active: false, start: null, current: null, isShift: false });
      return;
    }

    if (settings.measureMode) {
      return; // Clicks add waypoints, middle-click keeps tape, right-click resets
    }

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
      
      if (broadcastDrawPath) {
        broadcastDrawPath(pathData);
      }
      
      setCurrentDrawingPath([]);
      setIsDrawing(false);
      if (broadcastActivityStatus) broadcastActivityStatus('idle');
      return;
    }
  }, [isDrawing, isErasing, isMaskPainting, currentMaskPath, maskRectStart, maskRectPreview, marqueeState, setSelectedClipartIds, settings, currentDrawingPath, addDrawingPath, addMaskPath, addMaskRect, broadcastDrawPath, broadcastActivityStatus]);

  const getMeasurementInfo = useCallback(() => {
    if (measureWaypoints.length === 0 || !currentPoint) return null;

    let totalUnitDistance = 0;
    for (let i = 0; i < measureWaypoints.length - 1; i++) {
      const p1 = measureWaypoints[i];
      const p2 = measureWaypoints[i + 1];
      const { unitDistance } = calculateAccurateDistance(p1.x, p1.y, p2.x, p2.y);
      totalUnitDistance += unitDistance;
    }
    const lastWay = measureWaypoints[measureWaypoints.length - 1];
    const { unitDistance: segDist } = calculateAccurateDistance(lastWay.x, lastWay.y, currentPoint.x, currentPoint.y);
    totalUnitDistance += segDist;

    const multiplierText = settings.measureMultiplier !== 1 ? ` (${settings.measureMultiplier}x)` : '';

    if (settings.measureMode === 'line') {
      if (measureWaypoints.length > 1) {
        return `Total: ${totalUnitDistance.toFixed(2)} units (Seg: ${segDist.toFixed(1)}u)${multiplierText}`;
      }
      return `${totalUnitDistance.toFixed(2)} units${multiplierText}`;
    } else if (settings.measureMode === 'radial') {
      return `R: ${totalUnitDistance.toFixed(2)} units${multiplierText}`;
    } else if (settings.measureMode === 'cone') {
      return `${totalUnitDistance.toFixed(2)} units @ ${settings.coneAngle}°${multiplierText}`;
    }
    return null;
  }, [measureWaypoints, currentPoint, settings, calculateAccurateDistance]);

  // Determine cursor style
  const getCursorStyle = () => {
    if (settings.maskEnabled && settings.maskTool === 'brush') return 'none';
    if (settings.eraserEnabled) return 'none';
    if (settings.drawingEnabled) return 'none';
    if (settings.maskEnabled) return 'crosshair';
    if (settings.measureMode) return 'crosshair';
    if (settings.pingMode) return 'crosshair';
    return 'default';
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full ${className}`}
      style={fullscreen ? { background: 'transparent' } : {}}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onContextMenu={(e) => {
        e.preventDefault();
        // If a mousedown handler already exited an active tool for this same
        // right-click, don't also open the radial menu — see
        // suppressNextContextMenuRef's declaration for why this has to be a
        // ref check rather than re-reading settings here.
        if (suppressNextContextMenuRef.current) {
          suppressNextContextMenuRef.current = false;
          return;
        }
        if (settings.measureMode) {
          updateSettings({ measureMode: false });
          return;
        }
        if (settings.drawingEnabled || settings.eraserEnabled) {
          if (clearDrawings) clearDrawings();
          setIsDrawing(false);
          setIsErasing(false);
          setCurrentDrawingPath([]);
          updateSettings({ drawingEnabled: false, eraserEnabled: false });
          return;
        }
        const coords = getCanvasCoords(e);
        if (settings.pingMode) {
          const allExistingPings = [...(pings || []), ...(pingMarkers || [])];
          const clickedPing = allExistingPings.find(p => {
            const dx = p.x - coords.x;
            const dy = p.y - coords.y;
            return Math.sqrt(dx * dx + dy * dy) <= 22;
          });
          if (clickedPing) {
            if (removePing) removePing(clickedPing.id);
            return;
          }
          if (addPing) {
            addPing(coords.x, coords.y, settings.pingColor, settings.pingLabel || '');
          }
          if (sessionCode && broadcastPing) {
            broadcastPing(coords.x, coords.y, settings.pingColor || '#FFD700', settings.pingLabel || '');
          }
          return;
        }

        if (openRadialMenu) {
          openRadialMenu({
            x: e.clientX,
            y: e.clientY,
            mapX: coords.x,
            mapY: coords.y
          });
        }
      }}
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
        {/* Local layers (host's own layers) — hidden if their scene layer is toggled off */}
        {(settings.backgroundLayers || [])
          .filter(layer => !hiddenItemKeys?.backgrounds?.has(layer.id))
          .map((layer) => (
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
        {/* Local Placed Cliparts — hidden if their scene layer is toggled off */}
        {settings.placedCliparts?.filter((clipart) => !hiddenItemKeys?.cliparts?.has(clipart.instanceId)).map((clipart) => {
          const isSelected = (selectedClipartIds || []).includes(clipart.instanceId) || selectedClipartId === clipart.instanceId;
          const isPartMap = groupDragStartPositionsRef.current && groupDragStartPositionsRef.current[clipart.instanceId];
          const activeGroupOffset = isPartMap ? groupDragOffset : null;

          return (
            <PlacedClipart
              key={clipart.instanceId}
              clipart={clipart}
              isSelected={isSelected}
              onSelect={(e) => handleClipartSelect(clipart, e)}
              onContextMenu={(e, instanceId) => {
                e.preventDefault();
                if (openRadialMenu) {
                  openRadialMenu({
                    x: e.clientX,
                    y: e.clientY,
                    mapX: clipart.x,
                    mapY: clipart.y,
                    tokenInstanceId: instanceId,
                  });
                }
              }}
              onUpdate={(updated) => {
                updatePlacedClipart(clipart.instanceId, updated);
                if (sessionCode && broadcastUpdateClipart) {
                  broadcastUpdateClipart({ ...updated, instanceId: clipart.instanceId });
                }
              }}
              onLiveMove={(pos) => {
                if (sessionCode && broadcastLiveClipartMove) {
                  broadcastLiveClipartMove({ ...pos, instanceId: clipart.instanceId });
                }
              }}
              onDelete={() => {
                removePlacedClipart(clipart.instanceId);
                if (setSelectedClipartIds) {
                  setSelectedClipartIds(prev => prev.filter(id => id !== clipart.instanceId));
                }
                if (sessionCode && broadcastRemoveClipart) {
                  broadcastRemoveClipart(clipart.instanceId);
                }
              }}
              canEdit={interactive && !isBlocked && !settings.drawingEnabled && !settings.eraserEnabled && !settings.measureMode}
              disabled={settings.drawingEnabled || settings.eraserEnabled || !!settings.measureMode}
              snapToGrid={settings.snapClipartsToGrid}
              gridCellWidth={physicalCellSize.cellWidth}
              gridCellHeight={physicalCellSize.cellHeight}
              groupDragOffset={activeGroupOffset}
              onDragStartExtra={handleGroupDragStart}
              onDragMoveExtra={handleGroupDragMove}
              onDragEndExtra={handleGroupDragEnd}
            />
          );
        })}
        
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
      
      {/* Layer 5: Measurement interaction layer (highest - captures all mouse events for measuring/pinging) */}
      {(settings.measureMode || settings.drawingEnabled || settings.eraserEnabled || settings.maskEnabled || settings.pingMode) && (
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
      {interactive && settings.measureMode && measureWaypoints.length > 0 && currentPoint && (
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
      {cursorPos && interactive && (settings.drawingEnabled || settings.eraserEnabled || settings.effectsEnabled || (settings.maskEnabled && settings.maskTool === 'brush')) && (() => {
        let size = 0;
        let color = 'rgba(255,255,255,0.6)';
        if (settings.eraserEnabled) {
          size = settings.eraserSize || 20;
          color = 'rgba(255,160,60,0.7)';
        } else if (settings.effectsEnabled) {
          size = settings.effectBrushSize || 60;
          color = 'rgba(202,160,85,0.85)';
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

      {/* Marquee Drag Selection Box Overlay */}
      {marqueeState.active && marqueeState.start && marqueeState.current && (
        <div
          className="absolute border-2 border-dashed border-[#caa055] bg-[#caa055]/15 rounded pointer-events-none z-30 shadow-[0_0_15px_rgba(202,160,85,0.3)] animate-in fade-in duration-75"
          style={{
            left: Math.min(marqueeState.start.x, marqueeState.current.x),
            top: Math.min(marqueeState.start.y, marqueeState.current.y),
            width: Math.abs(marqueeState.current.x - marqueeState.start.x),
            height: Math.abs(marqueeState.current.y - marqueeState.start.y),
          }}
        >
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/80 text-[#caa055] text-[10px] font-mono rounded border border-[#caa055]/40 font-bold select-none">
            Select Box
          </div>
        </div>
      )}

      {/* Radial Context Menu */}
      <RadialContextMenu />
    </div>
  );
};

export default GridCanvas;
