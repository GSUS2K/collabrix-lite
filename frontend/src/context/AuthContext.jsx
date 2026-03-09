import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cc_token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then(r => setUser(r.data.user))
      .catch(() => localStorage.removeItem('cc_token'))
      .finally(() => setLoading(false));
  }, []);

  // Listen for 401 events from api.js (avoids window.location redirect in Discord iframe)
  useEffect(() => {
    const handler = () => { localStorage.removeItem('cc_token'); setUser(null); };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('cc_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithDiscord = (token, userData) => {
    localStorage.setItem('cc_token', token);
    setUser(userData);
  };

  const loginWithGoogle = async (credential) => {
    const { data } = await api.post('/api/auth/google', { credential });
    localStorage.setItem('cc_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (username, email, password) => {
    const { data } = await api.post('/api/auth/register', { username, email, password });
    localStorage.setItem('cc_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('cc_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithDiscord, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
