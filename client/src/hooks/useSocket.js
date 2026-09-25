import { useEffect, useRef } from 'react';
import socket, { EVENTS } from '../socket/socketClient';

/**
 * Hook to manage Socket.IO connection lifecycle and event listeners.
 * Automatically cleans up listeners on unmount.
 */
const useSocket = () => {
  const listenersRef = useRef([]);

  const on = (event, handler) => {
    socket.on(event, handler);
    listenersRef.current.push({ event, handler });
  };

  const off = (event, handler) => {
    socket.off(event, handler);
  };

  const emit = (event, data) => {
    socket.emit(event, data);
  };

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
