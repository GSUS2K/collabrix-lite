import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

// Connect directly to Render — Vercel proxy doesn't work for socket.io
// (Vercel rewrites return index.html for /socket.io/ requests)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://collabrix-lite.onrender.com';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('cc_token');
    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
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

