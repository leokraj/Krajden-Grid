import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import AdminSecretModal from '../components/AdminSecretModal';
import { 
  Grid3X3, 
  Download, 
  Tv, 
  ExternalLink, 
  Shield, 
  Key, 
  Monitor, 
  Check, 
  Loader2, 
  Sparkles,
  Layers,
  Flame,
  Maximize2,
  Terminal,
  Eye,
  Sliders,
  Zap,
  ArrowRight
} from 'lucide-react';

// Custom symmetrical fleur-de-lis medieval crest icon
function KrajdenCrest({ className = "w-6 h-6" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 100" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="50" y1="18" x2="50" y2="82" strokeWidth="2.5" />
      <path d="M50 12 C46 22, 44 30, 50 40 C56 30, 54 22, 50 12 Z" fill="currentColor" stroke="none" />
      <circle cx="50" cy="28" r="1.5" fill="currentColor" stroke="none" />
      <path d="M50 36 C32 20, 18 32, 22 52 C25 66, 42 66, 48 54" strokeWidth="2" />
      <path d="M50 36 C68 20, 82 32, 78 52 C75 66, 58 66, 52 54" strokeWidth="2" />
      <path d="M50 50 C38 42, 28 50, 32 64 C35 74, 46 72, 48 62" strokeWidth="1.5" />
      <path d="M50 50 C62 42, 72 50, 68 64 C65 74, 54 72, 52 62" strokeWidth="1.5" />
      <circle cx="50" cy="48" r="4.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="48" r="7.5" strokeWidth="1" />
      <path d="M30 48 H70" strokeWidth="1.5" />
      <circle cx="30" cy="48" r="2" fill="currentColor" stroke="none" />
      <circle cx="70" cy="48" r="2" fill="currentColor" stroke="none" />
      <path d="M50 68 C42 78, 44 86, 50 90 C56 86, 58 78, 50 68 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Windows logo icon
function WindowsIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.551H10.949M0 12.6h9.75V22.05L0 20.7m10.949-8.1H24V24l-13.051-1.8" />
    </svg>
  );
}

export function HomePage() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copiedPowerShell, setCopiedPowerShell] = useState(false);

  // Keyboard shortcut (Ctrl+Shift+A) to open DM Vault
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const backendUrl = (() => {
    try {
      if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) {
        return process.env.REACT_APP_BACKEND_URL;
      }
    } catch (e) {}
    try {
      if (import.meta && import.meta.env && import.meta.env.VITE_BACKEND_URL) {
        return import.meta.env.VITE_BACKEND_URL;
      }
    } catch (e) {}
    return window.location.origin;
  })();

  const downloadZipUrl = '/api/download/KrajdenGrid-Portable.zip';
  const downloadBatUrl = '/api/download/KrajdenGrid-FastApp.bat';

  const [downloadProgress, setDownloadProgress] = useState(0);

  const triggerBrowserDownload = (url, filename) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 2000);
    } catch (e) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 60000);
    }
  };

  const handleDownloadWindows = useCallback(async () => {
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const response = await fetch('/api/download/KrajdenGrid-Windows.zip');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 115351061;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total > 0) {
          setDownloadProgress(Math.min(99, Math.round((loaded / total) * 100)));
        }
      }

      setDownloadProgress(100);
      const blob = new Blob(chunks, { type: 'application/zip' });
      const blobUrl = URL.createObjectURL(blob);
      triggerBrowserDownload(blobUrl, 'KrajdenGrid-Windows.zip');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (err) {
      console.warn('Direct zip fetch failed, falling back to background download:', err);
      triggerBrowserDownload('/api/download/KrajdenGrid-Windows.zip', 'KrajdenGrid-Windows.zip');
    } finally {
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(0);
      }, 1500);
    }
  }, []);

  const copyPowerShellCmd = () => {
    const cmd = ps1InstallCommand;
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(cmd);
      } else {
        const ta = document.createElement('textarea');
        ta.value = cmd;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedPowerShell(true);
      setTimeout(() => setCopiedPowerShell(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToDownload = () => {
    const el = document.getElementById('download-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col selection:bg-[#caa055] selection:text-black relative overflow-x-hidden font-sans">
      
      {/* Background glow effects */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[180px] pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle at center, #caa055 0%, rgba(10, 10, 12, 0) 70%)' }}
      />
      <div 
        className="absolute top-[600px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-10"
        style={{ background: 'radial-gradient(circle at center, #FF453A 0%, rgba(10, 10, 12, 0) 70%)' }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3.5 group cursor-pointer text-left select-none">
            <KrajdenCrest className="w-8 h-8 text-[#caa055] group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-cinzel text-xl font-extrabold tracking-[0.15em] text-[#caa055] leading-none">
                KRAJDEN GRID
              </span>
              <span className="font-mono text-[9px] tracking-[0.25em] text-slate-400 mt-1 uppercase leading-none">
                WINDOWS OVERLAY EDITION
              </span>
            </div>
          </Link>

          {/* Navigation & Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link 
              to="/download"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-[#caa055]/40 text-slate-200 hover:text-[#caa055] text-xs font-cinzel font-bold transition-all"
            >
              <Download className="w-3.5 h-3.5 text-[#caa055]" />
              <span>Download Hub</span>
            </Link>

            <button
              onClick={() => setIsAdminOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#caa055]/30 bg-[#caa055]/10 text-[#caa055] hover:bg-[#caa055]/20 text-xs font-cinzel font-bold transition-all cursor-pointer"
              title="Open DM Vault & Clipart Library (Ctrl+Shift+A)"
            >
              <Shield className="w-3.5 h-3.5 text-[#caa055]" />
              <span className="hidden sm:inline">Asset Vault</span>
              <span className="text-[9px] font-mono opacity-60 ml-0.5">Ctrl+Shift+A</span>
            </button>

            <Link 
              to="/fullscreen"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-slate-300 hover:text-white text-xs font-mono transition-all"
            >
              <Tv className="w-3.5 h-3.5 text-[#caa055]" />
              <span>Web Preview</span>
            </Link>

            <Link to="/download">
              <Button
                className="h-10 bg-[#caa055] hover:bg-[#d5b271] text-black font-cinzel font-bold text-xs tracking-wider uppercase rounded-xl px-5 shadow-lg shadow-[#caa055]/15 hover:shadow-[#caa055]/25 transition-all flex items-center gap-2 cursor-pointer"
              >
                <WindowsIcon className="w-4 h-4 text-black" />
                <span>Get Windows App</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center">
        <section className="w-full max-w-5xl mx-auto px-6 pt-16 pb-20 text-center space-y-8">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#caa055]/10 border border-[#caa055]/30 text-[#caa055] text-xs font-mono uppercase tracking-wider">
            <WindowsIcon className="w-3.5 h-3.5" />
            <span>Standalone Windows 10 & 11 Desktop Overlay</span>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="font-cinzel text-4xl sm:text-6xl md:text-7xl font-extrabold uppercase tracking-tight text-white leading-[1.05]">
              The Tactical Grid Overlay <br />
              <span className="text-[#caa055] italic">For Windows Tabletop DMs</span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg max-w-3xl mx-auto font-sans leading-relaxed pt-2">
              Transform any horizontal TV gaming table, second monitor, or virtual map into a high-contrast battleground. Overlay calibrated square and hex grids with fog of war, spell radius rings, and token controls.
            </p>
          </div>

          {/* Primary 1-Click Download Action Bar */}
          <div className="pt-4 flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
              <a
                href="/api/download/KrajdenGrid-Windows.zip"
                download="KrajdenGrid-Windows.zip"
                className="w-full sm:w-auto flex-1 h-14 bg-[#caa055] hover:bg-[#d5b271] text-black font-cinzel font-extrabold text-sm tracking-widest uppercase rounded-2xl shadow-xl shadow-[#caa055]/20 hover:shadow-[#caa055]/30 transition-all flex items-center justify-center gap-3 cursor-pointer no-underline text-center"
              >
                <Download className="w-5 h-5" /> Download for Windows
              </a>

              <Link to="/fullscreen" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-14 border border-white/20 hover:border-[#caa055] text-white hover:text-[#caa055] font-cinzel font-bold text-xs tracking-wider uppercase rounded-2xl px-6 transition-all"
                >
                  <Tv className="w-4 h-4 mr-2 text-[#caa055]" />
                  Web Canvas
                </Button>
              </Link>
            </div>

            {downloading && (
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mt-1">
                <div 
                  className="bg-[#caa055] h-full transition-all duration-200" 
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              <a
                href="/api/download/KrajdenGrid-Windows.zip"
                download="KrajdenGrid-Windows.zip"
                className="text-[#caa055] hover:underline"
              >
                Direct ZIP Link
              </a>
              <span>•</span>
              <Link to="/download" className="hover:text-white hover:underline">
                Installation Guide &rarr;
              </Link>
            </div>
          </div>

          {/* Compatibility guarantee */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-mono pt-1">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#caa055]" /> Windows 10 & 11 (64-bit)
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#caa055]" /> 100% Offline Capable
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#caa055]" /> Multi-Monitor & TV Table Ready
            </span>
          </div>

          {/* Interactive Visual Showcase */}
          <div className="pt-8 max-w-4xl mx-auto">
            <div className="relative rounded-2xl border border-[#caa055]/30 bg-[#121316] p-2 sm:p-4 shadow-2xl overflow-hidden group">
              <div className="aspect-[16/9] w-full bg-[#0b0c0e] rounded-xl overflow-hidden relative flex flex-col justify-between p-6 border border-white/5">
                
                {/* Simulated Grid Mesh Overlay */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-40"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(202, 160, 85, 0.35) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(202, 160, 85, 0.35) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                  }}
                />

                {/* Simulated Spell Template (Fireball / Aura) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-2 border-red-500/80 bg-red-500/10 pointer-events-none flex items-center justify-center animate-pulse">
                  <span className="text-[10px] font-mono text-red-400 font-bold bg-black/60 px-2 py-0.5 rounded border border-red-500/40">
                    20 FT RADIUS (FIREBALL)
                  </span>
                </div>

                {/* Top Overlay HUD Bar */}
                <div className="relative z-10 flex items-center justify-between bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-lg text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-[#caa055] font-bold flex items-center gap-1.5">
                      <Grid3X3 className="w-4 h-4" /> 50px Grid
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300">TV Projection: Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-bold border border-green-500/30">
                      LIVE DUAL-DISPLAY
                    </span>
                  </div>
                </div>

                {/* Bottom Overlay Controls Preview */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-black/85 backdrop-blur-md border border-[#caa055]/30 p-3 rounded-lg text-xs">
                  <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
                    <Sliders className="w-4 h-4 text-[#caa055]" />
                    <span>Grid Color &bull; Fog of War &bull; Spell Templates &bull; Tokens &bull; Ruler</span>
                  </div>
                  <Link 
                    to="/fullscreen"
                    className="text-[#caa055] hover:text-[#d5b271] font-cinzel font-bold text-xs flex items-center gap-1 hover:underline"
                  >
                    Open Live Canvas <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights (Clear, Anti-Slop, High-Utility) */}
        <section className="w-full border-t border-white/5 bg-[#0e0f12] py-20">
          <div className="max-w-6xl mx-auto px-6 space-y-12">
            
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="font-cinzel text-3xl sm:text-4xl font-bold uppercase tracking-wider text-white">
                Built For Real Tabletop Gaming
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Everything you need to run tabletop RPG combat seamlessly without clunky web subscription lock-ins.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Feature 1 */}
              <div className="p-8 rounded-2xl bg-[#141519] border border-white/5 hover:border-[#caa055]/30 transition-all space-y-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-[#caa055]/10 border border-[#caa055]/30 flex items-center justify-center text-[#caa055]">
                  <Tv className="w-6 h-6" />
                </div>
                <h3 className="font-cinzel text-lg font-bold text-white uppercase tracking-wider">
                  TV Tabletop Dual-Display
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Display clean battle maps and player grids on your horizontal TV table while keeping DM controls, fog overrides, and secret notes private on your laptop screen.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-8 rounded-2xl bg-[#141519] border border-white/5 hover:border-[#caa055]/30 transition-all space-y-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-[#caa055]/10 border border-[#caa055]/30 flex items-center justify-center text-[#caa055]">
                  <Flame className="w-6 h-6" />
                </div>
                <h3 className="font-cinzel text-lg font-bold text-white uppercase tracking-wider">
                  Spell Rings & Fog of War
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Instantly measure blast radii (Fireball 20ft, Cone of Cold 60ft, Spirit Guardians 15ft) and reveal unexplored dungeon chambers with dynamic fog painting.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-8 rounded-2xl bg-[#141519] border border-white/5 hover:border-[#caa055]/30 transition-all space-y-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-[#caa055]/10 border border-[#caa055]/30 flex items-center justify-center text-[#caa055]">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="font-cinzel text-lg font-bold text-white uppercase tracking-wider">
                  Firebase DM Vault
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Upload tokens, monsters, maps, and sound effects to your permanent Firebase vault (Press <code className="text-[#caa055]">Ctrl+Shift+A</code> anytime to access).
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* Dedicated Download Section */}
        <section id="download-section" className="w-full max-w-5xl mx-auto px-6 py-20 space-y-10 text-center">
          <div className="space-y-3">
            <h2 className="font-cinzel text-3xl sm:text-4xl font-extrabold uppercase tracking-wider text-white">
              Get Krajden Grid for Windows
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Download the complete offline Windows standalone app or run the instant 1-click launcher.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            
            {/* Primary Package Card */}
            <div className="p-8 rounded-2xl bg-[#141519] border border-[#caa055]/40 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#caa055]/10 border border-[#caa055]/30 flex items-center justify-center text-[#caa055]">
                    <WindowsIcon className="w-6 h-6" />
                  </div>
                  <Badge className="bg-[#caa055] text-black font-mono font-bold text-[10px] uppercase">
                    Full Offline App
                  </Badge>
                </div>
                <div>
                  <h3 className="font-cinzel text-xl font-bold text-white uppercase">
                    KrajdenGrid-Windows.zip
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Includes precompiled <code className="text-[#caa055]">KrajdenGrid.exe</code>, all 200+ built-in token cliparts, spell templates, and offline multi-monitor engine.
                  </p>
                </div>
                <ul className="space-y-2 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#caa055]" /> Unzip anywhere on Windows and double-click to launch
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#caa055]" /> No installation or administrator permissions required
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <a
                  href="/api/download/KrajdenGrid-Windows.zip"
                  download="KrajdenGrid-Windows.zip"
                  className="w-full h-12 bg-[#caa055] hover:bg-[#d5b271] text-black font-cinzel font-bold text-xs tracking-widest uppercase rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 no-underline text-center"
                >
                  <Download className="w-4 h-4" /> Download Windows App (.zip)
                </a>

                <div className="text-center">
                  <a
                    href="/api/download/KrajdenGrid-Windows.zip"
                    download="KrajdenGrid-Windows.zip"
                    className="text-[11px] text-[#caa055] hover:underline font-mono"
                  >
                    Direct browser download link &rarr;
                  </a>
                </div>
              </div>
            </div>

            {/* Instant Desktop Launcher .bat */}
            <div className="p-8 rounded-2xl bg-[#141519] border border-white/10 flex flex-col justify-between space-y-6 text-left">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#caa055]">
                    <Download className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="text-[#caa055] border-[#caa055]/30 font-mono text-[10px]">
                    Instant Desktop Launcher
                  </Badge>
                </div>
                <div>
                  <h3 className="font-cinzel text-xl font-bold text-white uppercase">
                    Zero-Install Launcher (.bat)
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Download <strong className="text-white">KrajdenGrid-FastApp.bat</strong> to your desktop. Double-click it anytime to launch in a clean, standalone borderless window with zero downloads and 100% clean compatibility:
                  </p>
                </div>

                <div className="p-3 bg-black/90 border border-white/10 rounded-xl text-xs font-mono text-slate-300 space-y-1">
                  <div className="flex items-center gap-2 text-[#caa055]">
                    <Check className="w-3.5 h-3.5" /> 100% Safe, zero antivirus false positives
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Check className="w-3.5 h-3.5 text-[#caa055]" /> Launches instantly in GPU-accelerated desktop mode
                  </div>
                </div>
              </div>

              <a
                href="/api/download/KrajdenGrid-FastApp.bat"
                download="KrajdenGrid-FastApp.bat"
                className="w-full h-12 border border-white/20 hover:border-[#caa055] hover:bg-[#caa055]/10 text-white hover:text-[#caa055] font-cinzel font-bold text-xs tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" /> Download KrajdenGrid-FastApp.bat
              </a>
            </div>

          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#08080a] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <KrajdenCrest className="w-4 h-4 text-[#caa055]" />
            <span>Krajden Grid &copy; {new Date().getFullYear()} &bull; Windows Tabletop Overlay</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-[#caa055] transition-colors cursor-pointer"
            >
              DM Vault (Ctrl+Shift+A)
            </button>
            <Link to="/fullscreen" className="hover:text-[#caa055] transition-colors">
              Live Canvas
            </Link>
          </div>
        </div>
      </footer>

      {/* DM Secret Asset Vault Modal */}
      <AdminSecretModal 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
      />
    </div>
  );
}

export default HomePage;
