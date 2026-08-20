import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  saveTokenToFirebase,
  deleteTokenFromFirebase,
  saveBattlemapToFirebase,
  deleteBattlemapFromFirebase,
  saveEffectToFirebase,
  deleteEffectFromFirebase,
  fetchTokensFromFirebase,
  fetchBattlemapsFromFirebase,
  fetchEffectsFromFirebase,
} from '../lib/firebase';
import {
  Shield,
  Lock,
  Unlock,
  Key,
  X,
  Plus,
  Trash2,
  Edit2,
  Save,
  Image as ImageIcon,
  Map as MapIcon,
  Upload,
  Loader2,
  Sparkles,
  CheckCircle,
  FolderPlus,
  RefreshCw,
  Zap,
  Cloud,
  CheckSquare,
  Square,
  Check,
} from 'lucide-react';

export default function AdminSecretModal({ isOpen, onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Tab: 'gifs' | 'maps' | 'effects'
  const [activeTab, setActiveTab] = useState('gifs');

  // Firebase sync state
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  // Multi-item selection states for batch deletion & operations
  const [selectedClipartIds, setSelectedClipartIds] = useState(new Set());
  const [selectedMapIds, setSelectedMapIds] = useState(new Set());
  const [selectedEffectIds, setSelectedEffectIds] = useState(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Library Items state
  const [cliparts, setCliparts] = useState([]);
  const [battlemaps, setBattlemaps] = useState([]);
  const [effects, setEffects] = useState([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // Form states - Single GIF/Clipart
  const [gifName, setGifName] = useState('');
  const [gifCategory, setGifCategory] = useState('animated_fx');
  const [gifUrl, setGifUrl] = useState('');
  const [isUploadingGif, setIsUploadingGif] = useState(false);
  const gifFileInputRef = useRef(null);

  // Form states - Single Battle Map
  const [mapName, setMapName] = useState('');
  const [mapTheme, setMapTheme] = useState('Dungeon');
  const [mapUrl, setMapUrl] = useState('');
  const [mapDescription, setMapDescription] = useState('');
  const [isUploadingMap, setIsUploadingMap] = useState(false);
  const mapFileInputRef = useRef(null);

  // Form states - Single Effect
  const [effectName, setEffectName] = useState('');
  const [effectCategory, setEffectCategory] = useState('nature');
  const [effectUrl, setEffectUrl] = useState('');
  const [isUploadingEffect, setIsUploadingEffect] = useState(false);
  const effectFileInputRef = useRef(null);

  // Edit State
  const [editingItem, setEditingItem] = useState(null); // { id, name, category, theme, imageUrl, url, description, type: 'gif'|'map' }
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Check saved session on open
  useEffect(() => {
    if (isOpen) {
      const token = localStorage.getItem('krajden_admin_token');
      if (token) {
        setIsAuthenticated(true);
        fetchLibraryData();
      }
    }
  }, [isOpen]);

  // Fetch Global Library Data
  async function fetchLibraryData() {
    setIsLoadingLibrary(true);
    try {
      const results = await Promise.allSettled([
        fetch('/api/library/cliparts'),
        fetch('/api/library/battlemaps'),
        fetch('/api/library/effects'),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        const data = await results[0].value.json();
        setCliparts(data.cliparts || []);
      }
      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        const data = await results[1].value.json();
        setBattlemaps(data.battlemaps || []);
      }
      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        const data = await results[2].value.json();
        setEffects(data.effects || []);
      }
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
    } catch (e) {
      console.error('Failed to fetch library:', e);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  // Handle Login
  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!password.trim()) return;

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const backendUrl = window.location.origin;
      const res = await fetch(`${backendUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('krajden_admin_token', data.token);
        setIsAuthenticated(true);
        toast.success('Asset Vault unlocked!');
        fetchLibraryData();
      } else {
        setLoginError(data.detail || 'Incorrect passphrase.');
      }
    } catch (err) {
      setLoginError('Server connection error.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('krajden_admin_token');
    setIsAuthenticated(false);
    setPassword('');
    toast.info('Logged out of Vault');
  };

  // Helper for safely parsing JSON response or throwing readable error
  const safeJsonResponse = async (res) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server error (${res.status})`);
      }
      return data;
    }
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 413) {
        throw new Error('Upload size too large. Splitting into smaller batches automatically.');
      }
      throw new Error(`Server returned error (${res.status}): ${text.substring(0, 100)}`);
    }
    if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
      throw new Error(`Server returned HTML SPA fallback page (status ${res.status}) instead of JSON API response`);
    }
    throw new Error(`Unexpected server response (${res.status}): ${text.substring(0, 100)}`);
  };

  // Helper to upload files in small batches with multi-tier fallbacks
  const uploadFilesChunked = async (files, onProgress) => {
    const CHUNK_SIZE = 5;
    const allUploaded = [];

    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      const chunk = files.slice(i, i + CHUNK_SIZE);
      if (onProgress) {
        onProgress(i, files.length);
      }

      // Try batch multipart upload first
      let chunkSuccess = false;
      try {
        const formData = new FormData();
        chunk.forEach((file) => formData.append('files', file));

        const res = await fetch('/api/cliparts/batch-upload', {
          method: 'POST',
          body: formData,
        });

        const data = await safeJsonResponse(res);
        if (Array.isArray(data.files) && data.files.length > 0) {
          allUploaded.push(...data.files);
          chunkSuccess = true;
        }
      } catch (batchErr) {
        console.warn('[Batch Upload Warning]:', batchErr.message, 'Falling back to individual file processing.');
      }

      if (chunkSuccess) continue;

      // Fallback 1: Upload files individually via /api/cliparts/upload
      for (const file of chunk) {
        try {
          const singleFormData = new FormData();
          singleFormData.append('file', file);
          const singleRes = await fetch('/api/cliparts/upload', {
            method: 'POST',
            body: singleFormData,
          });
          const singleData = await safeJsonResponse(singleRes);
          if (singleData.url) {
            allUploaded.push({
              url: singleData.url,
              name: singleData.name || file.name.replace(/\.[^/.]+$/, ''),
              originalName: file.name,
              size: file.size,
            });
            continue;
          }
        } catch (singleErr) {
          console.warn('[Single Upload Warning]:', singleErr.message, 'Falling back to Base64 Data URI.');
        }

        // Fallback 2: Read file as Data URI
        try {
          const base64Url = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
          });
          if (base64Url) {
            allUploaded.push({
              url: base64Url,
              name: file.name.replace(/\.[^/.]+$/, ''),
              originalName: file.name,
              size: file.size,
            });
          }
        } catch (base64Err) {
          console.error('[Base64 Fallback Failed]:', base64Err);
        }
      }
    }

    if (onProgress) {
      onProgress(files.length, files.length);
    }

    return allUploaded;
  };

  // Drag & Drop state
  const [isDragOverGif, setIsDragOverGif] = useState(false);
  const [isDragOverMap, setIsDragOverMap] = useState(false);

  // BATCH File Upload Core Handler for GIFs / Tokens
  const processBatchGifFiles = async (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    setIsUploadingGif(true);
    const toastId = toast.loading(`Uploading 0 / ${files.length} file(s)...`);

    try {
      const uploadedFiles = await uploadFilesChunked(files, (done, total) => {
        toast.loading(`Uploading ${done} / ${total} file(s)...`, { id: toastId });
      });

      if (uploadedFiles.length === 0) {
        toast.error('No files could be processed', { id: toastId });
        return;
      }

      toast.loading(`Publishing ${uploadedFiles.length} item(s) to Vault...`, { id: toastId });

      // Prepare batch library items using original filenames as names
      const itemsToPublish = uploadedFiles.map((f) => ({
        name: f.name,
        category: gifCategory,
        type: 'image',
        imageUrl: f.url,
        tags: [gifCategory, 'batch_uploaded'],
      }));

      const PUBLISH_CHUNK_SIZE = 10;
      let totalPublished = 0;

      for (let i = 0; i < itemsToPublish.length; i += PUBLISH_CHUNK_SIZE) {
        const itemChunk = itemsToPublish.slice(i, i + PUBLISH_CHUNK_SIZE);
        try {
          const batchRes = await fetch('/api/admin/library/clipart/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemChunk }),
          });

          const batchData = await safeJsonResponse(batchRes);
          if (batchData.success) {
            totalPublished += itemChunk.length;
          }
        } catch (pubErr) {
          console.warn('[Publish Chunk Warning]:', pubErr.message, 'Falling back to single item publishing.');
          for (const singleItem of itemChunk) {
            try {
              const singleRes = await fetch('/api/admin/library/clipart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(singleItem),
              });
              const singleData = await safeJsonResponse(singleRes);
              if (singleData.success) {
                totalPublished++;
              }
            } catch (sPubErr) {
              console.error('[Single Item Publish Error]:', sPubErr.message);
            }
          }
        }
      }

      if (totalPublished > 0) {
        // Persist all published items to Firebase Firestore in real-time
        for (const item of itemsToPublish) {
          saveTokenToFirebase({
            ...item,
            id: `token_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            isVault: true,
            created_at: new Date().toISOString()
          }).catch(e => console.warn('[Firebase] Token batch save error:', e));
        }
        toast.success(`Batch uploaded & published ${totalPublished} asset(s)!`, { id: toastId });
        setGifName('');
        setGifUrl('');
        fetchLibraryData();
      } else {
        toast.error('Failed to save items to vault', { id: toastId });
      }
    } catch (err) {
      console.error('Batch GIF upload error:', err);
      toast.error('Upload error: ' + err.message, { id: toastId });
    } finally {
      setIsUploadingGif(false);
      if (gifFileInputRef.current) gifFileInputRef.current.value = '';
    }
  };

  const handleBatchGifUpload = (e) => {
    processBatchGifFiles(e.target.files);
  };

  // Handle Add Single GIF / Clipart
  const handleAddSingleGif = async (e) => {
    e?.preventDefault();
    if (!gifUrl.trim()) {
      toast.error('Please specify an image or GIF URL');
      return;
    }

    try {
      const title = gifName.trim() || 'Untitled Asset';
      const res = await fetch('/api/admin/library/clipart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title,
          category: gifCategory,
          type: 'image',
          imageUrl: gifUrl.trim(),
          tags: [gifCategory, 'admin_uploaded'],
        }),
      });

      const data = await safeJsonResponse(res);
      if (data.success) {
        // Sync to Firebase Firestore
        saveTokenToFirebase({
          id: `token_${Date.now()}`,
          name: title,
          category: gifCategory,
          type: 'image',
          imageUrl: gifUrl.trim(),
          tags: [gifCategory, 'admin_uploaded'],
          isVault: true,
          created_at: new Date().toISOString()
        }).catch(e => console.warn('[Firebase] Token save note:', e));

        toast.success(`Added "${title}" to Global Vault!`);
        setGifName('');
        setGifUrl('');
        if (gifFileInputRef.current) gifFileInputRef.current.value = '';
        fetchLibraryData();
      } else {
        toast.error(data.detail || 'Failed to add asset');
      }
    } catch (err) {
      toast.error('Error adding asset: ' + err.message);
    }
  };

  // BATCH File Upload Core Handler for Battle Maps
  const processBatchMapFiles = async (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    setIsUploadingMap(true);
    const toastId = toast.loading(`Uploading 0 / ${files.length} battle map(s)...`);

    try {
      const uploadedFiles = await uploadFilesChunked(files, (done, total) => {
        toast.loading(`Uploading ${done} / ${total} battle map(s)...`, { id: toastId });
      });

      if (uploadedFiles.length === 0) {
        toast.error('No map files could be processed', { id: toastId });
        return;
      }

      toast.loading(`Publishing ${uploadedFiles.length} map(s) to Vault...`, { id: toastId });

      // Prepare batch map items using original filenames as names
      const itemsToPublish = uploadedFiles.map((f) => ({
        name: f.name,
        theme: mapTheme,
        url: f.url,
        description: mapDescription.trim() || `${mapTheme} Tactical Battle Map`,
      }));

      const PUBLISH_CHUNK_SIZE = 10;
      let totalPublished = 0;

      for (let i = 0; i < itemsToPublish.length; i += PUBLISH_CHUNK_SIZE) {
        const itemChunk = itemsToPublish.slice(i, i + PUBLISH_CHUNK_SIZE);
        try {
          const batchRes = await fetch('/api/admin/library/battlemap/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemChunk }),
          });

          const batchData = await safeJsonResponse(batchRes);
          if (batchData.success) {
            totalPublished += itemChunk.length;
          }
        } catch (pubErr) {
          console.warn('[Publish Map Chunk Warning]:', pubErr.message, 'Falling back to single map publishing.');
          for (const singleItem of itemChunk) {
            try {
              const singleRes = await fetch('/api/admin/library/battlemap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(singleItem),
              });
              const singleData = await safeJsonResponse(singleRes);
              if (singleData.success) {
                totalPublished++;
              }
            } catch (sPubErr) {
              console.error('[Single Map Publish Error]:', sPubErr.message);
            }
          }
        }
      }

      if (totalPublished > 0) {
        // Persist published battle maps to Firebase Firestore
        for (const item of itemsToPublish) {
          saveBattlemapToFirebase({
            ...item,
            id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            created_at: new Date().toISOString()
          }).catch(e => console.warn('[Firebase] Battle map batch save error:', e));
        }
        toast.success(`Published ${totalPublished} Battle Map(s) to Vault!`, { id: toastId });
        setMapName('');
        setMapUrl('');
        setMapDescription('');
        fetchLibraryData();
      } else {
        toast.error('Failed to save maps to database', { id: toastId });
      }
    } catch (err) {
      console.error('Batch map upload error:', err);
      toast.error('Map upload error: ' + err.message, { id: toastId });
    } finally {
      setIsUploadingMap(false);
      if (mapFileInputRef.current) mapFileInputRef.current.value = '';
    }
  };

  const handleBatchMapUpload = (e) => {
    processBatchMapFiles(e.target.files);
  };

  // Handle Add Single Battle Map
  const handleAddSingleMap = async (e) => {
    e?.preventDefault();
    if (!mapName.trim() || !mapUrl.trim()) {
      toast.error('Please specify map name and image URL or file');
      return;
    }

    try {
      const backendUrl = window.location.origin;
      const res = await fetch(`${backendUrl}/api/admin/library/battlemap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mapName.trim(),
          theme: mapTheme,
          url: mapUrl.trim(),
          description: mapDescription.trim() || `${mapTheme} Tactical Battle Map`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Sync to Firebase Firestore
        saveBattlemapToFirebase({
          id: `map_${Date.now()}`,
          name: mapName.trim(),
          theme: mapTheme,
          url: mapUrl.trim(),
          description: mapDescription.trim() || `${mapTheme} Tactical Battle Map`,
          created_at: new Date().toISOString()
        }).catch(e => console.warn('[Firebase] Map save note:', e));

        toast.success(`Published battle map "${mapName}" to Vault!`);
        setMapName('');
        setMapUrl('');
        setMapDescription('');
        if (mapFileInputRef.current) mapFileInputRef.current.value = '';
        fetchLibraryData();
      } else {
        toast.error(data.detail || 'Failed to add battle map');
      }
    } catch (err) {
      toast.error('Error adding battle map: ' + err.message);
    }
  };

  // Save Edit Item
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);

    try {
      const backendUrl = window.location.origin;
      const isMap = editingItem.type === 'map';
      const endpoint = isMap
        ? `${backendUrl}/api/admin/library/battlemap/${editingItem.id}`
        : `${backendUrl}/api/admin/library/clipart/${editingItem.id}`;

      const payload = isMap
        ? {
            name: editingItem.name,
            theme: editingItem.theme,
            url: editingItem.url,
            description: editingItem.description,
          }
        : {
            name: editingItem.name,
            category: editingItem.category,
            imageUrl: editingItem.imageUrl,
          };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (isMap) {
          saveBattlemapToFirebase({ ...editingItem, ...payload }).catch(e => console.warn(e));
        } else {
          saveTokenToFirebase({ ...editingItem, ...payload }).catch(e => console.warn(e));
        }
        toast.success(`Saved changes for "${editingItem.name}"`);
        setEditingItem(null);
        fetchLibraryData();
      } else {
        toast.error('Failed to save changes');
      }
    } catch (err) {
      toast.error('Save error: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Helper to persist deleted vault IDs (ID or exact URL only)
  const markVaultIdDeleted = (id, url) => {
    try {
      const existing = JSON.parse(localStorage.getItem('krajden_deleted_vault_ids') || '[]')
        .filter(x => typeof x === 'string' && (x.length > 5 || x.startsWith('admin_') || x.startsWith('vault_') || x.startsWith('map_') || x.startsWith('clipart_') || x.startsWith('token_') || x.startsWith('data:') || x.startsWith('http')));
      const newSet = new Set([
        ...existing,
        ...(id ? [id, String(id)] : []),
        ...(url ? [url] : [])
      ]);
      localStorage.setItem('krajden_deleted_vault_ids', JSON.stringify(Array.from(newSet)));
    } catch (e) {}
  };

  // --- Multi-Select Toggle & Batch Selection Helpers ---
  const toggleSelectClipart = (id) => {
    setSelectedClipartIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllCliparts = () => {
    if (selectedClipartIds.size === cliparts.length) {
      setSelectedClipartIds(new Set());
    } else {
      setSelectedClipartIds(new Set(cliparts.map((c) => c.id)));
    }
  };

  const toggleSelectMap = (id) => {
    setSelectedMapIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllMaps = () => {
    if (selectedMapIds.size === battlemaps.length) {
      setSelectedMapIds(new Set());
    } else {
      setSelectedMapIds(new Set(battlemaps.map((m) => m.id)));
    }
  };

  const toggleSelectEffect = (id) => {
    setSelectedEffectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllEffects = () => {
    if (selectedEffectIds.size === effects.length) {
      setSelectedEffectIds(new Set());
    } else {
      setSelectedEffectIds(new Set(effects.map((e) => e.id)));
    }
  };

  // --- Batch Delete Handlers (Delete from Firebase Firestore + Backend + Local Vault) ---

  const handleDeleteSelectedCliparts = async () => {
    if (selectedClipartIds.size === 0) {
      toast.info('No GIFs or tokens selected.');
      return;
    }
    const count = selectedClipartIds.size;
    setIsBatchDeleting(true);
    const toastId = toast.loading(`Deleting ${count} selected token(s) from Firebase & Library...`);

    try {
      const adminToken = localStorage.getItem('krajden_admin_token') || 'admin_vault_session_2026';
      const toDelete = cliparts.filter((c) => selectedClipartIds.has(c.id) || selectedClipartIds.has(String(c.id)));

      await Promise.allSettled(
        toDelete.map(async (item) => {
          const id = item.id;
          const url = item.imageUrl || item.url || item.imageData || item.src;
          const name = item.name;

          if (id) {
            try { await deleteTokenFromFirebase(id, url); } catch(e) {}
          }
          try {
            await fetch(`/api/admin/library/clipart/${encodeURIComponent(id || 'unknown')}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
              body: JSON.stringify({ url, name }),
            });
          } catch(e) {}

          markVaultIdDeleted(id, url);
        })
      );

      setCliparts((prev) => prev.filter((c) => !selectedClipartIds.has(c.id) && !selectedClipartIds.has(String(c.id))));
      setSelectedClipartIds(new Set());
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
      toast.success(`Deleted ${count} GIF(s)/token(s) permanently!`, { id: toastId });
    } catch (err) {
      toast.error('Batch delete error: ' + err.message, { id: toastId });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleDeleteSelectedMaps = async () => {
    if (selectedMapIds.size === 0) {
      toast.info('No battle maps selected.');
      return;
    }
    const count = selectedMapIds.size;
    setIsBatchDeleting(true);
    const toastId = toast.loading(`Deleting ${count} selected battle map(s) from Firebase & Library...`);

    try {
      const adminToken = localStorage.getItem('krajden_admin_token') || 'admin_vault_session_2026';
      const toDelete = battlemaps.filter((m) => selectedMapIds.has(m.id) || selectedMapIds.has(String(m.id)));

      await Promise.allSettled(
        toDelete.map(async (item) => {
          const id = item.id;
          const url = item.url || item.imageUrl;
          const name = item.name;

          if (id) {
            try { await deleteBattlemapFromFirebase(id, url); } catch(e) {}
          }
          try {
            await fetch(`/api/admin/library/battlemap/${encodeURIComponent(id || 'unknown')}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
              body: JSON.stringify({ url, name }),
            });
          } catch(e) {}

          markVaultIdDeleted(id, url);
        })
      );

      setBattlemaps((prev) => prev.filter((m) => !selectedMapIds.has(m.id) && !selectedMapIds.has(String(m.id))));
      setSelectedMapIds(new Set());
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
      toast.success(`Deleted ${count} battle map(s) permanently!`, { id: toastId });
    } catch (err) {
      toast.error('Batch delete error: ' + err.message, { id: toastId });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleDeleteSelectedEffects = async () => {
    if (selectedEffectIds.size === 0) {
      toast.info('No effects selected.');
      return;
    }
    const count = selectedEffectIds.size;
    setIsBatchDeleting(true);
    const toastId = toast.loading(`Deleting ${count} selected effect(s) from Firebase & Library...`);

    try {
      const adminToken = localStorage.getItem('krajden_admin_token') || 'admin_vault_session_2026';
      const toDelete = effects.filter((e) => selectedEffectIds.has(e.id) || selectedEffectIds.has(String(e.id)));

      await Promise.allSettled(
        toDelete.map(async (item) => {
          const id = item.id;
          const url = item.imageUrl || item.url;
          const name = item.name;

          if (id) {
            try { await deleteEffectFromFirebase(id, url); } catch(e) {}
          }
          try {
            await fetch(`/api/admin/library/effect/${encodeURIComponent(id || name)}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
              body: JSON.stringify({ url, name }),
            });
          } catch(e) {}

          markVaultIdDeleted(id, url);
        })
      );

      setEffects((prev) => prev.filter((e) => !selectedEffectIds.has(e.id) && !selectedEffectIds.has(String(e.id))));
      setSelectedEffectIds(new Set());
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
      toast.success(`Deleted ${count} effect(s) permanently!`, { id: toastId });
    } catch (err) {
      toast.error('Batch delete error: ' + err.message, { id: toastId });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // --- Single Item Delete Handlers (with Firebase & Library sync) ---

  // Handle Delete Clipart / GIF Token
  const handleDeleteClipart = async (itemOrId, nameArg) => {
    const item = typeof itemOrId === 'object' ? itemOrId : cliparts.find(c => c.id === itemOrId);
    const id = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId;
    const name = typeof itemOrId === 'object' ? itemOrId?.name : (nameArg || item?.name || 'Asset');
    const url = item ? (item.imageUrl || item.url || item.imageData || item.src) : null;

    const adminToken = localStorage.getItem('krajden_admin_token') || 'admin_vault_session_2026';

    try {
      if (id) {
        await deleteTokenFromFirebase(id, url).catch(e => console.warn('[Firebase] delete error:', e));
      }
      try {
        await fetch(`/api/admin/library/clipart/${encodeURIComponent(id || 'unknown')}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ url, name }),
        });
      } catch(e) {}

      markVaultIdDeleted(id, url);
      setCliparts((prev) => prev.filter((i) => {
        if (!i) return false;
        if (id && (i.id === id || String(i.id) === String(id))) return false;
        if (url && (i.imageUrl === url || i.url === url)) return false;
        return true;
      }));
      setSelectedClipartIds((prev) => {
        const next = new Set(prev);
        if (id) next.delete(id);
        return next;
      });
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
      toast.success(`Deleted "${name}" from Firebase and Vault Library`);
    } catch (err) {
      toast.error('Delete error: ' + err.message);
    }
  };

  // Handle Delete Battle Map
  const handleDeleteMap = async (itemOrId, nameArg) => {
    const item = typeof itemOrId === 'object' ? itemOrId : battlemaps.find(m => m.id === itemOrId);
    const id = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId;
    const name = typeof itemOrId === 'object' ? itemOrId?.name : (nameArg || item?.name || 'Battle Map');
    const url = item ? (item.url || item.imageUrl) : null;

    const adminToken = localStorage.getItem('krajden_admin_token') || 'admin_vault_session_2026';

    try {
      if (id) {
        await deleteBattlemapFromFirebase(id, url).catch(e => console.warn('[Firebase] delete error:', e));
      }
      try {
        await fetch(`/api/admin/library/battlemap/${encodeURIComponent(id || 'unknown')}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ url, name }),
        });
      } catch(e) {}

      markVaultIdDeleted(id, url);
      setBattlemaps((prev) => prev.filter((i) => {
        if (!i) return false;
        if (id && (i.id === id || String(i.id) === String(id))) return false;
        if (url && (i.url === url || i.imageUrl === url)) return false;
        return true;
      }));
      setSelectedMapIds((prev) => {
        const next = new Set(prev);
        if (id) next.delete(id);
        return next;
      });
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
      toast.success(`Deleted battle map "${name}" from Firebase & Library`);
    } catch (err) {
      toast.error('Delete error: ' + err.message);
    }
  };

  // Handle Delete Effect
  const handleDeleteEffect = async (itemOrId, nameArg) => {
    const item = typeof itemOrId === 'object' ? itemOrId : effects.find(e => e.id === itemOrId);
    const id = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId;
    const name = typeof itemOrId === 'object' ? itemOrId?.name : (nameArg || item?.name || 'Effect');
    const url = item ? (item.imageUrl || item.url) : null;

    const adminToken = localStorage.getItem('krajden_admin_token') || 'admin_vault_session_2026';

    try {
      if (id) {
        await deleteEffectFromFirebase(id, url).catch(e => console.warn('[Firebase] delete error:', e));
      }
      try {
        await fetch(`/api/admin/library/effect/${encodeURIComponent(id || name)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ url, name }),
        });
      } catch(e) {}

      markVaultIdDeleted(id, url);
      setEffects((prev) => prev.filter((i) => {
        if (!i) return false;
        if (id && (i.id === id || String(i.id) === String(id))) return false;
        if (url && (i.imageUrl === url || i.url === url)) return false;
        return true;
      }));
      setSelectedEffectIds((prev) => {
        const next = new Set(prev);
        if (id) next.delete(id);
        return next;
      });
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
      toast.success(`Deleted effect "${name}" from Firebase & Library`);
    } catch (err) {
      toast.error('Delete error: ' + err.message);
    }
  };

  // Handle Upload Single Effect
  const handleSingleEffectUpload = async (e) => {
    e.preventDefault();
    if (!effectName.trim()) {
      toast.error('Please enter an effect name');
      return;
    }
    const file = effectFileInputRef.current?.files?.[0];
    if (!file && !effectUrl.trim()) {
      toast.error('Please select a video/GIF file or enter an Effect URL');
      return;
    }

    setIsUploadingEffect(true);
    try {
      const backendUrl = window.location.origin;
      const adminToken = localStorage.getItem('krajden_admin_token') || 'admin_vault_session_2026';
      const formData = new FormData();
      formData.append('name', effectName.trim());
      formData.append('category', effectCategory);
      if (file) formData.append('file', file);
      if (effectUrl.trim()) formData.append('imageUrl', effectUrl.trim());

      const res = await fetch(`${backendUrl}/api/admin/library/effect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        saveEffectToFirebase({
          id: `eff_${Date.now()}`,
          name: effectName.trim(),
          category: effectCategory,
          imageUrl: data.url || effectUrl.trim(),
          tags: [effectCategory, 'admin_uploaded'],
          created_at: new Date().toISOString()
        }).catch(e => console.warn('[Firebase] effect save note:', e));

        toast.success(`Uploaded effect "${effectName}"`);
        setEffectName('');
        setEffectUrl('');
        if (effectFileInputRef.current) effectFileInputRef.current.value = '';
        fetchLibraryData();
      } else {
        toast.error('Failed to upload effect');
      }
    } catch (err) {
      toast.error('Upload error: ' + err.message);
    } finally {
      setIsUploadingEffect(false);
    }
  };

  // Handle Clear All Vault Cliparts/Tokens
  const handleClearAllCliparts = async () => {
    try {
      const backendUrl = window.location.origin;
      const adminToken = localStorage.getItem('krajden_admin_token') || '';
      const res = await fetch(`${backendUrl}/api/admin/library/cliparts/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (res.ok) {
        toast.success("Cleared all vault tokens!");
        setCliparts([]);
        localStorage.setItem('krajden_vault_cleared', 'true');
        window.dispatchEvent(new CustomEvent('krajden_library_updated'));
      } else {
        toast.error('Failed to clear vault');
      }
    } catch (err) {
      toast.error('Clear error: ' + err.message);
    }
  };

  // Handle Reseed Default Vault Cliparts/Tokens
  const handleReseedVault = async () => {
    try {
      const backendUrl = window.location.origin;
      const res = await fetch(`${backendUrl}/api/admin/library/cliparts/reseed`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Restored ${data.count || 0} default vault tokens!`);
        localStorage.removeItem('krajden_vault_cleared');
        fetchLibraryItems();
        window.dispatchEvent(new CustomEvent('krajden_library_updated'));
      } else {
        toast.error('Failed to restore default vault');
      }
    } catch (err) {
      toast.error('Reseed error: ' + err.message);
    }
  };

  // Explicit Upload & Sync to Firebase for Category
  const handleSyncCategoryToFirebase = async (catType) => {
    setIsSyncingFirebase(true);
    const toastId = toast.loading(`Uploading & syncing ${catType.toUpperCase()} category to Firebase Firestore...`);

    try {
      let count = 0;
      let errors = 0;
      if (catType === 'gifs') {
        const itemsToSave = cliparts.length > 0 ? cliparts : [];
        for (let i = 0; i < itemsToSave.length; i++) {
          const item = itemsToSave[i];
          const docId = String(item.id || `token_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
          try {
            await saveTokenToFirebase({
              ...item,
              id: docId,
              imageUrl: item.imageUrl || item.url,
              isVault: true,
              created_at: item.created_at || new Date().toISOString()
            });
            count++;
          } catch (e) {
            console.warn(`[Firebase Token Sync Warning] ${item.name || docId}:`, e.message);
            errors++;
          }
          if ((i + 1) % 5 === 0 || i === itemsToSave.length - 1) {
            toast.loading(`Syncing tokens (${i + 1}/${itemsToSave.length})...`, { id: toastId });
          }
        }
        toast.success(`☁️ Uploaded & synced ${count} Token(s) to Firebase! Saved in /tokens and live in App Library.${errors > 0 ? ` (${errors} skipped)` : ''}`, { id: toastId, duration: 5000 });
      } else if (catType === 'maps') {
        const itemsToSave = battlemaps.length > 0 ? battlemaps : [];
        for (let i = 0; i < itemsToSave.length; i++) {
          const map = itemsToSave[i];
          const docId = String(map.id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
          try {
            await saveBattlemapToFirebase({
              ...map,
              id: docId,
              url: map.url || map.imageUrl,
              created_at: map.created_at || new Date().toISOString()
            });
            count++;
          } catch (e) {
            console.warn(`[Firebase Battlemap Sync Warning] ${map.name || docId}:`, e.message);
            errors++;
          }
          if ((i + 1) % 5 === 0 || i === itemsToSave.length - 1) {
            toast.loading(`Syncing battle maps (${i + 1}/${itemsToSave.length})...`, { id: toastId });
          }
        }
        toast.success(`☁️ Uploaded & synced ${count} Battle Map(s) to Firebase! Saved in /battlemaps and live in App Library.${errors > 0 ? ` (${errors} skipped)` : ''}`, { id: toastId, duration: 5000 });
      } else if (catType === 'effects') {
        const itemsToSave = effects.length > 0 ? effects : [];
        for (let i = 0; i < itemsToSave.length; i++) {
          const eff = itemsToSave[i];
          const docId = String(eff.id || `eff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
          try {
            await saveEffectToFirebase({
              ...eff,
              id: docId,
              imageUrl: eff.imageUrl || eff.url,
              created_at: eff.created_at || new Date().toISOString()
            });
            count++;
          } catch (e) {
            console.warn(`[Firebase Effect Sync Warning] ${eff.name || docId}:`, e.message);
            errors++;
          }
          if ((i + 1) % 5 === 0 || i === itemsToSave.length - 1) {
            toast.loading(`Syncing visual effects (${i + 1}/${itemsToSave.length})...`, { id: toastId });
          }
        }
        toast.success(`☁️ Uploaded & synced ${count} Visual Effect(s) to Firebase! Saved in /effects and live in App Library.${errors > 0 ? ` (${errors} skipped)` : ''}`, { id: toastId, duration: 5000 });
      }
      window.dispatchEvent(new CustomEvent('krajden_library_updated'));
    } catch (err) {
      console.error('[Firebase Sync Error]:', err);
      toast.error(`Firebase upload error: ${err.message || 'Check connection'}`, { id: toastId });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
      data-testid="admin-secret-modal-backdrop"
    >
      <div
        className="bg-[#0b0c10] border border-border-gold/30 rounded-2xl w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden text-white"
        data-testid="admin-secret-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-gold/20 bg-[#07080b]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-gold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-widest font-cinzel text-white uppercase">
                  Asset Vault & Manager
                </h2>
                <Badge
                  variant="outline"
                  className="border-gold/40 text-gold bg-gold/10 text-[9px] font-mono px-2 py-0.5"
                >
                  ADMIN
                </Badge>
              </div>
              <p className="text-[11px] text-slate-cool font-sans">
                Batch upload GIFs, tokens, and battle maps using their original filenames, or edit existing assets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-cool hover:text-white transition-colors"
            data-testid="close-admin-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        {!isAuthenticated ? (
          /* Login Screen */
          <div className="p-8 max-w-md mx-auto w-full my-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/30 mx-auto flex items-center justify-center glow-gold-leak">
              <Lock className="w-8 h-8 text-gold" />
            </div>

            <div>
              <h3 className="text-lg font-bold font-cinzel tracking-wider text-white uppercase mb-2">
                Asset Vault Access
              </h3>
              <p className="text-xs text-slate-cool leading-relaxed">
                Enter your passphrase to access the batch asset manager.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-gold font-mono mb-1.5 block">
                  Vault Passphrase
                </Label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-muted absolute left-3 top-3" />
                  <Input
                    type="password"
                    placeholder="Enter passphrase..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-black/60 border-white/10 text-white placeholder:text-slate-muted focus:border-gold"
                    autoFocus
                  />
                </div>
                {loginError && (
                  <p className="text-[11px] text-red-400 mt-2 font-mono">{loginError}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoggingIn || !password.trim()}
                className="w-full bg-gold hover:bg-gold-light text-black font-bold h-11 text-xs tracking-widest uppercase transition-all rounded-xl shadow-lg shadow-gold/10"
              >
                {isLoggingIn ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Unlocking Vault...</>
                ) : (
                  <><Unlock className="w-4 h-4 mr-2" /> Unlock Vault</>
                )}
              </Button>
            </form>
          </div>
        ) : (
          /* Admin Dashboard Content */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Navigation Tabs */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('gifs')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-cinzel tracking-wider transition-all flex items-center gap-2 ${
                    activeTab === 'gifs'
                      ? 'bg-gold text-black shadow-md'
                      : 'text-slate-cool hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  GIFs & Tokens ({cliparts.length})
                </button>
                <button
                  onClick={() => setActiveTab('maps')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-cinzel tracking-wider transition-all flex items-center gap-2 ${
                    activeTab === 'maps'
                      ? 'bg-gold text-black shadow-md'
                      : 'text-slate-cool hover:text-white hover:bg-white/5'
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  Battle Maps ({battlemaps.length})
                </button>
                <button
                  onClick={() => setActiveTab('effects')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-cinzel tracking-wider transition-all flex items-center gap-2 ${
                    activeTab === 'effects'
                      ? 'bg-gold text-black shadow-md'
                      : 'text-slate-cool hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  Effects ({effects.length})
                </button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-xs text-slate-cool hover:text-red-400 font-mono"
              >
                Lock & Exit Vault
              </Button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {activeTab === 'gifs' ? (
                /* GIFs & Animated Tokens Tab */
                <div className="space-y-6">
                  {/* Firebase Cloud Sync & Status Bar for Tokens */}
                  <div className="bg-gradient-to-r from-[#0d1f14] via-[#09150d] to-[#0d1f14] border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
                        <Cloud className="w-5 h-5 text-emerald-400 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold font-cinzel text-emerald-300 uppercase tracking-wider">
                            Firebase Firestore Cloud Storage (Tokens & Cliparts)
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ● Live in /tokens
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Total Vault Tokens: <strong className="text-white">{cliparts.length}</strong>. Click the button to upload and verify all tokens to Firebase so they are instantly accessible in the app's library.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      disabled={isSyncingFirebase}
                      onClick={() => handleSyncCategoryToFirebase('gifs')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs uppercase tracking-wider px-4 shrink-0 gap-2 shadow-md hover:shadow-emerald-500/20 cursor-pointer"
                    >
                      {isSyncingFirebase ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading to Firebase...</>
                      ) : (
                        <><Cloud className="w-4 h-4" /> Upload to Firebase</>
                      )}
                    </Button>
                  </div>

                  {/* Batch & Single Upload Box */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOverGif(true);
                    }}
                    onDragLeave={() => setIsDragOverGif(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOverGif(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        processBatchGifFiles(e.dataTransfer.files);
                      }
                    }}
                    className={`bg-panel/80 border rounded-2xl p-6 space-y-5 transition-all ${
                      isDragOverGif
                        ? 'border-gold bg-gold/10 ring-2 ring-gold/40'
                        : 'border-[#caa055]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderPlus className="w-5 h-5 text-gold" />
                        <h3 className="text-sm font-bold font-cinzel tracking-wider uppercase text-white">
                          Batch Upload GIFs or Tokens
                        </h3>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-gold/30 text-gold font-mono">
                        Auto-titles from filenames
                      </Badge>
                    </div>

                    {/* Drag & Drop Visual Box */}
                    <div
                      onClick={() => gifFileInputRef.current?.click()}
                      className="border-2 border-dashed border-white/20 hover:border-gold/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-black/40 hover:bg-black/60 group"
                    >
                      <Upload className="w-8 h-8 text-gold mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-white font-cinzel uppercase tracking-wider">
                        Drag & Drop GIF / Token files here, or Click to Browse
                      </p>
                      <p className="text-[10px] text-slate-cool mt-1">
                        Select multiple files (.gif, .png, .jpg, .webp). Asset titles will auto-format from filenames.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Target Category for Batch */}
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-slate-cool font-mono mb-1 block">
                          Category for Uploads *
                        </Label>
                        <select
                          value={gifCategory}
                          onChange={(e) => setGifCategory(e.target.value)}
                          className="w-full h-9 rounded-md bg-black/60 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-gold"
                        >
                          <option value="animated_fx">Animated FX (Spells / Fire / Teleport)</option>
                          <option value="dnd_heroes">Hero Tokens</option>
                          <option value="dnd_monsters">Monster Tokens</option>
                          <option value="dnd_dungeon">Dungeon Props</option>
                          <option value="dnd_conditions">5e Conditions</option>
                        </select>
                      </div>

                      {/* File Batch Input */}
                      <div className="flex flex-col justify-end">
                        <input
                          type="file"
                          ref={gifFileInputRef}
                          multiple
                          accept="image/*,.gif,.webp"
                          onChange={handleBatchGifUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          onClick={() => gifFileInputRef.current?.click()}
                          disabled={isUploadingGif}
                          className="bg-gold hover:bg-gold-light text-black font-bold h-9 text-xs uppercase tracking-wider gap-2 shadow-lg shadow-gold/10"
                        >
                          {isUploadingGif ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Batch Uploading & Locking...</>
                          ) : (
                            <><Upload className="w-4 h-4" /> Save Forever in Vault (Upload Files)</>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Single URL option */}
                    <div className="border-t border-white/10 pt-4 mt-2">
                      <Label className="text-[11px] uppercase tracking-wider text-slate-muted font-mono mb-1.5 block">
                        Or Add Single Asset via URL:
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          placeholder="Asset Title (optional)..."
                          value={gifName}
                          onChange={(e) => setGifName(e.target.value)}
                          className="bg-black/60 border-white/10 text-white text-xs w-1/3"
                        />
                        <Input
                          placeholder="Image/GIF URL..."
                          value={gifUrl}
                          onChange={(e) => setGifUrl(e.target.value)}
                          className="bg-black/60 border-white/10 text-white text-xs flex-1"
                        />
                        <Button
                          onClick={handleAddSingleGif}
                          disabled={!gifUrl.trim()}
                          size="sm"
                          className="bg-white/10 hover:bg-gold hover:text-black text-white font-bold text-xs shrink-0"
                        >
                          Add URL
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Active Library Items Grid */}
                  <div>
                    {/* Multi-Select & Batch Action Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-black/40 border border-white/10 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          onClick={handleSelectAllCliparts}
                          size="sm"
                          variant="outline"
                          className="border-white/20 hover:border-gold text-white text-xs font-mono flex items-center gap-1.5 h-8"
                        >
                          {selectedClipartIds.size === cliparts.length && cliparts.length > 0 ? (
                            <><CheckSquare className="w-3.5 h-3.5 text-gold" /> Deselect All</>
                          ) : (
                            <><Square className="w-3.5 h-3.5 text-slate-400" /> Select All ({cliparts.length})</>
                          )}
                        </Button>
                        <span className="text-xs font-cinzel font-bold text-gold uppercase tracking-wider">
                          Vault GIFs & Tokens ({cliparts.length})
                        </span>
                        {selectedClipartIds.size > 0 && (
                          <Badge className="bg-red-600 text-white font-mono text-[10px]">
                            {selectedClipartIds.size} Selected
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedClipartIds.size > 0 && (
                          <Button
                            type="button"
                            onClick={handleDeleteSelectedCliparts}
                            disabled={isBatchDeleting}
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5 h-8 shadow-md hover:shadow-red-500/30 cursor-pointer animate-pulse"
                          >
                            {isBatchDeleting ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</>
                            ) : (
                              <><Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedClipartIds.size}) from Firebase & Library</>
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={handleReseedVault}
                          size="sm"
                          variant="outline"
                          className="border-gold/30 text-gold hover:bg-gold/10 text-xs font-bold gap-1.5 h-8"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Restore Presets
                        </Button>
                        <Button
                          onClick={handleClearAllCliparts}
                          size="sm"
                          variant="destructive"
                          className="bg-red-950/80 hover:bg-red-800 text-red-200 text-xs font-bold gap-1.5 border border-red-500/40 shadow-sm h-8"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          Clear All
                        </Button>
                      </div>
                    </div>

                    {isLoadingLibrary ? (
                      <div className="py-12 text-center text-slate-cool">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gold" />
                        Loading vault assets...
                      </div>
                    ) : cliparts.length === 0 ? (
                      <div className="p-8 border border-white/5 rounded-2xl bg-black/40 text-center text-slate-muted text-xs">
                        No custom GIFs or tokens in the vault. Use the batch upload above to publish your assets!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {cliparts.map((item) => {
                          const isSelected = selectedClipartIds.has(item.id);
                          return (
                            <div
                              key={item.id}
                              className={`bg-panel border rounded-xl p-3 flex flex-col justify-between transition-all group relative cursor-pointer ${
                                isSelected
                                  ? 'border-red-500 ring-2 ring-red-500/80 bg-red-950/30'
                                  : 'border-white/10 hover:border-gold/40'
                              }`}
                              onClick={() => toggleSelectClipart(item.id)}
                            >
                              {/* Selection Checkbox Pill */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectClipart(item.id);
                                }}
                                className="absolute top-2 left-2 z-10 p-1 rounded-md bg-black/80 hover:bg-black border border-white/20 transition-all cursor-pointer"
                                title="Select item for batch delete"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-red-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 group-hover:text-gold" />
                                )}
                              </div>

                              <div className="w-full aspect-square rounded-lg bg-black/60 border border-white/5 overflow-hidden flex items-center justify-center p-2 mb-2 relative">
                                <img
                                  src={item.imageUrl || item.url || item.imageData || item.image_data || item.src}
                                  alt={item.name}
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-white truncate" title={item.name}>{item.name}</p>
                                <Badge variant="outline" className="text-[9px] border-gold/30 text-gold bg-gold/5 font-mono">
                                  {item.category}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() =>
                                    setEditingItem({
                                      id: item.id,
                                      name: item.name,
                                      category: item.category,
                                      imageUrl: item.imageUrl,
                                      type: 'gif',
                                    })
                                  }
                                  className="flex-1 py-1.5 bg-white/5 hover:bg-gold hover:text-black text-slate-cool rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteClipart(item)}
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] transition-colors cursor-pointer"
                                  title="Delete from Firebase and Vault Library"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'maps' ? (
                /* Battle Maps Tab */
                <div className="space-y-6">
                  {/* Firebase Cloud Sync & Status Bar for Battle Maps */}
                  <div className="bg-gradient-to-r from-[#0d1f14] via-[#09150d] to-[#0d1f14] border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
                        <Cloud className="w-5 h-5 text-emerald-400 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold font-cinzel text-emerald-300 uppercase tracking-wider">
                            Firebase Firestore Cloud Storage (Battle Maps)
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ● Live in /battlemaps
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Total Vault Maps: <strong className="text-white">{battlemaps.length}</strong>. Click the button to upload and verify all battle maps to Firebase so they are instantly accessible in the app's library.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      disabled={isSyncingFirebase}
                      onClick={() => handleSyncCategoryToFirebase('maps')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs uppercase tracking-wider px-4 shrink-0 gap-2 shadow-md hover:shadow-emerald-500/20 cursor-pointer"
                    >
                      {isSyncingFirebase ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading to Firebase...</>
                      ) : (
                        <><Cloud className="w-4 h-4" /> Upload to Firebase</>
                      )}
                    </Button>
                  </div>

                  {/* Batch Upload Battle Maps Box */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOverMap(true);
                    }}
                    onDragLeave={() => setIsDragOverMap(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOverMap(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        processBatchMapFiles(e.dataTransfer.files);
                      }
                    }}
                    className={`bg-panel/80 border rounded-2xl p-6 space-y-5 transition-all ${
                      isDragOverMap
                        ? 'border-gold bg-gold/10 ring-2 ring-gold/40'
                        : 'border-[#caa055]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-gold" />
                        <h3 className="text-sm font-bold font-cinzel tracking-wider uppercase text-white">
                          Batch Upload Battle Maps
                        </h3>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-gold/30 text-gold font-mono">
                        VTT Background Maps
                      </Badge>
                    </div>

                    {/* Drag & Drop Visual Box */}
                    <div
                      onClick={() => mapFileInputRef.current?.click()}
                      className="border-2 border-dashed border-white/20 hover:border-gold/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-black/40 hover:bg-black/60 group"
                    >
                      <MapIcon className="w-8 h-8 text-gold mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-white font-cinzel uppercase tracking-wider">
                        Drag & Drop Battle Map files here, or Click to Browse
                      </p>
                      <p className="text-[10px] text-slate-cool mt-1">
                        Select multiple map image files (.jpg, .png, .webp). Map titles auto-format from filenames.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Theme Selector */}
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-slate-cool font-mono mb-1 block">
                          Theme / Environment *
                        </Label>
                        <select
                          value={mapTheme}
                          onChange={(e) => setMapTheme(e.target.value)}
                          className="w-full h-9 rounded-md bg-black/60 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-gold"
                        >
                          <option value="Dungeon">Dungeon</option>
                          <option value="Forest">Forest</option>
                          <option value="Tavern">Tavern</option>
                          <option value="Desert">Desert</option>
                          <option value="Castle">Castle</option>
                          <option value="Sci-Fi">Sci-Fi</option>
                          <option value="Underdark">Underdark</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>

                      {/* Batch Choose Button */}
                      <div className="flex flex-col justify-end">
                        <input
                          type="file"
                          ref={mapFileInputRef}
                          multiple
                          accept="image/*"
                          onChange={handleBatchMapUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          onClick={() => mapFileInputRef.current?.click()}
                          disabled={isUploadingMap}
                          className="bg-gold hover:bg-gold-light text-black font-bold h-9 text-xs uppercase tracking-wider gap-2 shadow-lg shadow-gold/10"
                        >
                          {isUploadingMap ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Batch Uploading Maps...</>
                          ) : (
                            <><Upload className="w-4 h-4" /> Choose & Batch Upload Maps</>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Single URL Option */}
                    <div className="border-t border-white/10 pt-4 mt-2">
                      <Label className="text-[11px] uppercase tracking-wider text-slate-muted font-mono mb-1.5 block">
                        Or Add Single Map via URL:
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          placeholder="Map Title..."
                          value={mapName}
                          onChange={(e) => setMapName(e.target.value)}
                          className="bg-black/60 border-white/10 text-white text-xs w-1/3"
                        />
                        <Input
                          placeholder="Map Image URL..."
                          value={mapUrl}
                          onChange={(e) => setMapUrl(e.target.value)}
                          className="bg-black/60 border-white/10 text-white text-xs flex-1"
                        />
                        <Button
                          onClick={handleAddSingleMap}
                          disabled={!mapUrl.trim() || !mapName.trim()}
                          size="sm"
                          className="bg-white/10 hover:bg-gold hover:text-black text-white font-bold text-xs shrink-0"
                        >
                          Add Map
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Active Battle Maps Grid */}
                  <div>
                    {/* Multi-Select & Batch Action Toolbar for Battle Maps */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-black/40 border border-white/10 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          onClick={handleSelectAllMaps}
                          size="sm"
                          variant="outline"
                          className="border-white/20 hover:border-gold text-white text-xs font-mono flex items-center gap-1.5 h-8"
                        >
                          {selectedMapIds.size === battlemaps.length && battlemaps.length > 0 ? (
                            <><CheckSquare className="w-3.5 h-3.5 text-gold" /> Deselect All</>
                          ) : (
                            <><Square className="w-3.5 h-3.5 text-slate-400" /> Select All ({battlemaps.length})</>
                          )}
                        </Button>
                        <h4 className="text-xs font-bold font-cinzel tracking-widest text-gold uppercase">
                          Global Vault Battle Maps ({battlemaps.length})
                        </h4>
                        {selectedMapIds.size > 0 && (
                          <Badge className="bg-red-600 text-white font-mono text-[10px]">
                            {selectedMapIds.size} Selected
                          </Badge>
                        )}
                      </div>

                      {selectedMapIds.size > 0 && (
                        <Button
                          type="button"
                          onClick={handleDeleteSelectedMaps}
                          disabled={isBatchDeleting}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5 h-8 shadow-md hover:shadow-red-500/30 cursor-pointer animate-pulse"
                        >
                          {isBatchDeleting ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</>
                          ) : (
                            <><Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedMapIds.size}) from Firebase & Library</>
                          )}
                        </Button>
                      )}
                    </div>

                    {isLoadingLibrary ? (
                      <div className="py-12 text-center text-slate-cool">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gold" />
                        Loading battle maps...
                      </div>
                    ) : battlemaps.length === 0 ? (
                      <div className="p-8 border border-white/5 rounded-2xl bg-black/40 text-center text-slate-muted text-xs">
                        No custom battle maps uploaded yet. Use the batch button above to publish your first maps!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {battlemaps.map((map) => {
                          const isSelected = selectedMapIds.has(map.id);
                          return (
                            <div
                              key={map.id}
                              className={`bg-panel border rounded-xl overflow-hidden transition-all flex flex-col justify-between cursor-pointer group relative ${
                                isSelected
                                  ? 'border-red-500 ring-2 ring-red-500/80 bg-red-950/30'
                                  : 'border-white/10 hover:border-gold/40'
                              }`}
                              onClick={() => toggleSelectMap(map.id)}
                            >
                              {/* Selection Checkbox */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectMap(map.id);
                                }}
                                className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-black/80 hover:bg-black border border-white/20 transition-all cursor-pointer"
                                title="Select battle map for batch delete"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-red-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 group-hover:text-gold" />
                                )}
                              </div>

                              <div className="w-full h-32 bg-black relative">
                                <img
                                  src={map.url}
                                  alt={map.name}
                                  className="w-full h-full object-cover"
                                />
                                <Badge className="absolute top-2 left-2 bg-black/80 border border-gold/40 text-gold text-[9px] font-mono">
                                  {map.theme}
                                </Badge>
                              </div>
                              <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                                <div>
                                  <p className="text-xs font-bold text-white truncate">{map.name}</p>
                                  <p className="text-[10px] text-slate-cool line-clamp-2 mt-0.5">
                                    {map.description}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() =>
                                      setEditingItem({
                                        id: map.id,
                                        name: map.name,
                                        theme: map.theme,
                                        url: map.url,
                                        description: map.description,
                                        type: 'map',
                                      })
                                    }
                                    className="flex-1 py-1.5 bg-white/5 hover:bg-gold hover:text-black text-slate-cool rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMap(map)}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] transition-colors cursor-pointer"
                                    title="Delete from Firebase and App Library"
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
              ) : (
                /* Animated Effects Tab */
                <div className="space-y-6">
                  {/* Firebase Cloud Sync & Status Bar for Effects */}
                  <div className="bg-gradient-to-r from-[#0d1f14] via-[#09150d] to-[#0d1f14] border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
                        <Cloud className="w-5 h-5 text-emerald-400 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold font-cinzel text-emerald-300 uppercase tracking-wider">
                            Firebase Firestore Cloud Storage (Visual Effects)
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ● Live in /effects
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Total Vault Effects: <strong className="text-white">{effects.length}</strong>. Click the button to upload and verify all visual effects to Firebase so they are instantly accessible in the app's library.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      disabled={isSyncingFirebase}
                      onClick={() => handleSyncCategoryToFirebase('effects')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs uppercase tracking-wider px-4 shrink-0 gap-2 shadow-md hover:shadow-emerald-500/20 cursor-pointer"
                    >
                      {isSyncingFirebase ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading to Firebase...</>
                      ) : (
                        <><Cloud className="w-4 h-4" /> Upload to Firebase</>
                      )}
                    </Button>
                  </div>

                  {/* Single Effect Upload Box */}
                  <div className="p-4 bg-black/60 border border-white/10 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                      <Zap className="w-4 h-4 text-gold" />
                      <h3 className="text-xs font-bold font-cinzel text-white uppercase tracking-wider">
                        Upload Vault Effect (GIF / Video)
                      </h3>
                    </div>

                    <form onSubmit={handleSingleEffectUpload} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-slate-cool font-mono mb-1 block">
                          Effect Title
                        </Label>
                        <Input
                          placeholder="e.g. Raging Firestorm"
                          value={effectName}
                          onChange={(e) => setEffectName(e.target.value)}
                          className="bg-black/60 border-white/10 text-xs text-white placeholder:text-slate-muted"
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-slate-cool font-mono mb-1 block">
                          Category
                        </Label>
                        <select
                          value={effectCategory}
                          onChange={(e) => setEffectCategory(e.target.value)}
                          className="w-full h-9 rounded-md bg-black/60 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-gold"
                        >
                          <option value="nature">Nature / Weather</option>
                          <option value="elemental">Elemental / Magic</option>
                          <option value="fire">Fire / Lava</option>
                          <option value="water">Water / Ocean</option>
                          <option value="dungeon">Dungeon / Smoke</option>
                        </select>
                      </div>

                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-slate-cool font-mono mb-1 block">
                          Video or GIF File
                        </Label>
                        <input
                          ref={effectFileInputRef}
                          type="file"
                          accept="image/gif,video/mp4,video/webm,.gif"
                          className="w-full text-xs text-slate-cool file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-white/10 file:text-white file:text-xs hover:file:bg-white/20 cursor-pointer"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-cool font-mono mb-1 block">
                          OR Effect URL (.gif, .mp4, data URI)
                        </Label>
                        <Input
                          placeholder="https://example.com/river_effect.gif"
                          value={effectUrl}
                          onChange={(e) => setEffectUrl(e.target.value)}
                          className="bg-black/60 border-white/10 text-xs text-white placeholder:text-slate-muted"
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="submit"
                          disabled={isUploadingEffect}
                          className="w-full bg-gold hover:bg-gold-light text-black font-bold h-9 text-xs tracking-wider uppercase transition-all rounded-xl"
                        >
                          {isUploadingEffect ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Uploading...</>
                          ) : (
                            <><Upload className="w-3.5 h-3.5 mr-2" /> Upload Effect</>
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Effects List Grid */}
                  <div className="space-y-3">
                    {/* Multi-Select Toolbar for Effects */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-black/40 border border-white/10 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          onClick={handleSelectAllEffects}
                          size="sm"
                          variant="outline"
                          className="border-white/20 hover:border-gold text-white text-xs font-mono flex items-center gap-1.5 h-8"
                        >
                          {selectedEffectIds.size === effects.length && effects.length > 0 ? (
                            <><CheckSquare className="w-3.5 h-3.5 text-gold" /> Deselect All</>
                          ) : (
                            <><Square className="w-3.5 h-3.5 text-slate-400" /> Select All ({effects.length})</>
                          )}
                        </Button>
                        <h3 className="text-xs font-bold font-cinzel text-white uppercase tracking-wider">
                          Vault Effects ({effects.length})
                        </h3>
                        {selectedEffectIds.size > 0 && (
                          <Badge className="bg-red-600 text-white font-mono text-[10px]">
                            {selectedEffectIds.size} Selected
                          </Badge>
                        )}
                      </div>

                      {selectedEffectIds.size > 0 && (
                        <Button
                          type="button"
                          onClick={handleDeleteSelectedEffects}
                          disabled={isBatchDeleting}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5 h-8 shadow-md hover:shadow-red-500/30 cursor-pointer animate-pulse"
                        >
                          {isBatchDeleting ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</>
                          ) : (
                            <><Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedEffectIds.size}) from Firebase & Library</>
                          )}
                        </Button>
                      )}
                    </div>

                    {effects.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-black/20 space-y-2">
                        <Zap className="w-8 h-8 text-slate-muted mx-auto" />
                        <p className="text-xs text-slate-cool font-medium">No vault effects saved yet.</p>
                        <p className="text-[11px] text-slate-muted">Upload GIF/video clips above to populate the Effects tool.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {effects.map((effect) => {
                          const isSelected = selectedEffectIds.has(effect.id);
                          return (
                            <div
                              key={effect.id}
                              className={`bg-black/40 border rounded-xl overflow-hidden group transition-all flex flex-col cursor-pointer relative ${
                                isSelected
                                  ? 'border-red-500 ring-2 ring-red-500/80 bg-red-950/30'
                                  : 'border-white/10 hover:border-gold/40'
                              }`}
                              onClick={() => toggleSelectEffect(effect.id)}
                            >
                              {/* Selection Checkbox */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectEffect(effect.id);
                                }}
                                className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-black/80 hover:bg-black border border-white/20 transition-all cursor-pointer"
                                title="Select effect for batch delete"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-red-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 group-hover:text-gold" />
                                )}
                              </div>

                              <div className="aspect-video relative bg-black/60 overflow-hidden flex items-center justify-center">
                                {effect.imageUrl?.includes('video/mp4') || effect.imageUrl?.endsWith('.mp4') ? (
                                  <video src={effect.imageUrl} autoPlay loop muted className="w-full h-full object-cover" />
                                ) : (
                                  <img src={effect.imageUrl || effect.url} alt={effect.name} className="w-full h-full object-cover" />
                                )}
                                <span className="absolute top-1.5 left-1.5 bg-black/80 text-gold text-[8px] font-mono px-1.5 py-0.5 rounded uppercase">
                                  {effect.category || 'Effect'}
                                </span>
                              </div>

                              <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                                <div>
                                  <p className="text-xs font-bold text-white truncate">{effect.name}</p>
                                </div>

                                <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleDeleteEffect(effect)}
                                    className="w-full py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    title="Delete from Firebase and App Library"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete Effect
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
              )}
            </div>
          </div>
        )}

        {/* Edit Item Modal Overlay */}
        {editingItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0e0f14] border border-gold/40 rounded-2xl w-full max-w-md p-6 space-y-4 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-gold" />
                  <h3 className="text-xs font-bold font-cinzel uppercase text-white">
                    Edit {editingItem.type === 'map' ? 'Battle Map' : 'GIF Asset'}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-1 text-slate-cool hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-slate-cool font-mono block mb-1">
                    Title / Name
                  </Label>
                  <Input
                    value={editingItem.name || ''}
                    onChange={(e) =>
                      setEditingItem((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="bg-black/60 border-white/10 text-xs text-white"
                  />
                </div>

                {editingItem.type === 'map' ? (
                  <>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-slate-cool font-mono block mb-1">
                        Theme
                      </Label>
                      <select
                        value={editingItem.theme || 'Dungeon'}
                        onChange={(e) =>
                          setEditingItem((prev) => ({ ...prev, theme: e.target.value }))
                        }
                        className="w-full h-9 rounded-md bg-black/60 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-gold"
                      >
                        <option value="Dungeon">Dungeon</option>
                        <option value="Forest">Forest</option>
                        <option value="Tavern">Tavern</option>
                        <option value="Desert">Desert</option>
                        <option value="Castle">Castle</option>
                        <option value="Sci-Fi">Sci-Fi</option>
                        <option value="Underdark">Underdark</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-slate-cool font-mono block mb-1">
                        Image URL
                      </Label>
                      <Input
                        value={editingItem.url || ''}
                        onChange={(e) =>
                          setEditingItem((prev) => ({ ...prev, url: e.target.value }))
                        }
                        className="bg-black/60 border-white/10 text-xs text-white"
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-slate-cool font-mono block mb-1">
                        Description
                      </Label>
                      <Input
                        value={editingItem.description || ''}
                        onChange={(e) =>
                          setEditingItem((prev) => ({ ...prev, description: e.target.value }))
                        }
                        className="bg-black/60 border-white/10 text-xs text-white"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-slate-cool font-mono block mb-1">
                        Category
                      </Label>
                      <select
                        value={editingItem.category || 'animated_fx'}
                        onChange={(e) =>
                          setEditingItem((prev) => ({ ...prev, category: e.target.value }))
                        }
                        className="w-full h-9 rounded-md bg-black/60 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-gold"
                      >
                        <option value="animated_fx">Animated FX (Spells / Fire / Teleport)</option>
                        <option value="dnd_heroes">Hero Tokens</option>
                        <option value="dnd_monsters">Monster Tokens</option>
                        <option value="dnd_dungeon">Dungeon Props</option>
                        <option value="dnd_conditions">5e Conditions</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-slate-cool font-mono block mb-1">
                        Image / GIF URL
                      </Label>
                      <Input
                        value={editingItem.imageUrl || ''}
                        onChange={(e) =>
                          setEditingItem((prev) => ({ ...prev, imageUrl: e.target.value }))
                        }
                        className="bg-black/60 border-white/10 text-xs text-white"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingItem(null)}
                  className="text-xs text-slate-cool"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  size="sm"
                  className="bg-gold hover:bg-gold-light text-black font-bold text-xs gap-1"
                >
                  {isSavingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
