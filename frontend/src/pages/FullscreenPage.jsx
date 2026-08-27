import React, { useState, useEffect } from 'react';
import { GridProvider, useGrid } from '../context/GridContext';
import { SessionProvider, useSession } from '../context/SessionContext';
import { GridCanvas } from '../components/GridCanvas';
import { FloatingControls } from '../components/FloatingControls';
import { Toaster } from '../components/ui/sonner';
import { ClipartLibrary } from '../components/ClipartLibrary';
import BackgroundLayersPanel from '../components/BackgroundLayersPanel';
import { DiceAnimationLayer } from '../components/DiceAnimation';
import { EffectsDrawingOverlay, EffectsControlPanel } from '../components/EffectsLayer';

export function FullscreenContent() {
  const { 
    settings, 
    updateSettings,
    clipartFavorites,
    toggleClipartFavorite,
    customCliparts,
    addCustomClipart,
    removeCustomClipart,
    addPlacedClipart
  } = useGrid();
  const [showControls, setShowControls] = useState(true);

  // Parse mode and electron status from URL search parameters / electron API
  const queryParams = new URLSearchParams(window.location.search);
  const mode = queryParams.get('mode');
  const isElectron = !!(window.electronAPI?.isElectron || queryParams.get('electron') === '1');

  // Body background configuration
  useEffect(() => {
    if (isElectron) {
      document.body.style.backgroundColor = '#0d0f12';
      document.documentElement.style.backgroundColor = '#0d0f12';
      document.body.style.background = '#0d0f12';
      document.documentElement.style.background = '#0d0f12';
      document.body.classList.add('electron-app');
      document.documentElement.classList.add('electron-app');
    }
  }, [isElectron, mode]);

  // Auto enter fullscreen when page loads (ONLY for main tabletop overlay grid, not standalone tool windows, and NOT in Electron!)
  useEffect(() => {
    if (mode) return; // Standalone panels should never force fullscreen
    if (window.electronAPI?.isElectron) return; // In Electron, the frameless window is already full size, so native fullscreen is not needed and avoids minimizing on focus loss!

    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn('Fullscreen request blocked or failed:', err);
      }
    };
    
    // Tiny delay to bypass initial render constraints
    const timer = setTimeout(enterFullscreen, 1000);
    return () => clearTimeout(timer);
  }, [mode]);

  // Handle standalone child windows
  if (mode === 'clipart') {
    return (
      <div className="fixed inset-0 bg-transparent text-white overflow-hidden flex flex-col h-screen w-screen select-none p-1.5 animate-in fade-in duration-200" data-testid="fullscreen-clipart-mode">
        <div className="flex-1 w-full h-full rounded-2xl border border-white/15 overflow-hidden shadow-2xl bg-[#0d0d0f] flex flex-col">
          <ClipartLibrary
            isOpen={true}
            isDocked={false}
            onClose={() => window.close()}
            favorites={clipartFavorites}
            onToggleFavorite={toggleClipartFavorite}
            customCliparts={customCliparts}
            onAddCustomClipart={addCustomClipart}
            onRemoveCustomClipart={removeCustomClipart}
            onSelectClipart={(item) => {
              const viewportWidth = 1920;
              const viewportHeight = 1080;
              const centerX = viewportWidth / 2;
              const centerY = viewportHeight / 2;
              
              const newClipart = {
                ...item,
                x: centerX,
                y: centerY,
                scale: 50,
                rotation: 0,
              };
              addPlacedClipart(newClipart);
            }}
          />
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  if (mode === 'layers') {
    return (
      <div className="fixed inset-0 bg-transparent text-white flex flex-col h-screen w-screen select-none p-1.5 animate-in fade-in duration-200" data-testid="fullscreen-layers-mode">
        <div className="flex-1 bg-[#0d0d0f] rounded-2xl border border-white/15 overflow-hidden shadow-2xl flex flex-col p-4">
          <div 
            className="flex items-center justify-between border-b border-white/10 pb-2 mb-4 bg-white/5 p-2 rounded-t-xl shrink-0 cursor-move"
            style={window.electronAPI?.isElectron ? { WebkitAppRegion: 'drag' } : undefined}
          >
            <div className="flex items-center gap-1.5 select-none">
              <span className="text-xs font-semibold text-white">🗺️ Battle Maps & Layers Library</span>
            </div>
            <button
              onClick={() => window.close()}
              className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10 rounded flex items-center justify-center font-bold text-xs cursor-pointer"
              style={window.electronAPI?.isElectron ? { WebkitAppRegion: 'no-drag' } : undefined}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <BackgroundLayersPanel />
          </div>
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  if (mode === 'effects') {
    return (
      <div className="fixed inset-0 bg-transparent text-white flex flex-col h-screen w-screen select-none p-1.5 animate-in fade-in duration-200" data-testid="fullscreen-effects-mode">
        <div className="flex-1 bg-[#0d0d0f] rounded-2xl border border-white/15 overflow-hidden shadow-2xl flex flex-col p-4">
          <div 
            className="flex items-center justify-between border-b border-white/10 pb-2 mb-4 bg-white/5 p-2 rounded-t-xl shrink-0 cursor-move"
            style={window.electronAPI?.isElectron ? { WebkitAppRegion: 'drag' } : undefined}
          >
            <div className="flex items-center gap-1.5 select-none">
              <span className="text-xs font-semibold text-white">✨ Animated Visual Effects Library</span>
            </div>
            <button
              onClick={() => window.close()}
              className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10 rounded flex items-center justify-center font-bold text-xs cursor-pointer"
              style={window.electronAPI?.isElectron ? { WebkitAppRegion: 'no-drag' } : undefined}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <EffectsControlPanel onClose={() => window.close()} />
          </div>
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  // Stabilize and auto-restore fullscreen mode after file import/picker dialog exits
  useEffect(() => {
    if (window.electronAPI?.isElectron) return;

    const handleGlobalClick = (e) => {
      // If they clicked on a file input, we are initiating a file selection
      if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'file') {
        window.isSelectingFile = true;
      }
    };

    const handleWindowFocus = () => {
      if (window.isSelectingFile) {
        // Give a tiny timeout for the OS dialog closure to settle, then try to restore fullscreen
        setTimeout(async () => {
          if (window.isSelectingFile && !document.fullscreenElement) {
            try {
              await document.documentElement.requestFullscreen();
              window.isSelectingFile = false;
            } catch (err) {
              console.warn('Focus fullscreen restore blocked, will restore on click instead.');
            }
          }
        }, 400);
      }
    };

    const handleRestoreOnClick = async (e) => {
      // If we are waiting to restore fullscreen after file selection, and they click anywhere
      if (window.isSelectingFile && !document.fullscreenElement) {
        // Do not intercept if they are clicking a file input again
        if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'file') {
          return;
        }

        try {
          await document.documentElement.requestFullscreen();
          window.isSelectingFile = false;
        } catch (err) {
          console.warn('Click fullscreen restore failed:', err);
        }
      }
    };

    const handleGlobalChange = (e) => {
      // If file input has changed, try to immediately restore fullscreen
      if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'file') {
        if (window.isSelectingFile && !document.fullscreenElement) {
          setTimeout(async () => {
            if (!document.fullscreenElement) {
              try {
                await document.documentElement.requestFullscreen();
                window.isSelectingFile = false;
              } catch (err) {
                console.warn('Change fullscreen restore failed:', err);
              }
            }
          }, 200);
        }
      }
    };

    window.addEventListener('click', handleGlobalClick, { capture: true });
    window.addEventListener('click', handleRestoreOnClick, { capture: true });
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('change', handleGlobalChange, { capture: true });

    return () => {
      window.removeEventListener('click', handleGlobalClick, { capture: true });
      window.removeEventListener('click', handleRestoreOnClick, { capture: true });
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('change', handleGlobalChange, { capture: true });
      // Reset the global state on unmount
      window.isSelectingFile = false;
    };
  }, []);

  // Listen for Ctrl + Shift + C keys to toggle controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore shortcut if user is currently typing in an input, textarea, or contentEditable element
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
         activeElement.tagName === 'TEXTAREA' ||
         activeElement.isContentEditable)
      ) {
        return;
      }

      if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setShowControls((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute effective background color
  const effectiveBgColor = settings.backgroundColor || '#0d0f12';

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0d0f12] select-none" data-testid="fullscreen-page">

      {/* Draggable title bar — invisible 24px strip at top for moving window between monitors */}
      {window.electronAPI && (
        <div
          className="fixed top-0 left-0 right-0 z-[999]"
          style={{ height: 24, WebkitAppRegion: 'drag', background: 'transparent' }}
        />
      )}
      {/* Background layer color */}
      <div 
        className="absolute inset-0 transition-colors duration-300"
        style={{ 
          backgroundColor: effectiveBgColor,
          zIndex: 0
        }}
      />

      {/* Grid Canvas Layer */}
      <GridCanvas 
        interactive={true} 
        fullscreen={true} 
        className="absolute inset-0 z-10" 
      />

      {/* Effects drawing layer — video/GIF effects along drawn paths */}
      <EffectsDrawingOverlay
        canvasSize={{ width: window.screen.width || 1920, height: window.screen.height || 1080 }}
      />

      {/* Floating UI Overlays */}
      {showControls && (
        <div className="fixed top-4 left-4 z-50 max-h-[90vh] overflow-y-auto" data-testid="fullscreen-controls">
          <FloatingControls onClose={() => setShowControls(false)} />
        </div>
      )}

      {/* Mini toggle to restore controls if hidden */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="fixed bottom-4 left-4 z-50 bg-[#111214]/94 hover:bg-[#caa055] hover:text-[#111214] border border-[#caa055]/30 rounded-[4px] px-3 py-1.5 text-[10px] font-bold text-white transition-all shadow-lg font-mono tracking-widest cursor-pointer"
          title="Show Grid Control Dashboard (Press Ctrl+Shift+C)"
          data-testid="show-controls-btn"
        >
          SHOW CONTROLS (Ctrl+Shift+C)
        </button>
      )}

      {/* Floating shortcut info */}
      <div className="fixed bottom-4 right-4 z-40 bg-black/60 backdrop-blur-sm border border-[#caa055]/20 rounded-[4px] px-3 py-1.5 text-[9px] font-mono text-slate-muted pointer-events-none tracking-wider">
        Press <span className="text-[#caa055] font-bold">Ctrl + Shift + C</span> to toggle controls dashboard
      </div>

      {/* 3D dice animation layer — renders tumbling dice at cursor position on every roll */}
      <DiceAnimationLayer />

      <Toaster position="top-right" />
    </div>
  );
}

export default function FullscreenPage() {
  return (
    <GridProvider>
      <SessionProvider>
        <FullscreenContent />
      </SessionProvider>
    </GridProvider>
  );
}
