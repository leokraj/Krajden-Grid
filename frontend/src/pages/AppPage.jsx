import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GridProvider } from '../context/GridContext';
import { ConfigPanel } from '../components/ConfigPanel';
import { GridPreview } from '../components/GridPreview';
import { MeasurementsList } from '../components/MeasurementsList';
import { PresetManager } from '../components/PresetManager';
import { AuthModal } from '../components/AuthModal';
import { Button } from '../components/ui/button';
import { Toaster } from '../components/ui/sonner';
import { ArrowLeft, Download, Grid3X3, Maximize2, LogOut, Shield, ExternalLink } from 'lucide-react';

function AppContent() {
  const { user, logout } = useAuth();

  return (
    <div 
      className="min-h-screen relative overflow-hidden flex flex-col justify-between" 
      style={{
        backgroundColor: '#1c1d1f',
        backgroundImage: 'radial-gradient(circle at top center, rgba(202,160,85,0.05), transparent 45%), linear-gradient(180deg, #1c1d1f 0%, #141517 100%)'
      }}
      data-testid="app-page"
    >
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none z-0" />

      {/* Symmetrical glowing light leak highlights matching website exactly */}
      <div 
        className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[160px] pointer-events-none opacity-15 z-0"
        style={{
          background: 'radial-gradient(circle at center, #caa055 0%, rgba(28, 29, 31, 0) 70%)',
        }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none opacity-10 z-0"
        style={{
          background: 'radial-gradient(circle at center, #FF3E3E 0%, rgba(28, 29, 31, 0) 70%)',
        }}
      />

      {/* Atmospheric misty gothic landscape SVG (castle silhouette) */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none select-none z-0 overflow-hidden opacity-[0.10] h-[50%]">
        <svg className="absolute bottom-0 left-0 w-[120%] h-full min-w-[1200px]" viewBox="0 0 1200 600" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Distant misty mountain ridges */}
          <path d="M0 600 L1200 600 L1200 420 C1080 390 980 400 900 340 C800 260 700 320 600 240 C520 180 420 230 330 190 C200 140 100 250 0 220 Z" fill="#0d0e10" />
          {/* Middle mountain ridge with castle silhouette */}
          <path d="M0 600 L1200 600 L1200 480 C1100 450 1020 460 940 410 C840 340 750 410 660 350 C570 290 470 340 390 300 L390 260 L402 260 L402 230 L414 230 L414 260 L426 260 L426 300 C340 290 290 320 220 290 C140 250 70 330 0 310 Z" fill="#0b0c0d" />
          {/* Close silhouette with high spires on a jagged cliff */}
          <path d="M250 600 L550 600 L510 440 L510 390 L525 390 L525 350 L505 220 L498 220 L491 140 L484 140 L477 220 L470 220 L450 350 L450 390 L465 390 L465 440 Z" fill="#08090a" />
        </svg>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1c1d1f]/95 backdrop-blur-md border-b border-[#caa055]/15 shrink-0 h-[72px]">
        <div className="max-w-[1500px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link to="/">
              <button className="text-[#caa055] hover:text-[#d5b271] border border-[#caa055]/30 hover:border-[#caa055]/60 hover:bg-[#caa055]/5 px-3.5 h-10 rounded-[4px] text-[10px] uppercase font-outfit tracking-[0.15em] font-semibold flex items-center gap-1.5 transition-all bg-transparent cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" />
                BACK TO MAP
              </button>
            </Link>
            
            <div className="h-6 w-px bg-[#caa055]/20 self-center" />

            <div className="flex items-center gap-2.5 ml-1">
              <div className="w-8 h-8 bg-[#caa055]/5 border border-[#caa055]/20 flex items-center justify-center rounded">
                <Grid3X3 className="w-4 h-4 text-[#caa055]" />
              </div>
              <span className="font-bold text-base tracking-[0.2em] font-cinzel">
                <span className="text-[#F3EEE7]">KRAJDEN </span>
                <span className="text-[#caa055]">GRID</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 text-[10px] text-slate-cool uppercase font-outfit tracking-wider mr-2 font-semibold">
                <Shield className="w-3.5 h-3.5 text-[#caa055]" />
                <span>{user.nickname || user.name}</span>
                <button
                  onClick={logout}
                  className="text-slate-muted hover:text-red-500 transition-colors ml-1 cursor-pointer bg-transparent border-none"
                  title="Sign out of Dungeons"
                  data-testid="logout-btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <Link to="/fullscreen">
              <Button variant="outline" className="h-10 px-4 rounded-[4px] border-[#caa055]/50 text-[#caa055] hover:border-[#caa055] hover:bg-[#caa055]/5 flex items-center gap-1.5 font-cinzel font-bold text-[10px] tracking-wider">
                <ExternalLink className="w-3.5 h-3.5" />
                CAST GRID (FULLSCREEN)
              </Button>
            </Link>
            <Link to="/download">
              <Button variant="outline" className="h-10 px-4 rounded-[4px] border-white/10 hover:border-[#caa055]/40 text-[#caa055]/80 hover:text-white flex items-center gap-1.5 font-cinzel font-semibold text-[10px] tracking-wider">
                <Download className="w-3.5 h-3.5" />
                GET DESKTOP APP
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1500px] mx-auto px-6 py-8 relative z-10 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[28px]">
          <div className="lg:col-span-4">
            <ConfigPanel />
          </div>
          <div className="lg:col-span-8 flex flex-col gap-[28px]">
            <GridPreview interactive={true} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[28px]">
              <MeasurementsList />
              <PresetManager />
            </div>
          </div>
        </div>
      </main>

      {/* Info Banner removed to match reference */}

      <Toaster position="top-right" />
    </div>
  );
}

export function AppPage() {
  const { isAuthenticated, loading } = useAuth();
  const [guestBypass, setGuestBypass] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gold font-mono text-sm animate-pulse tracking-widest uppercase">Loading Battleground...</div>
      </div>
    );
  }

  if (!isAuthenticated && !guestBypass) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden" data-testid="auth-gate">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <AuthModal
          isOpen={true}
          initialMode="register"
          isGate={true}
          onGuest={() => setGuestBypass(true)}
        />
      </div>
    );
  }

  return (
    <GridProvider>
      <AppContent />
    </GridProvider>
  );
}

export default AppPage;
