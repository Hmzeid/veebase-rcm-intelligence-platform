import { db } from '@/lib/db';

export interface AuditInput {
  action: string;
  actor?: string;
  actorRole?: string;
  claimId?: string | null;
  claimNumber?: string | null;
  agentName?: string | null;
  details: string;
  previousValue?: string | null;
  newValue?: string | null;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags?: string[];
  source?: 'ui' | 'api' | 'engine' | 'webhook';
}

/** Append an immutable entry to the compliance audit trail. Best-effort. */
export async function writeAudit(entry: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actor: entry.actor ?? 'System',
        actorRole: entry.actorRole ?? 'System',
        claimId: entry.claimId ?? null,
        claimNumber: entry.claimNumber ?? null,
        agentName: entry.agentName ?? null,
        details: entry.details,
        previousValue: entry.previousValue ?? null,
        newValue: entry.newValue ?? null,
        riskLevel: entry.riskLevel ?? 'LOW',
        tags: JSON.stringify(entry.tags ?? []),
        source: entry.source ?? 'engine',
      },
    });
  } catch (e) {
    console.warn('writeAudit failed (non-critical):', e);
  }
}
