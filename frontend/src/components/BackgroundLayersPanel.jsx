import React, { useRef, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { useSession } from '../context/SessionContext';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import {
  Layers, Trash2, Eye, EyeOff, Lock, Unlock,
  Plus, Upload, Video, Play, Pause, ChevronUp, ChevronDown, ExternalLink
} from 'lucide-react';

export default function BackgroundLayersPanel({ onUndock }) {
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
