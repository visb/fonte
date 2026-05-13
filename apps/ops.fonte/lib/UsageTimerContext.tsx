import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';

const LIMIT_SECONDS = 1200;
const HEARTBEAT_EVERY_MS = 10_000;  // 10s — max gap lost on crash
const RESYNC_EVERY_MS = 60_000;     // 60s full resync from backend (picks up other devices)

interface TimerCtx {
  secondsRemaining: number;
  isBlocked: boolean;
  isLoading: boolean;
  startTracking: () => void;
  stopTracking: () => void;
}

const UsageTimerContext = createContext<TimerCtx | null>(null);

export function useUsageTimerContext(): TimerCtx {
  const ctx = useContext(UsageTimerContext);
  if (!ctx) throw new Error('useUsageTimerContext must be inside UsageTimerProvider');
  return ctx;
}

export function UsageTimerProvider({ children }: { children: React.ReactNode }) {
  const [secondsUsed, setSecondsUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const isActiveRef = useRef(false);
  // Wall-clock timestamp when current tracking period started.
  const trackStartAtRef = useRef<number | null>(null);
  // Backend-authoritative value at the moment tracking started (or last heartbeat sync).
  const baseAtStartRef = useRef(0);
  // Last heartbeat wall-clock timestamp.
  const lastHeartbeatAtRef = useRef<number | null>(null);
  // Last full-resync wall-clock timestamp.
  const lastResyncAtRef = useRef<number | null>(null);
  // Display interval ref.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync state + refs from a server value. Call after any authoritative backend response.
  const syncFromServer = useCallback((serverSecondsUsed: number) => {
    const clamped = Math.min(serverSecondsUsed, LIMIT_SECONDS);
    setSecondsUsed(clamped);
    baseAtStartRef.current = clamped;
    trackStartAtRef.current = isActiveRef.current ? Date.now() : null;
  }, []);

  // Initial fetch — source of truth on mount.
  useEffect(() => {
    api.residentSessions
      .getToday()
      .then((s) => syncFromServer(s.secondsUsed))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [syncFromServer]);

  // Stable tick — reads everything from refs, never recreated.
  const tick = useCallback(() => {
    if (!isActiveRef.current || trackStartAtRef.current === null) return;

    const now = Date.now();

    // Update display using wall-clock elapsed since last sync point.
    const elapsed = Math.floor((now - trackStartAtRef.current) / 1000);
    const display = Math.min(baseAtStartRef.current + elapsed, LIMIT_SECONDS);
    setSecondsUsed(display);

    // Heartbeat: send elapsed seconds since last heartbeat and sync base from response.
    const msSinceHb = lastHeartbeatAtRef.current !== null ? now - lastHeartbeatAtRef.current : 0;
    if (msSinceHb >= HEARTBEAT_EVERY_MS) {
      const secsSinceHb = Math.floor(msSinceHb / 1000);
      lastHeartbeatAtRef.current = now;
      api.residentSessions
        .heartbeat(secsSinceHb)
        .then((s) => syncFromServer(s.secondsUsed))
        .catch(() => {});
    }

    // Periodic full resync from backend (catches other devices' usage).
    const msSinceResync =
      lastResyncAtRef.current !== null ? now - lastResyncAtRef.current : Infinity;
    if (msSinceResync >= RESYNC_EVERY_MS) {
      lastResyncAtRef.current = now;
      api.residentSessions
        .getToday()
        .then((s) => syncFromServer(s.secondsUsed))
        .catch(() => {});
    }
  }, [syncFromServer]); // syncFromServer is stable

  const startTracking = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    trackStartAtRef.current = Date.now();
    lastHeartbeatAtRef.current = Date.now();
    lastResyncAtRef.current = Date.now();
    // baseAtStartRef already holds the latest server value from syncFromServer.
    intervalRef.current = setInterval(tick, 1000);
  }, [tick]);

  const stopTracking = useCallback(() => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Flush remaining seconds since last heartbeat.
    if (lastHeartbeatAtRef.current !== null) {
      const secs = Math.floor((Date.now() - lastHeartbeatAtRef.current) / 1000);
      if (secs > 0) {
        api.residentSessions
          .heartbeat(secs)
          .then((s) => syncFromServer(s.secondsUsed))
          .catch(() => {});
      }
    }
    trackStartAtRef.current = null;
    lastHeartbeatAtRef.current = null;
  }, [syncFromServer]);

  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  const secondsRemaining = Math.max(0, LIMIT_SECONDS - secondsUsed);
  const isBlocked = secondsUsed >= LIMIT_SECONDS;

  return (
    <UsageTimerContext.Provider
      value={{ secondsRemaining, isBlocked, isLoading, startTracking, stopTracking }}
    >
      {children}
    </UsageTimerContext.Provider>
  );
}
