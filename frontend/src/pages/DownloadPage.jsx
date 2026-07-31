import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
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
  Lock,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function DownloadPage() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showSmartScreenHelp, setShowSmartScreenHelp] = useState(true);

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
  const [downloading, setDownloading] = useState(false);
  const [downloadingPortable, setDownloadingPortable] = useState(false);
  const [downloadingBat, setDownloadingBat] = useState(false);
  const [progress, setProgress] = useState(0);
  const [portableProgress, setPortableProgress] = useState(0);
  const [batProgress, setBatProgress] = useState(0);
  const [error, setError] = useState(null);

  const performStreamingDownload = useCallback(async (filename, setProg, setDown) => {
    setDown(true);
    setProg(0);
    setError(null);

    const downloadUrl = `${backendUrl}/api/download/${filename}`;

    try {
      // 0. Fast check if file is hosted externally (e.g. GitHub Releases)
      try {
        const infoRes = await fetch(`${downloadUrl}?info=true`);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          if (infoData && infoData.external && infoData.redirectUrl) {
            console.log(`[StreamingDownload] Asset is served externally (${infoData.redirectUrl}). Triggering direct browser download...`);
            const directLink = document.createElement('a');
            directLink.href = infoData.redirectUrl;
            directLink.download = filename;
            directLink.target = '_blank';
            directLink.rel = 'noopener noreferrer';
            document.body.appendChild(directLink);
            directLink.click();
            document.body.removeChild(directLink);
            setDown(false);
            return;
          }
        }
      } catch (infoErr) {
        console.warn('[StreamingDownload] Info probe skipped:', infoErr);
      }

      const response = await fetch(downloadUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      // Check if the response was intercepted by the AI Studio proxy login/challenge check
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('AUTH_REDIRECT_INTERCEPTED');
      }

      const reader = response.body.getReader();
      const contentLength = +response.headers.get('content-length') || 0;

      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (contentLength > 0) {
          setProg(Math.min(99, Math.round((receivedLength / contentLength) * 100)));
        } else {
          // If no content-length header, simulate active stream progress
          setProg((prev) => Math.min(95, prev + 2));
        }
      }

      setProg(100);
      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        setDown(false);
      }, 1000);

    } catch (e) {
      console.warn(`[Krajden Grid] Streaming download of ${filename} encountered issue (${e.message}). Triggering direct browser download fallback...`);
      try {
        let finalFilename = filename;
        if (filename.toLowerCase() === 'krajdengrid-setup.exe') {
          finalFilename = 'KrajdenGrid-Windows.zip';
        }
        const directLink = document.createElement('a');
        directLink.href = downloadUrl;
        directLink.download = finalFilename;
        directLink.target = '_blank';
        directLink.rel = 'noopener noreferrer';
        document.body.appendChild(directLink);
        directLink.click();
        document.body.removeChild(directLink);
      } catch (fallbackError) {
        console.error('[Krajden Grid] Fallback failed:', fallbackError);
      }

      if (e.message === 'AUTH_REDIRECT_INTERCEPTED' || e.message === 'Failed to fetch') {
        setError(
          <span className="block space-y-2">
            <strong className="text-white uppercase tracking-wider block">🔒 Direct Download Triggered</strong>
            <span>Your browser is downloading <strong>{filename}</strong> via direct link. If the download does not start automatically:</span>
            <a 
              href={downloadUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center justify-center mt-2 bg-gold hover:bg-gold-light text-black font-bold px-4 py-2.5 rounded-lg transition-all text-[10px] uppercase tracking-widest gap-2 shadow-md hover:shadow-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Click Here to Download Directly
            </a>
          </span>
        );
      } else {
        console.error(`[Krajden Grid] Download of ${filename} failed:`, e);
        setError(`Download attempted via fallback link. If it did not start, please click "Open App in New Tab".`);
      }
      setDown(false);
    }
  }, [backendUrl]);

  const performChunkedDownload = useCallback(async (filename, setProg, setDown) => {
    setDown(true);
    setProg(0);
    setError(null);

    const downloadUrl = `${backendUrl}/api/download/${filename}`;
    let finalFilename = filename;
    if (filename.toLowerCase() === 'krajdengrid-setup.exe') {
      finalFilename = 'KrajdenGrid-Windows.zip';
    }

    try {
      // 0. Fast check if file is hosted externally (e.g. GitHub Releases)
      try {
        const infoRes = await fetch(`${downloadUrl}?info=true`);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          if (infoData && infoData.external && infoData.redirectUrl) {
            console.log(`[ChunkedDownload] Asset is served externally (${infoData.redirectUrl}). Opening in new window...`);
            window.open(infoData.redirectUrl, '_blank');
            setDown(false);
            return;
          }
        }
      } catch (infoErr) {
        console.warn('[ChunkedDownload] Info probe skipped:', infoErr);
      }

      // 1. Get the file size using a lightweight 206 request for the first byte
      console.log(`[ChunkedDownload] Probing file size for ${filename}...`);
      const probeResponse = await fetch(downloadUrl, {
        headers: { 'Range': 'bytes=0-0' },
        credentials: 'include'
      });

      if (!probeResponse.ok && probeResponse.status !== 206) {
        throw new Error(`Server returned HTTP ${probeResponse.status} ${probeResponse.statusText}`);
      }

      // Check if the response was intercepted by proxy login/challenge check
      const contentType = probeResponse.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('AUTH_REDIRECT_INTERCEPTED');
      }

      const contentRange = probeResponse.headers.get('Content-Range');
      let fileSize = 0;
      if (contentRange) {
        // Content-Range format is "bytes 0-0/113324604"
        const parts = contentRange.split('/');
        if (parts.length === 2) {
          fileSize = parseInt(parts[1], 10);
        }
      }

      if (!fileSize) {
        fileSize = parseInt(probeResponse.headers.get('content-length') || '0', 10);
      }

      console.log(`[ChunkedDownload] File size detected: ${fileSize} bytes`);

      if (fileSize <= 0) {
        throw new Error('Could not determine file size');
      }

      // 2. Download the file in chunks of 25MB to bypass Cloud Run 32MB limits
      const chunkSize = 25 * 1024 * 1024; // 25 MB
      const totalChunks = Math.ceil(fileSize / chunkSize);
      const chunks = [];
      let receivedBytes = 0;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize - 1, fileSize - 1);
        console.log(`[ChunkedDownload] Fetching chunk ${i + 1}/${totalChunks} (bytes ${start}-${end})...`);

        const response = await fetch(downloadUrl, {
          headers: { 'Range': `bytes=${start}-${end}` },
          credentials: 'include'
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Failed to fetch chunk ${i + 1}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        chunks.push(buffer);
        receivedBytes += buffer.byteLength;

        // Update progress
        const percent = Math.min(99, Math.round((receivedBytes / fileSize) * 100));
        setProg(percent);
      }

      setProg(100);
      console.log(`[ChunkedDownload] All chunks downloaded successfully. Assembly in progress...`);

      // 3. Combine chunks into a single Blob and trigger browser save
      // Map 'KrajdenGrid-Setup.exe' correctly to the saved filename
      // The backend will serve the file renamed as 'KrajdenGrid-Windows.zip' if Setup.exe is requested but missing.
      let finalFilename = filename;
      if (filename.toLowerCase() === 'krajdengrid-setup.exe') {
        finalFilename = 'KrajdenGrid-Windows.zip';
      }

      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        setDown(false);
      }, 1000);

    } catch (e) {
      console.warn(`[ChunkedDownload] Fetch failed (${e.message}). Triggering direct browser download fallback...`);
      let finalFilename = filename;
      if (filename.toLowerCase() === 'krajdengrid-setup.exe') {
        finalFilename = 'KrajdenGrid-Windows.zip';
      }

      try {
        const directLink = document.createElement('a');
        directLink.href = downloadUrl;
        directLink.download = finalFilename;
        directLink.target = '_blank';
        directLink.rel = 'noopener noreferrer';
        document.body.appendChild(directLink);
        directLink.click();
        document.body.removeChild(directLink);
      } catch (fallbackErr) {
        console.error('[ChunkedDownload] Fallback failed:', fallbackErr);
      }

      if (e.message === 'AUTH_REDIRECT_INTERCEPTED' || e.message === 'Failed to fetch' || e.name === 'TypeError') {
        setError(
          <span className="block space-y-2">
            <strong className="text-white uppercase tracking-wider block">🔒 Direct Download Triggered</strong>
            <span>Your browser is downloading <strong>{finalFilename}</strong> directly. If the download does not start automatically:</span>
            <a 
              href={downloadUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center justify-center mt-2 bg-gold hover:bg-gold-light text-black font-bold px-4 py-2.5 rounded-lg transition-all text-[10px] uppercase tracking-widest gap-2 shadow-md hover:shadow-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Click Here to Download Directly ({finalFilename})
            </a>
          </span>
        );
      } else {
        setError(`Download attempted via fallback link. If it did not start, please click "Open App in New Tab".`);
      }
      setDown(false);
    }
  }, [backendUrl]);

  const handleDownload = useCallback(() => {
    performChunkedDownload('KrajdenGrid-Setup.exe', setProgress, setDownloading);
  }, [performChunkedDownload]);

  const handleDownloadPortable = useCallback(() => {
    performChunkedDownload('KrajdenGrid-Portable.zip', setPortableProgress, setDownloadingPortable);
  }, [performChunkedDownload]);

  const handleDownloadBat = useCallback(() => {
    performStreamingDownload('KrajdenGrid-Setup.bat', setBatProgress, setDownloadingBat);
  }, [performStreamingDownload]);

  const features = [
    'Always-on-top transparent tactical grid',
    'Click-through grid — interact with battlemaps below',
    'Cast to multiple displays or tablet projectors',
    'Real-time collaborative session sync',
    'Live drawing, pings, and tokens shared live',
    'Curated tabletop clipart & custom miniatures',
    'Tactical global hotkeys (Ctrl+Shift+G/D/M/Q)',
    'Full offline support for local campaigns',
  ];

  let isIframe = false;
  try {
    isIframe = typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    isIframe = true;
  }

  return (
    <div className="min-h-screen bg-background text-[#f3f4f6] selection:bg-gold/30 selection:text-gold relative overflow-hidden" data-testid="download-page">
      {isIframe && (
        <div className="bg-gradient-to-r from-amber-600 via-gold to-amber-600 text-black px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2 relative z-50 shadow-md">
          <span>💡 Running inside the AI Studio preview frame? For file downloads, OAuth logins, and tests to work, you must open the app in a new tab:</span>
          <a
            href={typeof window !== 'undefined' ? (window.location.origin + window.location.pathname) : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-black text-white hover:bg-neutral-800 px-3 py-1 rounded-md text-[10px] uppercase tracking-wider transition-all inline-flex items-center gap-1 shadow"
          >
            Open in New Tab
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050609]/80 backdrop-blur-md border-b border-border-gold/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-slate-cool hover:text-gold">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Tavern
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-sm bg-gold/5 border border-border-gold/30 flex items-center justify-center">
                <Grid3X3 className="w-4 h-4 text-gold" />
              </div>
              <span className="font-bold text-base tracking-widest font-cinzel">
                <span className="text-white">KRAJDEN </span>
                <span className="text-gold">GRID</span>
              </span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsAdminOpen(true)} 
            className="text-slate-cool hover:text-gold text-xs gap-1.5 font-mono border border-border-gold/10 hover:border-gold/30 rounded-lg px-3"
            data-testid="header-dm-vault-btn"
          >
            <Lock className="w-3.5 h-3.5 text-gold" /> 
            DM Vault
          </Button>
        </div>
      </header>

      {/* Hero + Download */}
      <section className="py-20 md:py-28 relative z-10 animate-fade-in">
        <div className="max-w-5xl mx-auto px-6">
          
          {/* Header text container */}
          <div className="max-w-2xl mx-auto text-center mb-16">
            <Badge 
              variant="outline" 
              className="mb-6 border-border-gold/30 text-gold bg-gold/5 px-4 py-1.5 font-mono uppercase tracking-widest flex items-center gap-2 w-fit mx-auto"
            >
              <Shield className="w-3.5 h-3.5" />
              Desktop Arsenal
            </Badge>
            <h1 className="text-4xl md:text-5.5xl font-black tracking-widest mb-4 text-white font-cinzel uppercase leading-tight">
              SUMMON <span className="text-gold">KRAJDEN GRID</span>
            </h1>
            <p className="text-sm md:text-base text-slate-cool leading-relaxed font-sans">
              Launch the transparent tactical grid directly above any desktop map application, browser, or virtual tabletop. Includes a 7-day free trial.
            </p>
          </div>

          {/* Cards Grid with ample horizontal space */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 text-left">
            {/* Developer Mode Local Shell */}
            <Card className="bg-panel border border-[#caa055]/30 rounded-2xl glow-gold-leak flex flex-col justify-between transition-all duration-300 hover:border-gold/50">
              <CardContent className="p-10 md:p-12 space-y-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-gold/5 border border-border-gold/30 shrink-0">
                      <Monitor className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-widest font-cinzel uppercase">Local Electron Shell</h3>
                      <p className="text-[10px] text-gold/80 font-mono tracking-wider">Developer & Testing Workflow (Highly Recommended)</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-cool leading-relaxed mb-6">
                    Run the exact transparent, always-on-top tabletop grid directly on your machine. This lightweight wrapper embeds the live preview with zero download latency or security warning prompts.
                  </p>

                  <div className="space-y-4 bg-black/60 border border-white/5 p-6 rounded-xl font-mono text-xs text-slate-cool">
                    <div className="flex items-start gap-2.5">
                      <span className="text-gold font-bold shrink-0">1.</span>
                      <span>Export this project as a ZIP from the top-right <strong className="text-white">Settings Gear → Export as ZIP</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-gold font-bold shrink-0">2.</span>
                      <span>Extract the files and open your terminal in the <code className="text-gold">electron-app</code> directory:</span>
                    </div>
                    <pre className="p-3 bg-black/80 rounded-lg text-[11px] text-white overflow-x-auto border border-white/5">cd electron-app</pre>
                    <div className="flex items-start gap-2.5">
                      <span className="text-gold font-bold shrink-0">3.</span>
                      <span>Install dependencies & start local testing:</span>
                    </div>
                    <pre className="p-3 bg-black/80 rounded-lg text-[11px] text-white overflow-x-auto border border-white/5">npm install && npm start</pre>
                    <div className="flex items-start gap-2.5">
                      <span className="text-gold font-bold shrink-0">4.</span>
                      <span>Package your beautiful Windows Installer (<code>.exe</code>):</span>
                    </div>
                    <pre className="p-3 bg-black/80 rounded-lg text-[11px] text-white overflow-x-auto border border-white/5">npm run dist</pre>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <p className="text-[10px] text-slate-muted uppercase tracking-widest text-center font-mono">
                    COMPATIBLE WITH WINDOWS, MACOS, AND LINUX
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Standard pre-compiled Windows setup */}
            <Card className="bg-panel border border-[#caa055]/30 rounded-2xl glow-gold-leak flex flex-col justify-between transition-all duration-300 hover:border-gold/50">
              <CardContent className="p-10 md:p-12 space-y-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-gold/5 border border-border-gold/30 shrink-0">
                      <Download className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-widest font-cinzel uppercase">Windows Desktop App</h3>
                      <p className="text-[10px] text-gold/80 font-mono tracking-wider">Official Precompiled Release</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-cool leading-relaxed mb-6">
                    Run Krajden Grid as a native Windows desktop companion. Select your preferred package below to install or run portably.
                  </p>

                  {error && (
                    <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3 text-xs text-red-300" data-testid="download-error">
                      {error}
                    </div>
                  )}

                  {downloadingBat && (
                    <div className="space-y-3 bg-black/30 p-5 border border-white/5 rounded-xl mb-4 animate-fade-in">
                      <div className="h-1 rounded-sm bg-background overflow-hidden">
                        <div
                          className="h-full bg-gold transition-all duration-300 rounded-sm"
                          style={{ width: `${batProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-muted font-mono uppercase tracking-widest">{batProgress < 100 ? 'Streaming Launcher...' : 'Complete!'} {batProgress}%</p>
                    </div>
                  )}

                  {downloading && (
                    <div className="space-y-3 bg-black/30 p-5 border border-white/5 rounded-xl mb-4 animate-fade-in">
                      <div className="h-1 rounded-sm bg-background overflow-hidden">
                        <div
                          className="h-full bg-gold transition-all duration-300 rounded-sm"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-muted font-mono uppercase tracking-widest">{progress < 100 ? 'Streaming Installer...' : 'Complete!'} {progress}%</p>
                    </div>
                  )}

                  {downloadingPortable && (
                    <div className="space-y-3 bg-black/30 p-5 border border-white/5 rounded-xl mb-4 animate-fade-in">
                      <div className="h-1 rounded-sm bg-background overflow-hidden">
                        <div
                          className="h-full bg-gold transition-all duration-300 rounded-sm"
                          style={{ width: `${portableProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-muted font-mono uppercase tracking-widest">{portableProgress < 100 ? 'Streaming Portable ZIP...' : 'Complete!'} {portableProgress}%</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* OPTION 1: BATCH LAUNCHER */}
                  <div>
                    <Button
                      size="lg"
                      onClick={handleDownloadBat}
                      disabled={downloading || downloadingPortable || downloadingBat}
                      className="w-full bg-gold hover:bg-gold-light text-black font-bold h-12 text-xs tracking-[0.2em] transition-all rounded-xl shadow-lg shadow-gold/10 hover:shadow-gold/20"
                    >
                      {downloadingBat ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Downloading Launcher...</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" /> Download Setup.bat (~4 KB)</>
                      )}
                    </Button>
                    <p className="text-[9px] text-gold/90 font-mono uppercase tracking-wider text-center mt-1.5 font-semibold">
                      ⚡ RECOMMENDED: 100% immune to Windows SmartScreen blocks & starts instantly!
                    </p>
                  </div>

                  {/* OPTION 2: EXE SETUP */}
                  <div className="pt-2 border-t border-white/5">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleDownload}
                      disabled={downloading || downloadingPortable || downloadingBat}
                      className="w-full border-white/20 hover:border-gold hover:bg-gold/5 text-white hover:text-gold font-bold h-12 text-xs tracking-[0.2em] transition-all rounded-xl"
                      data-testid="download-windows-btn"
                    >
                      {downloading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Downloading Installer...</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" /> Download Setup.exe (~36 MB)</>
                      )}
                    </Button>
                    <p className="text-[9px] text-slate-muted font-mono uppercase tracking-wider text-center mt-1.5">
                      Windows Standalone Installer wrapper.
                    </p>
                  </div>

                  {/* OPTION 3: PORTABLE ZIP */}
                  <div className="pt-2 border-t border-white/5">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleDownloadPortable}
                      disabled={downloading || downloadingPortable || downloadingBat}
                      className="w-full border-[#caa055]/40 hover:border-gold hover:bg-gold/5 text-gold font-bold h-12 text-xs tracking-[0.2em] transition-all rounded-xl"
                    >
                      {downloadingPortable ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Downloading ZIP...</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" /> Download Portable ZIP (~120 MB)</>
                      )}
                    </Button>
                    <p className="text-[9px] text-slate-muted font-mono uppercase tracking-wider text-center mt-1.5">
                      100% Offline & Precompiled. Unzip anywhere and double-click.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Windows SmartScreen & Smart App Control Helper */}
          <div className="mb-16 max-w-4xl mx-auto">
            <div className="bg-[#111216] border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-xl text-left">
              <div 
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowSmartScreenHelp(prev => !prev)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wider font-cinzel uppercase flex items-center gap-2">
                      Windows SmartScreen or Smart App Control Blocking the App?
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">FIX & UNBLOCK</span>
                    </h3>
                    <p className="text-[11px] text-gray-400 font-sans">
                      Windows Defender flags custom indie software without a paid Microsoft EV certificate. Here is how to unblock it in 10 seconds.
                    </p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-white p-1">
                  {showSmartScreenHelp ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {showSmartScreenHelp && (
                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-300">
                  {/* Method 1: Batch Launcher */}
                  <div className="bg-black/40 p-4 rounded-xl border border-amber-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-[11px] uppercase">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] text-amber-400">1</span>
                      Use Included Launcher
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      Extract the <strong className="text-gold">KrajdenGrid-Portable.zip</strong>, then double-click:
                    </p>
                    <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded text-center text-amber-300 font-mono font-bold text-[11px]">
                      📄 Launch-KrajdenGrid.bat
                    </div>
                    <p className="text-[10px] text-gray-400 font-sans">
                      This script unblocks all extracted files via PowerShell automatically before launching <code className="text-white">KrajdenGrid.exe</code>.
                    </p>
                  </div>

                  {/* Method 2: Defender Exclusion */}
                  <div className="bg-black/40 p-4 rounded-xl border border-amber-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-[11px] uppercase">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] text-amber-400">2</span>
                      Add Defender Exclusion
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      If Windows 11 <strong className="text-white">Smart App Control</strong> still blocks the EXE:
                    </p>
                    <ol className="list-decimal list-inside text-[10px] text-gray-300 space-y-1 font-mono">
                      <li>Open <strong className="text-amber-300">Windows Security</strong> from Start</li>
                      <li>Go to <strong className="text-white">Virus & threat protection settings</strong></li>
                      <li>Click <strong className="text-amber-300">Add or remove exclusions</strong></li>
                      <li>Add <strong className="text-white">Folder</strong> &rarr; Select unzipped folder</li>
                    </ol>
                  </div>

                  {/* Method 3: PWA Web App */}
                  <div className="bg-black/40 p-4 rounded-xl border border-amber-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-[11px] uppercase">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] text-amber-400">3</span>
                      Chrome / Edge Windowed App
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      Run directly in browser with 0% chance of Windows blocks:
                    </p>
                    <a 
                      href="/fullscreen" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block w-full bg-gold/10 hover:bg-gold/20 border border-gold/30 text-gold text-center py-2 rounded text-[11px] font-bold uppercase font-mono transition-colors"
                    >
                      🚀 Open Fullscreen Battleground
                    </a>
                    <p className="text-[10px] text-gray-400 font-sans">
                      In Chrome/Edge menu, click <strong className="text-white font-mono">Cast, save & share &rarr; Install page as app</strong> for a standalone windowed desktop app!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Features Checklist */}
          <div className="border-t border-white/5 pt-12 max-w-3xl mx-auto">
            <h4 className="text-center text-xs font-bold font-cinzel tracking-[0.2em] uppercase text-gold/80 mb-8">
              Krajden Grid Desktop Capabilities
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-left">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-slate-cool transition-all hover:text-white">
                  <Check className="w-4 h-4 text-gold shrink-0" />
                  <span className="font-sans text-xs leading-relaxed">{feature}</span>
                </div>
              ))}
            </div>

            {/* Asset Vault Link */}
            <div className="mt-12 pt-6 border-t border-white/5 text-center">
              <button 
                onClick={() => setIsAdminOpen(true)} 
                className="inline-flex items-center gap-2 text-[11px] text-slate-muted hover:text-gold transition-colors font-mono tracking-wider opacity-80 hover:opacity-100"
                data-testid="footer-dm-vault-btn"
              >
                <Lock className="w-3.5 h-3.5 text-gold/70" />
                Asset Vault Admin
                <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-slate-cool border border-white/10 font-sans">
                  Ctrl+Shift+A
                </span>
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* Secret DM Admin Modal */}
      <AdminSecretModal 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
      />
    </div>
  );
}

export default DownloadPage;
