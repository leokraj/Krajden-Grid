import { useState, useEffect } from 'react';
import { useLicense } from '../context/LicenseContext';
import { useAuth } from '../context/AuthContext';
import { Shield, Key, CreditCard, CheckCircle, AlertTriangle, X, Loader2, AlertCircle } from 'lucide-react';

// Shared purchase + activate UI
export function LicenseActions() {
  const [mode, setMode] = useState('purchase'); // 'purchase' | 'activate'
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { startPurchase, activateLicense } = useLicense();

  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user, email]);

  const handlePurchase = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await startPurchase(email);
      window.location.href = result.checkout_url;
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleActivate = async () => {
    setLoading(true);
    setError('');
    try {
      await activateLicense(licenseKey.trim(), email.trim());
      setSuccess('License activated! Loading battleground...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4" data-testid="license-actions">
      {/* Tab toggle */}
      <div className="flex bg-[#0d0e10] rounded-xl p-1 border border-white/5">
        <button
          onClick={() => { setMode('purchase'); setError(''); }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
            mode === 'purchase' ? 'bg-[#caa055] text-[#1c1d1f]' : 'text-gray-400 hover:text-white'
          }`}
          data-testid="purchase-tab"
        >
          <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />
          Acquire License
        </button>
        <button
          onClick={() => { setMode('activate'); setError(''); }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
            mode === 'activate' ? 'bg-[#caa055] text-[#1c1d1f]' : 'text-gray-400 hover:text-white'
          }`}
          data-testid="activate-tab"
        >
          <Key className="w-3.5 h-3.5 inline mr-1.5" />
          Unseal key
        </button>
      </div>

      {mode === 'purchase' ? (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-[#caa055]/10 to-[#dc143c]/10 rounded-xl p-4 border border-[#caa055]/10 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#caa055] font-black text-xl" style={{ fontFamily: "'Cinzel', serif" }}>$15</span>
              <span className="text-[10px] bg-[#caa055]/15 text-[#caa055] px-2 py-0.5 rounded-full font-bold tracking-wider">ELITE ARTIFACT</span>
            </div>
            <p className="text-gray-400 text-xs font-sans leading-relaxed">Lifetime ownership · Periodic magical updates · Cast on up to 2 screens concurrently.</p>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email (for key delivery)"
            className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-[#caa055]/50"
            data-testid="purchase-email"
          />
          <button
            onClick={handlePurchase}
            disabled={loading || !email}
            className="w-full py-3 rounded-xl bg-[#caa055] hover:bg-[#d5b271] text-[#1c1d1f] font-extrabold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="purchase-btn"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {loading ? 'Scribing spell...' : 'Buy Lifetime License — $15'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your purchase email address"
            className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-[#caa055]/50"
            data-testid="activate-email-input"
          />
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            placeholder="KRAJDEN-XXXX-XXXX-XXXX"
            className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white text-center font-mono tracking-wider placeholder-gray-600 outline-none focus:border-[#caa055]/50"
            data-testid="license-key-input"
          />
          <button
            onClick={handleActivate}
            disabled={loading || licenseKey.length < 10 || !email}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="activate-btn"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {loading ? 'Unsealing...' : 'Activate Key'}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-xs text-center" data-testid="license-error">{error}</p>}
      {success && (
        <div className="flex items-center justify-center gap-2 text-green-400 text-xs">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}
    </div>
  );
}

// Modal version of license actions (for in-app use)
export function LicenseModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-w-sm w-full bg-[#141517] rounded-2xl border border-[#caa055]/15 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#caa055]" />
            <h2 className="text-lg font-bold text-white tracking-wide" style={{ fontFamily: "'Cinzel', serif" }}>Krajden License</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <LicenseActions />
      </div>
    </div>
  );
}

// Expired screen with purchase + activate options
export function ExpiredScreen() {
  return (
    <div className="fixed inset-0 bg-[#1c1d1f] flex items-center justify-center z-[99999] p-4">
      <div className="max-w-md w-full bg-[#141517] rounded-2xl border border-[#caa055]/15 p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[#dc143c]/10 flex items-center justify-center mx-auto mb-5 border border-[#dc143c]/20">
          <AlertTriangle className="w-8 h-8 text-[#dc143c]" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>Campaign Trial Ended</h1>
        <p className="text-gray-400 text-sm mb-6 font-sans leading-relaxed">
          Your 7-day Krajden Grid trial has expired. Acquire a lifetime artifact key to continue designing and syncing your fantasy battlefields.
        </p>
        <LicenseActions />
      </div>
    </div>
  );
}

// Trial banner shown at top of app during trial period
export function TrialBanner() {
  const license = useLicense();
  const [showActivate, setShowActivate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!license) return null;
  const { status, daysRemaining } = license;
  if (status === 'licensed' || status === 'checking' || dismissed) return null;
  if (status !== 'trial') return null;

  const days = Math.ceil(daysRemaining);

  return (
    <>
      <div className="h-9 bg-[#111214] border-b border-[#caa055]/20 text-[10px] text-slate-cool uppercase font-outfit tracking-wider flex items-center justify-between px-6 z-[9999] relative" data-testid="trial-banner">
        <div className="w-5" /> {/* Spacer to perfectly center the content */}
        <div className="flex items-center gap-1.5 justify-center">
          <AlertCircle className="w-3.5 h-3.5 text-[#caa055]" />
          <span className="font-semibold text-white/90">
            {days} day{days !== 1 ? 's' : ''} left in campaign trial
          </span>
          <span className="text-[#caa055]/40 mx-1.5">·</span>
          <button
            onClick={() => setShowActivate(true)}
            className="text-[#caa055] hover:text-[#d5b271] font-semibold transition-colors cursor-pointer underline underline-offset-4 decoration-[#caa055]/40"
            data-testid="trial-buy-btn"
          >
            Get Lifetime License — $15
          </button>
        </div>
        <button onClick={() => setDismissed(true)} className="text-slate-muted hover:text-[#caa055] transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {showActivate && <LicenseModal onClose={() => setShowActivate(false)} />}
    </>
  );
}

// Full-screen paywall when trial expires
export function ExpiredGate({ children }) {
  const license = useLicense();
  if (!license) return children; // No license provider = no gate (Electron)
  if (license.status === 'expired') return <ExpiredScreen />;
  return children;
}

// License success page component (shown after Stripe redirect)
export function LicenseSuccessPage() {
  const [status, setStatus] = useState('polling');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const { pollPurchaseStatus, activateLicense } = useLicense();

  const pollStatus = async (sessionId, attempts) => {
    if (attempts >= 10) {
      setError('Payment verification timed out. Check your email or contact support.');
      setStatus('error');
      return;
    }
    try {
      const result = await pollPurchaseStatus(sessionId);
      if (result.status === 'paid' && result.license_key) {
        setLicenseKey(result.license_key);
        setStatus('success');
        // Auto-activate
        try {
          await activateLicense(result.license_key, result.email);
        } catch (e) {
          // Ignore — user can manually activate
        }
      } else if (result.status === 'expired') {
        setError('Payment session expired');
        setStatus('error');
      } else {
        setTimeout(() => pollStatus(sessionId, attempts + 1), 2000);
      }
    } catch (e) {
      setTimeout(() => pollStatus(sessionId, attempts + 1), 2000);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) {
      setError('No session ID found');
      setStatus('error');
      return;
    }
    pollStatus(sessionId, 0);
  }, []);

  const copyKey = () => {
    navigator.clipboard.writeText(licenseKey);
  };

  return (
    <div className="min-h-screen bg-[#1c1d1f] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#141517] rounded-2xl border border-[#caa055]/15 p-8 text-center shadow-2xl">
        {status === 'polling' && (
          <>
            <Loader2 className="w-10 h-10 text-[#caa055] animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>Processing tribute...</h1>
            <p className="text-gray-400 text-sm">Verifying your artifact purchase. Scribing scrolls.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>Summon Complete!</h1>
            <p className="text-gray-400 text-sm mb-5 font-sans leading-relaxed">Thank you for supporting Krajden Grid! Scribe your lifetime artifact key:</p>
            <div className="bg-black/40 rounded-xl p-4 border border-green-500/20 mb-4">
              <p className="text-lg font-mono font-bold text-green-400 tracking-wider" data-testid="received-license-key">{licenseKey}</p>
            </div>
            <button
              onClick={copyKey}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-sm font-medium transition-colors mb-3"
            >
              Copy License Artifact Key
            </button>
            <p className="text-gray-500 text-xs font-sans">Keep this scroll secure. It is required if you reinstall your battle terminal.</p>
            <a
              href="/fullscreen"
              className="mt-4 inline-block w-full py-3 rounded-xl bg-[#caa055] text-[#1c1d1f] font-extrabold text-sm text-center shadow-[0_4px_12px_rgba(202,160,85,0.2)]"
            >
              Launch Krajden Grid
            </a>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#dc143c]/10 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-[#dc143c]" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>Scribing Failed</h1>
            <p className="text-[#dc143c]/80 text-sm mb-4">{error}</p>
            <a href="/fullscreen" className="text-[#caa055] text-sm underline hover:text-[#caa055]/80">Return to Krajden Grid</a>
          </>
        )}
      </div>
    </div>
  );
}
