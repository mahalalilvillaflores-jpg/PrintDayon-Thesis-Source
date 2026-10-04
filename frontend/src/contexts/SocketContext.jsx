import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const activeShopRoomRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const rawApiUrl = import.meta.env.VITE_API_URL || '';
    const socketUrl = rawApiUrl
      ? rawApiUrl.replace(/\/$/, '').replace(/\/api$/, '')
      : (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/');

    const token = localStorage.getItem('pd_token');

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token },
    });

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('join:user', user._id);
      if (user.role === 'admin') {
        newSocket.emit('join:admin');
        console.log('🛡️  Joined admin room');
      }
      if (activeShopRoomRef.current) {
        newSocket.emit('join:shop', activeShopRoomRef.current);
        console.log('🏪 Restored shop room membership on connect:', activeShopRoomRef.current);
      }
      console.log('🔌 Socket connected');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, user?._id, user?.role]);

  const joinShopRoom = useCallback((shopId) => {
    if (shopId) {
      activeShopRoomRef.current = shopId;
      if (socket) {
        socket.emit('join:shop', shopId);
      }
    }
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected, joinShopRoom }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

export default SocketContext;
