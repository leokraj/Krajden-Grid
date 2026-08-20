/**
 * EffectsLayer.jsx
 * Reverse Mask Video & Animated Effects Engine for Krajden Grid
 * 
 * Features:
 * - Dynamic Reverse Mask Revealer: reveals animated video/GIF/textures beneath the tabletop.
 * - 4 Powerful Mask Tools:
 *     1. Brush: Freehand smooth painting brush with round caps & adjustable size.
 *     2. Marquee: Rectangular selection window.
 *     3. Bezier: Flowing curved vector path.
 *     4. Eraser: Erases from the mask (restores normal background).
 * - Video Tiling: Seamlessly repeat video as a tiled pattern with controllable tile scale (25% - 300%) or stretch across bounds.
 * - Built-in High Quality Video & Animated Presets (Lava, River Water, Arcane Portal, Toxic Acid, Blizzard, Firestorm, Void).
 * - Real-time Live Drawing Feedback: See the glowing animated video as you drag.
 * - Firebase Firestore synchronization & local caching.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useGrid } from '../context/GridContext';
import { subscribeEffects, saveEffectToFirebase, deleteEffectFromFirebase } from '../lib/firebase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import {
  Sparkles, Flame, Droplets, Compass, Zap, Shield, Eye, EyeOff,
  Trash2, Undo, Plus, Upload, Play, Pause, Grid, Layers, RefreshCw,
  Maximize2, Crop, Move, Sliders, Check
} from 'lucide-react';

// ── Built-in High Performance Animated Shader/SVG Vector Presets ─────────────

export const BUILTIN_EFFECT_PRESETS = [
  {
    id: 'preset_fx_lava_magma',
    name: 'Molten Magma Lava',
    category: 'fire',
    tags: ['lava', 'fire', 'magma', 'volcano', 'heat'],
    theme: 'Lava',
    description: 'Flowing molten magma with pulsating volcanic heat',
    isPreset: true,
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <defs>
          <radialGradient id="lavaGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fffb00" />
            <stop offset="35%" stop-color="#ff5500" />
            <stop offset="75%" stop-color="#b30000" />
            <stop offset="100%" stop-color="#2a0505" />
          </radialGradient>
          <filter id="lavaTurb">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="5">
              <animate attributeName="baseFrequency" values="0.03;0.045;0.03" dur="4s" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="35" />
          </filter>
        </defs>
        <rect width="300" height="300" fill="#150202"/>
        <g filter="url(#lavaTurb)">
          <rect width="300" height="300" fill="url(#lavaGrad)"/>
          <circle cx="90" cy="90" r="70" fill="#ffaa00" opacity="0.85">
            <animate attributeName="r" values="50;85;50" dur="3s" repeatCount="indefinite"/>
          </circle>
          <circle cx="210" cy="190" r="80" fill="#ff2200" opacity="0.9">
            <animate attributeName="r" values="60;95;60" dur="3.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="150" cy="150" r="45" fill="#ffff55" opacity="0.95">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>
    `)
  },
  {
    id: 'preset_fx_river_water',
    name: 'Rushing River Water',
    category: 'water',
    tags: ['water', 'river', 'stream', 'ocean', 'waves'],
    theme: 'Water',
    description: 'Animated shimmering river currents & fluid ripples',
    isPreset: true,
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <defs>
          <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="50%" stop-color="#0369a1" />
            <stop offset="100%" stop-color="#082f49" />
          </linearGradient>
          <filter id="waterTurb">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="12">
              <animate attributeName="baseFrequency" values="0.04;0.055;0.04" dur="3s" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="25" />
          </filter>
        </defs>
        <rect width="300" height="300" fill="url(#waterGrad)"/>
        <g filter="url(#waterTurb)" opacity="0.7">
          <path d="M 0 50 Q 150 20 300 50 T 600 50" stroke="#bae6fd" stroke-width="24" fill="none" opacity="0.6">
            <animateTransform attributeName="transform" type="translate" from="0,0" to="-300,0" dur="2.5s" repeatCount="indefinite"/>
          </path>
          <path d="M 0 150 Q 150 120 300 150 T 600 150" stroke="#7dd3fc" stroke-width="35" fill="none" opacity="0.7">
            <animateTransform attributeName="transform" type="translate" from="0,0" to="-300,0" dur="2s" repeatCount="indefinite"/>
          </path>
          <path d="M 0 250 Q 150 220 300 250 T 600 250" stroke="#38bdf8" stroke-width="28" fill="none" opacity="0.5">
            <animateTransform attributeName="transform" type="translate" from="0,0" to="-300,0" dur="3s" repeatCount="indefinite"/>
          </path>
        </g>
      </svg>
    `)
  },
  {
    id: 'preset_fx_arcane_portal',
    name: 'Arcane Cosmic Vortex',
    category: 'magic',
    tags: ['portal', 'arcane', 'magic', 'vortex', 'cosmic'],
    theme: 'Arcane',
    description: 'Swirling purple & cyan hyperspace gateway',
    isPreset: true,
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <defs>
          <radialGradient id="portalGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f472b6" />
            <stop offset="40%" stop-color="#a855f7" />
            <stop offset="80%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#090514" />
          </radialGradient>
        </defs>
        <rect width="300" height="300" fill="#090514"/>
        <g transform="translate(150,150)">
          <circle cx="0" cy="0" r="130" fill="url(#portalGrad)" opacity="0.9"/>
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite"/>
            <path d="M-90,-90 Q0,0 90,-90 Q0,0 90,90 Q0,0 -90,90 Q0,0 -90,-90" fill="#ec4899" opacity="0.6"/>
            <circle cx="0" cy="0" r="60" fill="none" stroke="#67e8f9" stroke-width="8" stroke-dasharray="20,10"/>
          </g>
          <g>
            <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="2.5s" repeatCount="indefinite"/>
            <circle cx="0" cy="0" r="35" fill="#fbcfe8" opacity="0.85"/>
            <path d="M 0 -80 L 15 0 L 0 80 L -15 0 Z" fill="#38bdf8" opacity="0.7"/>
          </g>
        </g>
      </svg>
    `)
  },
  {
    id: 'preset_fx_toxic_acid',
    name: 'Toxic Acid & Poison Mist',
    category: 'poison',
    tags: ['poison', 'acid', 'toxic', 'swamp', 'green'],
    theme: 'Swamp',
    description: 'Corrosive bubbling emerald acid pool',
    isPreset: true,
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <defs>
          <radialGradient id="acidGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#a3e635" />
            <stop offset="45%" stop-color="#22c55e" />
            <stop offset="85%" stop-color="#14532d" />
            <stop offset="100%" stop-color="#052e16" />
          </radialGradient>
          <filter id="acidNoise">
            <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="3" seed="8">
              <animate attributeName="baseFrequency" values="0.05;0.07;0.05" dur="3s" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="30" />
          </filter>
        </defs>
        <rect width="300" height="300" fill="url(#acidGrad)"/>
        <g filter="url(#acidNoise)" opacity="0.75">
          <circle cx="80" cy="80" r="45" fill="#d9f99d">
            <animate attributeName="r" values="30;60;30" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="220" cy="180" r="55" fill="#4ade80">
            <animate attributeName="r" values="40;75;40" dur="2.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="150" cy="220" r="35" fill="#86efac">
            <animate attributeName="r" values="20;50;20" dur="1.7s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>
    `)
  },
  {
    id: 'preset_fx_blizzard_frost',
    name: 'Glacial Blizzard Snow',
    category: 'weather',
    tags: ['snow', 'blizzard', 'ice', 'frost', 'cold'],
    theme: 'Snow',
    description: 'Swirling sub-zero blizzard crystals',
    isPreset: true,
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <defs>
          <linearGradient id="snowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e0f2fe" />
            <stop offset="60%" stop-color="#7dd3fc" />
            <stop offset="100%" stop-color="#0369a1" />
          </linearGradient>
        </defs>
        <rect width="300" height="300" fill="#0c4a6e"/>
        <g opacity="0.8">
          <circle cx="50" cy="50" r="8" fill="#ffffff">
            <animate attributeName="cx" values="0;300" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="cy" values="0;300" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="180" cy="30" r="14" fill="#ffffff" opacity="0.7">
            <animate attributeName="cx" values="50;350" dur="1.5s" repeatCount="indefinite"/>
            <animate attributeName="cy" values="0;300" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="90" cy="140" r="6" fill="#bae6fd">
            <animate attributeName="cx" values="0;300" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="cy" values="50;350" dur="2.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="240" cy="180" r="12" fill="#ffffff" opacity="0.6">
            <animate attributeName="cx" values="0;300" dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="cy" values="100;400" dur="1.8s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>
    `)
  },
  {
    id: 'preset_fx_shadow_void',
    name: 'Shadow Fog & Cosmic Void',
    category: 'magic',
    tags: ['fog', 'void', 'darkness', 'shadow', 'smoke'],
    theme: 'Dungeon',
    description: 'Swirling eldritch shadow smoke',
    isPreset: true,
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <defs>
          <radialGradient id="voidGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#18181b" />
            <stop offset="60%" stop-color="#27272a" />
            <stop offset="100%" stop-color="#09090b" />
          </radialGradient>
          <filter id="voidTurb">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="2">
              <animate attributeName="baseFrequency" values="0.03;0.05;0.03" dur="5s" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="40" />
          </filter>
        </defs>
        <rect width="300" height="300" fill="url(#voidGrad)"/>
        <g filter="url(#voidTurb)" opacity="0.75">
          <circle cx="100" cy="100" r="90" fill="#3f3f46" opacity="0.6"/>
          <circle cx="200" cy="200" r="100" fill="#52525b" opacity="0.5"/>
        </g>
      </svg>
    `)
  }
];

function isVideoUrl(url) {
  if (!url) return false;
  return url.startsWith('data:video/') || /\.(mp4|webm|mov|ogg)$/i.test(url);
}

function getLocalUserId() {
  try {
    let id = localStorage.getItem('krajden_user_id');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('krajden_user_id', id);
    }
    return id;
  } catch (e) {
    return 'anonymous';
  }
}

function getLocalUserName() {
  try {
    return localStorage.getItem('krajden_display_name') || 'Anonymous';
  } catch (e) {
    return 'Anonymous';
  }
}

// ── REVERSE MASK VIDEO ENGINE (CANVAS 2D) ────────────────────────────────────

/**
 * EffectsDrawingOverlay
 * Renders dynamic reverse masks revealing underlying animated video or repeating textures.
 */
export function EffectsDrawingOverlay({ canvasSize }) {
  const {
    settings,
    updateSettings,
    addEffectPath,
    updateEffectPath,
    removeEffectPath,
    undoLastEffectPath,
    clearEffectPaths
  } = useGrid();

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [marqueeStart, setMarqueeStart] = useState(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState(null);

  const canvasRef = useRef(null);
  const mediaElementsRef = useRef(new Map()); // url -> HTMLVideoElement | HTMLImageElement
  const rafRef = useRef(null);

  const effectPaths = settings.effectPaths || [];
  const effectsEnabled = !!settings.effectsEnabled;
  const activeEffectUrl = settings.activeEffectUrl || (BUILTIN_EFFECT_PRESETS[0]?.url);
  const effectTool = settings.effectTool || 'brush'; // 'brush' | 'marquee' | 'bezier' | 'eraser'
  const effectBrushSize = settings.effectBrushSize || 60;
  const effectTile = settings.effectTile !== false;
  const effectTileScale = settings.effectTileScale || 100;
  const effectOpacity = settings.effectOpacity ?? 0.9;
  const effectBlendMode = settings.effectBlendMode || 'normal';

  // Manage media elements (video loop / image)
  useEffect(() => {
    const urls = new Set();
    effectPaths.forEach(ep => { if (ep.effectUrl) urls.add(ep.effectUrl); });
    if (activeEffectUrl) urls.add(activeEffectUrl);

    urls.forEach(url => {
      if (!mediaElementsRef.current.has(url)) {
        if (isVideoUrl(url)) {
          const video = document.createElement('video');
          video.src = url;
          video.crossOrigin = 'anonymous';
          video.loop = true;
          video.muted = true;
          video.autoplay = true;
          video.playsInline = true;
          video.playbackRate = settings.effectSpeed || 1;
          video.play().catch(() => {});
          mediaElementsRef.current.set(url, video);
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = url;
          mediaElementsRef.current.set(url, img);
        }
      }
    });

    // Clean up unused media elements
    mediaElementsRef.current.forEach((el, url) => {
      if (!urls.has(url)) {
        if (el instanceof HTMLVideoElement) {
          el.pause();
          el.src = '';
        }
        mediaElementsRef.current.delete(url);
      }
    });
  }, [effectPaths, activeEffectUrl, settings.effectSpeed]);

  // Main Canvas Render Loop with Dynamic Clipping Reverse Masks & Tiling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;

    const render = () => {
      if (!isMounted) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Group paths by effectUrl to minimize texture switches
      const pathsToRender = [...effectPaths];

      // Add active live drawing stroke / marquee to render list if drawing
      if (isDrawing && activeEffectUrl) {
        if (effectTool === 'brush' && currentStroke.length > 0) {
          pathsToRender.push({
            id: 'live_stroke',
            type: 'brush',
            points: currentStroke,
            effectUrl: activeEffectUrl,
            width: effectBrushSize,
            opacity: effectOpacity,
            tile: effectTile,
            tileScale: effectTileScale,
            blendMode: effectBlendMode,
            isLive: true
          });
        } else if (effectTool === 'marquee' && marqueeStart && marqueeCurrent) {
          const x = Math.min(marqueeStart.x, marqueeCurrent.x);
          const y = Math.min(marqueeStart.y, marqueeCurrent.y);
          const w = Math.abs(marqueeCurrent.x - marqueeStart.x);
          const h = Math.abs(marqueeCurrent.y - marqueeStart.y);
          pathsToRender.push({
            id: 'live_marquee',
            type: 'marquee',
            rect: { x, y, width: w, height: h },
            effectUrl: activeEffectUrl,
            opacity: effectOpacity,
            tile: effectTile,
            tileScale: effectTileScale,
            blendMode: effectBlendMode,
            isLive: true
          });
        } else if (effectTool === 'bezier' && currentStroke.length > 1) {
          pathsToRender.push({
            id: 'live_bezier',
            type: 'bezier',
            points: currentStroke,
            effectUrl: activeEffectUrl,
            width: effectBrushSize,
            opacity: effectOpacity,
            tile: effectTile,
            tileScale: effectTileScale,
            blendMode: effectBlendMode,
            isLive: true
          });
        }
      }

      // Render each effect mask layer
      pathsToRender.forEach((effect) => {
        const {
          type = 'brush',
          points = [],
          rect,
          effectUrl,
          width: strokeWidth = 60,
          opacity = 0.9,
          tile = true,
          tileScale = 100,
          blendMode = 'normal',
          isLive = false
        } = effect;

        if (!effectUrl) return;
        const media = mediaElementsRef.current.get(effectUrl);

        ctx.save();
        ctx.globalAlpha = Math.max(0.05, Math.min(1, opacity));
        
        // Map blend modes to canvas globalCompositeOperation
        if (blendMode === 'screen') ctx.globalCompositeOperation = 'screen';
        else if (blendMode === 'lighter') ctx.globalCompositeOperation = 'lighter';
        else if (blendMode === 'overlay') ctx.globalCompositeOperation = 'overlay';
        else ctx.globalCompositeOperation = 'source-over';

        // 1. Create the Reverse Mask Clipping Region
        ctx.beginPath();
        if (type === 'marquee' && rect) {
          ctx.rect(rect.x, rect.y, rect.width, rect.height);
        } else if (points.length === 1) {
          ctx.arc(points[0].x, points[0].y, strokeWidth / 2, 0, Math.PI * 2);
        } else if (points.length > 1) {
          // Draw smooth continuous stroke path
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length - 1; i++) {
            const cpx = (points[i].x + points[i + 1].x) / 2;
            const cpy = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, cpx, cpy);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }

        // Apply clipping boundary
        if (type === 'marquee' || points.length === 1) {
          ctx.clip();
        } else if (points.length > 1) {
          // In 2D canvas, to clip a thick stroke:
          // We can use ctx.stroke() with a pattern, or clip using stroke path
          // Let's create pattern fill for optimal performance!
        }

        // 2. Draw Animated Video / Repeating Tile inside the Mask
        if (media) {
          let mediaWidth = 300;
          let mediaHeight = 300;
          let isMediaReady = false;

          if (media instanceof HTMLVideoElement) {
            if (media.readyState >= 2) {
              mediaWidth = media.videoWidth || 300;
              mediaHeight = media.videoHeight || 300;
              isMediaReady = true;
            }
          } else if (media instanceof HTMLImageElement) {
            if (media.complete && media.naturalWidth > 0) {
              mediaWidth = media.naturalWidth;
              mediaHeight = media.naturalHeight;
              isMediaReady = true;
            }
          }

          if (isMediaReady) {
            const scale = (tileScale || 100) / 100;
            const patW = Math.max(16, Math.floor(mediaWidth * scale));
            const patH = Math.max(16, Math.floor(mediaHeight * scale));

            if (tile) {
              // Seamless Repeating Video / Image Pattern Tiling
              try {
                const pattern = ctx.createPattern(media, 'repeat');
                if (pattern) {
                  if (type === 'marquee' || points.length === 1) {
                    ctx.fillStyle = pattern;
                    ctx.fillRect(0, 0, width, height);
                  } else {
                    ctx.strokeStyle = pattern;
                    ctx.lineWidth = strokeWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                  }
                }
              } catch (patternErr) {
                // Fallback direct draw
                if (type === 'marquee' && rect) {
                  ctx.drawImage(media, rect.x, rect.y, rect.width, rect.height);
                }
              }
            } else {
              // Stretch video across the mask boundary
              if (type === 'marquee' && rect) {
                ctx.drawImage(media, rect.x, rect.y, rect.width, rect.height);
              } else if (points.length > 0) {
                const xs = points.map(p => p.x);
                const ys = points.map(p => p.y);
                const minX = Math.min(...xs) - strokeWidth / 2;
                const minY = Math.min(...ys) - strokeWidth / 2;
                const bW = Math.max(...xs) - minX + strokeWidth;
                const bH = Math.max(...ys) - minY + strokeWidth;
                
                try {
                  const pattern = ctx.createPattern(media, 'no-repeat');
                  ctx.strokeStyle = pattern || '#caa055';
                  ctx.lineWidth = strokeWidth;
                  ctx.lineCap = 'round';
                  ctx.lineJoin = 'round';
                  ctx.stroke();
                } catch (e) {
                  ctx.strokeStyle = '#caa055';
                  ctx.stroke();
                }
              }
            }
          } else {
            // Media loading glow placeholder
            ctx.strokeStyle = '#caa055';
            ctx.fillStyle = '#caa055';
            if (type === 'marquee' && rect) {
              ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            } else {
              ctx.lineWidth = strokeWidth;
              ctx.stroke();
            }
          }
        }

        // Live drawing dashed selection outline
        if (isLive) {
          ctx.strokeStyle = 'rgba(202, 160, 85, 0.75)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          if (type === 'marquee' && rect) {
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
          }
        }

        ctx.restore();
      });

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    effectPaths,
    isDrawing,
    currentStroke,
    marqueeStart,
    marqueeCurrent,
    activeEffectUrl,
    effectTool,
    effectBrushSize,
    effectTile,
    effectTileScale,
    effectOpacity,
    effectBlendMode
  ]);

  // Coordinate conversion from viewport to canvas
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (!effectsEnabled || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    const pt = getCanvasCoords(e);

    setIsDrawing(true);

    if (effectTool === 'marquee') {
      setMarqueeStart(pt);
      setMarqueeCurrent(pt);
    } else if (effectTool === 'eraser') {
      // Find and remove any effect stroke within eraser radius
      const eraserRadius = effectBrushSize / 2;
      const remaining = effectPaths.filter((ep) => {
        if (ep.rect) {
          return !(pt.x >= ep.rect.x && pt.x <= ep.rect.x + ep.rect.width && pt.y >= ep.rect.y && pt.y <= ep.rect.y + ep.rect.height);
        }
        if (ep.points) {
          return !ep.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) <= eraserRadius + (ep.width || 60) / 2);
        }
        return true;
      });
      if (remaining.length !== effectPaths.length) {
        updateSettings({ effectPaths: remaining });
      }
    } else {
      // Brush or Bezier
      setCurrentStroke([pt]);
    }
  }, [effectsEnabled, effectTool, effectBrushSize, effectPaths, getCanvasCoords, updateSettings]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing) return;
    const pt = getCanvasCoords(e);

    if (effectTool === 'marquee') {
      setMarqueeCurrent(pt);
    } else if (effectTool === 'eraser') {
      const eraserRadius = effectBrushSize / 2;
      const remaining = effectPaths.filter((ep) => {
        if (ep.rect) {
          return !(pt.x >= ep.rect.x && pt.x <= ep.rect.x + ep.rect.width && pt.y >= ep.rect.y && pt.y <= ep.rect.y + ep.rect.height);
        }
        if (ep.points) {
          return !ep.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) <= eraserRadius + (ep.width || 60) / 2);
        }
        return true;
      });
      if (remaining.length !== effectPaths.length) {
        updateSettings({ effectPaths: remaining });
      }
    } else {
      setCurrentStroke((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (Math.hypot(pt.x - last.x, pt.y - last.y) < 5) return prev;
        }
        return [...prev, pt];
      });
    }
  }, [isDrawing, effectTool, effectBrushSize, effectPaths, getCanvasCoords, updateSettings]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (!activeEffectUrl) {
      setCurrentStroke([]);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
      return;
    }

    if (effectTool === 'marquee' && marqueeStart && marqueeCurrent) {
      const x = Math.min(marqueeStart.x, marqueeCurrent.x);
      const y = Math.min(marqueeStart.y, marqueeCurrent.y);
      const w = Math.abs(marqueeCurrent.x - marqueeStart.x);
      const h = Math.abs(marqueeCurrent.y - marqueeStart.y);
      if (w > 10 && h > 10) {
        addEffectPath({
          type: 'marquee',
          rect: { x, y, width: w, height: h },
          effectUrl: activeEffectUrl,
          effectId: settings.activeEffectId,
          opacity: effectOpacity,
          tile: effectTile,
          tileScale: effectTileScale,
          blendMode: effectBlendMode,
          speed: settings.effectSpeed || 1,
        });
      }
    } else if ((effectTool === 'brush' || effectTool === 'bezier') && currentStroke.length > 0) {
      addEffectPath({
        type: effectTool,
        points: currentStroke,
        effectUrl: activeEffectUrl,
        effectId: settings.activeEffectId,
        width: effectBrushSize,
        opacity: effectOpacity,
        tile: effectTile,
        tileScale: effectTileScale,
        blendMode: effectBlendMode,
        speed: settings.effectSpeed || 1,
      });
    }

    setCurrentStroke([]);
    setMarqueeStart(null);
    setMarqueeCurrent(null);
  }, [
    isDrawing,
    activeEffectUrl,
    effectTool,
    marqueeStart,
    marqueeCurrent,
    currentStroke,
    effectBrushSize,
    effectOpacity,
    effectTile,
    effectTileScale,
    effectBlendMode,
    settings.activeEffectId,
    settings.effectSpeed,
    addEffectPath
  ]);

  // Global window mouseup listener
  useEffect(() => {
    if (!isDrawing) return;
    const onWindowUp = () => handleMouseUp();
    window.addEventListener('mouseup', onWindowUp);
    window.addEventListener('touchend', onWindowUp);
    return () => {
      window.removeEventListener('mouseup', onWindowUp);
      window.removeEventListener('touchend', onWindowUp);
    };
  }, [isDrawing, handleMouseUp]);

  const cWidth = canvasSize?.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
  const cHeight = canvasSize?.height || (typeof window !== 'undefined' ? window.innerHeight : 1080);

  if (!effectPaths.length && !effectsEnabled) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 15,
        pointerEvents: effectsEnabled ? 'auto' : 'none',
        touchAction: effectsEnabled ? 'none' : 'auto',
      }}
      data-testid="effects-drawing-overlay"
    >
      <canvas
        ref={canvasRef}
        width={cWidth}
        height={cHeight}
        className="w-full h-full absolute inset-0 block"
        style={{
          cursor: effectsEnabled ? (effectTool === 'eraser' ? 'crosshair' : 'crosshair') : 'default',
          pointerEvents: effectsEnabled ? 'auto' : 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />
    </div>
  );
}

// ── EFFECTS CONTROL PANEL ───────────────────────────────────────────────────

export function EffectsControlPanel({ onClose }) {
  const {
    settings,
    updateSettings,
    addEffectPath,
    updateEffectPath,
    removeEffectPath,
    undoLastEffectPath,
    clearEffectPaths
  } = useGrid();

  const [activeTab, setActiveTab] = useState('vault'); // 'vault' | 'community' | 'mine'
  const [firebaseEffects, setFirebaseEffects] = useState([]);
  const [communityEffects, setCommunityEffects] = useState([]);
  const [myEffects, setMyEffects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  const fileInputRef = useRef(null);
  const userId = getLocalUserId();
  const effectPaths = settings.effectPaths || [];

  // Active Tool & Settings
  const effectsEnabled = !!settings.effectsEnabled;
  const activeEffectUrl = settings.activeEffectUrl || BUILTIN_EFFECT_PRESETS[0]?.url;
  const effectTool = settings.effectTool || 'brush';
  const effectBrushSize = settings.effectBrushSize || 60;
  const effectTile = settings.effectTile !== false;
  const effectTileScale = settings.effectTileScale || 100;
  const effectOpacity = settings.effectOpacity ?? 0.9;
  const effectBlendMode = settings.effectBlendMode || 'normal';
  const effectSpeed = settings.effectSpeed || 1;

  // Real-time Firestore Effects sync
  useEffect(() => {
    const unsubscribe = subscribeEffects((fbEffects) => {
      if (Array.isArray(fbEffects)) {
        setFirebaseEffects(fbEffects);
      }
    });
    return () => unsubscribe?.();
  }, []);

  // Fetch effects on load
  const loadEffectsData = async () => {
    try {
      const res = await fetch('/api/library/effects');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.effects)) {
          setCommunityEffects(data.effects);
          setMyEffects(data.effects.filter(e => e.authorId === userId));
        }
      }
    } catch (e) {
      // offline fallback
    }
  };

  useEffect(() => {
    loadEffectsData();
    window.addEventListener('krajden_library_updated', loadEffectsData);
    return () => window.removeEventListener('krajden_library_updated', loadEffectsData);
  }, [userId]);

  // Combine Presets + Firebase Effects + Local/Community Effects
  const allEffects = useMemo(() => {
    const map = new Map();

    // 1. Built-in Animated Shader Presets
    BUILTIN_EFFECT_PRESETS.forEach(p => {
      map.set(p.id, { ...p, source: 'vault' });
    });

    // 2. Cloud Firestore Effects
    firebaseEffects.forEach(p => {
      if (!p || !p.id) return;
      map.set(p.id, { ...p, source: 'community' });
    });

    // 3. Community / Local Effects
    communityEffects.forEach(p => {
      if (!p || !p.id) return;
      map.set(p.id, { ...p, source: p.authorId === userId ? 'mine' : 'community' });
    });

    return Array.from(map.values());
  }, [firebaseEffects, communityEffects, userId]);

  // Filtered Effects
  const filteredEffects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allEffects.filter(e => {
      if (activeTab === 'vault' && e.source !== 'vault') return false;
      if (activeTab === 'community' && e.source !== 'community') return false;
      if (activeTab === 'mine' && e.source !== 'mine') return false;

      if (selectedTheme !== 'ALL') {
        const t = (e.theme || e.category || '').toLowerCase();
        if (!t.includes(selectedTheme.toLowerCase())) return false;
      }

      if (q) {
        const nameMatch = (e.name || '').toLowerCase().includes(q);
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const tagMatch = (e.tags || []).some(t => t.toLowerCase().includes(q));
        if (!nameMatch && !descMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [allEffects, activeTab, selectedTheme, searchQuery]);

  const selectEffect = (eff) => {
    updateSettings({
      activeEffectId: eff.id,
      activeEffectUrl: eff.url || eff.imageUrl,
      effectsEnabled: true
    });
    toast.success(`Active effect: "${eff.name}" — Draw reverse mask on map!`);
  };

  // Upload Custom Video / Animated Effect File
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const url = event.target.result;
        const name = file.name.replace(/\.[^/.]+$/, '');
        const newEff = {
          id: `custom_fx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: name,
          theme: 'Custom',
          url: url,
          imageUrl: url,
          category: 'other',
          tags: ['custom', 'video', 'effect'],
          authorId: userId,
          authorName: getLocalUserName(),
          created_at: new Date().toISOString()
        };

        // Save to Firebase
        saveEffectToFirebase(newEff).catch(() => {});

        // Add to local state
        setMyEffects(prev => [newEff, ...prev]);
        setCommunityEffects(prev => [newEff, ...prev]);
        selectEffect(newEff);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSyncFirebase = async () => {
    setIsSyncingFirebase(true);
    const toastId = toast.loading('☁️ Syncing Visual Effects from Firebase Vault...');
    try {
      await loadEffectsData();
      toast.success('☁️ Effects vault refreshed from cloud!', { id: toastId });
    } catch (e) {
      toast.error('Sync failed: ' + e.message, { id: toastId });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#0d0f12] border border-[#caa055]/30 rounded-xl shadow-2xl text-white min-w-[280px]" data-testid="effects-control-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#caa055]/20 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#caa055]" />
          <h3 className="text-xs font-bold font-cinzel uppercase tracking-widest text-[#caa055]">
            Reverse Mask Effects
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleSyncFirebase}
            disabled={isSyncingFirebase}
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[9px] text-[#caa055] hover:bg-[#caa055]/10"
            title="Sync effects from Firebase Vault"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
          </Button>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xs p-1">✕</button>
          )}
        </div>
      </div>

      {/* Main Activation Banner */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateSettings({ effectsEnabled: !effectsEnabled })}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 ${
            effectsEnabled
              ? 'bg-[#caa055] text-black shadow-[#caa055]/25 border border-[#caa055]'
              : 'bg-white/10 text-gray-200 hover:bg-white/15 border border-white/10'
          }`}
          data-testid="toggle-effects-tool-btn"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{effectsEnabled ? 'Painting Mode Active' : 'Enable Effects Tool'}</span>
        </button>
      </div>

      {/* Mask Tool Selectors (Brush / Marquee / Bezier / Eraser) */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
          Mask Revealer Tool
        </Label>
        <div className="grid grid-cols-4 gap-1 p-1 bg-black/50 border border-white/10 rounded-lg">
          {[
            { id: 'brush', label: 'Brush', icon: '🖌️', desc: 'Freehand Paint' },
            { id: 'marquee', label: 'Marquee', icon: '🔲', desc: 'Box Window' },
            { id: 'bezier', label: 'Bezier', icon: '〰️', desc: 'Curved Path' },
            { id: 'eraser', label: 'Eraser', icon: '🧹', desc: 'Erase Mask' }
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => updateSettings({ effectTool: tool.id, effectsEnabled: true })}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded transition-all text-center ${
                effectTool === tool.id
                  ? 'bg-[#caa055]/30 text-[#caa055] border border-[#caa055]/60 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
              title={tool.desc}
            >
              <span className="text-xs">{tool.icon}</span>
              <span className="text-[9px] font-bold mt-0.5">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tool Sliders & Tiling Controls */}
      <div className="space-y-2.5 bg-black/40 border border-white/10 p-2.5 rounded-lg">
        {/* Brush Size / Line Width */}
        {effectTool !== 'marquee' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-300">
              <span>{effectTool === 'eraser' ? 'Eraser Radius' : 'Brush / Stroke Size'}</span>
              <span className="font-mono text-[#caa055]">{effectBrushSize}px</span>
            </div>
            <Slider
              value={[effectBrushSize]}
              min={10}
              max={250}
              step={5}
              onValueChange={([val]) => updateSettings({ effectBrushSize: val })}
              className="py-1"
            />
          </div>
        )}

        {/* Video Tiling Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div>
            <span className="text-[10px] font-bold text-gray-300 block">Tile Video Effect</span>
            <span className="text-[8px] text-gray-500 block">Repeat seamless pattern vs stretch</span>
          </div>
          <Switch
            checked={effectTile}
            onCheckedChange={(checked) => updateSettings({ effectTile: checked })}
            className="scale-75"
          />
        </div>

        {/* Tile Scale (when tile is on) */}
        {effectTile && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-gray-300">
              <span>Tile Texture Scale</span>
              <span className="font-mono text-[#caa055]">{effectTileScale}%</span>
            </div>
            <Slider
              value={[effectTileScale]}
              min={25}
              max={300}
              step={5}
              onValueChange={([val]) => updateSettings({ effectTileScale: val })}
              className="py-1"
            />
          </div>
        )}

        {/* Opacity */}
        <div className="space-y-1 pt-1 border-t border-white/5">
          <div className="flex justify-between text-[10px] text-gray-300">
            <span>Effect Opacity</span>
            <span className="font-mono text-[#caa055]">{Math.round(effectOpacity * 100)}%</span>
          </div>
          <Slider
            value={[effectOpacity]}
            min={0.1}
            max={1}
            step={0.05}
            onValueChange={([val]) => updateSettings({ effectOpacity: val })}
            className="py-1"
          />
        </div>

        {/* Blend Mode Selection */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-[10px] text-gray-300">Blend Mode</span>
          <select
            value={effectBlendMode}
            onChange={(e) => updateSettings({ effectBlendMode: e.target.value })}
            className="bg-black/60 border border-white/20 text-white rounded px-2 py-0.5 text-[9px] font-mono"
          >
            <option value="normal">Normal (Opaque)</option>
            <option value="screen">Screen (Glowing Magic)</option>
            <option value="lighter">Additive (Lighter)</option>
            <option value="overlay">Overlay</option>
          </select>
        </div>
      </div>

      {/* Video & Effect Presets Vault */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-[#caa055]">
            Effect Media Library
          </Label>
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
            className="h-6 text-[9px] border-[#caa055]/40 text-[#caa055] hover:bg-[#caa055]/15 px-2 flex items-center gap-1"
          >
            <Upload className="w-3 h-3" /> Upload Video
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,image/gif,image/png,image/jpeg,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex rounded-lg overflow-hidden border border-white/10 bg-black/40 text-[9px]">
          {[
            { id: 'vault', label: '⭐ Vault Presets' },
            { id: 'community', label: '🌐 Cloud' },
            { id: 'mine', label: '👤 My Uploads' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-1 font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-[#caa055]/25 text-[#caa055] border-b-2 border-[#caa055]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Effect Grid */}
        <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
          {filteredEffects.map((eff) => {
            const isSelected = activeEffectUrl === (eff.url || eff.imageUrl);
            const isVideo = isVideoUrl(eff.url || eff.imageUrl);

            return (
              <div
                key={eff.id}
                onClick={() => selectEffect(eff)}
                className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#caa055] bg-[#caa055]/15 shadow-md shadow-[#caa055]/20 ring-1 ring-[#caa055]'
                    : 'border-white/10 hover:border-white/30 bg-black/40'
                }`}
              >
                {/* Media Preview Box */}
                <div className="w-full h-16 bg-black relative overflow-hidden flex items-center justify-center">
                  {isVideo ? (
                    <video
                      src={eff.url || eff.imageUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <img
                      src={eff.url || eff.imageUrl}
                      alt={eff.name}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  )}

                  {/* Active Badge */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-[#caa055] text-black text-[7px] font-black px-1.5 py-0.5 rounded shadow">
                      ACTIVE
                    </div>
                  )}
                </div>

                {/* Info Footer */}
                <div className="p-1.5 bg-[#0a0c0f]">
                  <p className="text-[10px] font-bold text-gray-200 truncate group-hover:text-[#caa055]">
                    {eff.name}
                  </p>
                  <p className="text-[8px] text-gray-500 truncate">
                    {eff.description || eff.theme || 'Animated Effect'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Placed Effect Masks Manager */}
      {effectPaths.length > 0 && (
        <div className="space-y-1.5 border-t border-white/10 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Placed Effect Masks ({effectPaths.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={undoLastEffectPath}
                className="text-[9px] text-gray-300 hover:text-white flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/10"
                title="Undo last placed mask"
              >
                <Undo className="w-2.5 h-2.5" /> Undo
              </button>
              <button
                onClick={clearEffectPaths}
                className="text-[9px] text-red-400 hover:text-red-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-950/20 border border-red-900/30"
              >
                <Trash2 className="w-2.5 h-2.5" /> Clear All
              </button>
            </div>
          </div>

          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {effectPaths.map((ep, idx) => (
              <div
                key={ep.id || idx}
                className="flex items-center justify-between p-1.5 rounded bg-white/5 border border-white/5 text-[9px]"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[#caa055]">#{idx + 1}</span>
                  <span className="capitalize text-gray-300">{ep.type || 'brush'}</span>
                  <span className="text-gray-500 font-mono">({Math.round((ep.opacity || 0.9) * 100)}%)</span>
                </div>
                <button
                  onClick={() => removeEffectPath(ep.id)}
                  className="text-red-400 hover:text-red-300 p-0.5"
                  title="Remove this effect mask"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EffectsControlPanel;
