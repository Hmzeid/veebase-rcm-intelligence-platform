'use client';

import { useEffect } from 'react';
import { useRCMStore } from './rcm-store';
import type { ClaimRecord, EscalationRecord, AgentRecord, KPIRecord, AuditEntry } from './rcm-types';

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Hydrate the client store from the live (DB-backed) API on first mount.
 * Falls back silently to the bundled demo data if the API is unreachable, so
 * the UI is always populated. Persisted state (claims created via the UI or
 * the integration API, escalation changes, audit entries) survives reloads.
 */
export function useHydrateStore() {
  const { hydrated, setHydrated, setClaims, setEscalations, setAgents, setKpis, setAuditEntries } = useRCMStore();

  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;

    (async () => {
      const [claims, escalations, agents, kpis, audit] = await Promise.all([
        getJSON<{ claims: ClaimRecord[] }>('/api/claims?limit=500'),
        getJSON<{ escalations: EscalationRecord[] }>('/api/escalations'),
        getJSON<{ agents: AgentRecord[] }>('/api/agents'),
        getJSON<{ kpis?: KPIRecord[] }>('/api/kpis'),
        getJSON<{ entries: AuditEntry[] }>('/api/audit?limit=300'),
      ]);
      if (cancelled) return;

      if (claims?.claims?.length) setClaims(claims.claims);
      if (escalations?.escalations?.length) setEscalations(escalations.escalations);
      if (agents?.agents?.length) setAgents(agents.agents);
      if (kpis?.kpis?.length) setKpis(kpis.kpis);
      if (audit?.entries?.length) setAuditEntries(audit.entries);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, setHydrated, setClaims, setEscalations, setAgents, setKpis, setAuditEntries]);
}

// ── Persisting action helpers ────────────────────────────────────────────

export async function apiCreateClaim(input: Record<string, unknown>): Promise<ClaimRecord | null> {
  try {
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return (await res.json()) as ClaimRecord;
  } catch {
    return null;
  }
}

export async function apiProcessClaim(id: string, mode: 'step' | 'auto' = 'auto') {
  try {
    const res = await fetch(`/api/claims/${id}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiUpdateEscalation(id: string, action: 'acknowledge' | 'resolve') {
  try {
    const res = await fetch('/api/escalations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
