import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { useGrid } from '../context/GridContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Users, Copy, Check, LogOut, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

export const SessionControls = () => {
  const {
    isConnected,
    sessionCode,
    isHost,
    participants,
    userName,
    error,
    createSession,
    joinSession,
    leaveSession,
    getShareableLink
  } = useSession();

  const { settings } = useGrid();

  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    if (!nameInput.trim()) return;
    createSession(nameInput.trim(), settings, { width: window.innerWidth, height: window.innerHeight });
  };

  const handleJoin = () => {
    if (!nameInput.trim() || !codeInput.trim()) return;
    joinSession(codeInput.trim().toUpperCase(), nameInput.trim());
  };

  const handleCopyLink = () => {
    const link = getShareableLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (sessionCode) {
    return (
      <div className="space-y-4 p-4 bg-panel border border-border-gold rounded-sm vintage-corner-bracket glow-gold-leak" data-testid="session-active-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-[10px] font-mono tracking-wider uppercase text-slate-cool">
              {isConnected ? 'Sync Active' : 'Connecting...'}
            </span>
          </div>
          <span className="text-[9px] font-mono tracking-widest text-gold font-bold px-2 py-0.5 rounded-sm bg-gold/5 border border-border-gold">
            {isHost ? 'HOST' : 'GUEST'}
          </span>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-mono tracking-widest text-slate-cool">Share Code</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background/50 border border-border-gold rounded-sm px-3 py-1.5 font-mono text-sm text-center text-gold font-bold tracking-widest select-all">
              {sessionCode}
            </div>
            <Button
              onClick={handleCopyLink}
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0 border-border-gold hover:border-gold/40 text-slate-cool hover:text-white"
              title="Copy Share Link"
              data-testid="copy-link-btn"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase font-mono tracking-widest text-slate-cool flex items-center gap-1.5">
              <Users className="w-3 h-3 text-gold" /> Connected Players ({1 + (participants?.guests?.length || 0)})
            </Label>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-1 border border-border-gold rounded-sm p-2 bg-[#050609]/60 text-[10px] font-mono tracking-wide">
            <div className="flex items-center justify-between text-slate-cool font-medium border-b border-border-gold pb-1">
              <span>{participants?.host?.name || 'Host'} (Host)</span>
              {participants?.host?.sid === socketIdOfMe() && <span className="text-gold">(You)</span>}
            </div>
            {participants?.guests?.map((guest) => (
              <div key={guest.sid} className="flex items-center justify-between text-slate-muted py-1">
                <span>{guest.name}</span>
                {guest.blocked && <span className="text-red-400">blocked</span>}
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={leaveSession}
          variant="outline"
          className="w-full h-8 text-[10px] border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center justify-center gap-1.5 transition-colors uppercase tracking-widest rounded-sm"
          data-testid="leave-session-btn"
        >
          <LogOut className="w-3.5 h-3.5" /> Leave Session
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-panel border border-border-gold rounded-sm vintage-corner-bracket glow-gold-leak" data-testid="session-setup-panel">
      {error && (
        <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-sm text-red-400 text-[10px] leading-normal font-sans" data-testid="session-error">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="session-name" className="text-[10px] uppercase font-mono tracking-widest text-slate-cool">Your Player Name</Label>
          <Input
            id="session-name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. DungeonMaster"
            className="h-8 text-xs bg-background/50 border-border-gold rounded-sm text-white"
            data-testid="session-name-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="space-y-1.5 col-span-2">
            <Button
              onClick={handleCreate}
              disabled={!nameInput.trim()}
              className="w-full h-8 text-[10px] bg-gold hover:bg-gold-bright text-black font-semibold rounded-sm font-cinzel tracking-widest uppercase"
              data-testid="create-session-btn"
            >
              Host New Session
            </Button>
          </div>

          <div className="col-span-2 border-t border-border-gold/30 my-1" />

          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="session-code-input" className="text-[10px] uppercase font-mono tracking-widest text-slate-cool">Join Existing Session</Label>
            <div className="flex items-center gap-2">
              <Input
                id="session-code-input"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Session Code"
                className="h-8 text-xs bg-background/50 border-border-gold rounded-sm font-mono tracking-widest uppercase text-center text-white placeholder:normal-case"
                data-testid="session-code-input"
              />
              <Button
                onClick={handleJoin}
                disabled={!nameInput.trim() || !codeInput.trim()}
                variant="outline"
                className="h-8 text-[10px] shrink-0 px-3 border-gold/30 text-gold hover:bg-gold/5 rounded-sm"
                data-testid="join-session-btn"
              >
                Join
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper stub for self-sid matching
function socketIdOfMe() {
  return null;
}
