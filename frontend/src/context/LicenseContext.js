import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const LicenseContext = createContext(null);

const STORAGE_KEY = 'overgrid_license';
const FINGERPRINT_KEY = 'overgrid_device_fp';
const REVALIDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Generate a device fingerprint
function getDeviceFingerprint() {
  let fp = localStorage.getItem(FINGERPRINT_KEY);
  if (fp) return fp;
  // Create a fingerprint from browser/device info
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 'unknown',
    Date.now().toString(36),
    Math.random().toString(36).substr(2, 8),
  ].join('|');
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  fp = 'OG-' + Math.abs(hash).toString(36) + '-' + Date.now().toString(36);
  localStorage.setItem(FINGERPRINT_KEY, fp);
  return fp;
}

export const LicenseProvider = ({ children }) => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  const [licenseState, setLicenseState] = useState({
    status: 'checking', // 'checking' | 'trial' | 'licensed' | 'expired'
    licenseKey: null,
    daysRemaining: 0,
    trialExpiresAt: null,
    deviceFingerprint: null,
  });
  const checkedRef = useRef(false);

  const deviceFp = getDeviceFingerprint();

  const checkLicenseStatus = useCallback(async () => {
    // If running inside Electron desktop app, automatically treat as licensed
    if (window.electronAPI?.isElectron || new URLSearchParams(window.location.search).get('electron') === '1') {
      setLicenseState({
        status: 'licensed',
        licenseKey: 'DESKTOP-NATIVE',
        daysRemaining: Infinity,
        trialExpiresAt: null,
        deviceFingerprint: deviceFp,
      });
      return;
    }

    // First check for saved license key
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.licenseKey) {
          // Validate with server
          const res = await fetch(`${backendUrl}/api/license/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ license_key: data.licenseKey, device_fingerprint: deviceFp }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.valid) {
              setLicenseState({
                status: 'licensed',
                licenseKey: data.licenseKey,
                daysRemaining: Infinity,
                trialExpiresAt: null,
                deviceFingerprint: deviceFp,
              });
              localStorage.setItem(STORAGE_KEY, JSON.stringify({
                licenseKey: data.licenseKey,
                lastValidated: Date.now(),
              }));
              return;
            }
          }
          // If validation fails online, check if within offline grace period
          if (data.lastValidated && (Date.now() - data.lastValidated) < REVALIDATE_INTERVAL) {
            setLicenseState({
              status: 'licensed',
              licenseKey: data.licenseKey,
              daysRemaining: Infinity,
              trialExpiresAt: null,
              deviceFingerprint: deviceFp,
            });
            return;
          }
        }
      } catch (e) {
        console.warn('License check failed:', e);
      }
    }

    // No valid license — check trial
    try {
      const res = await fetch(`${backendUrl}/api/license/trial/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_fingerprint: deviceFp }),
      });
      if (res.ok) {
        const trial = await res.json();
        setLicenseState({
          status: trial.status === 'active' ? 'trial' : 'expired',
          licenseKey: null,
          daysRemaining: trial.days_remaining,
          trialExpiresAt: trial.expires_at,
          deviceFingerprint: deviceFp,
        });
        return;
      }
    } catch (e) {
      console.warn('Trial check failed:', e);
    }

    // Fallback: allow usage (server unreachable)
    setLicenseState({
      status: 'trial',
      licenseKey: null,
      daysRemaining: 7,
      trialExpiresAt: null,
      deviceFingerprint: deviceFp,
    });
  }, [backendUrl, deviceFp]);

  // Check license on mount
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    checkLicenseStatus();
  }, [checkLicenseStatus]);

  const activateLicense = useCallback(async (key, email) => {
    const res = await fetch(`${backendUrl}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key, device_fingerprint: deviceFp, email: email?.trim() }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Invalid license key');
    }
    const result = await res.json();
    if (result.valid) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        licenseKey: key,
        lastValidated: Date.now(),
      }));
      setLicenseState({
        status: 'licensed',
        licenseKey: key,
        daysRemaining: Infinity,
        trialExpiresAt: null,
        deviceFingerprint: deviceFp,
      });
      return result;
    }
    throw new Error('License validation failed');
  }, [backendUrl, deviceFp]);

  const startPurchase = useCallback(async (email) => {
    const originUrl = process.env.REACT_APP_WEB_URL || window.location.origin;
    const res = await fetch(`${backendUrl}/api/license/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin_url: originUrl, email }),
    });
    if (!res.ok) throw new Error('Failed to start purchase');
    const data = await res.json();
    return data; // { checkout_url, session_id }
  }, [backendUrl]);

  const pollPurchaseStatus = useCallback(async (sessionId) => {
    const res = await fetch(`${backendUrl}/api/license/purchase/status/${sessionId}`);
    if (!res.ok) throw new Error('Failed to check status');
    return await res.json();
  }, [backendUrl]);

  return (
    <LicenseContext.Provider value={{
      ...licenseState,
      activateLicense,
      startPurchase,
      pollPurchaseStatus,
      recheckLicense: checkLicenseStatus,
    }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    return {
      status: 'licensed',
      licenseKey: 'DESKTOP-NATIVE',
      daysRemaining: Infinity,
      trialExpiresAt: null,
      deviceFingerprint: null,
      activateLicense: async () => ({ valid: true }),
      startPurchase: async () => {},
      pollPurchaseStatus: async () => {},
      recheckLicense: async () => {},
    };
  }
  return context;
};
export default LicenseContext;
