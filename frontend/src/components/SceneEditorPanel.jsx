import React, { useState, useRef, useEffect } from 'react';
import { useGrid } from '../context/GridContext';
import { Button } from './ui/button';
import {
  Film,
  Plus,
  Save,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  Download,
  Upload,
  RotateCcw,
  Eye,
  EyeOff,
  Minimize2,
  Sparkles,
  MoreVertical,
  Layers,
} from 'lucide-react';

export function SceneEditorPanel({ onUndock }) {
  const {
    scenes,
    activeSceneId,
    saveNewScene,
    updateActiveScene,
    updateScene,
    loadScene,
    toggleSceneVisibility,
    performSceneLoad,
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
  const [openMenuId, setOpenMenuId] = useState(null); // which row's ⋮ menu is open
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  const activeScene = scenes.find((s) => s.id === activeSceneId);

  // Close the ⋮ menu on any outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const handleCreateScene = (e) => {
    e.preventDefault();
    if (!newSceneName.trim()) return;
    saveNewScene(newSceneName.trim());
    setNewSceneName('');
  };

  const handleStartRename = (scene) => {
    setEditingSceneId(scene.id);
    setEditingName(scene.name);
    setOpenMenuId(null);
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
    <div className="p-3 bg-[#0d0f12] text-slate-100 text-xs font-outfit space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar rounded-lg border border-[#caa055]/20 shadow-2xl">
      {/* Header & Undock Button */}
      <div className="flex items-center justify-between border-b border-[#caa055]/20 pb-2">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-[#caa055] animate-pulse" />
          <h3 className="font-cinzel text-sm font-bold tracking-wide text-[#caa055]">
            Scene Editor
          </h3>
        </div>
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

      {/* Active Scene Banner */}
      <div className={`p-2.5 rounded border transition-all ${
        activeScene
          ? 'bg-[#caa055]/10 border-[#caa055]/50'
          : 'bg-black/40 border-slate-700/50 text-slate-400'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-mono uppercase tracking-wider text-[#caa055] font-bold flex items-center">
            <Sparkles className="w-3 h-3 mr-1 inline" />
            {activeScene ? 'Active Scene' : 'Unsaved Canvas'}
          </span>
        </div>
        <p className="font-semibold text-xs text-slate-100 truncate mb-2">
          {activeScene ? activeScene.name : 'Current Workspace'}
        </p>
        <div className="flex gap-1.5">
          {activeScene ? (
            <Button
              onClick={updateActiveScene}
              size="sm"
              className="flex-1 h-7 text-[10px] bg-[#caa055] hover:bg-[#d5b271] text-black font-bold font-cinzel whitespace-nowrap"
            >
              <Save className="w-3 h-3 mr-1 shrink-0" /> Overwrite
            </Button>
          ) : (
            <Button
              onClick={() => saveNewScene('New Scene')}
              size="sm"
              className="flex-1 h-7 text-[10px] bg-[#caa055]/80 hover:bg-[#caa055] text-black font-bold font-cinzel whitespace-nowrap"
            >
              <Save className="w-3 h-3 mr-1 shrink-0" /> Save Canvas
            </Button>
          )}
          <Button
            onClick={clearCanvasState}
            variant="outline"
            size="sm"
            className="h-7 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10 font-cinzel px-2"
            title="Clear active grid objects without deleting saved scenes"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Create New Scene Input */}
      <form onSubmit={handleCreateScene} className="flex items-center gap-1.5">
        <input
          type="text"
          value={newSceneName}
          onChange={(e) => setNewSceneName(e.target.value)}
          placeholder="New scene name..."
          className="flex-1 bg-black/50 border border-slate-700/60 rounded px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-[#caa055] transition placeholder:text-slate-600"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!newSceneName.trim()}
          className="h-7 text-[10px] bg-[#caa055] hover:bg-[#d5b271] text-black font-bold px-2.5 disabled:opacity-40 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </form>

      {/* Layers-style Scene List */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[9px] font-mono uppercase text-slate-500 font-bold tracking-wider">
            Layers ({scenes.length})
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={exportScenes}
              disabled={scenes.length === 0}
              className="p-1 text-slate-500 hover:text-[#caa055] disabled:opacity-30 rounded transition"
              title="Export all scenes to file"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-slate-500 hover:text-[#caa055] rounded transition"
              title="Import scenes from file"
            >
              <Upload className="w-3 h-3" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
          </div>
        </div>

        {scenes.length === 0 ? (
          <div className="text-center py-5 px-3 bg-black/20 rounded border border-dashed border-slate-800">
            <Film className="w-6 h-6 text-slate-600 mx-auto opacity-50 mb-1.5" />
            <p className="text-[10px] text-slate-500">No saved scenes yet</p>
          </div>
        ) : (
          <div className="rounded border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
            {scenes.map((scene) => {
              const isActive = scene.id === activeSceneId || scene.active;
              const isHidden = (settings.hiddenSceneIds || []).includes(scene.id);
              const isEditing = editingSceneId === scene.id;
              const isMenuOpen = openMenuId === scene.id;

              return (
                <div
                  key={scene.id}
                  className={`group relative flex items-center gap-1.5 px-2 py-1.5 transition-colors ${
                    isActive ? 'bg-[#caa055]/10 border-l-2 border-l-[#caa055]' : 'bg-black/20 border-l-2 border-l-transparent hover:bg-white/5'
                  }`}
                >
                  {/* Visibility toggle — pure show/hide of this scene's saved
                      items, independent of Load/Active state */}
                  <button
                    onClick={() => toggleSceneVisibility(scene.id)}
                    className={`shrink-0 p-0.5 rounded transition-colors ${
                      isHidden ? 'text-slate-600 hover:text-slate-400' : 'text-[#caa055] hover:text-[#d5b271]'
                    }`}
                    title={isHidden ? "Hidden — click to show on the grid" : "Visible — click to hide from the grid"}
                  >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  {/* Name — click to load, or inline rename */}
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(scene.id); if (e.key === 'Escape') setEditingSceneId(null); }}
                        className="flex-1 min-w-0 bg-black border border-[#caa055] rounded px-1.5 py-0.5 text-[11px] text-slate-100 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleSaveRename(scene.id)} className="shrink-0 p-0.5 text-emerald-400 hover:bg-emerald-500/20 rounded">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setEditingSceneId(null)} className="shrink-0 p-0.5 text-slate-400 hover:bg-white/10 rounded">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => loadScene(scene.id)}
                      onDoubleClick={() => handleStartRename(scene)}
                      className={`flex-1 min-w-0 truncate text-[11px] cursor-pointer transition ${
                        isActive ? 'text-[#caa055] font-semibold' : 'text-slate-300 hover:text-[#caa055]'
                      }`}
                      title="Click to load · Double-click to rename"
                    >
                      {scene.name}
                    </span>
                  )}

                  {/* Compact icon actions — click the name to load (no
                      separate Play button needed). The floppy disk exports
                      just this layer to its own file. Everything else
                      (rename, overwrite, duplicate, delete) lives in ⋮ to
                      keep the row to one compact line. */}
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => performSceneLoad(scene.id, 'merge')}
                        className="p-1 text-slate-500 hover:text-[#caa055] hover:bg-white/5 rounded transition"
                        title="Add this layer's tokens, maps, and effects on top of what's already on the grid"
                      >
                        <Layers className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => exportSingleScene(scene.id)}
                        className="p-1 text-slate-500 hover:text-[#caa055] hover:bg-white/5 rounded transition"
                        title="Save this layer to its own file"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteScene(scene.id)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                        title="Delete this layer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(isMenuOpen ? null : scene.id)}
                          className="p-1 text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded transition"
                          title="More actions"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-full mt-1 w-40 bg-[#111214] border border-white/10 rounded-md shadow-2xl z-50 py-1 text-[10px]"
                          >
                            <button
                              onClick={() => { handleStartRename(scene); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white transition"
                            >
                              <Edit2 className="w-3 h-3" /> Rename
                            </button>
                            <button
                              onClick={() => { updateScene(scene.id, { data: captureCanvasData() }); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white transition"
                            >
                              <RotateCcw className="w-3 h-3" /> Overwrite with current canvas
                            </button>
                            <button
                              onClick={() => { duplicateScene(scene.id); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white transition"
                            >
                              <Copy className="w-3 h-3" /> Duplicate
                            </button>
                            <div className="my-1 border-t border-white/10" />
                            <button
                              onClick={() => { deleteScene(scene.id); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-red-400 hover:bg-red-500/10 transition"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
