import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

  // Helper to get auth headers (Bearer token for Electron, cookies for web)
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('session_token');
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }, []);

  // Helper for authenticated fetch
  const authFetch = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        ...getAuthHeaders(),
      },
    });
  }, [getAuthHeaders]);

  const checkAuth = useCallback(async () => {
    try {
      const response = await authFetch(`${backendUrl}/api/auth/me`);
      if (response.ok) {
        const text = await response.text();
        try {
          const userData = JSON.parse(text);
          setUser(userData);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
        localStorage.removeItem('session_token');
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, [backendUrl, authFetch]);

  useEffect(() => {
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const register = async (email, password, name, nickname) => {
    const response = await fetch(`${backendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name, nickname: nickname || name }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Server returned invalid response'); }
    if (!response.ok) {
      throw new Error(data.detail || 'Registration failed');
    }
    if (data.session_token) {
      localStorage.setItem('session_token', data.session_token);
    }
    setUser(data);
    return data;
  };

  const login = async (email, password) => {
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Server returned invalid response'); }
    if (!response.ok) {
      throw new Error(data.detail || 'Login failed');
    }
    if (data.session_token) {
      localStorage.setItem('session_token', data.session_token);
    }
    setUser(data);
    return data;
  };

  const loginWithSocial = async (provider, email, name, picture) => {
    const response = await fetch(`${backendUrl}/api/auth/social-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider, email, name, picture }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Server returned invalid response'); }
    if (!response.ok) {
      throw new Error(data.detail || `${provider} login failed`);
    }
    if (data.session_token) {
      localStorage.setItem('session_token', data.session_token);
    }
    setUser(data);
    return data;
  };

  const loginWithGoogle = () => {
    // Redirect back to the current page after Google auth
    const redirectPath = window.location.pathname || '/app';
    const redirectUrl = window.location.origin + redirectPath;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}&provider=google&name=Krajden+Grid&app_name=Krajden+Grid&title=Krajden+Grid&app=Krajden+Grid`;

    if (window.electronAPI?.googleAuth) {
      window.electronAPI.googleAuth(authUrl);
    } else {
      window.location.href = authUrl;
    }
  };

  const loginWithFacebook = () => {
    // Redirect back to the current page after Facebook auth
    const redirectPath = window.location.pathname || '/app';
    const redirectUrl = window.location.origin + redirectPath;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}&provider=facebook&name=Krajden+Grid&app_name=Krajden+Grid&title=Krajden+Grid&app=Krajden+Grid`;

    if (window.electronAPI?.googleAuth) {
      window.electronAPI.googleAuth(authUrl);
    } else {
      window.location.href = authUrl;
    }
  };

  // Listen for Google session from Electron popup
  useEffect(() => {
    if (window.electronAPI?.onGoogleSession) {
      window.electronAPI.onGoogleSession(async (sessionId) => {
        try {
          await exchangeGoogleSession(sessionId);
        } catch (err) {
          console.error('Google session exchange failed:', err);
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exchangeGoogleSession = async (sessionId) => {
    const response = await fetch(`${backendUrl}/api/auth/google-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Server returned invalid response'); }
    if (!response.ok) {
      throw new Error(data.detail || 'Google auth failed');
    }
    if (data.session_token) {
      localStorage.setItem('session_token', data.session_token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await authFetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
      });
    } catch {
      // ignore
    }
    localStorage.removeItem('session_token');
    setUser(null);
  };

  // Load user's cliparts from server
  const loadUserCliparts = useCallback(async () => {
    if (!user) return null;
    try {
      const response = await authFetch(`${backendUrl}/api/auth/cliparts`);
      if (response.ok) {
        const text = await response.text();
        return JSON.parse(text);
      }
    } catch {
      // ignore
    }
    return null;
  }, [backendUrl, user, authFetch]);

  // Save user's cliparts to server
  const saveUserCliparts = useCallback(async (cliparts, favorites) => {
    if (!user) return;
    try {
      await authFetch(`${backendUrl}/api/auth/cliparts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliparts, favorites }),
      });
    } catch {
      // ignore, will retry next time
    }
  }, [backendUrl, user, authFetch]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    register,
    login,
    loginWithGoogle,
    loginWithFacebook,
    loginWithSocial,
    exchangeGoogleSession,
    logout,
    checkAuth,
    loadUserCliparts,
    saveUserCliparts,
    authFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
