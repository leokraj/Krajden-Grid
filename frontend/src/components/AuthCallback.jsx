import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const { exchangeGoogleSession } = useAuth();
  const exchangeStarted = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (exchangeStarted.current) return;
      exchangeStarted.current = true;

      // Extract session_id from URL fragment hash
      const hash = window.location.hash || '';
      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (sessionId) {
        try {
          await exchangeGoogleSession(sessionId);
        } catch (err) {
          console.error('Google session exchange failed:', err);
        }
      }

      // Clear the hash and redirect to clean app route
      window.location.hash = '';
      window.location.pathname = '/app';
    };

    run();
  }, [exchangeGoogleSession]);

  return (
    <div className="min-h-screen bg-[#07070a] flex flex-col items-center justify-center p-6" data-testid="auth-callback">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-amber-500 animate-spin mx-auto" />
        <div className="text-gray-400 font-mono text-xs tracking-wider animate-pulse">
          Exchanging Dungeons scroll credentials...
        </div>
      </div>
    </div>
  );
}
