// Idle sign-out (D-233): after the operator's set number of minutes with no
// activity (setting auth.idle_minutes, 30 by default) the user is signed
// out, so a shared terminal is not left open in someone's name. Items
// waiting in the send queue stay on the device and go at the next sign-in.
import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { useIdleMinutes } from './settings';

const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
export const IDLE_FLAG = 'nexus:signed-out-idle';

export function useIdleSignOut() {
  const { signOut } = useAuth();
  const minutes = useIdleMinutes();
  const last = useRef(Date.now());

  useEffect(() => {
    if (!minutes) return;                       // 0 switches it off
    const touch = () => { last.current = Date.now(); };
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const check = () => {
      if (Date.now() - last.current >= minutes * 60_000) {
        try { sessionStorage.setItem(IDLE_FLAG, String(minutes)); } catch { /* private mode */ }
        void signOut();
      }
    };
    const timer = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);   // a laptop woken after hours
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [minutes, signOut]);
}
