"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
const THROTTLE_MS = 10 * 1000;
const STORAGE_KEY = "last_activity";
const LOGOUT_SIGNAL_KEY = "inactivity_logout";

const AUTH_PATHS = ["/auth/login", "/auth/logout", "/auth/mfa-verify", "/auth/mfa-setup", "/auth/signup"];

export function InactivityTimer() {
  const lastActivityRef = useRef(Date.now());
  const loggedOutRef = useRef(false);
  const pathname = usePathname();

  const isAuthPage = AUTH_PATHS.some((p) => pathname?.startsWith(p));

  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > THROTTLE_MS) {
      lastActivityRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, now.toString());
      } catch {}
    }
  }, []);

  const triggerLogout = useCallback(() => {
    if (loggedOutRef.current) return;
    loggedOutRef.current = true;
    try {
      localStorage.setItem(LOGOUT_SIGNAL_KEY, Date.now().toString());
    } catch {}
    window.location.href = "/auth/logout?reason=inactivity";
  }, []);

  useEffect(() => {
    if (isAuthPage) return;

    const now = Date.now();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const storedTime = parseInt(stored, 10);
        const elapsed = now - storedTime;
        if (elapsed >= INACTIVITY_LIMIT_MS) {
          localStorage.setItem(STORAGE_KEY, now.toString());
          lastActivityRef.current = now;
        } else {
          lastActivityRef.current = storedTime;
        }
      } else {
        localStorage.setItem(STORAGE_KEY, now.toString());
        lastActivityRef.current = now;
      }
    } catch {
      lastActivityRef.current = now;
    }

    ACTIVITY_EVENTS.forEach((event) =>
      document.addEventListener(event, recordActivity, { passive: true })
    );

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        lastActivityRef.current = parseInt(e.newValue, 10);
      }
      if (e.key === LOGOUT_SIGNAL_KEY && e.newValue) {
        triggerLogout();
      }
    };
    window.addEventListener("storage", onStorageChange);

    const checkIdleAndLogout = () => {
      if (loggedOutRef.current) return;

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          lastActivityRef.current = parseInt(stored, 10);
        }
      } catch {}

      const idle = Date.now() - lastActivityRef.current;

      if (idle >= INACTIVITY_LIMIT_MS) {
        triggerLogout();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkIdleAndLogout();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const interval = setInterval(checkIdleAndLogout, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        document.removeEventListener(event, recordActivity)
      );
      window.removeEventListener("storage", onStorageChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, [isAuthPage, recordActivity, triggerLogout]);

  return null;
}
