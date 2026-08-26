import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useGrid } from '../context/GridContext';
import { useSession } from '../context/SessionContext';
import { DEFAULT_VAULT_BATTLEMAPS } from '../data/vaultPresets';
import {
  subscribeBattlemaps,
  fetchBattlemapsFromFirebase,
  saveBattlemapToFirebase,
  deleteBattlemapFromFirebase
} from '../lib/firebase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import {
  Layers, Trash2, Eye, EyeOff, Lock, Unlock,
  Plus, Upload, Video, Play, Pause, ChevronUp, ChevronDown, 
  ExternalLink, Search, Sparkles, MapPin, Globe, Shield, RefreshCw,
  Maximize2, Edit2, X, Check
} from 'lucide-react';

export const getFallbackMapSvg = (name = 'Battle Map') => {
  const label = (name || 'Battle Map').trim();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#181512"/>
    <path d="M 0 0 L 400 300 M 400 0 L 0 300" stroke="#3d352e" stroke-width="2"/>
    <rect x="20" y="20" width="360" height="260" fill="none" stroke="#caa055" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.5"/>
    <text x="200" y="150" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="#caa055" text-anchor="middle" letter-spacing="1">${label}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

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
  const libraryUploadInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [showMapLibrary, setShowMapLibrary] = useState(true); // Open by default for instant browsing

  // Search & Filter State for Map Library
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'vault' | 'community' | 'mine'
  const [selectedTheme, setSelectedTheme] = useState('ALL'); // 'ALL' | 'Dungeon' | 'Cavern' | 'Wilderness' | 'Urban' | 'Lava' | 'Snow' | 'Arcane'

  const [globalBattleMaps, setGlobalBattleMaps] = useState([]);
  const [firebaseMaps, setFirebaseMaps] = useState(() => {
    try {
      // Clear cache if project changed
      const cachedProject = localStorage.getItem('krajden_firebase_project');
      const currentProject = 'krajdengrid';
      if (cachedProject !== currentProject) {
        localStorage.removeItem('krajden_cached_firebase_maps');
        localStorage.setItem('krajden_firebase_project', currentProject);
        return [];
      }
      const cached = JSON.parse(localStorage.getItem('krajden_cached_firebase_maps') || '[]');
      return Array.isArray(cached) ? cached : [];
    } catch {
      return [];
    }
  });

  const [localCustomMaps, setLocalCustomMaps] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('krajden_local_custom_maps') || '[]');
      if (!Array.isArray(stored)) return [];
      // Resolve asset URLs stored separately
      return stored.map(m => {
        if (!m.url || !m.imageUrl) {
          const assetUrl = localStorage.getItem(`map_asset_${m.id}`)
                        || sessionStorage.getItem(`map_asset_${m.id}`)
                        || '';
          return { ...m, url: assetUrl, imageUrl: assetUrl };
        }
        return m;
      }).filter(m => m.url); // only include maps with actual data
    } catch {
      return [];
    }
  });

  const [deletedVaultIds, setDeletedVaultIds] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('krajden_deleted_vault_ids') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });

  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [previewMap, setPreviewMap] = useState(null);
  const [editingMap, setEditingMap] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTheme, setEditTheme] = useState('');

  // Subscribe to Firebase Firestore Battlemaps for real-time cloud synchronization
  useEffect(() => {
    const unsubscribe = subscribeBattlemaps((maps) => {
      if (Array.isArray(maps)) {
        setFirebaseMaps(maps);
        try {
          localStorage.setItem('krajden_cached_firebase_maps', JSON.stringify(maps));
        } catch (e) {}
      }
    });
    return () => unsubscribe?.();
  }, []);

  // Fetch from Node/Electron local backend if available
  const fetchGlobalMaps = async () => {
    try {
      const storedDeleted = JSON.parse(localStorage.getItem('krajden_deleted_vault_ids') || '[]');
      if (Array.isArray(storedDeleted)) {
        setDeletedVaultIds(storedDeleted);
      }
      const res = await fetch('/api/library/battlemaps');
      const ct = res.headers?.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.battlemaps)) {
          setGlobalBattleMaps(data.battlemaps);
        }
      }
    } catch {
      // offline / standalone mode fallback
    }
  };

  useEffect(() => {
    fetchGlobalMaps();
    const handleUpdate = () => fetchGlobalMaps();
    window.addEventListener('krajden_library_updated', handleUpdate);
    return () => window.removeEventListener('krajden_library_updated', handleUpdate);
  }, []);

  // Sync All Battlemaps from Firebase Cloud Vault
  const handleSyncAllFromFirebase = async () => {
    setIsSyncingFirebase(true);
    const toastId = toast.loading('☁️ Connecting to Firebase Vault & pulling all battle maps...');
    try {
      const maps = await fetchBattlemapsFromFirebase();
      if (Array.isArray(maps) && maps.length > 0) {
        setFirebaseMaps(maps);
        try {
          localStorage.setItem('krajden_cached_firebase_maps', JSON.stringify(maps));
        } catch (e) {}

        // Un-blacklist any active firestore map IDs
        const mapIdSet = new Set(maps.map(m => String(m.id || '')));
        const mapUrlSet = new Set(maps.map(m => String(m.url || m.imageUrl || '')));
        const updatedDeleted = deletedVaultIds.filter(d => !mapIdSet.has(d) && !mapUrlSet.has(d));
        setDeletedVaultIds(updatedDeleted);
        try {
          localStorage.setItem('krajden_deleted_vault_ids', JSON.stringify(updatedDeleted));
        } catch (e) {}

        if (window.electronAPI?.isElectron) {
          window.electronAPI.broadcast?.('vault-sync', { type: 'battlemaps', count: maps.length });
        }

        toast.success(`☁️ Successfully loaded ${maps.length} Battle Map(s) from Firebase!`, { id: toastId });
      } else {
        toast.info('Firebase Vault connected. No custom maps found in Firestore.', { id: toastId });
      }
      await fetchGlobalMaps();
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
    } catch (err) {
      console.error('[Firebase Sync Error]:', err);
      toast.error(`Sync error: ${err.message || 'Check connection'}`, { id: toastId });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  // Combine and deduplicate maps across Vault Presets, Firebase, Global Backend, and Local Custom
  const allVttMaps = useMemo(() => {
    const mapMap = new Map();

    // 1. Built-in High-Res Tactical Vault Battlemaps
    DEFAULT_VAULT_BATTLEMAPS.forEach(m => {
      if (!m || !m.id) return;
      mapMap.set(m.id, {
        ...m,
        source: 'vault',
        theme: m.theme || 'Dungeon',
      });
    });

    // 2. Global Server / Electron App Bundle Maps
    globalBattleMaps.forEach(m => {
      if (!m || !m.id) return;
      mapMap.set(m.id, {
        ...m,
        source: m.isVault ? 'vault' : 'community',
        theme: m.theme || 'Custom',
      });
    });

    // 3. Cloud Firestore Battlemaps (admin-uploaded = vault)
    firebaseMaps.forEach(m => {
      if (!m || !m.id) return;
      mapMap.set(m.id, {
        ...m,
        source: m.authorId ? 'community' : 'vault', // has author = user upload, no author = admin vault
        theme: m.theme || 'Vault',
      });
    });

    // 4. Local User Uploads
    localCustomMaps.forEach(m => {
      if (!m || !m.id) return;
      mapMap.set(m.id, {
        ...m,
        source: 'mine',
        theme: m.theme || 'Custom',
      });
    });

    // Filter out user-deleted map IDs
    const deletedSet = new Set(deletedVaultIds.map(d => String(d || '').trim()));
    const result = [];

    mapMap.forEach(m => {
      const mId = String(m.id || '').trim();
      const mUrl = String(m.url || m.imageUrl || '').trim();
      if (!mUrl) return;
      if (deletedSet.has(mId) || deletedSet.has(mUrl)) return;
      result.push(m);
    });

    return result;
  }, [firebaseMaps, globalBattleMaps, localCustomMaps, deletedVaultIds]);

  // Filtered battle maps based on search, tab, and theme
  const filteredMaps = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allVttMaps.filter(m => {
      // Tab filter
      if (activeTab === 'vault' && m.source !== 'vault') return false;
      if (activeTab === 'community' && m.source !== 'community') return false;
      if (activeTab === 'mine' && m.source !== 'mine') return false;

      // Theme filter
      if (selectedTheme !== 'ALL') {
        const itemTheme = String(m.theme || '').toLowerCase();
        const targetTheme = selectedTheme.toLowerCase();
        if (!itemTheme.includes(targetTheme) && !((m.tags || []).some(t => String(t).toLowerCase().includes(targetTheme)))) {
          return false;
        }
      }

      // Query search
      if (q) {
        const nameMatch = String(m.name || '').toLowerCase().includes(q);
        const descMatch = String(m.description || '').toLowerCase().includes(q);
        const themeMatch = String(m.theme || '').toLowerCase().includes(q);
        const tagMatch = (m.tags || []).some(t => String(t).toLowerCase().includes(q));
        if (!nameMatch && !descMatch && !themeMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [allVttMaps, activeTab, selectedTheme, searchQuery]);

  // Handle uploading custom battle map — Firebase Storage handles any size
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading(`Uploading "${file.name.replace(/\.[^/.]+$/, '')}"...`);
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!event.target?.result) return;
      const url = event.target.result;
      const mapName = file.name.replace(/\.[^/.]+$/, '');

      // Add to active layers immediately with local base64
      addBackgroundLayer(url, mapName);

      const newMap = {
        id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: mapName,
        theme: 'Custom',
        url,
        imageUrl: url,
        description: 'Uploaded Battle Map',
        created_at: new Date().toISOString(),
        source: 'mine',
      };

      // Save locally
      try {
        const meta = { ...newMap, url: undefined, imageUrl: undefined };
        const existing = JSON.parse(localStorage.getItem('krajden_local_custom_maps') || '[]');
        localStorage.setItem('krajden_local_custom_maps', JSON.stringify([meta, ...existing]));
        localStorage.setItem(`map_asset_${newMap.id}`, url);
      } catch(_) {}

      setLocalCustomMaps(prev => [newMap, ...prev]);

      // Upload to Firebase Storage — no size limit
      try {
        const saved = await saveBattlemapToFirebase(newMap);
        toast.success(`"${mapName}" uploaded to vault!`, { id: toastId });
        const finalUrl = saved?.url || url;
        const finalMap = { ...newMap, url: finalUrl, imageUrl: finalUrl, source: 'vault' };
        // Add to firebaseMaps immediately so it shows in Vault tab without waiting
        setFirebaseMaps(prev => [finalMap, ...prev.filter(m => m.id !== newMap.id)]);
        if (saved?.url && saved.url !== url) {
          setLocalCustomMaps(prev => prev.map(m => m.id === newMap.id ? { ...m, url: saved.url, imageUrl: saved.url } : m));
        }
      } catch(err) {
        toast.warning(`"${mapName}" loaded locally. Vault sync failed: ${err.message}`, { id: toastId });
      }
    };
    reader.onerror = () => toast.error('Failed to read file', { id: toastId });
    reader.readAsDataURL(file);
    e.target.value = '';
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
        toast.success(`Added local video "${file.name}" as background layer!`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddVideo = () => {
    if (!videoUrlInput.trim()) return;
    const isYouTube = videoUrlInput.includes('youtube.com') || videoUrlInput.includes('youtu.be');
    addBackgroundLayer(null, 'Video Map Layer', {
      type: 'video',
      videoUrl: videoUrlInput.trim(),
      isYouTube
    });
    toast.success('Added video stream to background layers!');
    setVideoUrlInput('');
    setShowVideoInput(false);
  };

  const handleDeleteMap = (map, e) => {
    e?.stopPropagation();
    const mapId = map.id;
    const mapUrl = map.url;

    // 1. Remove from local custom list
    setLocalCustomMaps(prev => {
      const updated = prev.filter(m => m.id !== mapId);
      try {
        localStorage.setItem('krajden_local_custom_maps', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Mark as deleted in localStorage blacklist
    const updatedDeleted = Array.from(new Set([...deletedVaultIds, mapId, mapUrl]));
    setDeletedVaultIds(updatedDeleted);
    try {
      localStorage.setItem('krajden_deleted_vault_ids', JSON.stringify(updatedDeleted));
    } catch {}

    // 3. Delete from Firebase if synced
    deleteBattlemapFromFirebase(mapId, mapUrl);

    toast.info(`Removed "${map.name}" from library.`);
  };

  const handleStartEdit = (map, e) => {
    e?.stopPropagation();
    setEditingMap(map);
    setEditName(map.name);
    setEditTheme(map.theme || 'Custom');
  };

  const handleSaveEdit = () => {
    if (!editingMap || !editName.trim()) return;
    const updated = {
      ...editingMap,
      name: editName.trim(),
      theme: editTheme.trim() || 'Custom'
    };

    setLocalCustomMaps(prev => {
      const next = prev.map(m => m.id === editingMap.id ? updated : m);
      try { localStorage.setItem('krajden_local_custom_maps', JSON.stringify(next)); } catch {}
      return next;
    });

    saveBattlemapToFirebase(updated).catch(() => {});
    toast.success(`Updated map "${updated.name}"`);
    setEditingMap(null);
  };

  const layers = settings.backgroundLayers || [];
  const locked = settings.bgLayersLocked || false;

  const themes = ['ALL', 'Dungeon', 'Cavern', 'Wilderness', 'Urban', 'Lava', 'Snow', 'Water', 'Arcane', 'Custom'];

  return (
    <div className="space-y-4 p-4 bg-[#0d0f12] border border-white/10 rounded-2xl text-white select-none" data-testid="layers-panel">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#caa055]" />
          <div>
            <h3 className="text-xs font-bold tracking-wide uppercase text-[#caa055]">Battle Maps & Background Layers</h3>
            <p className="text-[10px] text-gray-400">Position high-res tactical VTT battle maps & video backgrounds</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onUndock && (
            <button
              onClick={onUndock}
              className="flex items-center justify-center py-1 px-2.5 rounded-lg bg-white/5 text-gray-300 border border-white/10 hover:text-white hover:bg-white/10 transition-colors"
              title="Undock / Detach into standalone window"
            >
              <ExternalLink className="w-3 h-3 mr-1 text-[#caa055]" />
              <span className="text-[10px] font-semibold tracking-wide">DETACH</span>
            </button>
          )}
          <button
            onClick={toggleBgLayersLocked}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-semibold tracking-wide transition-colors ${
              locked 
                ? 'bg-[#caa055]/20 text-[#caa055] border border-[#caa055]/50' 
                : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
            }`}
            data-testid="toggle-lock-layers-btn"
          >
            {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {locked ? 'LOCKED' : 'LOCK'}
          </button>
        </div>
      </div>

      {/* Action Buttons: Add Image / Video / Library */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          className="h-8 text-[11px] font-medium border-white/10 hover:bg-white/10 hover:border-[#caa055]/40 flex items-center justify-center gap-1.5 bg-black/40 text-gray-200"
          data-testid="add-image-layer-btn"
        >
          <Upload className="w-3.5 h-3.5 text-[#caa055]" /> Add Custom Image
        </Button>
        <Button
          onClick={() => videoFileInputRef.current?.click()}
          variant="outline"
          className="h-8 text-[11px] font-medium border-white/10 hover:bg-white/10 hover:border-[#caa055]/40 flex items-center justify-center gap-1.5 bg-black/40 text-gray-200"
          data-testid="add-video-file-btn"
        >
          <Upload className="w-3.5 h-3.5 text-[#caa055]" /> Add Local Video (MP4/WebM)
        </Button>
        <Button
          onClick={() => setShowVideoInput(!showVideoInput)}
          variant="outline"
          className="col-span-2 h-8 text-[11px] font-medium border-white/10 hover:bg-white/10 hover:border-[#caa055]/40 flex items-center justify-center gap-1.5 bg-black/40 text-gray-200"
          data-testid="toggle-video-input-btn"
        >
          <Video className="w-3.5 h-3.5 text-[#caa055]" /> Add Video Stream Link (YouTube / URL)
        </Button>
        <Button
          onClick={() => setShowMapLibrary(!showMapLibrary)}
          variant="outline"
          className={`col-span-2 h-9 text-[11px] font-bold tracking-wide flex items-center justify-center gap-2 transition-all ${
            showMapLibrary 
              ? 'bg-[#caa055]/25 text-[#caa055] border border-[#caa055]' 
              : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-200'
          }`}
          data-testid="toggle-map-library-btn"
        >
          <MapPin className="w-3.5 h-3.5 text-[#caa055]" />
          {showMapLibrary ? 'Hide VTT Battlemap Library' : 'Open VTT Battlemap Library'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,image/gif,.gif,.webp"
          className="hidden"
          onChange={handleFileUpload}
        />
        <input
          ref={libraryUploadInputRef}
          type="file"
          accept="image/*,image/gif,.gif,.webp"
          className="hidden"
          onChange={handleFileUpload}
        />
        <input
          ref={videoFileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg"
          className="hidden"
          onChange={handleVideoFileUpload}
        />
      </div>

      {/* Video URL Input Panel */}
      {showVideoInput && (
        <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-2 animate-in fade-in" data-testid="video-input-panel">
          <Label className="text-[10px] text-gray-400 font-semibold">Live Video Stream URL (YouTube, MP4, or WebM direct stream)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://..."
              className="flex-1 h-8 text-xs bg-black/80 border-white/15 text-white"
            />
            <Button
              onClick={handleAddVideo}
              size="sm"
              className="h-8 text-[11px] bg-[#caa055] hover:bg-[#d5b271] text-black font-bold px-4"
              data-testid="add-video-btn"
            >
              Add Layer
            </Button>
          </div>
        </div>
      )}

      {/* MODERN BATTLEMAP LIBRARY BROWSER WITH FIREBASE SYNC & MANAGEMENT */}
      {showMapLibrary && (
        <div className="p-3.5 bg-black/70 border border-[#caa055]/30 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200" data-testid="vtt-map-library-panel">
          {/* Header with Search, Source Tabs, and Cloud Sync Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#caa055] flex items-center gap-1.5 font-cinzel">
                <span>🗺️</span> VTT Battlemap Library
              </span>
              <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full font-mono">
                {filteredMaps.length} Maps
              </span>
            </div>

            {/* Load All from Firebase Cloud Vault Button */}
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleSyncAllFromFirebase}
                disabled={isSyncingFirebase}
                size="sm"
                className="h-7 text-[10px] font-bold bg-[#caa055] hover:bg-[#d5b271] text-black shadow-md flex items-center gap-1.5"
                title="Load all battle maps from Firebase Firestore database into local library"
                data-testid="load-firebase-maps-btn"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
                <span>{isSyncingFirebase ? 'Syncing...' : 'Load All from Firebase'}</span>
              </Button>
            </div>
          </div>

          {/* Search bar & Tabs */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search maps by name, theme, or tags..."
                className="h-8 pl-8 text-xs bg-black/60 border-white/10 text-white placeholder:text-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex rounded-lg overflow-hidden border border-white/10 bg-black/40 text-[10px] font-medium">
              {[
                { id: 'all', label: 'All Maps' },
                { id: 'vault', label: '⭐ Vault Presets' },
                { id: 'community', label: '🌐 Cloud' },
                { id: 'mine', label: '👤 My Uploads' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#caa055]/30 text-[#caa055] font-bold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Button
              onClick={() => libraryUploadInputRef.current?.click()}
              size="sm"
              variant="outline"
              className="h-8 text-[11px] font-semibold border-[#caa055]/40 hover:bg-[#caa055]/15 text-[#caa055] flex items-center gap-1 shrink-0"
              title="Upload and save a custom battle map"
            >
              <Plus className="w-3.5 h-3.5" /> Upload Map
            </Button>
          </div>

          {/* Theme Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {themes.map((theme) => (
              <button
                key={theme}
                onClick={() => setSelectedTheme(theme)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide whitespace-nowrap transition-all ${
                  selectedTheme === theme
                    ? 'bg-[#caa055]/30 text-[#caa055] border border-[#caa055]'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/5'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>

          {/* Map Grid Cards */}
          {filteredMaps.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-white/10 rounded-xl bg-black/40 space-y-2">
              <p className="text-xs text-gray-400">No battle maps match your search or filter.</p>
              <Button
                onClick={() => { setSearchQuery(''); setSelectedTheme('ALL'); setActiveTab('all'); }}
                size="sm"
                variant="outline"
                className="h-7 text-[10px] border-white/10 text-gray-300"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {filteredMaps.map((map) => (
                <div
                  key={map.id}
                  onClick={() => {
                    addBackgroundLayer(map.url, map.name);
                    toast.success(`Loaded "${map.name}" onto tabletop grid!`);
                  }}
                  className="group relative flex flex-col text-left bg-zinc-950/80 border border-white/10 hover:border-[#caa055] rounded-xl overflow-hidden transition-all duration-200 focus:outline-none cursor-pointer shadow-md hover:shadow-lg hover:shadow-[#caa055]/10"
                >
                  {/* Thumbnail Image */}
                  <div className="relative w-full h-28 bg-black overflow-hidden">
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
                    
                    {/* Theme Badge */}
                    <div className="absolute top-1.5 left-1.5 bg-black/85 backdrop-blur-sm border border-white/15 text-[#caa055] text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {map.theme}
                    </div>

                    {/* Source Badge */}
                    {map.source === 'vault' && (
                      <div className="absolute top-1.5 right-1.5 bg-[#caa055] text-black text-[8px] font-black px-1.5 py-0.5 rounded tracking-wide">
                        VAULT
                      </div>
                    )}
                    {map.source === 'community' && (
                      <div className="absolute top-1.5 right-1.5 bg-sky-500/90 text-white text-[8px] font-black px-1.5 py-0.5 rounded tracking-wide">
                        CLOUD
                      </div>
                    )}

                    {/* Quick Card Action Buttons */}
                    <div className="absolute bottom-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 rounded p-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewMap(map);
                        }}
                        className="p-1 hover:text-[#caa055] text-gray-300 transition-colors"
                        title="Preview Fullscreen Map"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleStartEdit(map, e)}
                        className="p-1 hover:text-[#caa055] text-gray-300 transition-colors"
                        title="Edit Map Info"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteMap(map, e)}
                        className="p-1 hover:text-red-400 text-gray-300 transition-colors"
                        title="Delete Map"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content & Add Action */}
                  <div className="p-2 flex-1 flex flex-col justify-between space-y-1">
                    <div>
                      <div className="text-[11px] font-bold text-white group-hover:text-[#caa055] transition-colors truncate">
                        {map.name}
                      </div>
                      <div className="text-[9px] text-gray-400 line-clamp-1 leading-snug">
                        {map.description || 'Tactical VTT Battle Map'}
                      </div>
                    </div>
                    
                    <div className="pt-1 flex items-center justify-between border-t border-white/5">
                      <span className="text-[8px] text-gray-500 font-mono">1-inch grid ready</span>
                      <span className="text-[9px] font-bold text-[#caa055] flex items-center gap-1 group-hover:underline">
                        <span>+</span> Add Layer
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FULLSCREEN MAP PREVIEW MODAL */}
      {previewMap && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setPreviewMap(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-[#0d0f12] border border-[#caa055]/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#caa055]">{previewMap.name}</span>
                <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                  {previewMap.theme || 'Dungeon'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    addBackgroundLayer(previewMap.url, previewMap.name);
                    toast.success(`Loaded "${previewMap.name}" onto tabletop grid!`);
                    setPreviewMap(null);
                  }}
                  size="sm"
                  className="h-7 text-[10px] bg-[#caa055] text-black font-bold"
                >
                  + Add to Tabletop
                </Button>
                <button
                  onClick={() => setPreviewMap(null)}
                  className="text-gray-400 hover:text-white p-1 text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-black flex items-center justify-center p-2">
              <img
                src={previewMap.url}
                alt={previewMap.name}
                className="max-w-full max-h-[75vh] object-contain rounded-lg border border-white/10"
              />
            </div>
          </div>
        </div>
      )}

      {/* EDIT MAP INFO MODAL */}
      {editingMap && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setEditingMap(null)}
        >
          <div
            className="relative max-w-sm w-full bg-[#0d0f12] border border-[#caa055]/50 rounded-xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-[#caa055] uppercase tracking-wider">
                Edit Battle Map Info
              </span>
              <button onClick={() => setEditingMap(null)} className="text-gray-400 hover:text-white text-xs">
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] text-gray-400">Map Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-xs bg-black/60 border-white/15 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] text-gray-400">Theme / Category</Label>
                <Input
                  value={editTheme}
                  onChange={(e) => setEditTheme(e.target.value)}
                  placeholder="Dungeon, Cavern, Urban, Lava, etc."
                  className="h-8 text-xs bg-black/60 border-white/15 text-white mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                onClick={() => setEditingMap(null)}
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] text-gray-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                size="sm"
                className="h-7 text-[10px] bg-[#caa055] text-black font-bold"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE PLACED BACKGROUND LAYERS LIST */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <span>🎛️</span> Active Layers ({layers.length})
          </Label>
          {layers.length > 0 && (
            <button
              onClick={clearAllBackgroundLayers}
              className="text-[10px] text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Clear All Layers
            </button>
          )}
        </div>

        {layers.length === 0 ? (
          <div className="p-5 text-center border border-dashed border-white/10 rounded-xl text-gray-500 text-xs bg-black/20">
            No background layers placed yet. Click on any map from the library above or upload your own file.
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1" data-testid="layers-list">
            {layers.map((layer, index) => {
              const isSelected = selectedBgLayerId === layer.id;
              return (
                <div
                  key={layer.id}
                  onClick={() => setSelectedBgLayerId(isSelected ? null : layer.id)}
                  className={`flex flex-col p-2.5 rounded-xl transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-[#caa055]/15 border-[#caa055]/50 shadow-md shadow-[#caa055]/5'
                      : 'bg-black/30 border-white/10 hover:border-white/20'
                  }`}
                  data-testid={`layer-item-${layer.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-gray-500 font-mono">#{index + 1}</span>
                      <span className="text-xs text-gray-200 font-semibold truncate">{layer.name}</span>
                      {layer.type === 'video' && (
                        <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-mono">
                          VIDEO
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => updateBackgroundLayer(layer.id, { visible: !layer.visible })}
                        className={`p-1 rounded transition-colors ${
                          layer.visible !== false ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-400'
                        }`}
                        title={layer.visible !== false ? 'Hide Layer' : 'Show Layer'}
                      >
                        {layer.visible !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => reorderBackgroundLayers(index, Math.max(0, index - 1))}
                        disabled={index === 0}
                        className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => reorderBackgroundLayers(index, Math.min(layers.length - 1, index + 1))}
                        disabled={index === layers.length - 1}
                        className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeBackgroundLayer(layer.id)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
                        title="Remove Layer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Layer Controls */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5 animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>Opacity</span>
                          <span className="font-mono text-[#caa055]">{Math.round((layer.opacity ?? 1) * 100)}%</span>
                        </div>
                        <Slider
                          value={[layer.opacity ?? 1]}
                          min={0.05}
                          max={1}
                          step={0.01}
                          onValueChange={([val]) => updateBackgroundLayer(layer.id, { opacity: val })}
                          className="py-1"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-gray-400">Dim Background Layer</span>
                        <Switch
                          checked={layer.dimmed ?? false}
                          onCheckedChange={(checked) => updateBackgroundLayer(layer.id, { dimmed: checked })}
                          className="scale-75"
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
    </div>
  );
}

export default BackgroundLayersPanel;
