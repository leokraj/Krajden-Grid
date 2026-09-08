import React, { useRef, useState, useEffect } from 'react';
import { RotateCw, Trash2, Maximize2, Eye } from 'lucide-react';
import { getFallbackMapSvg } from './BackgroundLayersPanel';

export const PlacedBackgroundImage = ({
  layer,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  canEdit = false,
  disabled = false
}) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const layerStartRef = useRef({ x: 0, y: 0 });

  // Where the controls panel appears — set to wherever the user actually
  // clicked to select this layer, so adjusting a huge (e.g. 5000px) map
  // never means hunting across the screen for a panel anchored to the
  // layer's center, which can be far outside the visible viewport.
  const [clickOffset, setClickOffset] = useState(null);

  // Slider local adjust states for high performance (no lag)
  const [localScale, setLocalScale] = useState(layer.scale ?? 300);
  const [localRotation, setLocalRotation] = useState(layer.rotation ?? 0);
  const [localOpacity, setLocalOpacity] = useState(layer.opacity ?? 100);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const bgScale = localScale;
  const bgRotation = localRotation;
  const bgOpacity = localOpacity / 100;

  // Stable scale specifically for the control handle positioning so it does not jump vertically during slide
  const [stableScale, setStableScale] = useState(layer.scale ?? 300);

  const valuesRef = useRef({ scale: localScale, rotation: localRotation, opacity: localOpacity });

  // Sync ref with local state changes
  useEffect(() => {
    valuesRef.current = { scale: localScale, rotation: localRotation, opacity: localOpacity };
  }, [localScale, localRotation, localOpacity]);

  // Clear the recorded click position on deselect, so a fresh selection
  // (whether by click or some other means) starts from a clean state.
  useEffect(() => {
    if (!isSelected) setClickOffset(null);
  }, [isSelected]);

  // Sync local states when not actively adjusting
  useEffect(() => {
    if (!isAdjusting) {
      setLocalScale(layer.scale ?? 300);
      setLocalRotation(layer.rotation ?? 0);
      setLocalOpacity(layer.opacity ?? 100);
      setStableScale(layer.scale ?? 300);
    }
  }, [layer.scale, layer.rotation, layer.opacity, isAdjusting]);

  const commitChanges = React.useCallback(() => {
    setIsAdjusting(false);
    onUpdate({
      scale: valuesRef.current.scale,
      rotation: valuesRef.current.rotation,
      opacity: valuesRef.current.opacity
    });
  }, [onUpdate]);

  // Handle global/window mouseup and touchend when adjusting to prevent "stuck" sliders
  useEffect(() => {
    if (!isAdjusting) return;

    const handleWindowMouseUp = () => {
      commitChanges();
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchend', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchend', handleWindowMouseUp);
    };
  }, [isAdjusting, commitChanges]);

  const handleStart = (e) => {
    if (!canEdit || disabled) return;
    if (e.target.closest('.control-handle')) return; // Ignore drag triggers on handle buttons/sliders
    
    const isTouch = e.type.startsWith('touch');
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    if (!isTouch) {
      e.preventDefault();
    }
    e.stopPropagation();

    // Record where the click happened, relative to the layer's own local
    // origin (the containerRef div, which sits exactly at layer.x/layer.y).
    // getBoundingClientRect() already accounts for any canvas pan/zoom, so
    // this stays accurate regardless of view state.
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setClickOffset({ x: clientX - rect.left, y: clientY - rect.top });
    }

    onSelect();
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    layerStartRef.current = { x: layer.x ?? 0, y: layer.y ?? 0 };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const isTouch = e.type.startsWith('touch');
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;

      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      onUpdate({
        x: Math.round(layerStartRef.current.x + dx),
        y: Math.round(layerStartRef.current.y + dy)
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, onUpdate]);

  if (!layer.visible) return null;

  // Render Image vs Video
  const renderContent = () => {
    if (layer.type === 'video') {
      if (layer.isYouTube) {
        // Extract Youtube ID
        let videoId = '96989467';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = layer.videoUrl?.match(regExp);
        if (match && match[2].length === 11) {
          videoId = match[2];
        }
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3`}
            className="w-full aspect-video pointer-events-none select-none"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="no-referrer"
          />
        );
      } else {
        return (
          <video
            src={layer.videoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto object-cover pointer-events-none"
          />
        );
      }
    }

    return (
      <img
        src={layer.imageData}
        alt={layer.name}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = getFallbackMapSvg(layer.name);
        }}
        className="w-full h-auto pointer-events-none select-none"
        referrerPolicy="no-referrer"
      />
    );
  };

  // Custom range background gradient percentages
  const scalePercent = Math.min(100, Math.max(0, ((bgScale - 50) / 4950) * 100));
  const rotationPercent = (bgRotation / 360) * 100;
  const opacityPercent = localOpacity;

  // Calculate safe bottom offset using stable scale to completely eliminate vertical jumping
  const handleBottomOffset = (stableScale / 2) + 30;

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${layer.x ?? 0}px, ${layer.y ?? 0}px)`,
        width: '0px',
        height: '0px',
        zIndex: isSelected ? 30 : 10,
      }}
      data-testid={`placed-bg-layer-${layer.id}`}
    >
      {/* Inner Container: Holds the media content, handles scale, rotation, and user dragging */}
      <div
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        className={`absolute select-none origin-center ${
          canEdit ? 'cursor-grab' : ''
        } ${isDragging ? 'cursor-grabbing' : ''}`}
        style={{
          width: `${bgScale}px`,
          height: 'auto',
          transform: `translate(-50%, -50%) rotate(${bgRotation}deg)`,
          touchAction: 'none'
        }}
      >
        {/* Visual outline if selected - removed per user request */}

        {/* Actual Background Media (translucent style applied only here so controls remain 100% opaque) */}
        <div 
          className="w-full h-auto overflow-hidden rounded shadow-lg transition-opacity duration-150"
          style={{ opacity: bgOpacity }}
        >
          {renderContent()}
        </div>
      </div>

      {/* Floating Precision Controls when Selected (positioned cleanly above the center of the image) */}
      {isSelected && canEdit && (
        <div
          className="absolute flex items-center gap-4 bg-black/95 rounded-xl px-4 py-2.5 shadow-2xl border border-white/20 whitespace-nowrap z-50 control-handle"
          style={
            clickOffset
              ? {
                  // Anchored to exactly where the user clicked to select this
                  // layer — bottom-center of the panel sits at that point, so
                  // it always appears right above the cursor regardless of
                  // how large the map is or where its center happens to be.
                  left: `${clickOffset.x}px`,
                  top: `${clickOffset.y}px`,
                  transform: 'translate(-50%, calc(-100% - 16px))',
                }
              : {
                  // Fallback for selections that didn't originate from a
                  // direct click on the layer (e.g. programmatic selection).
                  bottom: `${handleBottomOffset}px`,
                  left: '0px',
                  transform: 'translateX(-50%)',
                }
          }
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Size (Scale) slider */}
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-amber-400" />
            <input
              type="range"
              min="50"
              max="5000"
              step="5"
              value={bgScale}
              onMouseDown={() => setIsAdjusting(true)}
              onTouchStart={() => setIsAdjusting(true)}
              onChange={(e) => {
                setLocalScale(parseInt(e.target.value));
              }}
              className="w-24 h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500 bg-white/20"
              style={{
                background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${scalePercent}%, #374151 ${scalePercent}%, #374151 100%)`
              }}
              title="Resize (Scale)"
            />
            <span className="text-[11px] text-gray-300 font-mono w-14 text-right">{bgScale}px</span>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Rotation slider */}
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-amber-400" />
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={bgRotation}
              onMouseDown={() => setIsAdjusting(true)}
              onTouchStart={() => setIsAdjusting(true)}
              onChange={(e) => {
                setLocalRotation(parseInt(e.target.value));
              }}
              className="w-20 h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500 bg-white/20"
              style={{
                background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${rotationPercent}%, #374151 ${rotationPercent}%, #374151 100%)`
              }}
              title="Rotate"
            />
            <span className="text-[11px] text-gray-300 font-mono w-7 text-right">{bgRotation}°</span>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Opacity slider */}
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={localOpacity}
              onMouseDown={() => setIsAdjusting(true)}
              onTouchStart={() => setIsAdjusting(true)}
              onChange={(e) => {
                setLocalOpacity(parseInt(e.target.value));
              }}
              className="w-20 h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500 bg-white/20"
              style={{
                background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${opacityPercent}%, #374151 ${opacityPercent}%, #374151 100%)`
              }}
              title="Opacity"
            />
            <span className="text-[11px] text-gray-300 font-mono w-8 text-right">{localOpacity}%</span>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
            title="Remove Background Layer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default PlacedBackgroundImage;
