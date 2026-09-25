import { useEffect, useState } from 'react';
import socket from '../../socket/socketClient';

const STATUS = {
  connected:    { label: 'Connected',      dot: 'connected',    text: 'text-success' },
  reconnecting: { label: 'Reconnecting…',  dot: 'reconnecting', text: 'text-warning' },
  disconnected: { label: 'Connection lost',dot: 'disconnected', text: 'text-danger'  },
};

const ConnectionStatus = ({ className = '' }) => {
  const [status, setStatus] = useState(socket.connected ? 'connected' : 'disconnected');

  useEffect(() => {
    const onConnect    = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onReconnect  = () => setStatus('reconnecting');

    socket.on('connect',             onConnect);
    socket.on('disconnect',          onDisconnect);
    socket.on('reconnect_attempt',   onReconnect);
    socket.on('reconnect',           onConnect);

    return () => {
      socket.off('connect',           onConnect);
      socket.off('disconnect',        onDisconnect);
      socket.off('reconnect_attempt', onReconnect);
      socket.off('reconnect',         onConnect);
    };
  }, []);

  const s = STATUS[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text} ${className}`}>
      <span className={`conn-dot ${s.dot}`} />
      {s.label}
    </span>
  );
};

export default ConnectionStatus;
