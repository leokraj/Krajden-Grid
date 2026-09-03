import React, { useState, useRef } from 'react';
import { useGrid } from '../context/GridContext';
import { Button } from './ui/button';
import { 
  Film, 
  Plus, 
  Save, 
  Play, 
  Copy, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Download, 
  Upload, 
  RotateCcw, 
  Layers, 
  PenTool, 
  Eye, 
  EyeOff, 
  Minimize2,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';

export function SceneEditorPanel({ onUndock }) {
  const {
    scenes,
    activeSceneId,
    saveNewScene,
    updateActiveScene,
    updateScene,
    loadScene,
    toggleSceneActive,
    toggleSceneVisibility,
    deleteScene,
    duplicateScene,
    clearCanvasState,
    exportScenes,
    exportSingleScene,
    importScenes,
    captureCanvasData,
    settings,
  } = useGrid();

  const [newSceneName, setNewSceneName] = useState('');
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const fileInputRef = useRef(null);

  const activeScene = scenes.find((s) => s.id === activeSceneId);

  const handleCreateScene = (e) => {
    e.preventDefault();
    if (!newSceneName.trim()) return;
    saveNewScene(newSceneName.trim());
    setNewSceneName('');
  };

  const handleStartRename = (scene) => {
    setEditingSceneId(scene.id);
    setEditingName(scene.name);
  };

  const handleSaveRename = (sceneId) => {
    if (editingName.trim()) {
      updateScene(sceneId, { name: editingName.trim() });
    }
    setEditingSceneId(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        importScenes(event.target.result);
      } catch (err) {
        console.error("Failed to read imported scenes file:", err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="p-3 bg-[#0d0f12] text-slate-100 text-xs font-outfit space-y-4 max-h-[80vh] overflow-y-[#caa055] overflow-y-auto custom-scrollbar rounded-lg border border-[#caa055]/20 shadow-2xl">
      {/* Header & Undock Button */}
      <div className="flex items-center justify-between border-b border-[#caa055]/20 pb-2">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-[#caa055] animate-pulse" />
          <h3 className="font-cinzel text-sm font-bold tracking-wide text-[#caa055]">
            Scene Editor
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          {onUndock && (
            <button
              onClick={onUndock}
              className="p-1 text-slate-400 hover:text-[#caa055] hover:bg-white/5 rounded transition"
              title="Undock Panel"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Active Scene Banner */}
      <div className={`p-3 rounded border transition-all ${
        activeScene 
          ? 'bg-[#caa055]/10 border-[#caa055]/50 shadow-[0_0_15px_rgba(202,160,85,0.15)]' 
          : 'bg-black/40 border-slate-700/50 text-slate-400'
      }`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#caa055] font-bold flex items-center">
            <Sparkles className="w-3 h-3 mr-1 inline" />
            {activeScene ? 'Active Scene Loaded' : 'Unsaved Canvas State'}
          </span>
          {activeScene && (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#caa055] text-black font-bold">
              ON GRID
            </span>
          )}
        </div>
        
        <p className="font-semibold text-sm text-slate-100 truncate mb-2">
          {activeScene ? activeScene.name : 'Current Workspace'}
        </p>

        <div className="flex flex-col gap-1.5">
          {activeScene ? (
            <Button
              onClick={updateActiveScene}
              size="sm"
              className="w-full h-8 text-[11px] bg-[#caa055] hover:bg-[#d5b271] text-black font-bold font-cinzel whitespace-nowrap"
            >
              <Save className="w-3 h-3 mr-1 shrink-0" /> Overwrite Active Scene
            </Button>
          ) : (
            <Button
              onClick={() => saveNewScene('New Scene')}
              size="sm"
              className="w-full h-8 text-[11px] bg-[#caa055]/80 hover:bg-[#caa055] text-black font-bold font-cinzel whitespace-nowrap"
            >
              <Save className="w-3 h-3 mr-1 shrink-0" /> Save Current Canvas
            </Button>
          )}
          <Button
            onClick={clearCanvasState}
            variant="outline"
            size="sm"
            className="w-full h-8 text-[11px] border-red-500/30 text-red-400 hover:bg-red-500/10 font-cinzel whitespace-nowrap"
            title="Clear active grid objects without deleting saved scenes"
          >
            <RotateCcw className="w-3 h-3 mr-1 shrink-0" /> Blank Canvas
          </Button>
        </div>
      </div>

      {/* Create New Scene Input */}
      <form onSubmit={handleCreateScene} className="space-y-1.5">
        <label className="text-[10px] uppercase font-mono text-slate-400 font-bold">
          Create & Save New Scene
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            placeholder="e.g. Encounter 1: Goblin Ambush..."
            className="flex-1 bg-black/50 border border-slate-700/60 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-[#caa055] transition placeholder:text-slate-600"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newSceneName.trim()}
            className="h-8 text-xs bg-[#caa055] hover:bg-[#d5b271] text-black font-bold px-3 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        </div>
      </form>

      {/* Scenes List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
            Saved Scenes ({scenes.length})
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={exportScenes}
              disabled={scenes.length === 0}
              className="p-1 text-slate-400 hover:text-[#caa055] disabled:opacity-30 rounded transition"
              title="Export Scenes to JSON file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-slate-400 hover:text-[#caa055] rounded transition"
              title="Import Scenes from JSON file"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {scenes.length === 0 ? (
          <div className="text-center py-6 px-3 bg-black/20 rounded border border-dashed border-slate-800 space-y-2">
            <Film className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
            <p className="text-xs text-slate-400">No saved scenes yet.</p>
            <p className="text-[10px] text-slate-500">
              Customize your grid tokens, drawings, and maps, then save your scene above!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {scenes.map((scene) => {
              const isActive = scene.id === activeSceneId || scene.active;
              const data = scene.data || {};
              const tokenCount = (data.placedCliparts || []).length;
              const drawingCount = (data.drawingPaths || []).length;
              const hasMap = !!(data.backgroundImage || data.backgroundImageData || (data.backgroundLayers || []).length > 0);
              const hasFog = (data.maskPaths || []).length > 0 || (data.maskRects || []).length > 0;

              return (
                <div
                  key={scene.id}
                  className={`p-2.5 rounded border transition-all ${
                    isActive
                      ? 'bg-[#caa055]/10 border-[#caa055]/60 shadow-[0_0_10px_rgba(202,160,85,0.1)]'
                      : 'bg-black/30 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Row: Toggle Switch & Title */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      {/* Visibility toggle — hides/shows this scene's items on the grid.
                          Does NOT load or switch scenes; that's what the Load button below does. */}
                      <button
                        onClick={() => toggleSceneVisibility(scene.id)}
                        className={`p-1 rounded-full transition-colors flex-shrink-0 focus:outline-none ${
                          (settings.hiddenSceneIds || []).includes(scene.id)
                            ? 'text-slate-600 hover:text-slate-400'
                            : 'text-[#caa055] hover:text-[#d5b271]'
                        }`}
                        title={(settings.hiddenSceneIds || []).includes(scene.id)
                          ? 'Hidden — click to show this scene\'s items on the grid'
                          : 'Visible — click to hide this scene\'s items from the grid'}
                      >
                        {(settings.hiddenSceneIds || []).includes(scene.id)
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />}
                      </button>

                      {/* Scene Name / Rename */}
                      {editingSceneId === scene.id ? (
                        <div className="flex items-center space-x-1 flex-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-black border border-[#caa055] rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none flex-1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(scene.id)}
                            className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingSceneId(null)}
                            className="p-1 text-slate-400 hover:bg-white/10 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 min-w-0 flex-1">
                          <span
                            onClick={() => loadScene(scene.id)}
                            className="font-medium text-xs text-slate-200 truncate cursor-pointer hover:text-[#caa055] transition"
                            title="Click to load scene"
                          >
                            {scene.name}
                          </span>
                          <button
                            onClick={() => handleStartRename(scene)}
                            className="p-0.5 text-slate-500 hover:text-slate-300 rounded opacity-0 hover:opacity-100 group-hover:opacity-100 transition"
                            title="Rename Scene"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Active Status Badge */}
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#caa055]/20 text-[#caa055] border border-[#caa055]/40 font-bold uppercase tracking-wider flex-shrink-0">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Badges / Stats */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px] text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-slate-800 flex items-center">
                      <Layers className="w-2.5 h-2.5 mr-1 text-cyan-400" />
                      {tokenCount} Tokens
                    </span>
                    {drawingCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-slate-800 flex items-center">
                        <PenTool className="w-2.5 h-2.5 mr-1 text-amber-400" />
                        {drawingCount} Strokes
                      </span>
                    )}
                    {hasMap && (
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-slate-800 flex items-center text-emerald-400">
                        <ImageIcon className="w-2.5 h-2.5 mr-1" />
                        Map
                      </span>
                    )}
                    {hasFog && (
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-slate-800 flex items-center text-purple-400">
                        <EyeOff className="w-2.5 h-2.5 mr-1" />
                        Fog
                      </span>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px]">
                    <div className="flex items-center space-x-1">
                      <Button
                        onClick={() => loadScene(scene.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-[#caa055] hover:bg-[#caa055]/10 hover:text-[#d5b271]"
                      >
                        <Play className="w-3 h-3 mr-1" /> Load
                      </Button>
                      <Button
                        onClick={() => updateScene(scene.id, { data: captureCanvasData() })}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        title="Update scene with current canvas state"
                      >
                        <Save className="w-3 h-3 mr-1" /> Save Here
                      </Button>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => exportSingleScene(scene.id)}
                        className="p-1 text-slate-400 hover:text-[#caa055] hover:bg-white/5 rounded transition"
                        title="Export just this scene to its own file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => duplicateScene(scene.id)}
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition"
                        title="Duplicate Scene"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteScene(scene.id)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                        title="Delete Scene"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SceneEditorPanel;
