import { useCallback, useContext, useEffect, useRef } from 'react';
import { useGrid } from '../context/GridContext';
import SessionContext from '../context/SessionContext';
import { PERSISTED_KEYS, STORAGE_KEY } from './campaign';

// One source of truth for the turn order. In a multiplayer session it is the
// session's list (so everyone stays in sync); otherwise it lives in the shared
// grid settings so the controls window, the game window and the DM screen all
// see the same order and the sigils can follow it.
export function useInitiative() {
  const { settings, updateSettings, isDmScreen } = useGrid();
  const session = useContext(SessionContext);
  const inSession = !!session?.sessionCode && !!session?.broadcastUpdateInitiative;
  const list = inSession ? (session.initiativeList || []) : (settings.initList || []);
  const turn = inSession
    ? (session.currentTurnIndex !== undefined ? session.currentTurnIndex : -1)
    : (settings.initTurn != null ? settings.initTurn : -1);

  const setInit = useCallback((newList, newTurn) => {
    if (inSession) {
      session.broadcastUpdateInitiative(newList, newTurn);
      return;
    }
    updateSettings({ initList: newList, initTurn: newTurn });
    // The DM screen is isolated from the projector, but the turn order has to
    // reach it live — send just these two fields.
    if (isDmScreen && window.electronAPI?.dmPush) {
      window.electronAPI.dmPush({ settings: { initList: newList, initTurn: newTurn } });
    }
  }, [inSession, session, updateSettings, isDmScreen]);

  return { list, turn, setInit, inSession };
}

// Saves/loads campaign profiles, table layouts and sigil colours. The normal
// grid-state persistence only keeps a short-lived reload cache, and these have
// to survive for good (the same table gets used week after week).
export function useCampaignPersistence() {
  const { settings, updateSettings } = useGrid();
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const patch = {};
        PERSISTED_KEYS.forEach((k) => { if (data[k] !== undefined) patch[k] = data[k]; });
        if (Object.keys(patch).length) updateSettings(patch);
      }
    } catch (e) { /* ignore */ }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const snapshot = JSON.stringify(PERSISTED_KEYS.map((k) => settings[k]));
  useEffect(() => {
    if (!loaded.current) return undefined;
    const t = setTimeout(() => {
      try {
        const data = {};
        PERSISTED_KEYS.forEach((k) => { if (settings[k] !== undefined) data[k] = settings[k]; });
        if (Object.keys(data).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);
}
