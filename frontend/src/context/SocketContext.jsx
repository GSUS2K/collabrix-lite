import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

// Socket.IO must connect directly to Render — Vercel serverless can't upgrade WebSockets
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://collabrix-lite.onrender.com';

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('cc_token');
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'], // polling first — Vercel works; upgrades to WS after
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
