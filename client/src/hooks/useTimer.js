import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Client-side countdown timer driven by server-provided endsAt timestamp.
 * The server is authoritative — we only use this for display.
 *
 * @param {string|null} endsAt - ISO timestamp from server
 * @returns {{ remaining: number, isUrgent: boolean, isExpired: boolean }}
 */
const useTimer = (endsAt) => {
  const [remaining, setRemaining] = useState(0);
  const frameRef = useRef(null);

  const tick = useCallback(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    const diff = Math.max(0, Math.ceil((new Date(endsAt) - Date.now()) / 1000));
    setRemaining(diff);

    if (diff > 0) {
      frameRef.current = requestAnimationFrame(tick);
    }
  }, [endsAt]);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    tick();
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [tick]);

  return {
    remaining,
    isUrgent: remaining > 0 && remaining <= 5,
    isWarning: remaining > 5 && remaining <= 10,
    isExpired: remaining === 0,
  };
};

export default useTimer;
