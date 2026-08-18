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
  writeBatch
} from 'firebase/firestore';

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

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  // Initialize Firestore with the specific provisioned database ID
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
} catch (error) {
  console.error('[Firebase Init] Failed to initialize Firebase client:', error);
}

export { app, db };

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
  const data = {
    ...token,
    id: docId,
    updated_at: new Date().toISOString()
  };
  await setDoc(docRef, data, { merge: true });
  return data;
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
    const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
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
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.warn('[Firebase] fetchBattlemaps error:', e.message);
    return [];
  }
}

export async function saveBattlemapToFirebase(mapItem) {
  if (!db || !mapItem) return;
  const docId = String(mapItem.id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const docRef = doc(db, 'battlemaps', docId);
  const data = {
    ...mapItem,
    id: docId,
    updated_at: new Date().toISOString()
  };
  await setDoc(docRef, data, { merge: true });
  return data;
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
  const data = {
    ...effectItem,
    id: docId,
    updated_at: new Date().toISOString()
  };
  await setDoc(docRef, data, { merge: true });
  return data;
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
  try {
    // Seed Tokens if empty
    const tokensSnap = await getDocs(collection(db, 'tokens'));
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

    // Seed Maps if empty
    const mapsSnap = await getDocs(collection(db, 'battlemaps'));
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

    // Seed Effects if empty
    if (defaultEffects.length > 0) {
      const effectsSnap = await getDocs(collection(db, 'effects'));
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
  } catch (e) {
    console.error('[Firebase Seeding] Error during initial seed:', e);
  }
}
