import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SocketEvents, SocketListeners } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  emit: <K extends keyof SocketEvents>(event: K, data: Parameters<SocketEvents[K]>[0]) => void;
  on: <K extends keyof SocketListeners>(event: K, callback: SocketListeners[K]) => void;
  off: <K extends keyof SocketListeners>(event: K, callback?: SocketListeners[K]) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && token && user) {
      // Create socket connection with authentication
      const newSocket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000', {
        auth: {
          token: token,
        },
        transports: ['websocket'],
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      setSocket(newSocket);

      // Cleanup on unmount or when user logs out
      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      // Close socket if user is not authenticated
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [isAuthenticated, token, user]);

  const emit = <K extends keyof SocketEvents>(
    event: K,
    data: Parameters<SocketEvents[K]>[0]
  ) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  };

  const on = <K extends keyof SocketListeners>(
    event: K,
    callback: SocketListeners[K]
  ) => {
    if (socket) {
      socket.on(event as string, callback as any);
    }
  };

  const off = <K extends keyof SocketListeners>(
    event: K,
    callback?: SocketListeners[K]
  ) => {
    if (socket) {
      if (callback) {
        socket.off(event as string, callback as any);
      } else {
        socket.off(event as string);
      }
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    emit,
    on,
    off,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};