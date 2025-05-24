'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { signOut } from 'next-auth/react';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_DIALOG_TIMEOUT_MS = 2 * 60 * 1000; // Show warning 2 minutes before timeout

interface UseInactivityTimerProps {
  onWarning: () => void; // Callback to show warning modal
  onIdle: () => void;    // Callback for when user becomes idle (logout)
  isTimerActive: boolean; // Control whether the timer should be running
}

export function useInactivityTimer({ onWarning, onIdle, isTimerActive }: UseInactivityTimerProps) {
  const [isIdle, setIsIdle] = useState(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIsIdle(false); // No longer idle if timers are reset

    if (!isTimerActive) return;

    warningTimerRef.current = setTimeout(() => {
      onWarning(); // Trigger warning modal
    }, INACTIVITY_TIMEOUT_MS - WARNING_DIALOG_TIMEOUT_MS);

    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
      onIdle(); // Trigger actual logout
    }, INACTIVITY_TIMEOUT_MS);
  }, [onWarning, onIdle, isTimerActive]);

  const handleUserActivity = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!isTimerActive) {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Initial setup of timers
    resetTimers();

    events.forEach(event => window.addEventListener(event, handleUserActivity, { capture: true, passive: true }));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleUserActivity, { capture: true }));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [handleUserActivity, resetTimers, isTimerActive]);

  return { isIdle, resetTimers }; // Expose isIdle and resetTimers (e.g., for "Stay Logged In" button)
}
