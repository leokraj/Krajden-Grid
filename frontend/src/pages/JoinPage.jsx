import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GridProvider } from '../context/GridContext';
import { SessionProvider, useSession } from '../context/SessionContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Users, UserPlus, ArrowRight, Shield } from 'lucide-react';

// Lazy load the heavy grid component
const FullscreenContent = lazy(() => import('./FullscreenPage').then(m => ({ default: m.FullscreenContent })));

const JoinContent = () => {
  const { code } = useParams();
  const { isConnected, joinSession, sessionCode, error } = useSession();
  const [nameInput, setNameInput] = useState('');
  const [joining, setJoining] = useState(false);

  // If already joined, show the grid directly (no redirect to /fullscreen)
  if (sessionCode) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="text-gold font-mono text-sm animate-pulse">Loading Battleground...</div></div>}>
        <FullscreenContent />
      </Suspense>
    );
  }

  const handleJoin = () => {
    if (nameInput.trim() && code) {
      setJoining(true);
      joinSession(code, nameInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-gold/30 selection:text-gold relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      
      {/* Radial Gold Light Leak */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle at center, #caa055 0%, rgba(28, 29, 31, 0) 70%)',
        }}
      />

      <div className="max-w-md w-full relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-sm bg-gold/5 border border-border-gold mb-4">
            <Users className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest mb-2 text-white font-cinzel uppercase">Join Battle Campaign</h1>
          <p className="text-xs text-slate-cool uppercase tracking-widest">
            You have been summoned to join a <span className="text-gold font-semibold">Krajden Grid</span> campaign.
          </p>
        </div>
        
        <div className="vintage-corner-bracket bg-panel border border-border-gold rounded-sm p-6 shadow-2xl glow-gold-leak">
          <div className="mb-6">
            <Label className="text-[10px] text-slate-cool uppercase tracking-widest font-mono">Campaign Code</Label>
            <div className="mt-2 text-center bg-background/60 py-3 rounded-sm border border-border-gold">
              <span className="font-mono text-3xl font-black tracking-widest text-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.25)]">
                {code?.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="mb-6">
            <Label className="text-[10px] text-slate-cool uppercase tracking-widest font-mono">Hero Name / Nickname</Label>
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter hero name"
              className="mt-2 text-sm text-white border-border-gold focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold bg-background/50 h-10 tracking-wide rounded-sm"
              maxLength={20}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              data-testid="join-page-name-input"
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-sm">
              <p className="text-xs text-red-400 font-sans">{error}</p>
            </div>
          )}
          
          <Button
            onClick={handleJoin}
            className="w-full h-11 text-xs font-bold bg-gold hover:bg-gold-bright text-black font-cinzel tracking-[0.2em] uppercase rounded-sm"
            disabled={!nameInput.trim() || !isConnected || joining}
            data-testid="join-page-btn"
          >
            {joining ? (
              'Joining Campaign...'
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Join Campaign
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
          
          {!isConnected && (
            <p className="text-[10px] text-gold animate-pulse mt-3 text-center font-mono uppercase tracking-widest">
              Connecting to taverns...
            </p>
          )}
        </div>
        
        <p className="text-[10px] text-slate-muted text-center mt-4 font-mono uppercase tracking-wider">
          Draw, place tokens, and measure distances synchronously on the master grid.
        </p>
      </div>
    </div>
  );
};

export const JoinPage = () => {
  return (
    <GridProvider>
      <SessionProvider>
        <JoinContent />
      </SessionProvider>
    </GridProvider>
  );
};

export default JoinPage;
