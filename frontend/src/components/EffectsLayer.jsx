/**
 * EffectsLayer.jsx
 * Video/GIF effects drawn along bezier paths on the grid.
 *
 * Three-tier vault:
 *   Vault     — admin-curated effects (your permanent collection)
 *   Community — user-shared effects (anyone can browse, upload, like)
 *   Mine      — effects the current user uploaded (can delete, share to community)
 *
 * Each placed effect has: points[], effectUrl, width, opacity, speed, tileOffsetX, tileOffsetY
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useGrid } from '../context/GridContext';

// ── Geometry helpers ──────────────────────────────────────────────────────────

function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i-1].x, dy = points[i].y - points[i-1].y;
    len += Math.sqrt(dx*dx + dy*dy);
  }
  return len;
}

function pointsToSvgD(points) {
  if (!points || points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    d += ` L ${points[1].x} ${points[1].y}`;
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const cpx = (points[i].x + points[i+1].x) / 2;
      const cpy = (points[i].y + points[i+1].y) / 2;
      d += ` Q ${points[i].x} ${points[i].y} ${cpx} ${cpy}`;
    }
    d += ` L ${points[points.length-1].x} ${points[points.length-1].y}`;
  }
  return d;
}

function getBounds(points, padding = 0) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return {
    x: Math.min(...xs) - padding, y: Math.min(...ys) - padding,
    w: Math.max(...xs) - Math.min(...xs) + padding*2,
    h: Math.max(...ys) - Math.min(...ys) + padding*2,
  };
}

// Generate a stable anonymous user ID (stored in localStorage)
function getLocalUserId() {
  try {
    let id = localStorage.getItem('krajden_user_id');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substring(2,10)}`;
      localStorage.setItem('krajden_user_id', id);
    }
    return id;
  } catch (e) { return 'anonymous'; }
}

function getLocalUserName() {
  try { return localStorage.getItem('krajden_display_name') || 'Anonymous'; } catch(e) { return 'Anonymous'; }
}

// ── Single Effect Path Renderer ───────────────────────────────────────────────

function EffectPath({ effect, canvasSize, isSelected, onSelect, onUpdatePoints, interactive }) {
  const { points = [], effectUrl, width = 80, opacity = 0.85, speed = 1, tileOffsetX = 0, tileOffsetY = 0, id } = effect;
  const mediaRef = useRef(null);
  const [draggingPoint, setDraggingPoint] = useState(null);

  const isVideo = effectUrl && (effectUrl.includes('data:video/') || /\.(mp4|webm)$/i.test(effectUrl));

  useEffect(() => {
    if (mediaRef.current && isVideo) {
      mediaRef.current.playbackRate = Math.max(0.1, Math.min(4, speed));
    }
  }, [speed, isVideo]);

  if (!points || points.length < 2 || !effectUrl) return null;

  const clipId = `eff-clip-${id}`;
  const patternId = `eff-pat-${id}`;
  const svgD = pointsToSvgD(points);
  const bounds = getBounds(points, width);
  const patW = Math.max(40, width * 2);
  const patH = Math.max(40, width);

  const handlePtDown = (e, idx) => {
    if (!interactive) return;
    e.stopPropagation();
    onSelect?.();
    setDraggingPoint(idx);
  };

  const handleMove = useCallback((e) => {
    if (draggingPoint === null || !interactive) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasSize.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasSize.height / rect.height);
    onUpdatePoints?.(id, points.map((p, i) => i === draggingPoint ? { x, y } : p));
  }, [draggingPoint, points, id, canvasSize, interactive, onUpdatePoints]);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={svgD} fill="none" stroke="white" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
        </clipPath>
        <pattern id={patternId} x={tileOffsetX} y={tileOffsetY} width={patW} height={patH} patternUnits="userSpaceOnUse">
          <foreignObject x="0" y="0" width={patW} height={patH}>
            {isVideo ? (
              <video ref={mediaRef} src={effectUrl} autoPlay loop muted playsInline
                style={{ width: patW, height: patH, objectFit: 'cover', display: 'block' }} />
            ) : (
              <img ref={mediaRef} src={effectUrl} alt=""
                style={{ width: patW, height: patH, objectFit: 'cover', display: 'block' }} />
            )}
          </foreignObject>
        </pattern>
      </defs>

      <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h}
        fill={`url(#${patternId})`} clipPath={`url(#${clipId})`}
        opacity={opacity} onClick={onSelect}
        style={{ cursor: interactive ? 'pointer' : 'default' }} />

      {isSelected && (
        <path d={svgD} fill="none" stroke="#caa055" strokeWidth={width+4}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.4}
          style={{ pointerEvents: 'none' }} />
      )}

      {isSelected && interactive && points.map((pt, idx) => (
        <circle key={idx} cx={pt.x} cy={pt.y} r={10}
          fill={idx === 0 || idx === points.length-1 ? '#caa055' : '#38bdf8'}
          stroke="#fff" strokeWidth={2} style={{ cursor: 'grab' }}
          onMouseDown={(e) => handlePtDown(e, idx)} />
      ))}

      {isSelected && interactive && draggingPoint !== null && (
        <rect x={0} y={0} width={canvasSize.width} height={canvasSize.height}
          fill="transparent" style={{ pointerEvents: 'all' }}
          onMouseMove={handleMove} onMouseUp={() => setDraggingPoint(null)} />
      )}
    </g>
  );
}

// ── Drawing Overlay ───────────────────────────────────────────────────────────

export function EffectsDrawingOverlay({ canvasSize }) {
  const { settings, addEffectPath, updateEffectPath, removeEffectPath } = useGrid();
  const [currentPoints, setCurrentPoints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const overlayRef = useRef(null);

  const effectPaths = settings.effectPaths || [];
  const effectsEnabled = settings.effectsEnabled;
  const activeEffectUrl = settings.activeEffectUrl;

  const getCoords = useCallback((e) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) * (canvasSize.width / rect.width),
      y: (e.clientY - rect.top) * (canvasSize.height / rect.height),
    };
  }, [canvasSize]);

  const handleDown = useCallback((e) => {
    if (!effectsEnabled || !activeEffectUrl || e.button !== 0) return;
    setCurrentPoints([getCoords(e)]);
    setIsDrawing(true);
    setSelectedId(null);
  }, [effectsEnabled, activeEffectUrl, getCoords]);

  const handleMove = useCallback((e) => {
    if (!isDrawing) return;
    const pt = getCoords(e);
    setCurrentPoints((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length-1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < 8) return prev;
      }
      return [...prev, pt];
    });
  }, [isDrawing, getCoords]);

  const handleUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.length >= 2) {
      addEffectPath({
        points: currentPoints,
        effectUrl: activeEffectUrl,
        effectId: settings.activeEffectId,
        width: 80, opacity: 0.85, speed: 1, tileOffsetX: 0, tileOffsetY: 0,
      });
    }
    setCurrentPoints([]);
  }, [isDrawing, currentPoints, activeEffectUrl, settings.activeEffectId, addEffectPath]);

  if (!effectPaths.length && !effectsEnabled) return null;

  return (
    <svg ref={overlayRef}
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:25,
        pointerEvents: effectsEnabled ? 'all' : 'none',
        cursor: effectsEnabled && activeEffectUrl ? 'crosshair' : 'default' }}
      viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
      preserveAspectRatio="none"
      onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp}
    >
      {effectPaths.map((effect) => (
        <EffectPath key={effect.id} effect={effect} canvasSize={canvasSize}
          isSelected={selectedId === effect.id}
          onSelect={() => setSelectedId(effect.id)}
          onUpdatePoints={(id, pts) => updateEffectPath(id, { points: pts })}
          interactive={!effectsEnabled} />
      ))}
      {isDrawing && currentPoints.length >= 2 && (
        <path d={pointsToSvgD(currentPoints)} fill="none" stroke="#caa055"
          strokeWidth={80} strokeLinecap="round" strokeLinejoin="round" opacity={0.3}
          style={{ pointerEvents: 'none' }} />
      )}
    </svg>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function EffectCard({ effect, onUse, onLike, onDelete, isLiked, isOwner, isSelected }) {
  return (
    <div
      className={`relative rounded overflow-hidden border-2 transition-all cursor-pointer group ${
        isSelected ? 'border-[#caa055]' : 'border-white/10 hover:border-white/30'
      }`}
      style={{ background: '#111' }}
      onClick={() => onUse(effect)}
    >
      <div style={{ aspectRatio: '1' }}>
        <img src={effect.imageUrl || effect.url} alt={effect.name}
          className="w-full h-full object-cover" style={{ opacity: 0.85 }} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-black/75 px-1 py-0.5">
        <p className="text-[8px] text-white truncate">{effect.name}</p>
        <div className="flex items-center justify-between">
          <span className="text-[7px] text-white/40">{effect.authorName || ''}</span>
          <div className="flex items-center gap-1">
            {onLike && (
              <button onClick={(e) => { e.stopPropagation(); onLike(effect); }}
                className={`text-[8px] ${isLiked ? 'text-red-400' : 'text-white/40 hover:text-red-400'}`}>
                ♥ {effect.likes || 0}
              </button>
            )}
            {onDelete && isOwner && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(effect); }}
                className="text-[8px] text-red-400/60 hover:text-red-400 ml-1">✕</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EffectGrid({ effects, onUse, onLike, onDelete, likedIds, userId, activeId, loading, emptyMsg }) {
  if (loading) return <p className="text-[10px] text-white/30 py-3 text-center">Loading...</p>;
  if (!effects.length) return <p className="text-[10px] text-white/30 py-3 text-center italic">{emptyMsg}</p>;
  return (
    <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
      {effects.map((e) => (
        <EffectCard key={e.id} effect={e}
          onUse={onUse} onLike={onLike} onDelete={onDelete}
          isLiked={likedIds?.includes(e.id)}
          isOwner={e.authorId === userId}
          isSelected={activeId === e.id} />
      ))}
    </div>
  );
}

// ── Upload Form ───────────────────────────────────────────────────────────────

function UploadEffectForm({ onUploaded, endpoint }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('nature');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const userId = getLocalUserId();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_500_000) { setError('File must be under 2.5MB'); return; }
    setFile(f);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  };

  const handleSubmit = async () => {
    if (!file || !name.trim()) { setError('Name and file are required'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name.trim());
      fd.append('category', category);
      fd.append('tags', tags);
      fd.append('authorName', getLocalUserName());
      fd.append('authorId', userId);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      onUploaded?.(data.item);
      setName(''); setTags(''); setFile(null); setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const CATEGORIES = ['nature', 'fire', 'water', 'magic', 'fog', 'weather', 'other'];

  return (
    <div className="flex flex-col gap-2 bg-white/5 rounded p-2">
      <p className="text-[9px] text-[#caa055] font-bold uppercase tracking-wider">Upload Effect</p>
      <input ref={fileRef} type="file" accept=".gif,.mp4,.webm,.png,.webp"
        onChange={handleFile} className="text-[9px] text-white/50 file:mr-2 file:text-[9px] file:bg-[#caa055]/20 file:text-[#caa055] file:border-0 file:rounded file:px-2 file:py-0.5" />
      {preview && (
        <img src={preview} alt="preview" className="w-16 h-16 object-cover rounded border border-white/20" />
      )}
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Effect name..."
        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white placeholder:text-white/30" />
      <select value={category} onChange={e => setCategory(e.target.value)}
        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white">
        {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
      </select>
      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (comma separated)"
        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white placeholder:text-white/30" />
      {error && <p className="text-[9px] text-red-400">{error}</p>}
      <button onClick={handleSubmit} disabled={uploading || !file || !name.trim()}
        className="py-1 rounded text-[10px] font-bold bg-[#caa055]/80 text-[#0d0f12] hover:bg-[#caa055] disabled:opacity-40 transition-all">
        {uploading ? 'Uploading...' : 'Upload & Share'}
      </button>
    </div>
  );
}

// ── Per-effect path controls (sliders) ───────────────────────────────────────

function EffectPathControls({ effect, label }) {
  const { updateEffectPath, removeEffectPath } = useGrid();
  const upd = (key, val) => updateEffectPath(effect.id, { [key]: val });
  return (
    <div className="bg-white/5 rounded p-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/60 truncate">{label}</span>
        <button onClick={() => removeEffectPath(effect.id)} className="text-red-400/60 hover:text-red-400 text-[10px] ml-1">✕</button>
      </div>
      {[
        { label: 'Width', key: 'width', min: 20, max: 300, step: 1, def: 80 },
        { label: 'Opacity', key: 'opacity', min: 0, max: 1, step: 0.05, def: 0.85 },
        { label: 'Speed', key: 'speed', min: 0.25, max: 4, step: 0.25, def: 1 },
        { label: 'Tile Offset X', key: 'tileOffsetX', min: -200, max: 200, step: 1, def: 0 },
        { label: 'Tile Offset Y', key: 'tileOffsetY', min: -200, max: 200, step: 1, def: 0 },
      ].map(({ label, key, min, max, step, def }) => (
        <div key={key}>
          <div className="flex justify-between">
            <span className="text-[8px] text-white/40 uppercase tracking-wide">{label}</span>
            <span className="text-[8px] text-white/30 font-mono">{effect[key] ?? def}</span>
          </div>
          <input type="range" min={min} max={max} step={step} value={effect[key] ?? def}
            onChange={(e) => upd(key, Number(e.target.value))}
            className="w-full h-1 accent-[#caa055]" />
        </div>
      ))}
    </div>
  );
}

// ── Main Effects Control Panel ────────────────────────────────────────────────

export function EffectsControlPanel({ onClose }) {
  const { settings, updateSettings, clearEffectPaths } = useGrid();
  const [tab, setTab] = useState('vault'); // 'vault' | 'community' | 'mine'
  const [vaultEffects, setVaultEffects] = useState([]);
  const [communityEffects, setCommunityEffects] = useState([]);
  const [myEffects, setMyEffects] = useState([]);
  const [likedIds, setLikedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('krajden_liked_effects') || '[]'); } catch(e) { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const userId = getLocalUserId();
  const effectPaths = settings.effectPaths || [];
  const activeEffectId = settings.activeEffectId;

  const persistLikes = (ids) => {
    setLikedIds(ids);
    try { localStorage.setItem('krajden_liked_effects', JSON.stringify(ids)); } catch(e) {}
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [vaultRes, commRes] = await Promise.all([
          fetch('/api/library/effects'),
          fetch('/api/community/effects'),
        ]);
        if (vaultRes.ok) { const d = await vaultRes.json(); setVaultEffects(d.effects || []); }
        if (commRes.ok) {
          const d = await commRes.json();
          const all = d.effects || [];
          setCommunityEffects(all);
          setMyEffects(all.filter(e => e.authorId === userId));
        }
      } catch(e) {}
      setLoading(false);
    };
    load();
  }, [userId]);

  const selectEffect = (effect) => {
    updateSettings({
      activeEffectId: effect.id,
      activeEffectUrl: effect.imageUrl || effect.url,
      effectsEnabled: true,
    });
  };

  const handleLike = async (effect) => {
    try {
      const res = await fetch(`/api/community/effects/${effect.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        const updater = (prev) => prev.map(e => e.id === effect.id ? { ...e, likes: data.likes } : e);
        setCommunityEffects(updater);
        setMyEffects(prev => prev.map(e => e.id === effect.id ? { ...e, likes: data.likes } : e));
        const newLiked = data.liked
          ? [...likedIds, effect.id]
          : likedIds.filter(id => id !== effect.id);
        persistLikes(newLiked);
      }
    } catch(e) {}
  };

  const handleDelete = async (effect) => {
    if (!window.confirm(`Delete "${effect.name}"?`)) return;
    try {
      await fetch(`/api/community/effects/${effect.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      setCommunityEffects(prev => prev.filter(e => e.id !== effect.id));
      setMyEffects(prev => prev.filter(e => e.id !== effect.id));
    } catch(e) {}
  };

  const handleUploaded = (item) => {
    setCommunityEffects(prev => [item, ...prev]);
    setMyEffects(prev => [item, ...prev]);
    setShowUpload(false);
    selectEffect(item);
  };

  const filterFn = (e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || (e.tags || []).some(t => t.toLowerCase().includes(q)) || (e.category || '').toLowerCase().includes(q);
  };

  const TABS = [
    { id: 'vault', label: '⭐ Vault' },
    { id: 'community', label: '🌐 Community' },
    { id: 'mine', label: '👤 Mine' },
  ];

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#0d0f12] border border-[#caa055]/30 rounded-lg min-w-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#caa055] tracking-widest uppercase">✨ Effects Tool</span>
        {onClose && <button onClick={onClose} className="text-white/40 hover:text-white text-xs">✕</button>}
      </div>

      {/* Draw toggle */}
      <button
        onClick={() => updateSettings({ effectsEnabled: !settings.effectsEnabled })}
        className={`w-full py-1.5 rounded text-xs font-bold tracking-wide transition-all ${
          settings.effectsEnabled ? 'bg-[#caa055] text-[#0d0f12]' : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        {settings.effectsEnabled ? '🖊 Drawing Effects — Click to Stop' : '🖊 Draw Effect Path'}
      </button>

      {/* Active effect indicator */}
      {settings.activeEffectUrl && (
        <div className="flex items-center gap-2 bg-white/5 rounded px-2 py-1">
          <img src={settings.activeEffectUrl} alt="" className="w-8 h-8 object-cover rounded" />
          <span className="text-[9px] text-white/60 truncate flex-1">Active effect selected</span>
          <button onClick={() => updateSettings({ activeEffectId: null, activeEffectUrl: null, effectsEnabled: false })}
            className="text-white/30 hover:text-white text-[10px]">✕</button>
        </div>
      )}

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search effects..."
        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white placeholder:text-white/30 w-full" />

      {/* Tabs */}
      <div className="flex rounded overflow-hidden border border-white/10">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-1 text-[9px] font-bold tracking-wide transition-all ${
              tab === t.id ? 'bg-[#caa055]/20 text-[#caa055]' : 'text-white/40 hover:text-white/70'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'vault' && (
        <EffectGrid
          effects={vaultEffects.filter(filterFn)}
          onUse={selectEffect}
          likedIds={[]}
          userId={userId}
          activeId={activeEffectId}
          loading={loading}
          emptyMsg="No vault effects yet — add via Admin panel."
        />
      )}

      {tab === 'community' && (
        <>
          <EffectGrid
            effects={communityEffects.filter(filterFn)}
            onUse={selectEffect}
            onLike={handleLike}
            onDelete={handleDelete}
            likedIds={likedIds}
            userId={userId}
            activeId={activeEffectId}
            loading={loading}
            emptyMsg="No community effects yet — be the first to share!"
          />
          <button onClick={() => setShowUpload(v => !v)}
            className="w-full py-1 rounded text-[10px] text-[#caa055] border border-[#caa055]/30 hover:bg-[#caa055]/10 transition-all">
            {showUpload ? '▲ Hide Upload' : '⬆ Share an Effect'}
          </button>
          {showUpload && (
            <UploadEffectForm endpoint="/api/community/effects" onUploaded={handleUploaded} />
          )}
        </>
      )}

      {tab === 'mine' && (
        <>
          <EffectGrid
            effects={myEffects.filter(filterFn)}
            onUse={selectEffect}
            onDelete={handleDelete}
            likedIds={likedIds}
            userId={userId}
            activeId={activeEffectId}
            loading={loading}
            emptyMsg="You haven't shared any effects yet."
          />
          <button onClick={() => setShowUpload(v => !v)}
            className="w-full py-1 rounded text-[10px] text-[#caa055] border border-[#caa055]/30 hover:bg-[#caa055]/10 transition-all">
            {showUpload ? '▲ Hide Upload' : '⬆ Upload Your Own'}
          </button>
          {showUpload && (
            <UploadEffectForm endpoint="/api/community/effects" onUploaded={handleUploaded} />
          )}
        </>
      )}

      {/* Placed effects */}
      {effectPaths.length > 0 && (
        <div>
          <p className="text-[10px] text-white/50 mb-1.5 uppercase tracking-wider">
            Placed Effects ({effectPaths.length})
          </p>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {effectPaths.map((ep, idx) => (
              <EffectPathControls key={ep.id} effect={ep} label={`Effect ${idx + 1}`} />
            ))}
          </div>
          <button onClick={clearEffectPaths}
            className="mt-2 w-full py-1 rounded text-[10px] text-red-400 hover:bg-red-900/30 border border-red-900/40 transition-all">
            Clear All Effects
          </button>
        </div>
      )}

      {/* Display name setting */}
      <div className="border-t border-white/5 pt-2">
        <p className="text-[8px] text-white/30 uppercase tracking-wider mb-1">Your display name</p>
        <input
          defaultValue={getLocalUserName()}
          onBlur={(e) => {
            try { localStorage.setItem('krajden_display_name', e.target.value.trim() || 'Anonymous'); } catch(_) {}
          }}
          placeholder="Anonymous"
          className="w-full bg-black/30 border border-white/10 rounded px-2 py-0.5 text-[9px] text-white/60 placeholder:text-white/20"
        />
      </div>
    </div>
  );
}
