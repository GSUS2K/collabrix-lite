import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import AuthPage from './components/auth/AuthPage';
import Dashboard from './components/dashboard/Dashboard';
import Room from './components/whiteboard/Room';
import { initGA, logPageView } from './utils/analytics';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { discordSdk, useDiscord } from './hooks/useDiscord';

initGA();

const AnalyticsTracker = () => {
  const location = useLocation();
  useEffect(() => { logPageView(location.pathname + location.search); }, [location]);
  return null;
};

// Detects if we're inside a real Discord Activity iframe
const isInDiscord = () => {
  try {
    return new URLSearchParams(window.location.search).get('frame_id') !== null;
  } catch { return false; }
};

// Silent auto-login for Discord Activity — no auth page shown
const DiscordAutoLogin = ({ children }) => {
  const { user, loading, loginWithDiscord } = useAuth();
  const { isReady, authenticate, error: sdkError } = useDiscord();
  const navigate = useNavigate();
  const [discordLoading, setDiscordLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (user) { setDiscordLoading(false); return; }
    if (!isInDiscord()) { setDiscordLoading(false); return; }

    // SDK failed to initialize — show error rather than hanging
    if (sdkError) { setError(sdkError.message || 'Discord SDK error'); setDiscordLoading(false); return; }

    if (!isReady) return; // wait for SDK to be ready

    (async () => {
      try {
        const { collabrix_token, user: discordUser } = await authenticate();
        loginWithDiscord(collabrix_token, discordUser);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Discord auto-login failed:', err);
        setError(err.message || 'Discord login failed');
      } finally {
        setDiscordLoading(false);
      }
    })();
  }, [loading, user, isReady, sdkError]);

  // 8-second timeout — only triggers if we're truly stuck waiting for Discord
  // Cancels itself if user resolves (logged in) before timeout fires
  useEffect(() => {
    if (!isInDiscord()) return;
    if (user || !loading) {
      // Already resolved — no need for a timeout
      return;
    }
    const t = setTimeout(() => {
      // Only set error if we're still waiting (not yet logged in)
      setDiscordLoading(prev => {
        if (prev) {
          setError('Discord timed out. Try reopening the Activity.');
        }
        return false;
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [user, loading]);

  if (loading || (isInDiscord() && discordLoading && !error)) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0c0c0f', color: '#00FFBF', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(0,255,191,0.2)', borderTopColor: '#00FFBF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, opacity: 0.7 }}>Connecting to Discord...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0c0c0f', color: '#FF6B6B', gap: 12, padding: 24 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <p style={{ fontWeight: 'bold' }}>Discord login failed</p>
        <p style={{ fontSize: 12, opacity: 0.6, textAlign: 'center' }}>{error}</p>
      </div>
    );
  }

  return children;
};

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0c0f' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(0,255,191,0.2)', borderTopColor: '#00FFBF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  return user ? children : <Navigate to="/auth" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/dashboard" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
    <Route path="/room/:id" element={<PrivateRoute><SocketProvider><Room /></SocketProvider></PrivateRoute>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <DiscordAutoLogin>
          <AnalyticsTracker />
          <AppRoutes />
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#18181F',
                color: '#F0EEF8',
                border: '1px solid rgba(255,255,255,0.07)',
                fontSize: '13px',
                fontFamily: "'Karla', sans-serif",
              },
              success: { iconTheme: { primary: '#00FFBF', secondary: '#0C0C0F' } },
              error: { iconTheme: { primary: '#FF6B6B', secondary: '#0C0C0F' } },
            }}
          />
        </DiscordAutoLogin>
      </BrowserRouter>
    </AuthProvider>
  );
}
