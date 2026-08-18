import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import AdminSecretModal from '../components/AdminSecretModal';
import { 
  ArrowLeft, 
  Download, 
  Monitor, 
  Grid3X3,
  Check, 
  Loader2, 
  Shield, 
  ExternalLink, 
  Terminal,
  ChevronDown,
  ChevronUp,
  Tv,
  Sparkles,
  HelpCircle,
  Package,
  Copy,
  CheckCircle2,
  AlertCircle,
  Zap,
  Code
} from 'lucide-react';

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

function WindowsIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.551H10.949M0 12.6h9.75V22.05L0 20.7m10.949-8.1H24V24l-13.051-1.8" />
    </svg>
  );
}

export function DownloadPage() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [copiedPowerShell, setCopiedPowerShell] = useState(false);
  const [copiedCurlZip, setCopiedCurlZip] = useState(false);
  const [copiedBatScript, setCopiedBatScript] = useState(false);
  const [showBatScript, setShowBatScript] = useState(false);

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

  const publicUrl = backendUrl.replace('ais-dev-', 'ais-pre-');
  const downloadZipUrl = `${publicUrl}/api/download/KrajdenGrid-Windows.zip`;
  const downloadBatUrl = `${publicUrl}/api/download/Install-KrajdenGrid.bat`;
  const ps1InstallCommand = `irm ${publicUrl}/api/download/Install-KrajdenGrid.ps1 | iex`;

  const batScriptContent = `@echo off
title Krajden Grid Desktop Launcher
echo Launching Krajden Grid Overlay for Windows...
set "TARGET_URL=${backendUrl}/fullscreen"
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized
    exit /b
)
if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized
    exit /b
)
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%" --window-size=1920,1080 --start-maximized
    exit /b
)
start "" "%TARGET_URL%"
exit /b`;

  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState('');
  const [downloadError, setDownloadError] = useState('');

  // 100% Reliable Native File Saving & Blob trigger
  const handleDownloadBat = async () => {
    setDownloadError('');
    // Try Native Windows File Picker (bypasses iframe restrictions)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'KrajdenGrid.bat',
          types: [{
            description: 'Windows Batch Command File (*.bat)',
            accept: { 'text/plain': ['.bat'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(batScriptContent);
        await writable.close();
        setDownloadSuccess('KrajdenGrid.bat saved to your PC!');
        setTimeout(() => setDownloadSuccess(''), 5000);
        return;
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') return;
        console.warn('showSaveFilePicker fallback:', pickerErr);
      }
    }

    // Fallback: Blob URL download
    try {
      const blob = new Blob([batScriptContent], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'KrajdenGrid.bat';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadSuccess('KrajdenGrid.bat downloaded!');
      setTimeout(() => setDownloadSuccess(''), 5000);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadError('Browser blocked iframe download. Please use the Copy Code or PowerShell option below!');
    }
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    setDownloadError('');
    try {
      // Direct stream fetch
      const response = await fetch(downloadZipUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: 'KrajdenGrid-Windows.zip',
            types: [{
              description: 'ZIP Archive (*.zip)',
              accept: { 'application/zip': ['.zip'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setDownloadSuccess('KrajdenGrid-Windows.zip saved to your PC!');
          setTimeout(() => setDownloadSuccess(''), 5000);
          setIsDownloadingZip(false);
          return;
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') {
            setIsDownloadingZip(false);
            return;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'KrajdenGrid-Windows.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadSuccess('KrajdenGrid-Windows.zip downloaded!');
      setTimeout(() => setDownloadSuccess(''), 5000);
    } catch (err) {
      console.warn('Direct zip fetch failed:', err);
      // Try direct link fallback
      window.open(downloadZipUrl, '_blank');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const ps1Command = `irm ${downloadBatUrl} -OutFile "$HOME\\Desktop\\KrajdenGrid.bat"; & "$HOME\\Desktop\\KrajdenGrid.bat"`;
  const curlZipCommand = `curl.exe -L "${downloadZipUrl}" -o "$HOME\\Downloads\\KrajdenGrid-Windows.zip"`;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col selection:bg-[#caa055] selection:text-black relative overflow-x-hidden font-sans">
      
      {/* Background radial glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[160px] pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle at center, #caa055 0%, rgba(10, 10, 12, 0) 70%)' }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3 group cursor-pointer select-none">
              <KrajdenCrest className="w-8 h-8 text-[#caa055] group-hover:scale-105 transition-transform" />
              <div className="flex flex-col">
                <span className="font-cinzel text-xl font-bold tracking-[0.15em] text-[#caa055] leading-none">
                  KRAJDEN DUNGEONS
                </span>
                <span className="font-mono text-[9px] tracking-[0.25em] text-slate-400 mt-1 uppercase leading-none">
                  OFFICIAL DOWNLOAD HUB
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link 
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-slate-300 hover:text-white text-xs font-mono transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>

            <button
              onClick={() => setIsAdminOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#caa055]/30 bg-[#caa055]/10 text-[#caa055] hover:bg-[#caa055]/20 text-xs font-cinzel font-bold transition-all cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-[#caa055]" />
              <span>Asset Vault</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Download Hub Content */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 sm:py-16 space-y-10 text-center">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#caa055]/10 border border-[#caa055]/30 text-[#caa055] text-xs font-mono uppercase tracking-wider">
            <WindowsIcon className="w-3.5 h-3.5" />
            <span>Native Windows Desktop Application (x64) &bull; No Browser Required</span>
          </div>

          <h1 className="font-cinzel text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-tight">
            Install Krajden Grid <br />
            <span className="text-[#caa055] italic">On Windows PC</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-sans max-w-2xl mx-auto">
            This is the <strong>native Windows desktop executable (<code className="text-[#caa055]">KrajdenGrid.exe</code>)</strong> with full offline support, hardware-accelerated grid rendering, TV-table calibration, and multi-monitor windowing.
          </p>

          {/* Download status toast */}
          {downloadSuccess && (
            <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-xl text-green-300 text-xs font-mono flex items-center gap-2 animate-in fade-in max-w-xl mx-auto">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {downloadError && (
            <div className="p-4 bg-amber-500/20 border border-amber-500/50 rounded-xl text-amber-200 text-xs font-mono text-left flex items-start gap-3 max-w-xl mx-auto">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Note:</strong> {downloadError}
              </div>
            </div>
          )}
        </div>

        {/* PRIMARY OPTION 1: 1-CLICK POWERSHELL NATIVE INSTALLER */}
        <div className="max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl bg-[#141519] border-2 border-[#caa055] shadow-2xl text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#caa055]/20 flex items-center justify-center text-[#caa055]">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#caa055] uppercase tracking-widest font-bold block">
                  ⚡ FASTEST 1-CLICK WINDOWS INSTALL (RECOMMENDED)
                </span>
                <h3 className="font-cinzel text-lg sm:text-xl font-bold text-white uppercase">
                  Automatic Windows App Installer
                </h3>
              </div>
            </div>

            <button
              onClick={() => copyToClipboard(ps1InstallCommand, setCopiedPowerShell)}
              className="bg-[#caa055] hover:bg-[#d5b271] text-black px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shrink-0"
            >
              {copiedPowerShell ? <><Check className="w-4 h-4 text-green-900" /> Command Copied!</> : <><Copy className="w-4 h-4" /> Copy Install Command</>}
            </button>
          </div>

          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            Open <strong>Windows PowerShell</strong> (Press Windows Key, type <code className="text-[#caa055]">PowerShell</code>, press Enter), paste this line, and press Enter. It automatically downloads <strong>KrajdenGrid.exe</strong>, installs it to your PC, creates a <strong>Krajden Grid Desktop Icon</strong>, and launches the native Windows app:
          </p>

          <pre className="p-3.5 bg-black/95 rounded-xl text-xs text-amber-200 font-mono overflow-x-auto select-all border border-[#caa055]/30 leading-relaxed font-bold">
            {ps1InstallCommand}
          </pre>
        </div>

        {/* Download Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
          
          {/* Method 1: Complete Standalone Native ZIP */}
          <div className="p-8 rounded-2xl bg-[#141519] border border-[#caa055]/40 flex flex-col justify-between space-y-6 shadow-xl relative">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#caa055]/10 border border-[#caa055]/30 flex items-center justify-center text-[#caa055]">
                  <Package className="w-6 h-6" />
                </div>
                <Badge className="bg-[#caa055] text-black font-mono font-bold text-[10px] uppercase">
                  Native .exe (125 MB)
                </Badge>
              </div>

              <div>
                <h2 className="font-cinzel text-xl font-bold text-white uppercase tracking-wide">
                  Direct Standalone ZIP
                </h2>
                <span className="text-[11px] font-mono text-[#caa055] font-semibold block mt-0.5">
                  KrajdenGrid-Windows.zip
                </span>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Contains the native Windows executable <strong className="text-white font-mono">KrajdenGrid.exe</strong>. Extract the folder anywhere on your PC and double-click to launch without a browser.
                </p>
              </div>

              <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5 font-mono">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#caa055]" /> Native 64-bit Windows Executable (.exe)
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#caa055]" /> 100% Offline with all 200+ token cliparts
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#caa055]" /> TV Table & Multi-Monitor Hardware Rendering
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleDownloadZip}
                disabled={isDownloadingZip}
                className="w-full h-12 bg-[#caa055] hover:bg-[#d5b271] text-black font-cinzel font-bold text-xs tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isDownloadingZip ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Downloading ZIP (~125 MB)...</>
                ) : (
                  <><Download className="w-4 h-4" /> Download Windows App (.zip)</>
                )}
              </button>

              <div className="text-center">
                <a
                  href={downloadZipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#caa055] hover:underline font-mono"
                >
                  Direct browser download link &rarr;
                </a>
              </div>
            </div>
          </div>

          {/* Method 2: 1-Click Installer .BAT File */}
          <div className="p-8 rounded-2xl bg-[#141519] border border-white/15 flex flex-col justify-between space-y-6 shadow-xl relative">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#caa055]">
                  <Download className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="text-slate-300 border-white/20 font-mono text-[10px]">
                  Installer Helper
                </Badge>
              </div>

              <div>
                <h2 className="font-cinzel text-xl font-bold text-white uppercase tracking-wide">
                  Installer Helper (.bat)
                </h2>
                <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                  Install-KrajdenGrid.bat
                </span>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Download this script and double-click it. It runs the Windows installer to set up <strong className="text-white">KrajdenGrid.exe</strong> and create desktop icons for you.
                </p>
              </div>

              <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5 font-mono">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#caa055]" /> Automatically creates Desktop icon
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#caa055]" /> Adds Krajden Grid to Windows Start Menu
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={`${backendUrl}/api/download/Install-KrajdenGrid.bat`}
                download="Install-KrajdenGrid.bat"
                className="w-full h-12 border border-[#caa055]/50 hover:border-[#caa055] hover:bg-[#caa055]/10 text-[#caa055] font-cinzel font-bold text-xs tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" /> Download Install-KrajdenGrid.bat
              </a>

              <div className="p-2 bg-black/80 rounded-xl border border-white/5 text-[10px] font-mono text-slate-400 text-center">
                Double-click on your PC to install
              </div>
            </div>
          </div>

        </div>

        {/* 3 Simple Setup Steps */}
        <div className="max-w-4xl mx-auto pt-8 border-t border-white/5 space-y-6 text-left">
          <h2 className="font-cinzel text-xl font-bold uppercase text-white tracking-wider text-center">
            How to Run on Windows
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#121316] border border-white/5 space-y-2">
              <span className="text-[#caa055] font-bold text-sm">STEP 1</span>
              <p className="text-slate-300 font-sans text-xs">
                Copy and run the <strong>PowerShell Command</strong> above (or download the ZIP / BAT).
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#121316] border border-white/5 space-y-2">
              <span className="text-[#caa055] font-bold text-sm">STEP 2</span>
              <p className="text-slate-300 font-sans text-xs">
                Double-click <code className="text-[#caa055]">KrajdenGrid.bat</code> on your Desktop.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#121316] border border-white/5 space-y-2">
              <span className="text-[#caa055] font-bold text-sm">STEP 3</span>
              <p className="text-slate-300 font-sans text-xs">
                Move the window to your table monitor/TV and press <code className="text-[#caa055]">F11</code> for borderless tabletop gaming!
              </p>
            </div>
          </div>
        </div>

        {/* Windows SmartScreen Notice */}
        <div className="max-w-4xl mx-auto bg-[#121316] border border-amber-500/30 rounded-xl p-6 text-left space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-mono text-xs font-bold">
            <HelpCircle className="w-4 h-4" />
            <span>Windows SmartScreen Note</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Because Krajden Grid is an independent tabletop gaming tool, Windows may show <em>"Windows protected your PC"</em> on the first run. Click <strong>"More info"</strong> and then <strong>"Run anyway"</strong>.
          </p>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#08080a] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <KrajdenCrest className="w-4 h-4 text-[#caa055]" />
            <span>Krajden Dungeons &copy; {new Date().getFullYear()} &bull; All Rights Reserved</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-[#caa055] transition-colors">
              Home
            </Link>
            <button 
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-[#caa055] transition-colors cursor-pointer"
            >
              DM Vault (Ctrl+Shift+A)
            </button>
            <Link to="/fullscreen" className="hover:text-[#caa055] transition-colors">
              Web Canvas
            </Link>
          </div>
        </div>
      </footer>

      <AdminSecretModal 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
      />
    </div>
  );
}

export default DownloadPage;
