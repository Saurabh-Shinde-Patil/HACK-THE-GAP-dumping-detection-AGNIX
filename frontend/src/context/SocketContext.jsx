import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [alerts, setAlerts] = useState([]);
  const [cctvAlerts, setCctvAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (user) {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
      const socket = io(socketUrl, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        // Join role-based rooms
        if (user.role === 'admin') socket.emit('join-room', 'admins');
        if (user.role === 'superadmin') {
          socket.emit('join-room', 'admins');
          socket.emit('join-room', 'superadmins');
        }
        if (user.role === 'worker') socket.emit('join-room', `worker-${user._id}`);
      });

      socket.on('new-alert', (report) => {
        setAlerts((prev) => [{ ...report, _alertTs: Date.now() }, ...prev].slice(0, 50));
      });

      // CCTV detection alerts
      socket.on('cctv-detection', (detection) => {
        setCctvAlerts((prev) => [{ ...detection, _alertTs: Date.now() }, ...prev].slice(0, 100));
      });

      socket.on('disconnect', () => setIsConnected(false));
      return () => socket.disconnect();
    }
  }, [user]);

  const clearAlerts = () => setAlerts([]);
  const clearCctvAlerts = () => setCctvAlerts([]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, alerts, cctvAlerts, isConnected, clearAlerts, clearCctvAlerts }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

