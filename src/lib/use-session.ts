'use client';

import { useEffect, useState } from 'react';

export interface SessionInfo {
  authEnabled: boolean;
  user: string | null;
  role: string | null;
  capabilities: string[];
}

let cache: SessionInfo | null = null;
let inflight: Promise<SessionInfo | null> | null = null;

async function load(): Promise<SessionInfo | null> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SessionInfo | null) => {
        cache = d;
        return d;
      })
      .catch(() => null);
  }
  return inflight;
}

/**
 * Lightweight session/capabilities hook (cached per page load). When auth is
 * disabled the session reports an implicit ADMIN, so `can()` is permissive in
 * the open demo — matching the server's behaviour.
 */
export function useSession() {
  const [session, setSession] = useState<SessionInfo | null>(cache);

  useEffect(() => {
    let active = true;
    load().then((s) => active && setSession(s));
    return () => {
      active = false;
    };
  }, []);

  const can = (capability: string): boolean => {
    if (!session) return true; // optimistic until loaded; server still enforces
    if (!session.authEnabled) return true;
    return session.capabilities.includes(capability);
  };

  return { session, can };
}
