import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Grid3X3, 
  Download, 
  Tv,
  ExternalLink,
} from 'lucide-react';

// Custom symmetrical fleur-de-lis medieval crest icon matching the logo
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
      {/* Central vertical spine with diamond nodes */}
      <line x1="50" y1="18" x2="50" y2="82" strokeWidth="2.5" />
      
      {/* Stylized top flame / spearhead */}
      <path d="M50 12 C46 22, 44 30, 50 40 C56 30, 54 22, 50 12 Z" fill="currentColor" stroke="none" />
      <circle cx="50" cy="28" r="1.5" fill="currentColor" stroke="none" />
      
      {/* Main majestic symmetrical scroll branches (fleur-de-lis) */}
      <path d="M50 36 C32 20, 18 32, 22 52 C25 66, 42 66, 48 54" strokeWidth="2" />
      <path d="M50 36 C68 20, 82 32, 78 52 C75 66, 58 66, 52 54" strokeWidth="2" />
      
      {/* Secondary lower flanking scrolls */}
      <path d="M50 50 C38 42, 28 50, 32 64 C35 74, 46 72, 48 62" strokeWidth="1.5" />
      <path d="M50 50 C62 42, 72 50, 68 64 C65 74, 54 72, 52 62" strokeWidth="1.5" />
      
      {/* Central circular core emblem */}
      <circle cx="50" cy="48" r="4.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="48" r="7.5" strokeWidth="1" />
      
      {/* Horizontal decorative band */}
      <path d="M30 48 H70" strokeWidth="1.5" />
      <circle cx="30" cy="48" r="2" fill="currentColor" stroke="none" />
      <circle cx="70" cy="48" r="2" fill="currentColor" stroke="none" />
      
      {/* Elegant bottom root flourish */}
      <path d="M50 68 C42 78, 44 86, 50 90 C56 86, 58 78, 50 68 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Hood/Player icon representing the rogue/hero of the tabletop game
function HoodIcon({ className = "w-5 h-5" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 2C8.5 2 6 5.5 6 9c0 2 .5 3.5 1 4.5l-2 3.5v3h14v-3l-2-3.5c.5-1 1-2.5 1-4.5c0-3.5-2.5-7-6-7z" />
      <path d="M9 13.5c1.5-1 4.5-1 6 0" />
      <path d="M12 9v2.5" />
    </svg>
  );
}

// Custom 4-point star/sparkle matching "BEGIN SESSION ✧" exactly
function FourPointStar({ className = "w-3.5 h-3.5" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
    </svg>
  );
}

// Custom long narrow arrow icon representing the "BIND TO SESSION →"
function LongArrowRight({ className = "w-4 h-4" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function HomePage() {
  const [sessionCode, setSessionCode] = useState('');
  const navigate = useNavigate();

  const handleJoinCampaign = (e) => {
    e.preventDefault();
    if (sessionCode.trim()) {
      navigate(`/join/${sessionCode.trim().toLowerCase()}`);
    }
  };

  let isIframe = false;
  try {
    isIframe = typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    isIframe = true;
  }

  return (
    <div className="min-h-screen bg-[#1c1d1f] text-slate-100 font-sans selection:bg-[#caa055]/30 selection:text-[#caa055] relative overflow-hidden flex flex-col justify-between" data-testid="home-page">
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
      {/* Symmetrical glowing light leak highlights matching website exactly */}
      <div 
        className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[160px] pointer-events-none opacity-25"
        style={{
          background: 'radial-gradient(circle at center, #caa055 0%, rgba(28, 29, 31, 0) 70%)',
        }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle at center, #FF3E3E 0%, rgba(28, 29, 31, 0) 70%)',
        }}
      />

      {/* Atmospheric misty gothic landscape SVG (castle silhouette) */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none select-none z-0 overflow-hidden opacity-[0.22] h-[55%]">
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
      <header className="relative z-10 border-b border-[#caa055]/20 bg-background/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Brand Logo & Social links matching website exactly */}
          <div className="flex items-center gap-6">
            {/* Social Icons from website */}
            <div className="hidden sm:flex items-center gap-2">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noreferrer"
                className="w-8 h-8 rounded-[6px] border border-[#caa055]/30 flex items-center justify-center text-[#caa055] hover:bg-[#caa055]/10 transition-colors"
                id="header-fb"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 8H7v3h2v9h3v-9h3.6l.4-3H12V6c0-.9.2-1 1-1h2V2h-3c-3 0-4 1.5-4 4v2z"/>
                </svg>
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noreferrer"
                className="w-8 h-8 rounded-[6px] border border-[#caa055]/30 flex items-center justify-center text-[#caa055] hover:bg-[#caa055]/10 transition-colors"
                id="header-ig"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
            </div>

            <div className="flex items-center gap-3.5 group cursor-pointer text-left select-none">
              <KrajdenCrest className="w-8 h-8 text-[#caa055]" />
              <div className="flex flex-col w-[110px]">
                <div className="flex justify-between w-full font-cinzel text-lg font-bold text-[#caa055] leading-none">
                  <span>K</span>
                  <span>R</span>
                  <span>A</span>
                  <span>J</span>
                  <span>D</span>
                  <span>E</span>
                  <span>N</span>
                </div>
                <div className="flex justify-between w-full font-cinzel text-[8px] font-bold text-[#8c8d90] mt-1.5 uppercase leading-none">
                  <span>D</span>
                  <span>U</span>
                  <span>N</span>
                  <span>G</span>
                  <span>E</span>
                  <span>O</span>
                  <span>N</span>
                  <span>S</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <span className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#A4B0C0] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#caa055]" />
              DIGITAL TABLETOP CONDUIT V1.2
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 my-8">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Scribe display and details */}
          <div className="lg:col-span-6 space-y-8 text-left">
            
            {/* Subtitle Badge */}
            <div className="flex items-center gap-2 text-[#caa055]">
              <KrajdenCrest className="w-4 h-4 text-[#caa055] shrink-0" />
              <span className="text-[#caa055] text-[10px] tracking-[0.25em] font-mono font-semibold uppercase">
                TABLETOP COMPANION ENGINE
              </span>
            </div>

            {/* Title with exact style combinations */}
            <div className="space-y-0.5">
              <span className="font-cinzel text-2xl font-light tracking-[0.18em] text-white block leading-none mb-1">
                SCRIBE THE
              </span>
              <h1 className="font-cinzel text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-[0.05em] text-white uppercase leading-[0.95] block">
                TACTICAL
              </h1>
              <h1 className="font-cinzel text-5xl sm:text-6xl md:text-7xl font-bold tracking-[0.05em] text-[#caa055] italic uppercase leading-[0.95] block">
                MESH
              </h1>
            </div>

            {/* Symmetrical divider featuring the small rotated square diamond */}
            <div className="flex items-center gap-4 py-2 w-48">
              <div className="h-[1px] flex-1 bg-[#caa055]/30" />
              <div className="w-2.5 h-2.5 bg-[#caa055] rotate-45 shrink-0" />
              <div className="h-[1px] flex-1 bg-[#caa055]/30" />
            </div>

            {/* Intro paragraph */}
            <p className="text-[#A4B0C0] text-sm leading-relaxed max-w-lg font-sans">
              Enter the ritual realm of premium, high-contrast battlegrounds. Designed with razor-sharp vector calibration, ambient real-time sync, and immersive digital dungeon screens.
            </p>

            {/* Features list with matching details */}
            <div className="space-y-6 pt-2">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 border border-[#caa055]/50 rounded-full flex items-center justify-center text-[#caa055] font-mono text-xs font-bold bg-[#caa055]/5">
                  I
                </div>
                <div>
                  <h3 className="text-xs tracking-[0.15em] font-bold text-slate-200 uppercase font-cinzel">
                    ULTRA-THIN CALIBRATION
                  </h3>
                  <p className="text-xs text-[#A4B0C0]/85 mt-1 leading-relaxed">
                    Scribe perfect square grids with custom subdivision ratios, line opacities, and offsets.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 border border-[#caa055]/50 rounded-full flex items-center justify-center text-[#caa055] font-mono text-xs font-bold bg-[#caa055]/5">
                  II
                </div>
                <div>
                  <h3 className="text-xs tracking-[0.15em] font-bold text-slate-200 uppercase font-cinzel">
                    THE HEARTH CHANNELS
                  </h3>
                  <p className="text-xs text-[#A4B0C0]/85 mt-1 leading-relaxed">
                    Sync player measurements, scenery tokens, and tabletop logs instantly.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 border border-[#caa055]/50 rounded-full flex items-center justify-center text-[#caa055] font-mono text-xs font-bold bg-[#caa055]/5">
                  III
                </div>
                <div>
                  <h3 className="text-xs tracking-[0.15em] font-bold text-slate-200 uppercase font-cinzel">
                    ENCOUNTER PERSISTENCE
                  </h3>
                  <p className="text-xs text-[#A4B0C0]/85 mt-1 leading-relaxed">
                    Maintain your campaign state across devices and sessions with secure continuity.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Portal Cards with exact placement and rounded-xl */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Card 1: Enter the Krajden Grid */}
            <div className="relative border border-[#caa055]/15 bg-[#141517] p-8 rounded-xl shadow-2xl overflow-hidden group transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border border-[#caa055]/40 flex items-center justify-center text-[#caa055] bg-[#caa055]/5 shrink-0">
                  <Grid3X3 className="w-5 h-5 text-[#caa055]" />
                </div>
                <div className="space-y-0.5 text-left">
                  <span className="text-[9px] tracking-[0.25em] text-[#caa055] font-mono uppercase font-bold">
                    RITUAL OF ACCESS
                  </span>
                  <h2 className="text-lg font-cinzel tracking-[0.08em] text-white uppercase font-bold">
                    ENTER THE KRAJDEN GRID
                  </h2>
                </div>
              </div>

              <p className="text-xs text-[#A4B0C0] mt-4 leading-relaxed text-left">
                Unlock the complete battleground suite to calibrate custom meshes, drop scenario tokens, and initiate live sync campaigns.
              </p>

              <Link to="/app" className="block mt-6">
                <Button className="w-full h-12 bg-[#caa055] hover:bg-[#d5b271] text-[#1c1d1f] font-cinzel font-bold text-xs tracking-[0.2em] uppercase rounded-[6px] border border-[#caa055] hover:border-[#d5b271] transition-all duration-300 flex items-center justify-center gap-2">
                  BEGIN SESSION <FourPointStar className="w-3.5 h-3.5 shrink-0 text-[#1c1d1f]" />
                </Button>
              </Link>
            </div>

            {/* Card 2: Join the Ritual */}
            <div className="relative border border-[#caa055]/15 bg-[#141517] p-8 rounded-xl shadow-2xl overflow-hidden transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border border-red-500/40 flex items-center justify-center text-red-500 bg-red-500/5 shrink-0">
                  <HoodIcon className="w-5 h-5 text-red-500" />
                </div>
                <div className="space-y-0.5 text-left">
                  <span className="text-[9px] tracking-[0.25em] text-red-500 font-mono uppercase font-bold">
                    SUMMONED HERO
                  </span>
                  <h2 className="text-lg font-cinzel tracking-[0.08em] text-white uppercase font-bold">
                    JOIN THE RITUAL
                  </h2>
                </div>
              </div>

              <form onSubmit={handleJoinCampaign} className="mt-6 space-y-4 text-left">
                <div className="space-y-2">
                  <label htmlFor="campaign-code" className="block text-[10px] tracking-[0.2em] text-[#caa055] font-mono uppercase font-semibold">
                    ENCOUNTER SIGIL
                  </label>
                  <Input 
                    id="campaign-code"
                    type="text" 
                    placeholder="e.g. dragon-keep" 
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value)}
                    className="w-full h-12 bg-[#0d0e10] border border-[#caa055]/20 px-4 text-xs text-white rounded-[6px] placeholder:text-slate-600 focus-visible:border-[#caa055]/50 focus-visible:ring-0 font-mono uppercase tracking-widest placeholder:normal-case"
                    maxLength={12}
                  />
                </div>

                <Button 
                  type="submit"
                  disabled={!sessionCode.trim()}
                  className={`w-full h-12 font-cinzel font-bold text-xs tracking-[0.2em] uppercase rounded-[6px] transition-all duration-300 flex items-center justify-center gap-2 border ${
                    sessionCode.trim()
                      ? 'bg-transparent border-[#caa055] text-[#caa055] hover:bg-[#caa055]/10 cursor-pointer'
                      : 'bg-transparent border-[#caa055]/20 text-[#caa055]/20 cursor-not-allowed'
                  }`}
                  data-testid="join-session-btn"
                >
                  BIND TO SESSION <LongArrowRight className="w-4 h-4 shrink-0" />
                </Button>
              </form>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#caa055]/15 bg-[#141517] py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest text-[#A4B0C0] uppercase text-left">
            <span>© 2026 KRAJDEN DUNGEONS LTD.</span>
            <span className="text-[#caa055]">●</span>
            <span className="flex items-center gap-1.5 text-[#caa055] font-bold">
              <Tv className="w-3.5 h-3.5 text-[#caa055]" />
              PHYSICAL SCREEN PROJECTOR READY
            </span>
          </div>

          <div className="flex items-center">
            <Link to="/download">
              <Button 
                variant="outline" 
                className="h-10 border border-[#caa055] hover:bg-[#caa055]/10 text-[#caa055] text-[10px] tracking-[0.15em] uppercase rounded-[6px] transition-all flex items-center gap-2 font-cinzel font-bold px-5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#caa055]" />
                GET DESKTOP COMPANION APP
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
