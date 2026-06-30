import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Gamepad2, Chrome, Facebook, ArrowLeft, Loader2 } from 'lucide-react';

// Custom Elegant Grid Icon matching the layout precisely
const GridIcon = ({ className = "w-7 h-7" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
  </svg>
);

// Elegant Centered Divider Ornament
const SymmetricalDivider = () => (
  <div className="flex items-center justify-center gap-4 my-5 w-full">
    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#caa055]/30" />
    <div className="relative flex items-center justify-center">
      <div className="w-1.5 h-1.5 bg-[#caa055] rotate-45" />
      <div className="absolute w-2.5 h-2.5 border border-[#caa055]/40 rotate-45" />
    </div>
    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#caa055]/30" />
  </div>
);

// Four-point Star Icon for Scribe Button
const FourPointStar = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
  </svg>
);

// Custom Solid Gold Google Icon
const GoogleIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#caa055" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#caa055" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#caa055" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#caa055" />
  </svg>
);

// Custom Solid Gold Facebook Icon
const FacebookIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" fill="#caa055" />
  </svg>
);

export const AuthModal = ({ isOpen, onClose, initialMode = 'login', isGate = false, onGuest }) => {
  const { login, register, loginWithSocial } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Decoupled social login states
  const [socialProvider, setSocialProvider] = useState(null); // 'google' | 'facebook' | null
  const [isCustomSocial, setIsCustomSocial] = useState(false);
  const [customSocialEmail, setCustomSocialEmail] = useState('');
  const [customSocialName, setCustomSocialName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        await register(email, password, name, nickname);
      } else {
        await login(email, password);
      }
      onClose?.();
    } catch (err) {
      setError(err.message);
    }
    setIsLoading(false);
  };

  const handleSocialSubmit = async (socialEmailToUse, socialNameToUse) => {
    setError('');
    setIsLoading(true);
    try {
      const displayName = socialNameToUse || socialEmailToUse.split('@')[0];
      await loginWithSocial(socialProvider, socialEmailToUse, displayName, null);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Social login failed');
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/85 backdrop-blur-md px-4" data-testid="auth-modal-overlay">
      <div className="bg-[#141517] border border-[#caa055]/15 rounded-xl shadow-2xl w-full max-w-[460px] overflow-hidden" data-testid="auth-modal">
        {socialProvider ? (
          /* Custom interactive decoupled social chooser */
          <div className="p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-4 pb-4 border-b border-[#caa055]/10">
              <button
                type="button"
                onClick={() => { setSocialProvider(null); setIsCustomSocial(false); setError(''); }}
                className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {socialProvider === 'google' ? (
                    <>
                      <Chrome className="w-5 h-5 text-[#caa055]" />
                      Sign in with Google
                    </>
                  ) : (
                    <>
                      <Facebook className="w-5 h-5 text-[#caa055]" />
                      Sign in with Facebook
                    </>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">to continue to Krajden Grid</p>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <p className="text-xs text-red-400 bg-red-400/5 border border-red-500/10 p-2.5 rounded-lg">
                {error}
              </p>
            )}

            {!isCustomSocial ? (
              /* Account Chooser */
              <div className="space-y-4">
                <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-2">Select Account</div>
                
                {/* Primary account (Krajden) */}
                <button
                  type="button"
                  onClick={() => handleSocialSubmit('l.krajden@gmail.com', 'L. Krajden')}
                  disabled={isLoading}
                  className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#caa055]/20 rounded-xl flex items-center gap-4 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#caa055]/25 text-[#caa055] border border-[#caa055]/30 flex items-center justify-center font-bold text-base shadow-inner">
                    L
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-200 group-hover:text-white truncate">L. Krajden</div>
                    <div className="text-xs text-gray-400 truncate font-mono">l.krajden@gmail.com</div>
                  </div>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 text-[#caa055] animate-spin" />
                  ) : (
                    <div className="text-[10px] bg-[#caa055]/10 text-[#caa055] border border-[#caa055]/20 px-2.5 py-0.5 rounded-md font-mono uppercase tracking-wide group-hover:scale-105 transition-transform">
                      Active
                    </div>
                  )}
                </button>

                {/* Switch Account */}
                <button
                  type="button"
                  onClick={() => setIsCustomSocial(true)}
                  disabled={isLoading}
                  className="w-full text-center p-3 text-xs bg-transparent hover:bg-white/5 border border-dashed border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-all font-mono"
                >
                  + Use another account
                </button>
              </div>
            ) : (
              /* Custom Account Input Form */
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customSocialEmail) {
                    handleSocialSubmit(customSocialEmail, customSocialName);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-sans font-bold tracking-[0.08em] text-[#caa055] uppercase">Email Address</label>
                  <input
                    type="email"
                    value={customSocialEmail}
                    onChange={(e) => setCustomSocialEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="flex h-12 w-full rounded-[6px] border border-[#caa055]/15 bg-[#0d0e10]/80 px-4 py-2 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-[#caa055]/60 transition-colors"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-sans font-bold tracking-[0.08em] text-[#caa055] uppercase">Profile Name (Optional)</label>
                  <input
                    type="text"
                    value={customSocialName}
                    onChange={(e) => setCustomSocialName(e.target.value)}
                    placeholder="Your Full Name"
                    className="flex h-12 w-full rounded-[6px] border border-[#caa055]/15 bg-[#0d0e10]/80 px-4 py-2 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-[#caa055]/60 transition-colors"
                    disabled={isLoading}
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomSocial(false)}
                    disabled={isLoading}
                    className="flex-1 h-12 rounded-[6px] border border-[#caa055]/15 bg-transparent text-gray-400 hover:text-white font-cinzel font-bold text-xs tracking-[0.15em] transition-all hover:bg-white/5 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !customSocialEmail}
                    className="flex-1 h-12 rounded-[6px] bg-[#caa055] hover:bg-[#d5b271] text-[#1c1d1f] font-cinzel font-bold text-xs tracking-[0.15em] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#1c1d1f]" />
                    ) : (
                      <>Sign In <FourPointStar className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Privacy Disclaimer */}
            <p className="text-[10px] text-gray-500 leading-relaxed text-center font-sans">
              To proceed securely, your character will link with your scroll on Krajden Grid. This session is securely encrypted.
            </p>
          </div>
        ) : (
          /* Standard Email Login / Register View matching screenshot 100% */
          <div className="p-8 space-y-6">
            
            {/* Centered Brand Header */}
            <div className="text-center flex flex-col items-center">
              <div className="mb-2">
                <GridIcon className="w-7 h-7 text-[#caa055]" />
              </div>
              <h1 className="font-cinzel text-[26px] tracking-[0.06em] text-white font-bold leading-none select-none uppercase">
                KRAJDEN <span className="text-[#caa055]">GRID</span>
              </h1>
              
              <SymmetricalDivider />

              <h2 className="text-lg font-cinzel tracking-[0.08em] text-white uppercase font-bold text-center leading-normal">
                {mode === 'login' ? 'Enter the Battle Station' : 'Scribe Your Character'}
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 text-center leading-normal font-sans">
                Sign in to sync drawings, cliparts, and presets securely.
              </p>
            </div>

            {/* Social Logins: Google & Facebook side-by-side with Gold Icons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSocialProvider('google')}
                disabled={isLoading}
                className="h-12 border border-[#caa055]/15 hover:border-[#caa055]/40 bg-[#0d0e10]/60 hover:bg-[#caa055]/5 text-[#caa055] hover:text-white rounded-[6px] transition-all flex items-center justify-center gap-3 font-cinzel font-bold text-xs tracking-[0.15em] select-none cursor-pointer"
                data-testid="google-login-btn"
              >
                <GoogleIcon className="w-4 h-4 text-[#caa055]" />
                GOOGLE
              </button>
              <button
                type="button"
                onClick={() => setSocialProvider('facebook')}
                disabled={isLoading}
                className="h-12 border border-[#caa055]/15 hover:border-[#caa055]/40 bg-[#0d0e10]/60 hover:bg-[#caa055]/5 text-[#caa055] hover:text-white rounded-[6px] transition-all flex items-center justify-center gap-3 font-cinzel font-bold text-xs tracking-[0.15em] select-none cursor-pointer"
                data-testid="facebook-login-btn"
              >
                <FacebookIcon className="w-4 h-4 text-[#caa055]" />
                FACEBOOK
              </button>
            </div>

            {/* Or Email Divider */}
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-[#caa055]/10" />
              <span className="text-[10px] text-[#caa055]/50 font-mono tracking-widest uppercase">
                {mode === 'login' ? 'OR SIGN IN WITH EMAIL' : 'OR SIGN IN WITH EMAIL'}
              </span>
              <div className="flex-1 h-px bg-[#caa055]/10" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  {/* REAL NAME */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-sans font-bold tracking-[0.08em] text-[#caa055] uppercase">
                      Real Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#caa055]/40" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="pl-11 pr-4 flex h-12 w-full rounded-[6px] border border-[#caa055]/15 bg-[#0d0e10]/80 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#caa055]/60 transition-colors"
                        required
                        data-testid="auth-name-input"
                      />
                    </div>
                  </div>

                  {/* HERO NICKNAME */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-sans font-bold tracking-[0.08em] text-[#caa055] uppercase">
                      Hero Nickname (visible to other players)
                    </label>
                    <div className="relative">
                      <Gamepad2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#caa055]/40" />
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="e.g. RangerEldrin"
                        className="pl-11 pr-4 flex h-12 w-full rounded-[6px] border border-[#caa055]/15 bg-[#0d0e10]/80 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#caa055]/60 transition-colors"
                        maxLength={50}
                        data-testid="auth-nickname-input"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* EMAIL ADDRESS */}
              <div className="space-y-2">
                <label className="text-[10px] font-sans font-bold tracking-[0.08em] text-[#caa055] uppercase">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#caa055]/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@dungeon.com"
                    className="pl-11 pr-4 flex h-12 w-full rounded-[6px] border border-[#caa055]/15 bg-[#0d0e10]/80 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#caa055]/60 transition-colors"
                    required
                    data-testid="auth-email-input"
                  />
                </div>
              </div>

              {/* SECRET PASSWORD */}
              <div className="space-y-2">
                <label className="text-[10px] font-sans font-bold tracking-[0.08em] text-[#caa055] uppercase">
                  Secret Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#caa055]/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="pl-11 pr-4 flex h-12 w-full rounded-[6px] border border-[#caa055]/15 bg-[#0d0e10]/80 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#caa055]/60 transition-colors"
                    required
                    minLength={6}
                    data-testid="auth-password-input"
                  />
                </div>
              </div>

              {/* Error Box */}
              {error && (
                <p className="text-xs text-red-400 bg-red-400/5 border border-red-500/10 p-2.5 rounded-lg" data-testid="auth-error">
                  {error}
                </p>
              )}

              {/* Submit Scribe Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-[6px] bg-[#caa055] hover:bg-[#d5b271] text-[#1c1d1f] font-cinzel font-bold text-xs tracking-[0.15em] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#caa055]/10 select-none"
                data-testid="auth-submit-btn"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#1c1d1f]" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Scribe Account'}
                    <FourPointStar className="w-3.5 h-3.5 shrink-0 text-[#1c1d1f]" />
                  </>
                )}
              </button>
            </form>

            {/* Switch mode */}
            <p className="text-center text-xs text-gray-500">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => { setMode('register'); setError(''); }}
                    className="text-[#caa055] hover:underline font-semibold cursor-pointer"
                    data-testid="switch-to-register"
                  >
                    Scribe account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-[#caa055] hover:underline font-semibold cursor-pointer"
                    data-testid="switch-to-login"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>

            {/* Guest mode Option */}
            {isGate && onGuest && (
              <>
                <div className="h-px bg-[#caa055]/10" />
                <div className="flex justify-center pt-2">
                  <button
                    onClick={onGuest}
                    className="text-center text-xs text-[#caa055]/70 hover:text-[#caa055] py-2 transition-all font-mono tracking-widest uppercase cursor-pointer select-none"
                    data-testid="continue-as-guest-btn"
                  >
                    [ CONTINUE AS GUEST ]
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
