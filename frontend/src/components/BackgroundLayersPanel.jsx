import React, { useRef, useState, useEffect } from 'react';
import { useGrid } from '../context/GridContext';
import { useSession } from '../context/SessionContext';
import { DEFAULT_VAULT_BATTLEMAPS } from '../data/vaultPresets';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import {
  Layers, Trash2, Eye, EyeOff, Lock, Unlock,
  Plus, Upload, Video, Play, Pause, ChevronUp, ChevronDown, ExternalLink
} from 'lucide-react';

export const getFallbackMapSvg = (name = 'Battle Map') => {
  const label = (name || 'Battle Map').trim();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#1e1b18"/>
    <path d="M 0 0 L 400 300 M 400 0 L 0 300" stroke="#38312b" stroke-width="2"/>
    <rect x="20" y="20" width="360" height="260" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.4"/>
    <text x="200" y="150" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#f59e0b" text-anchor="middle" letter-spacing="1">${label}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const VTT_MAPS = DEFAULT_VAULT_BATTLEMAPS;

export function BackgroundLayersPanel({ onUndock }) {
  const {
    settings,
    addBackgroundLayer,
    updateBackgroundLayer,
    removeBackgroundLayer,
    reorderBackgroundLayers,
    clearAllBackgroundLayers,
    toggleBgLayersLocked,
    selectedBgLayerId,
    setSelectedBgLayerId
  } = useGrid();

  const sessionContext = useSession();
  const isHost = sessionContext?.isHost ?? true;
  const isBlocked = sessionContext?.isBlocked ?? false;

  const fileInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [showMapLibrary, setShowMapLibrary] = useState(false);

  const [globalBattleMaps, setGlobalBattleMaps] = useState([]);
  const [deletedVaultIds, setDeletedVaultIds] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('krajden_deleted_vault_ids') || '[]');
      return Array.isArray(raw) ? raw.filter(x => typeof x === 'string' && (x.length > 20 || x.startsWith('admin_') || x.startsWith('vault_') || x.startsWith('data:') || x.startsWith('http'))) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const fetchGlobalMaps = async () => {
      try {
        const storedDeleted = JSON.parse(localStorage.getItem('krajden_deleted_vault_ids') || '[]');
        if (Array.isArray(storedDeleted)) {
          const cleanDeleted = storedDeleted.filter(x => typeof x === 'string' && (x.length > 20 || x.startsWith('admin_') || x.startsWith('vault_') || x.startsWith('data:') || x.startsWith('http')));
          setDeletedVaultIds(cleanDeleted);
        }
        const res = await fetch('/api/library/battlemaps');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.battlemaps)) {
            setGlobalBattleMaps(data.battlemaps);
          }
        }
      } catch (e) {
        // silent catch
      }
    };
    fetchGlobalMaps();

    const handleUpdate = () => fetchGlobalMaps();
    window.addEventListener('krajden_library_updated', handleUpdate);
    return () => window.removeEventListener('krajden_library_updated', handleUpdate);
  }, [showMapLibrary]);

  // Combine global admin battle maps with default preset maps, avoiding duplicate IDs and deleted vault items
  const mapIds = new Set();
  const allVttMaps = [];
  [...globalBattleMaps, ...VTT_MAPS].forEach(m => {
    if (!m) return;
    const mId = String(m.id || '').trim();
    const mUrl = String(m.url || m.imageUrl || '').trim();

    const isDeleted = deletedVaultIds.some(d => {
      const sD = String(d || '').trim();
      if (!sD) return false;
      if (mId && sD === mId) return true;
      if (mUrl && sD === mUrl) return true;
      return false;
    });

    if (!isDeleted && m.id && !mapIds.has(m.id)) {
      mapIds.add(m.id);
      allVttMaps.push(m);
    }
  });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        addBackgroundLayer(event.target.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        addBackgroundLayer(null, file.name, {
          type: 'video',
          videoUrl: event.target.result,
          isYouTube: false
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddVideo = () => {
    if (!videoUrlInput.trim()) return;
    const isYouTube = videoUrlInput.includes('youtube.com') || videoUrlInput.includes('youtu.be');
    addBackgroundLayer(null, 'Video Layer', {
      type: 'video',
      videoUrl: videoUrlInput.trim(),
      isYouTube
    });
    setVideoUrlInput('');
    setShowVideoInput(false);
  };

  const layers = settings.backgroundLayers || [];
  const locked = settings.bgLayersLocked || false;

  return (
    <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl" data-testid="layers-panel">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase text-gray-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-amber-400" /> Map Background Layers
        </Label>
        <div className="flex items-center gap-1.5">
          {onUndock && (
            <button
              onClick={onUndock}
              className="flex items-center justify-center p-1 px-2 rounded-lg bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:bg-white/10 transition-colors"
              title="Undock / Detach Panel"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              <span className="text-[10px] font-semibold tracking-wide">DETACH</span>
            </button>
          )}
          <button
            onClick={toggleBgLayersLocked}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide transition-colors ${
              locked ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-gray-400 border border-white/5'
            }`}
            data-testid="toggle-lock-layers-btn"
          >
            {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {locked ? 'LOCKED' : 'LOCK'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          className="h-8 text-[11px] border-white/10 hover:bg-white/5 flex items-center justify-center gap-1.5"
          data-testid="add-image-layer-btn"
        >
          <Upload className="w-3.5 h-3.5 text-amber-400" /> Add Image
        </Button>
        <Button
          onClick={() => videoFileInputRef.current?.click()}
          variant="outline"
          className="h-8 text-[11px] border-white/10 hover:bg-white/5 flex items-center justify-center gap-1.5"
          data-testid="add-video-file-btn"
        >
          <Upload className="w-3.5 h-3.5 text-amber-400" /> Add Local Video
        </Button>
        <Button
          onClick={() => setShowVideoInput(!showVideoInput)}
          variant="outline"
          className="col-span-2 h-8 text-[11px] border-white/10 hover:bg-white/5 flex items-center justify-center gap-1.5"
          data-testid="toggle-video-input-btn"
        >
          <Video className="w-3.5 h-3.5 text-amber-400" /> Add Video Link (YouTube / URL)
        </Button>
        <Button
          onClick={() => setShowMapLibrary(!showMapLibrary)}
          variant="outline"
          className={`col-span-2 h-8 text-[11px] flex items-center justify-center gap-1.5 transition-all ${
            showMapLibrary 
              ? 'bg-[#caa055]/20 text-[#caa055] border-[#caa055]/40' 
              : 'border-white/10 hover:bg-white/5'
          }`}
          data-testid="toggle-map-library-btn"
        >
          <span className="text-amber-400">🗺️</span> Choose from Map Library
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,image/gif,.gif"
          className="hidden"
          onChange={handleFileUpload}
        />
        <input
          ref={videoFileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoFileUpload}
        />
      </div>

      {showVideoInput && (
        <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-2" data-testid="video-input-panel">
          <Label className="text-[10px] text-gray-400">Video URL (YouTube or Direct file URL)</Label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 h-7 text-xs bg-black/60 border border-white/10 rounded px-2 text-white"
            />
            <Button
              onClick={handleAddVideo}
              size="sm"
              className="h-7 text-[10px] bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              data-testid="add-video-btn"
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {showMapLibrary && (
        <div className="p-3 bg-black/40 border border-[#caa055]/20 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-1 duration-200" data-testid="vtt-map-library-panel">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-[#caa055] font-semibold uppercase tracking-wider flex items-center gap-1">
              <span>🗺️</span> VTT Battlemap Library
            </Label>
            <span className="text-[9px] text-gray-500 font-mono">{allVttMaps.length} Maps Available</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {allVttMaps.map((map) => (
              <button
                key={map.id}
                onClick={() => {
                  addBackgroundLayer(map.url, map.name);
                  toast.success(`Successfully added "${map.name}" to background layers!`);
                }}
                className="group relative flex flex-col text-left bg-black/50 border border-white/5 hover:border-[#caa055]/50 rounded-lg overflow-hidden transition-all duration-200 focus:outline-none cursor-pointer"
              >
                {/* Map Thumbnail */}
                <div className="relative w-full h-16 bg-zinc-900 overflow-hidden">
                  <img
                    src={map.url}
                    alt={map.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = getFallbackMapSvg(map.name);
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-1 left-1 bg-black/80 border border-white/10 text-[#caa055] text-[8px] font-semibold px-1 rounded uppercase tracking-wider">
                    {map.theme}
                  </div>
                </div>
                
                {/* Map Details */}
                <div className="p-1.5 flex-1 flex flex-col justify-between">
                  <div className="text-[10px] font-semibold text-white truncate group-hover:text-[#caa055] transition-colors">
                    {map.name}
                  </div>
                  <div className="text-[8px] text-gray-400 line-clamp-2 mt-0.5 leading-normal">
                    {map.description}
                  </div>
                  <div className="mt-1 text-[8px] font-bold text-[#caa055] flex items-center gap-0.5 self-end">
                    <span>+</span> Add Layer
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {layers.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-white/5 rounded-xl text-gray-500 text-xs">
          No background layers added yet. Upload an image or add a video layer to get started.
        </div>
      ) : (
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1" data-testid="layers-list">
          {layers.map((layer, index) => {
            const isSelected = selectedBgLayerId === layer.id;
            return (
              <div
                key={layer.id}
                onClick={() => setSelectedBgLayerId(isSelected ? null : layer.id)}
                className={`flex flex-col p-2.5 rounded-lg transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-black/20 border-white/5 hover:border-white/10'
                }`}
                data-testid={`layer-item-${layer.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-gray-500 font-mono">#{index + 1}</span>
                    <span className="text-xs text-gray-300 font-medium truncate">{layer.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => reorderBackgroundLayers(index, Math.max(0, index - 1))}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      title="Move Up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => reorderBackgroundLayers(index, Math.min(layers.length - 1, index + 1))}
                      disabled={index === layers.length - 1}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      title="Move Down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateBackgroundLayer(layer.id, { visible: !layer.visible })}
                      className="p-1 text-gray-400 hover:text-white"
                      title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                      data-testid={`toggle-visible-${layer.id}`}
                    >
                      {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-gray-600" />}
                    </button>
                    <button
                      onClick={() => removeBackgroundLayer(layer.id)}
                      className="p-1 text-red-400/70 hover:text-red-400"
                      title="Delete Layer"
                      data-testid={`delete-layer-${layer.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Opacity</span>
                        <span className="text-amber-400 font-semibold">{layer.opacity || 100}%</span>
                      </div>
                      <Slider
                        value={[layer.opacity ?? 100]}
                        onValueChange={([val]) => updateBackgroundLayer(layer.id, { opacity: val })}
                        min={0}
                        max={100}
                        step={1}
                        className="py-1"
                        data-testid={`opacity-slider-${layer.id}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BackgroundLayersPanel;
