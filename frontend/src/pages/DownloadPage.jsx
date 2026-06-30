import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  ArrowLeft, 
  Download, 
  Monitor, 
  Grid3X3,
  Check,
  Loader2,
  Shield,
  ExternalLink,
} from 'lucide-react';

export default function DownloadPage() {
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
      if (e.message === 'AUTH_REDIRECT_INTERCEPTED') {
        console.warn(`[Krajden Grid] Download of ${filename} intercepted by iframe sandbox. Triggering automatic fallback download...`);
        try {
          const directLink = document.createElement('a');
          directLink.href = downloadUrl;
          directLink.download = filename;
          directLink.target = '_blank';
          directLink.rel = 'noopener noreferrer';
          document.body.appendChild(directLink);
          directLink.click();
          document.body.removeChild(directLink);

          setError(
            <span className="block space-y-2">
              <strong className="text-white uppercase tracking-wider block">🔒 Download Intercepted by Iframe Sandbox</strong>
              <span>Because the preview is running inside a secure Google AI Studio iframe, your browser blocks secure streaming downloads.</span>
              <span className="block mt-2 text-gold font-semibold">💡 Click the button below to open the application in a new tab, where downloading will work instantly and flawlessly!</span>
              <a 
                href={window.location.origin + "/download"} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center justify-center mt-2 bg-gold hover:bg-gold-light text-black font-bold px-4 py-2.5 rounded-lg transition-all text-[10px] uppercase tracking-widest gap-2 shadow-md hover:shadow-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open App in New Tab & Download
              </a>
            </span>
          );
        } catch (fallbackError) {
          console.error('[Krajden Grid] Fallback failed:', fallbackError);
          setError(
            <span className="block space-y-2">
              <strong className="text-white uppercase tracking-wider block">🔒 Download Intercepted</strong>
              <span>The platform's iframe security rules blocked direct downloads.</span>
              <span className="block mt-2 text-gold font-semibold">💡 Click the button below to open the application in a new tab, where downloading will work instantly and flawlessly!</span>
              <a 
                href={window.location.origin + "/download"} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center justify-center mt-2 bg-gold hover:bg-gold-light text-black font-bold px-4 py-2.5 rounded-lg transition-all text-[10px] uppercase tracking-widest gap-2 shadow-md hover:shadow-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open App in New Tab & Download
              </a>
            </span>
          );
        }
      } else {
        console.error(`[Krajden Grid] Download of ${filename} failed:`, e);
        setError(`Download failed: ${e.message}. Please try opening the app in a new tab first.`);
      }
      setDown(false);
    }
  }, [backendUrl]);

  const handleDownload = useCallback(() => {
    performStreamingDownload('KrajdenGrid-Setup.exe', setProgress, setDownloading);
  }, [performStreamingDownload]);

  const handleDownloadPortable = useCallback(() => {
    performStreamingDownload('KrajdenGrid-Portable.zip', setPortableProgress, setDownloadingPortable);
  }, [performStreamingDownload]);

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
          </div>

        </div>
      </section>
    </div>
  );
}
