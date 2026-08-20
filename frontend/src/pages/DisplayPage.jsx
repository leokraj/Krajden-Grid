import { useState, useEffect, useRef, useContext, Suspense, lazy } from 'react';
import { GridProvider, useGrid } from '../context/GridContext';
import { SessionProvider, useSession } from '../context/SessionContext';
import SessionContext from '../context/SessionContext';
import { GridCanvas } from '../components/GridCanvas';
import { EffectsDrawingOverlay } from '../components/EffectsLayer';
import { Monitor, Wifi, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const SYNCED_GRID_KEYS = [
  'gridEnabled', 'gridColor', 'lineThickness', 'opacity', 'showSubdivisions',
  'subdivisionCount', 'unitWidth', 'unitHeight', 'lockRatio', 'gridSize',
  'squareSize', 'screenWidth', 'screenHeight', 'backgroundColor',
  'backgroundEnabled', 'measureMultiplier',
];

function GuestViewport({ hostWidth, hostHeight, children }) {
  const [bounds, setBounds] = useState({ width: '100%', height: '100%', left: 0, top: 0 });
  useEffect(() => {
    const calc = () => {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const hostRatio = hostWidth / hostHeight;
      const winRatio = winW / winH;
      let w, h, left, top;
      if (winRatio > hostRatio) {
        h = winH; w = winH * hostRatio; left = (winW - w) / 2; top = 0;
      } else {
        w = winW; h = winW / hostRatio; left = 0; top = (winH - h) / 2;
      }
      setBounds({ width: w, height: h, left, top });
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [hostWidth, hostHeight]);

  return (
    <div style={{ position: 'absolute', left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

const DisplayCanvas = () => {
  const { settings, updateSettings } = useGrid();
  const { sessionCode, isHost } = useSession();
  const sessionContext = useContext(SessionContext);
  const remoteGridSettings = sessionContext?.remoteGridSettings;
  const hostDimensions = sessionContext?.hostDimensions;
  const clearAllEvent = sessionContext?.clearAllEvent;
  const { clearDrawings, clearMeasurements } = useGrid();
  const isGuest = sessionCode && !isHost;

  // Apply remote grid settings
  useEffect(() => {
    if (!isGuest || !remoteGridSettings) return;
    updateSettings(remoteGridSettings);
  }, [isGuest, remoteGridSettings, updateSettings]);

  // Clear all event
  const clearAllRef = useRef(0);
  useEffect(() => {
    if (clearAllEvent > 0 && clearAllEvent !== clearAllRef.current) {
      clearAllRef.current = clearAllEvent;
      clearDrawings();
      clearMeasurements();
    }
  }, [clearAllEvent, clearDrawings, clearMeasurements]);

  // Auto fullscreen
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0"
      style={{ backgroundColor: settings.backgroundEnabled !== false ? settings.backgroundColor : '#050609' }}
      data-testid="display-canvas"
    >
      {isGuest && hostDimensions ? (
        <GuestViewport hostWidth={hostDimensions.width} hostHeight={hostDimensions.height}>
          <GridCanvas interactive={false} fullscreen={true} className="absolute inset-0" />
          <EffectsDrawingOverlay />
        </GuestViewport>
      ) : (
        <>
          <GridCanvas interactive={false} fullscreen={true} className="absolute inset-0" />
          <EffectsDrawingOverlay />
        </>
      )}
      {/* Session indicator */}
      <div className="fixed top-3 right-3 z-50 bg-[#050609]/80 backdrop-blur-sm border border-border-gold rounded-sm px-3 py-1.5 flex items-center gap-2 opacity-50 hover:opacity-100 transition-all">
        <Monitor className="w-3.5 h-3.5 text-gold" />
        <span className="text-xs text-white/80 font-mono tracking-widest">{sessionCode}</span>
      </div>
    </div>
  );
};

const DisplayJoin = () => {
  const { isConnected, joinSession, sessionCode, error } = useSession();
  const [codeInput, setCodeInput] = useState('');
  const [joining, setJoining] = useState(false);

  if (sessionCode) {
    return <DisplayCanvas />;
  }

  const handleJoin = () => {
    if (codeInput.trim()) {
      setJoining(true);
      joinSession(codeInput.trim().toUpperCase(), 'Display');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 selection:bg-gold/30 selection:text-gold relative overflow-hidden" data-testid="display-join">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      
      {/* Radial Gold Light Leak */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle at center, #caa055 0%, rgba(28, 29, 31, 0) 70%)',
        }}
      />

      <div className="max-w-md w-full text-center relative z-10 animate-fade-in-up">
        {/* Logo */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-sm bg-gold/5 border border-border-gold mb-5">
            <Monitor className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-white mb-2 font-cinzel uppercase">Cast Projection</h1>
          <p className="text-xs text-slate-cool uppercase tracking-widest font-sans">Mirror the tactical battlefield grid onto this secondary monitor, TV, or projector</p>
        </div>

        {/* Join form */}
        <div className="vintage-corner-bracket bg-panel border border-border-gold rounded-sm p-6 shadow-2xl glow-gold-leak">
          <div className="flex items-center gap-2 mb-5 justify-center">
            <Wifi className={`w-3.5 h-3.5 ${isConnected ? 'text-green-400' : 'text-gold animate-pulse'}`} />
            <span className="text-[10px] text-slate-cool font-mono uppercase tracking-widest">{isConnected ? 'Server Connected' : 'Connecting Taverns...'}</span>
          </div>

          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="CAMPAIGN CODE"
            className="text-center text-xl font-mono tracking-[0.3em] h-12 bg-background/50 border-border-gold mb-4 text-white focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold rounded-sm"
            maxLength={6}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
            data-testid="display-code-input"
          />

          {error && (
            <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-sm">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <Button
            onClick={handleJoin}
            className="w-full h-11 text-xs font-bold bg-gold hover:bg-gold-bright text-black rounded-sm tracking-[0.2em] font-cinzel uppercase"
            disabled={!codeInput.trim() || !isConnected || joining}
            data-testid="display-join-btn"
          >
            {joining ? 'Casting...' : (
              <>
                Connect Cast Display
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-slate-muted mt-6 font-mono uppercase tracking-widest">
          Open <span className="text-gold">/remote</span> on your controller device to generate a campaign code.
        </p>
      </div>
    </div>
  );
};

export function DisplayPage() {
  return (
    <GridProvider>
      <SessionProvider>
        <DisplayJoin />
      </SessionProvider>
    </GridProvider>
  );
}

export default DisplayPage;
