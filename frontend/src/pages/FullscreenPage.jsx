import React, { useState, useEffect } from 'react';
import { GridProvider, useGrid } from '../context/GridContext';
import { SessionProvider, useSession } from '../context/SessionContext';
import { GridCanvas } from '../components/GridCanvas';
import { FloatingControls } from '../components/FloatingControls';
import { Toaster } from '../components/ui/sonner';

function FullscreenContent() {
  const { settings, updateSettings } = useGrid();
  const [showControls, setShowControls] = useState(true);

  // Auto enter fullscreen when page loads
  useEffect(() => {
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
  }, []);

  // Stabilize and auto-restore fullscreen mode after file import/picker dialog exits
  useEffect(() => {
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

  // Listen for 'F' or 'Esc' key to toggle controls or exit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'c' || e.key === 'C') {
        setShowControls((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background select-none" data-testid="fullscreen-page">
      {/* Background layer color */}
      <div 
        className="absolute inset-0 transition-colors duration-300"
        style={{ 
          backgroundColor: settings.backgroundColor || '#050609',
          zIndex: 0
        }}
      />

      {/* Grid Canvas Layer */}
      <GridCanvas 
        interactive={true} 
        fullscreen={true} 
        className="absolute inset-0 z-10" 
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
          title="Show Grid Control Dashboard (Press C)"
          data-testid="show-controls-btn"
        >
          SHOW CONTROLS (C)
        </button>
      )}

      {/* Floating shortcut info */}
      <div className="fixed bottom-4 right-4 z-40 bg-black/60 backdrop-blur-sm border border-[#caa055]/20 rounded-[4px] px-3 py-1.5 text-[9px] font-mono text-slate-muted pointer-events-none tracking-wider">
        Press <span className="text-[#caa055] font-bold">C</span> to toggle controls dashboard
      </div>

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
