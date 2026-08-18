import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Download, Monitor, Grid3X3, Layers, Zap, Eye, Sword, ChevronDown } from 'lucide-react';
import AdminSecretModal from '../components/AdminSecretModal';

// Direct GitHub Release URLs — no backend server involved
const GITHUB_RELEASE = 'https://github.com/leokraj/Krajden-Grid/releases/download/v1.0.0';
const DOWNLOAD_ZIP = `${GITHUB_RELEASE}/KrajdenGrid-Windows.zip`;
const DOWNLOAD_BAT = `${GITHUB_RELEASE}/KrajdenGrid-Setup.bat`;

function KrajdenCrest({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
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

function WindowsIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.551H10.949M0 12.6h9.75V22.05L0 20.7m10.949-8.1H24V24l-13.051-1.8" />
    </svg>
  );
}

const FEATURES = [
  { icon: Grid3X3, title: 'Precision Grid Overlay', desc: 'Transparent always-on-top grid that conforms to any screen or projector — calibrate once, play forever.' },
  { icon: Layers, title: 'Battle Map Layers', desc: 'Stack video backgrounds, fog of war masks, and hand-drawn terrain directly behind your grid.' },
  { icon: Eye, title: 'Fog of War', desc: 'Reveal rooms progressively with freehand, rectangle, or circle fog brushes. Hide ambushes until the moment strikes.' },
  { icon: Sword, title: 'Token Library', desc: 'Place heroes, monsters, and props from the vault. Right-click for size presets, conditions, and layering.' },
  { icon: Zap, title: 'Live Session Sync', desc: 'Share a session code and sync tokens, drawings, and measurements with players in real time.' },
  { icon: Monitor, title: 'Projector Ready', desc: 'Project over your physical table or span across multiple monitors — the grid scales to any setup.' },
];

const INSTALL_STEPS = [
  { num: '01', title: 'Download the ZIP', desc: 'Click the button above. Your browser will save KrajdenGrid-Windows.zip to your Downloads folder.' },
  { num: '02', title: 'Extract anywhere', desc: 'Right-click the ZIP → Extract All. Pick any folder — your Desktop, Documents, wherever you prefer.' },
  { num: '03', title: 'Run KrajdenGrid.exe', desc: 'Open the extracted folder and double-click KrajdenGrid.exe. No installation required — it runs immediately.' },
  { num: '04', title: 'Windows SmartScreen?', desc: 'If Windows shows a blue "Unknown publisher" warning, click More info → Run anyway. This is normal for unsigned indie apps.' },
];

export function DownloadPage() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const faqs = [
    { q: 'Does it work without internet?', a: 'Krajden Grid loads its interface from our servers, so an internet connection is required. Once loaded, most grid and drawing tools work offline — but token vault, live sessions, and battle map sync require a connection.' },
    { q: 'Will my antivirus flag it?', a: 'Some antivirus software flags unsigned executables from independent developers. Krajden Grid is safe — you can verify the source on our GitHub repository. If your AV blocks it, add an exception or use "Run anyway" in Windows Defender.' },
    { q: 'What Windows version is required?', a: 'Windows 10 or Windows 11, 64-bit. The app is built on Electron which requires these minimum versions.' },
    { q: 'How do I update?', a: 'Download the latest ZIP from this page and replace your old folder. No uninstaller needed — just overwrite or delete the old folder and extract the new one.' },
    { q: 'Can multiple players connect to one session?', a: 'Yes — the DM starts a session from the controls panel and shares a code. Players join via the web app or their own desktop copy. Tokens, drawings, and pings sync in real time.' },
  ];

  return (
    <div className="min-h-screen bg-[#08080a] text-white overflow-x-hidden font-sans selection:bg-[#caa055] selection:text-black">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(202,160,85,0.08) 0%, transparent 70%)' }} />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#08080a]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <KrajdenCrest className="w-7 h-7 text-[#caa055]" />
            <span className="font-cinzel text-base font-bold tracking-widest text-[#caa055] uppercase">Krajden Grid</span>
          </Link>
          <button
            onClick={() => setIsAdminOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#caa055]/20 bg-[#caa055]/5 text-[#caa055]/60 hover:text-[#caa055] hover:bg-[#caa055]/10 text-xs font-cinzel font-bold transition-all"
          >
            <Shield className="w-3 h-3" />
            DM Vault
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#caa055]/10 border border-[#caa055]/25 text-[#caa055] text-xs font-mono uppercase tracking-widest mb-8">
          <WindowsIcon className="w-3 h-3" />
          Windows 10 / 11 · 64-bit · Free Early Access
        </div>

        <h1 className="font-cinzel text-4xl sm:text-6xl font-extrabold uppercase tracking-tight text-white leading-none mb-4">
          Your Table.<br />
          <span className="text-[#caa055]">Your Grid.</span>
        </h1>

        <p className="text-white/50 text-lg max-w-xl mx-auto mb-12 leading-relaxed">
          A transparent overlay grid for tabletop gaming on any screen or projector —
          with tokens, fog of war, battle maps, and live session sync.
        </p>

        {/* Primary download button */}
        <div className="flex flex-col items-center gap-4">
          <a
            href={DOWNLOAD_ZIP}
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-[#caa055] text-[#08080a] font-cinzel font-extrabold text-lg uppercase tracking-widest hover:bg-[#d4b060] active:scale-95 transition-all shadow-[0_0_40px_rgba(202,160,85,0.25)] hover:shadow-[0_0_60px_rgba(202,160,85,0.4)]"
          >
            <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
            Download for Windows
          </a>
          <p className="text-white/25 text-xs font-mono">
            KrajdenGrid-Windows.zip · ~121 MB · No installer required
          </p>

          {/* Secondary: .bat option */}
          <div className="mt-2 flex items-center gap-3">
            <div className="h-px w-16 bg-white/10" />
            <span className="text-white/25 text-xs uppercase tracking-wider">or</span>
            <div className="h-px w-16 bg-white/10" />
          </div>
          <a
            href={DOWNLOAD_BAT}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 text-xs font-mono transition-all"
          >
            <WindowsIcon className="w-3.5 h-3.5" />
            Download Setup.bat (auto-installs, ~4 KB)
          </a>
          <p className="text-white/20 text-[10px] font-mono -mt-2">
            Run as Administrator · Downloads and configures automatically
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#caa055]/20 to-transparent" />
      </div>

      {/* Install steps */}
      <section className="max-w-5xl mx-auto px-6 py-16 relative z-10">
        <h2 className="font-cinzel text-sm font-bold uppercase tracking-[0.2em] text-[#caa055]/60 text-center mb-10">
          Getting Started
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {INSTALL_STEPS.map((step) => (
            <div key={step.num} className="flex flex-col gap-3 p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:border-[#caa055]/20 transition-colors">
              <span className="font-cinzel text-3xl font-black text-[#caa055]/20 leading-none">{step.num}</span>
              <h3 className="font-cinzel text-sm font-bold text-white tracking-wide">{step.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#caa055]/20 to-transparent" />
      </div>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16 relative z-10">
        <h2 className="font-cinzel text-sm font-bold uppercase tracking-[0.2em] text-[#caa055]/60 text-center mb-10">
          What's Inside
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4 p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:border-[#caa055]/15 transition-colors group">
              <div className="mt-0.5 shrink-0">
                <f.icon className="w-5 h-5 text-[#caa055]/50 group-hover:text-[#caa055]/80 transition-colors" />
              </div>
              <div>
                <h3 className="font-cinzel text-sm font-bold text-white/80 mb-1">{f.title}</h3>
                <p className="text-white/35 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#caa055]/20 to-transparent" />
      </div>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16 relative z-10">
        <h2 className="font-cinzel text-sm font-bold uppercase tracking-[0.2em] text-[#caa055]/60 text-center mb-10">
          Common Questions
        </h2>
        <div className="flex flex-col divide-y divide-white/5">
          {faqs.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                className="w-full flex items-center justify-between py-4 text-left group"
              >
                <span className="text-white/70 text-sm font-medium group-hover:text-white transition-colors pr-4">{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-[#caa055]/50 shrink-0 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen === i && (
                <p className="text-white/40 text-sm pb-4 leading-relaxed">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-20 relative z-10">
        <div className="rounded-2xl border border-[#caa055]/20 bg-[#caa055]/5 p-10 text-center">
          <KrajdenCrest className="w-10 h-10 text-[#caa055]/40 mx-auto mb-4" />
          <h2 className="font-cinzel text-2xl font-bold text-white mb-3">Ready to run the session?</h2>
          <p className="text-white/40 text-sm mb-8 max-w-md mx-auto">
            Early access is free. Download, unzip, and your grid is live in under a minute.
          </p>
          <a
            href={DOWNLOAD_ZIP}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#caa055] text-[#08080a] font-cinzel font-extrabold text-sm uppercase tracking-widest hover:bg-[#d4b060] active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            Download Krajden Grid
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 relative z-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <KrajdenCrest className="w-4 h-4 text-[#caa055]/40" />
            <span className="text-white/20 text-xs font-cinzel tracking-widest uppercase">Krajden Grid</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/20">
            <span>Early Access v1.0</span>
            <a href="https://github.com/leokraj/Krajden-Grid" target="_blank" rel="noopener noreferrer"
              className="hover:text-white/50 transition-colors">GitHub</a>
            <button onClick={() => setIsAdminOpen(true)} className="hover:text-[#caa055]/60 transition-colors">
              DM Vault (Ctrl+Shift+A)
            </button>
          </div>
        </div>
      </footer>

      {isAdminOpen && <AdminSecretModal isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />}
    </div>
  );
}

export default DownloadPage;
