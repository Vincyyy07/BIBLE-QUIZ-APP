import { useEffect, useRef, useCallback } from 'react';
import socket, { EVENTS } from '../socket/socketClient';

/**
 * Hook to manage Socket.IO connection lifecycle and event listeners.
 * Automatically cleans up listeners on unmount with referentially stable handlers.
 */
const useSocket = () => {
  const listenersRef = useRef([]);

  const on = useCallback((event, handler) => {
    socket.on(event, handler);
    listenersRef.current.push({ event, handler });
  }, []);

  const off = useCallback((event, handler) => {
    socket.off(event, handler);
  }, []);

  const emit = useCallback((event, data) => {
    socket.emit(event, data);
  }, []);

  // Clean up all registered listeners on unmount
  useEffect(() => {
    return () => {
      listenersRef.current.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
      listenersRef.current = [];
    };
  }, []);

  return { socket, on, off, emit, EVENTS };
};

export default useSocket;
