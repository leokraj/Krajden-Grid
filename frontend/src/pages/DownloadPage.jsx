import { useState, useEffect } from 'react';
import { Shield, Download, ChevronDown } from 'lucide-react';
import AdminSecretModal from '../components/AdminSecretModal';

const DOWNLOAD_URL = 'https://github.com/leokraj/Krajden-Grid/releases/download/v1.0.0/KrajdenGrid-Windows.zip';

function KrajdenCrest({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const FAQS = [
  {
    q: 'What do I do after downloading?',
    a: 'Unzip the file anywhere on your PC, open the folder, and double-click KrajdenGrid.exe. No installation needed.'
  },
  {
    q: 'Windows shows a security warning — is it safe?',
    a: 'Yes. As an indie app without a paid code-signing certificate, Windows Defender may show a blue "Unknown publisher" screen. Click More info → Run anyway to proceed.'
  },
  {
    q: 'Does it work without internet?',
    a: 'The app loads its interface from our servers, so an internet connection is required on first launch. Grid tools and drawing work offline after loading.'
  },
  {
    q: 'How do I update to a new version?',
    a: 'Download the latest ZIP from this page and replace your old folder. No uninstaller needed.'
  },
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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#08080a',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(202,160,85,0.07) 0%, transparent 70%)'
      }} />

      {/* Nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, width: '100%',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(8,8,10,0.92)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <KrajdenCrest className="w-7 h-7" style={{ color: '#caa055', width: 28, height: 28 }} />
          <span style={{
            fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 700,
            letterSpacing: '0.18em', color: '#caa055', textTransform: 'uppercase'
          }}>Krajden Grid</span>
        </div>
        <button onClick={() => setIsAdminOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          border: '1px solid rgba(202,160,85,0.2)',
          background: 'rgba(202,160,85,0.05)',
          color: 'rgba(202,160,85,0.5)', cursor: 'pointer',
          fontSize: 11, fontFamily: 'Cinzel, serif', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          transition: 'all 0.2s',
        }}>
          <Shield style={{ width: 12, height: 12 }} />
          DM Vault
        </button>
      </header>

      {/* Hero */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 32px 60px', textAlign: 'center',
        position: 'relative', zIndex: 1, maxWidth: 640, width: '100%',
      }}>

        <KrajdenCrest style={{ width: 64, height: 64, color: 'rgba(202,160,85,0.3)', marginBottom: 32 }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 14px', borderRadius: 999,
          background: 'rgba(202,160,85,0.08)',
          border: '1px solid rgba(202,160,85,0.2)',
          color: '#caa055', fontSize: 10,
          fontFamily: 'monospace', letterSpacing: '0.15em',
          textTransform: 'uppercase', marginBottom: 28,
        }}>
          Windows 10 / 11 · 64-bit · Free Early Access
        </div>

        <h1 style={{
          fontFamily: 'Cinzel, serif', fontSize: 'clamp(32px, 6vw, 56px)',
          fontWeight: 900, textTransform: 'uppercase',
          letterSpacing: '-0.01em', lineHeight: 1.05,
          color: '#fff', marginBottom: 20,
        }}>
          Krajden Grid
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.45)', fontSize: 16,
          lineHeight: 1.7, marginBottom: 48, maxWidth: 480,
        }}>
          A transparent overlay grid for tabletop gaming. Place tokens, reveal fog of war,
          sync battle maps, and run live sessions — projected over your table or on any screen.
        </p>

        {/* THE ONE DOWNLOAD BUTTON */}
        <a
          href={DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          download="KrajdenGrid-Windows.zip"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '18px 40px', borderRadius: 14,
            background: '#caa055', color: '#08080a',
            fontFamily: 'Cinzel, serif', fontWeight: 900,
            fontSize: 15, letterSpacing: '0.12em',
            textTransform: 'uppercase', textDecoration: 'none',
            boxShadow: '0 0 50px rgba(202,160,85,0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#d4b060';
            e.currentTarget.style.boxShadow = '0 0 70px rgba(202,160,85,0.5)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#caa055';
            e.currentTarget.style.boxShadow = '0 0 50px rgba(202,160,85,0.3)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Download style={{ width: 20, height: 20 }} />
          Download for Windows
        </a>

        <p style={{
          marginTop: 16, color: 'rgba(255,255,255,0.2)',
          fontSize: 12, fontFamily: 'monospace',
        }}>
          KrajdenGrid-Windows.zip · ~121 MB · Unzip and run — no installer
        </p>

        {/* Minimal install steps */}
        <div style={{
          marginTop: 56, display: 'flex', flexDirection: 'column', gap: 0,
          width: '100%', borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '32px 0',
        }}>
          {[
            ['1', 'Download', 'Click the button above — the ZIP saves to your Downloads folder'],
            ['2', 'Unzip', 'Right-click the ZIP → Extract All → choose any folder'],
            ['3', 'Run', 'Open the folder → double-click KrajdenGrid.exe'],
          ].map(([num, title, desc]) => (
            <div key={num} style={{
              display: 'flex', alignItems: 'flex-start', gap: 20,
              padding: '16px 0',
              borderBottom: num !== '3' ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <span style={{
                fontFamily: 'Cinzel, serif', fontSize: 24, fontWeight: 900,
                color: 'rgba(202,160,85,0.15)', lineHeight: 1, minWidth: 32,
                textAlign: 'right',
              }}>{num}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ marginTop: 48, width: '100%', textAlign: 'left' }}>
          <div style={{
            fontSize: 10, fontFamily: 'Cinzel, serif', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(202,160,85,0.4)', marginBottom: 20, textAlign: 'center',
          }}>
            Common Questions
          </div>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '16px 0', background: 'none',
                  border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 500 }}>
                  {faq.q}
                </span>
                <ChevronDown style={{
                  width: 14, height: 14, color: 'rgba(202,160,85,0.4)',
                  flexShrink: 0, transform: faqOpen === i ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }} />
              </button>
              {faqOpen === i && (
                <p style={{
                  color: 'rgba(255,255,255,0.35)', fontSize: 13,
                  lineHeight: 1.7, paddingBottom: 16, margin: 0,
                }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        width: '100%', borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '24px 32px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', position: 'relative', zIndex: 1,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, fontFamily: 'Cinzel, serif', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Krajden Grid · Early Access v1.0
        </span>
        <button onClick={() => setIsAdminOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.1)', fontSize: 11,
        }}>
          DM Vault
        </button>
      </footer>

      {isAdminOpen && <AdminSecretModal isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />}
    </div>
  );
}

export default DownloadPage;
