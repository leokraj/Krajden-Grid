import "../../App.css";
import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LicenseProvider } from "./context/LicenseContext";
import { TrialBanner, ExpiredGate, LicenseSuccessPage } from "./components/LicenseGate";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import AppPage from "./pages/AppPage";
import DownloadPage from "./pages/DownloadPage";
import JoinPage from "./pages/JoinPage";
import DisplayPage from "./pages/DisplayPage";
import RemotePage from "./pages/RemotePage";
import AuthCallback from "./components/AuthCallback";

// Lazy import to match JoinPage's dynamic import — fixes Vite bundler initialization error
const FullscreenPage = lazy(() => import("./pages/FullscreenPage"));

function AppRouter() {
  const location = useLocation();
  // CRITICAL: Check URL fragment for session_id synchronously during render
  // to prevent race conditions with AuthProvider's checkAuth
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  // License success/cancel pages bypass the gate
  if (location.pathname === '/license/success') {
    return <LicenseSuccessPage />;
  }
  if (location.pathname === '/license/cancel') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-sm bg-[#141418] rounded-2xl border border-white/10 p-8 text-center">
          <h1 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>Payment Cancelled</h1>
          <p className="text-gray-400 text-sm mb-4">No charges were made to your treasury.</p>
          <a href="/fullscreen" className="text-[#e0a924] text-sm underline hover:text-[#e0a924]/80">Return to Krajden Grid</a>
        </div>
      </div>
    );
  }

  // Mobile remote + display + electron overlay don't need license gate
  const noGateRoutes = ['/', '/download', '/remote', '/display'];
  const isElectronMode = new URLSearchParams(window.location.search).get('electron') === '1' || !!window.electronAPI?.isElectron;
  const needsGate = !isElectronMode && !noGateRoutes.includes(location.pathname) && !location.pathname.startsWith('/join/');

  return (
    <>
      {needsGate && <TrialBanner />}
      {needsGate ? (
        <ExpiredGate>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/fullscreen" element={<Suspense fallback={<div style={{background:'#0a0a0a',width:'100vw',height:'100vh'}}/>}><FullscreenPage /></Suspense>} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/join/:code" element={<JoinPage />} />
            <Route path="/display" element={<DisplayPage />} />
            <Route path="/remote" element={<RemotePage />} />
          </Routes>
        </ExpiredGate>
      ) : (
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/fullscreen" element={<Suspense fallback={<div style={{background:'#0a0a0a',width:'100vw',height:'100vh'}}/>}><FullscreenPage /></Suspense>} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/display" element={<DisplayPage />} />
          <Route path="/remote" element={<RemotePage />} />
        </Routes>
      )}
    </>
  );
}

function App() {
  const isElectron = new URLSearchParams(window.location.search).get('electron') === '1' || !!window.electronAPI?.isElectron;

  useEffect(() => {
    if (isElectron) {
      document.documentElement.classList.add('electron-app');
      document.body.classList.add('electron-app');
      document.documentElement.style.background = '#0d0f12';
      document.body.style.background = '#0d0f12';
      document.documentElement.style.backgroundColor = '#0d0f12';
      document.body.style.backgroundColor = '#0d0f12';
    }
  }, [isElectron]);
  
  return (
    <div className={`App ${isElectron ? 'electron-app bg-[#0d0f12]' : ''}`}>
      <ErrorBoundary>
        <BrowserRouter basename={process.env.PUBLIC_URL || ''}>
          <AuthProvider>
            <LicenseProvider>
              <AppRouter />
            </LicenseProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  );
}

export default App;
