import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

// Empty URL = same origin (collabrix-lite.vercel.app)
// Vercel's rewrites proxy /socket.io/* to Render backend
// This ensures Discord Activity sandbox allows the connection (Vercel is in URL Mappings)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('cc_token');
    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling'], // polling only — Vercel can't upgrade to WebSocket
      path: '/socket.io/',
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

