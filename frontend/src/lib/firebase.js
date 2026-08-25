import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDocFromServer,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

export const firebaseConfig = {
  projectId: "gen-lang-client-0652230217",
  appId: "1:277883395164:web:1e3ae885c1a7bfda025a99",
  apiKey: "AIzaSyAcFNalZUXT1_MlfkhH34XkmoqWzsqESOg",
  authDomain: "gen-lang-client-0652230217.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-krajdengrid-29722090-d9f6-40a4-9c98-c4e76e51e4ff",
  storageBucket: "gen-lang-client-0652230217.firebasestorage.app",
  messagingSenderId: "277883395164",
  measurementId: "",
  oAuthClientId: "277883395164-u3v9dj7rjg5gbctkq6n124b21usqkse9.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

let app;
let db;
let storage;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
  storage = getStorage(app);
} catch (error) {
  console.error('[Firebase Init] Failed to initialize Firebase client:', error);
}

export { app, db, storage };

// ── Firebase Storage Upload Utility ──────────────────────────────────────────
export async function uploadToStorage(dataUrl, path) {
  if (!storage) throw new Error('Firebase Storage not initialized');
  if (!dataUrl || !path) throw new Error('Missing dataUrl or path');

  // If it's already a remote URL (not base64), return as-is
  if (!dataUrl.startsWith('data:')) return dataUrl;

  const ref = storageRef(storage, path);
  const [header, base64Data] = dataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';

  const byteString = atob(base64Data);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);

  const blob = new Blob([bytes], { type: mimeType });
  await uploadBytes(ref, blob, { contentType: mimeType });
  return await getDownloadURL(ref);
}

export async function deleteFromStorage(path) {
  if (!storage || !path) return;
  try { await deleteObject(storageRef(storage, path)); } catch(_) {}
}

// Connection verification test
export async function testConnection() {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'system_health', 'ping'));
    console.log('[Firebase] Connected to Firestore database:', firebaseConfig.firestoreDatabaseId);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("[Firebase] Offline or connecting...");
    }
    return false;
  }
}

/**
 * Optimizes and compresses base64 images so they never exceed Firestore's 1MB document limit (1,048,576 bytes).
 * Scales high-resolution battle maps / tokens to max 1920px and compresses to WebP / JPEG (target ~150-400 KB).
 */
export async function optimizeBase64ForFirestore(dataUrl, maxDimension = 1920, targetQuality = 0.80) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  // If already under 450 KB (approx 460,000 chars), no compression needed
  if (dataUrl.length < 450 * 1024) {
    return dataUrl;
  }

  // If it is SVG, no need to rasterize
  if (dataUrl.startsWith('data:image/svg')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Scale down if larger than maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: true });
          if (!ctx) return resolve(dataUrl);

          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP first
          let compressed = canvas.toDataURL('image/webp', targetQuality);
          // If not supported or still > 600KB, try JPEG with 0.75
          if (!compressed || compressed.startsWith('data:image/png') || compressed.length > 600 * 1024) {
            const jpeg = canvas.toDataURL('image/jpeg', 0.75);
            if (jpeg && jpeg.length < (compressed ? compressed.length : dataUrl.length)) {
              compressed = jpeg;
            }
          }

          if (compressed && compressed.length < dataUrl.length) {
            resolve(compressed);
          } else {
            resolve(dataUrl);
          }
        } catch (canvasErr) {
          console.warn('[Firebase Optimizer] Canvas compression note:', canvasErr);
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch (e) {
      resolve(dataUrl);
    }
  });
}

// ── TOKENS & CLIPARTS ─────────────────────────────────────────────────────────

export function subscribeTokens(onUpdate) {
  if (!db) return () => {};
  const colRef = collection(db, 'tokens');
  return onSnapshot(colRef, (snapshot) => {
    const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    onUpdate(items);
  }, (err) => {
    console.warn('[Firebase] Tokens subscription fallback/offline:', err.message);
  });
}

export async function fetchTokensFromFirebase() {
  if (!db) return [];
  try {
    const colRef = collection(db, 'tokens');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.warn('[Firebase] fetchTokens error:', e.message);
    return [];
  }
}

export async function saveTokenToFirebase(token) {
  if (!db || !token) return;
  const docId = String(token.id || `token_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const docRef = doc(db, 'tokens', docId);

  let imageUrl = token.imageUrl || token.url || '';

  // Upload to Firebase Storage if it's a base64 data URL
  if (imageUrl.startsWith('data:')) {
    const ext = imageUrl.startsWith('data:image/gif') ? 'gif'
              : imageUrl.startsWith('data:video/mp4') ? 'mp4'
              : imageUrl.startsWith('data:video/webm') ? 'webm'
              : imageUrl.startsWith('data:image/png') ? 'png'
              : imageUrl.startsWith('data:image/webp') ? 'webp'
              : 'jpg';
    const storagePath = `tokens/${docId}.${ext}`;
    try {
      imageUrl = await uploadToStorage(imageUrl, storagePath);
    } catch(e) {
      console.warn('[Firebase Storage] Token upload failed, falling back to Firestore base64:', e.message);
      // Fall back to compressed base64 if Storage fails
      if (!imageUrl.startsWith('data:video/') && !imageUrl.startsWith('data:image/gif')) {
        imageUrl = await optimizeBase64ForFirestore(imageUrl, 512, 0.75);
      }
    }
  }

  const data = {
    ...token,
    id: docId,
    imageUrl,
    url: imageUrl,
    name: token.name || 'Unnamed Token',
    updated_at: new Date().toISOString(),
  };

  await setDoc(docRef, data, { merge: true });
  return data;
}

export async function saveTokensBatchToFirebase(tokens = []) {
  if (!db || !tokens || tokens.length === 0) return;
  const CHUNK_SIZE = 20;
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const t of chunk) {
      const docId = String(t.id || `token_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const ref = doc(db, 'tokens', docId);
      const url = t.imageUrl || t.url || '';
      batch.set(ref, {
        ...t,
        id: docId,
        imageUrl: url,
        url: url,
        isVault: true,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }
    await batch.commit();
    await new Promise((r) => setTimeout(r, 40));
  }
}

export async function deleteTokenFromFirebase(id, url) {
  if (!db) return;
  try {
    if (id) {
      const docRef = doc(db, 'tokens', String(id));
      await deleteDoc(docRef).catch(() => {});
    }
    if (url) {
      const colRef = collection(db, 'tokens');
      const snap = await getDocs(colRef).catch(() => null);
      if (snap) {
        for (const d of snap.docs) {
          const data = d.data();
          if (data.imageUrl === url || data.url === url || data.id === id) {
            await deleteDoc(d.ref).catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Firebase] deleteToken error:', e.message);
  }
}

// ── BATTLEMAPS ────────────────────────────────────────────────────────────────

export function subscribeBattlemaps(onUpdate) {
  if (!db) return () => {};
  const colRef = collection(db, 'battlemaps');
  return onSnapshot(colRef, (snapshot) => {
    const items = snapshot.docs
      .map(d => ({ ...d.data(), id: d.id }))
      .filter(m => !String(m.id || '').startsWith('preset_map_'));
    onUpdate(items);
  }, (err) => {
    console.warn('[Firebase] Battlemaps subscription fallback/offline:', err.message);
  });
}

export async function fetchBattlemapsFromFirebase() {
  if (!db) return [];
  try {
    const colRef = collection(db, 'battlemaps');
    const snap = await getDocs(colRef);
    return snap.docs
      .map(d => ({ ...d.data(), id: d.id }))
      .filter(m => !String(m.id || '').startsWith('preset_map_'));
  } catch (e) {
    console.warn('[Firebase] fetchBattlemaps error:', e.message);
    return [];
  }
}

export async function saveBattlemapToFirebase(mapItem) {
  if (!db || !mapItem) return;
  const docId = String(mapItem.id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const docRef = doc(db, 'battlemaps', docId);

  let url = mapItem.url || mapItem.imageUrl || '';

  // Upload to Firebase Storage if it's a base64 data URL
  if (url.startsWith('data:')) {
    const ext = url.startsWith('data:video/mp4') ? 'mp4'
              : url.startsWith('data:video/webm') ? 'webm'
              : url.startsWith('data:image/gif') ? 'gif'
              : url.startsWith('data:image/png') ? 'png'
              : url.startsWith('data:image/webp') ? 'webp'
              : 'jpg';
    const storagePath = `battlemaps/${docId}.${ext}`;
    try {
      url = await uploadToStorage(url, storagePath);
    } catch(e) {
      console.warn('[Firebase Storage] Battlemap upload failed:', e.message);
      throw new Error(`Storage upload failed: ${e.message}`);
    }
  }

  const data = {
    ...mapItem,
    id: docId,
    url,
    imageUrl: url,
    name: mapItem.name || 'Battle Map',
    updated_at: new Date().toISOString(),
  };

  await setDoc(docRef, data, { merge: true });
  return data;
}

export async function saveBattlemapsBatchToFirebase(maps = []) {
  if (!db || !maps || maps.length === 0) return;
  const CHUNK_SIZE = 20;
  for (let i = 0; i < maps.length; i += CHUNK_SIZE) {
    const chunk = maps.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const m of chunk) {
      const docId = String(m.id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const ref = doc(db, 'battlemaps', docId);
      const url = m.url || m.imageUrl || '';
      batch.set(ref, {
        ...m,
        id: docId,
        url: url,
        isVault: true,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }
    await batch.commit();
    await new Promise((r) => setTimeout(r, 40));
  }
}

export async function deleteBattlemapFromFirebase(id, url) {
  if (!db) return;
  try {
    if (id) {
      const docRef = doc(db, 'battlemaps', String(id));
      await deleteDoc(docRef).catch(() => {});
    }
    if (url) {
      const colRef = collection(db, 'battlemaps');
      const snap = await getDocs(colRef).catch(() => null);
      if (snap) {
        for (const d of snap.docs) {
          const data = d.data();
          if (data.url === url || data.imageUrl === url || data.id === id) {
            await deleteDoc(d.ref).catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Firebase] deleteBattlemap error:', e.message);
  }
}

// ── EFFECTS ───────────────────────────────────────────────────────────────────

export function subscribeEffects(onUpdate) {
  if (!db) return () => {};
  const colRef = collection(db, 'effects');
  return onSnapshot(colRef, (snapshot) => {
    const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    onUpdate(items);
  }, (err) => {
    console.warn('[Firebase] Effects subscription fallback/offline:', err.message);
  });
}

export async function fetchEffectsFromFirebase() {
  if (!db) return [];
  try {
    const colRef = collection(db, 'effects');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.warn('[Firebase] fetchEffects error:', e.message);
    return [];
  }
}

export async function saveEffectToFirebase(effectItem) {
  if (!db || !effectItem) return;
  const docId = String(effectItem.id || `effect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const docRef = doc(db, 'effects', docId);

  let imageUrl = effectItem.imageUrl || effectItem.url || '';

  // Upload to Firebase Storage if it's a base64 data URL
  if (imageUrl.startsWith('data:')) {
    const ext = imageUrl.startsWith('data:video/mp4') ? 'mp4'
              : imageUrl.startsWith('data:video/webm') ? 'webm'
              : imageUrl.startsWith('data:image/gif') ? 'gif'
              : imageUrl.startsWith('data:image/png') ? 'png'
              : imageUrl.startsWith('data:image/webp') ? 'webp'
              : 'jpg';
    const storagePath = `effects/${docId}.${ext}`;
    try {
      imageUrl = await uploadToStorage(imageUrl, storagePath);
    } catch(e) {
      console.warn('[Firebase Storage] Effect upload failed:', e.message);
      throw new Error(`Storage upload failed: ${e.message}`);
    }
  }

  const data = {
    ...effectItem,
    id: docId,
    imageUrl,
    url: imageUrl,
    name: effectItem.name || 'Visual Effect',
    updated_at: new Date().toISOString(),
  };

  await setDoc(docRef, data, { merge: true });
  return data;
}

export async function saveEffectsBatchToFirebase(effects = []) {
  if (!db || !effects || effects.length === 0) return;
  const CHUNK_SIZE = 20;
  for (let i = 0; i < effects.length; i += CHUNK_SIZE) {
    const chunk = effects.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const eff of chunk) {
      const docId = String(eff.id || `effect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const ref = doc(db, 'effects', docId);
      const url = eff.imageUrl || eff.url || '';
      batch.set(ref, {
        ...eff,
        id: docId,
        imageUrl: url,
        url: url,
        isVault: true,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }
    await batch.commit();
    await new Promise((r) => setTimeout(r, 40));
  }
}

export async function deleteEffectFromFirebase(id, url) {
  if (!db) return;
  try {
    if (id) {
      const docRef = doc(db, 'effects', String(id));
      await deleteDoc(docRef).catch(() => {});
    }
    if (url) {
      const colRef = collection(db, 'effects');
      const snap = await getDocs(colRef).catch(() => null);
      if (snap) {
        for (const d of snap.docs) {
          const data = d.data();
          if (data.imageUrl === url || data.url === url || data.id === id) {
            await deleteDoc(d.ref).catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Firebase] deleteEffect error:', e.message);
  }
}

// ── INITIAL PRESET SEEDING TO FIREBASE ────────────────────────────────────────

export async function seedInitialVaultToFirebase(defaultTokens = [], defaultMaps = [], defaultEffects = []) {
  if (!db) return;
  const SEED_CACHE_KEY = 'krajden_firebase_vault_seeded_v3';
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(SEED_CACHE_KEY)) {
      return;
    }

    // Seed Tokens if empty (using limit(1) to avoid consuming excessive read quota)
    const tokensSnap = await getDocs(query(collection(db, 'tokens'), limit(1)));
    if (tokensSnap.empty && defaultTokens.length > 0) {
      console.log(`[Firebase Seeding] Seeding ${defaultTokens.length} default tokens to Firestore...`);
      const batch = writeBatch(db);
      for (const t of defaultTokens) {
        if (!t.id) continue;
        const ref = doc(db, 'tokens', String(t.id));
        batch.set(ref, {
          ...t,
          isVault: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { merge: true });
      }
      await batch.commit();
      console.log('[Firebase Seeding] Tokens seeded successfully.');
    }

    // Seed Maps if empty (using limit(1))
    const mapsSnap = await getDocs(query(collection(db, 'battlemaps'), limit(1)));
    if (mapsSnap.empty && defaultMaps.length > 0) {
      console.log(`[Firebase Seeding] Seeding ${defaultMaps.length} default battlemaps to Firestore...`);
      const batch = writeBatch(db);
      for (const m of defaultMaps) {
        if (!m.id) continue;
        const ref = doc(db, 'battlemaps', String(m.id));
        batch.set(ref, {
          ...m,
          isVault: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { merge: true });
      }
      await batch.commit();
      console.log('[Firebase Seeding] Battlemaps seeded successfully.');
    }

    // Seed Effects if empty (using limit(1))
    if (defaultEffects.length > 0) {
      const effectsSnap = await getDocs(query(collection(db, 'effects'), limit(1)));
      if (effectsSnap.empty) {
        console.log(`[Firebase Seeding] Seeding ${defaultEffects.length} default effects to Firestore...`);
        const batch = writeBatch(db);
        for (const eff of defaultEffects) {
          if (!eff.id) continue;
          const ref = doc(db, 'effects', String(eff.id));
          batch.set(ref, {
            ...eff,
            isVault: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { merge: true });
        }
        await batch.commit();
        console.log('[Firebase Seeding] Effects seeded successfully.');
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SEED_CACHE_KEY, 'true');
    }
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes('Quota limit exceeded') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      console.warn('[Firebase Seeding] Firestore daily read quota reached; using built-in vault defaults.');
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(SEED_CACHE_KEY, 'true');
        }
      } catch {}
    } else {
      console.warn('[Firebase Seeding] Note during initial seed check:', msg);
    }
  }
}
