import { db } from '@/lib/db';
import type { ClaimRecord, ClaimStatus, PayerType } from '@/lib/rcm-types';
import { processClaim, computeReadiness, computeDenialRisk, isTerminal, type EngineClaim, type AgentResult } from '@/lib/rcm-engine';
import { writeAudit } from './audit';
import { emitEvent, type RcmEvent } from './webhooks';

// ── Serialization ───────────────────────────────────────────────────────

type DbClaim = Awaited<ReturnType<typeof db.claim.findFirst>>;

export function serializeClaim(c: NonNullable<DbClaim>): ClaimRecord {
  return {
    id: c.id,
    claimNumber: c.claimNumber,
    patientId: c.patientId,
    patientName: c.patientName,
    nationalId: c.nationalId,
    encounterId: c.encounterId,
    payerId: c.payerId,
    payerName: c.payerName,
    payerType: c.payerType as PayerType,
    serviceDate: c.serviceDate.toISOString(),
    totalAmount: c.totalAmount,
    status: c.status as ClaimStatus,
    readinessScore: c.readinessScore,
    denialRiskScore: c.denialRiskScore,
    priorAuthRequired: c.priorAuthRequired,
    priorAuthNumber: c.priorAuthNumber ?? undefined,
    priorAuthStatus: c.priorAuthStatus ?? undefined,
    submittedAt: c.submittedAt?.toISOString() ?? undefined,
    expectedResponseBy: c.expectedResponseBy?.toISOString() ?? undefined,
    paidAmount: c.paidAmount,
    patientResponsibility: c.patientResponsibility,
    appealDeadline: c.appealDeadline?.toISOString() ?? undefined,
    filingDeadline: c.filingDeadline?.toISOString() ?? undefined,
    phase: c.phase,
    hitlGate: c.hitlGate as ClaimRecord['hitlGate'],
    currentAgent: c.currentAgent ?? undefined,
    tags: safeJson<string[]>(c.tags as string, []),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function toEngineClaim(c: ClaimRecord): EngineClaim {
  return {
    id: c.id,
    claimNumber: c.claimNumber,
    patientName: c.patientName,
    payerId: c.payerId,
    payerName: c.payerName,
    payerType: c.payerType,
    serviceDate: c.serviceDate,
    totalAmount: c.totalAmount,
    status: c.status,
    readinessScore: c.readinessScore,
    denialRiskScore: c.denialRiskScore,
    priorAuthRequired: c.priorAuthRequired,
    priorAuthNumber: c.priorAuthNumber,
    priorAuthStatus: c.priorAuthStatus,
    paidAmount: c.paidAmount,
    patientResponsibility: c.patientResponsibility,
    phase: c.phase,
    tags: c.tags,
    submittedAt: c.submittedAt,
    filingDeadline: c.filingDeadline,
    appealDeadline: c.appealDeadline,
    expectedResponseBy: c.expectedResponseBy,
  };
}

// ── Reads ───────────────────────────────────────────────────────────────

export async function getClaim(id: string): Promise<ClaimRecord | null> {
  const c = await db.claim.findFirst({ where: { OR: [{ id }, { claimNumber: id }] } });
  return c ? serializeClaim(c) : null;
}

export interface ClaimFilters {
  status?: string | null;
  payerType?: string | null;
  payerId?: string | null;
  minAmount?: number;
  maxAmount?: number;
  tag?: string | null;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listClaims(filters: ClaimFilters = {}) {
  const rows = await db.claim.findMany({ orderBy: { createdAt: 'desc' } });
  let claims = rows.map(serializeClaim);

  if (filters.status) claims = claims.filter((c) => c.status === filters.status);
  if (filters.payerType) claims = claims.filter((c) => c.payerType === filters.payerType);
  if (filters.payerId) claims = claims.filter((c) => c.payerId === filters.payerId);
  if (filters.minAmount !== undefined) claims = claims.filter((c) => c.totalAmount >= filters.minAmount!);
  if (filters.maxAmount !== undefined) claims = claims.filter((c) => c.totalAmount <= filters.maxAmount!);
  if (filters.tag) claims = claims.filter((c) => c.tags.includes(filters.tag!));
  if (filters.search) {
    const s = filters.search.toLowerCase();
    claims = claims.filter(
      (c) =>
        c.patientName.toLowerCase().includes(s) ||
        c.claimNumber.toLowerCase().includes(s) ||
        c.payerName.toLowerCase().includes(s),
    );
  }

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const total = claims.length;
  const start = (page - 1) * limit;
  const paginated = claims.slice(start, start + limit);

  const totalAmount = claims.reduce((s, c) => s + c.totalAmount, 0);
  const totalPaid = claims.reduce((s, c) => s + c.paidAmount, 0);
  const statusDistribution: Record<string, number> = {};
  for (const c of claims) statusDistribution[c.status] = (statusDistribution[c.status] || 0) + 1;

  return {
    claims: paginated,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalClaims: total,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      avgReadinessScore: total ? Math.round(claims.reduce((s, c) => s + c.readinessScore, 0) / total) : 0,
      avgDenialRiskScore: total ? Math.round(claims.reduce((s, c) => s + c.denialRiskScore, 0) / total) : 0,
      statusDistribution,
    },
  };
}

export async function updateClaim(idOrNumber: string, patch: Partial<CreateClaimInput> & { status?: ClaimStatus; priorAuthStatus?: string }, actor = 'API'): Promise<ClaimRecord | null> {
  const current = await getClaim(idOrNumber);
  if (!current) return null;
  const data: Record<string, unknown> = {};
  if (patch.payerName !== undefined) data.payerName = patch.payerName;
  if (patch.payerType !== undefined) data.payerType = patch.payerType;
  if (patch.totalAmount !== undefined) data.totalAmount = patch.totalAmount;
  if (patch.priorAuthRequired !== undefined) data.priorAuthRequired = patch.priorAuthRequired;
  if (patch.priorAuthNumber !== undefined) data.priorAuthNumber = patch.priorAuthNumber;
  if (patch.priorAuthStatus !== undefined) data.priorAuthStatus = patch.priorAuthStatus;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.tags !== undefined) data.tags = JSON.stringify(patch.tags);
  const updated = await db.claim.update({ where: { id: current.id }, data });
  const claim = serializeClaim(updated);
  await writeAudit({
    action: 'AGENT_OVERRIDE',
    actor,
    actorRole: 'Operator',
    claimId: claim.id,
    claimNumber: claim.claimNumber,
    details: `Claim fields updated via API: ${Object.keys(data).join(', ')}`,
    newValue: claim.status,
    source: 'api',
  });
  await emitEvent('claim.updated', { claim });
  return claim;
}

// ── Create ──────────────────────────────────────────────────────────────

export interface CreateClaimInput {
  patientName: string;
  nationalId?: string;
  patientId?: string;
  encounterId?: string;
  payerId?: string;
  payerName?: string;
  payerType?: PayerType;
  serviceDate?: string;
  totalAmount: number;
  priorAuthRequired?: boolean;
  priorAuthNumber?: string;
  tags?: string[];
  status?: ClaimStatus;
  source?: string;
}

export async function createClaim(input: CreateClaimInput, actor = 'API'): Promise<ClaimRecord> {
  const count = await db.claim.count();
  const seq = String(count + 1).padStart(4, '0');
  const year = new Date().getFullYear();
  const payerType = (input.payerType ?? 'PRIVATE') as PayerType;

  const baseClaim: ClaimRecord = {
    id: 'tmp',
    claimNumber: `CLM-${year}-${seq}`,
    patientId: input.patientId ?? `PAT-${seq}`,
    patientName: input.patientName,
    nationalId: input.nationalId ?? '',
    encounterId: input.encounterId ?? `ENC-${seq}`,
    payerId: input.payerId ?? payerType,
    payerName: input.payerName ?? defaultPayerName(payerType),
    payerType,
    serviceDate: input.serviceDate ?? new Date().toISOString(),
    totalAmount: input.totalAmount,
    status: input.status ?? 'ELIGIBILITY',
    readinessScore: 0,
    denialRiskScore: 0,
    priorAuthRequired: input.priorAuthRequired ?? false,
    priorAuthNumber: input.priorAuthNumber,
    priorAuthStatus: input.priorAuthRequired ? (input.priorAuthNumber ? 'APPROVED' : 'PENDING') : 'NOT_REQUIRED',
    paidAmount: 0,
    patientResponsibility: 0,
    phase: 1,
    hitlGate: 'REVIEW',
    tags: input.tags ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const engineClaim = toEngineClaim(baseClaim);
  const readinessScore = computeReadiness(engineClaim);
  const denialRiskScore = computeDenialRisk(engineClaim);

  const created = await db.claim.create({
    data: {
      claimNumber: baseClaim.claimNumber,
      patientId: baseClaim.patientId,
      patientName: baseClaim.patientName,
      nationalId: baseClaim.nationalId,
      encounterId: baseClaim.encounterId,
      payerId: baseClaim.payerId,
      payerName: baseClaim.payerName,
      payerType: baseClaim.payerType,
      serviceDate: new Date(baseClaim.serviceDate),
      totalAmount: baseClaim.totalAmount,
      status: baseClaim.status,
      readinessScore,
      denialRiskScore,
      priorAuthRequired: baseClaim.priorAuthRequired,
      priorAuthNumber: baseClaim.priorAuthNumber ?? null,
      priorAuthStatus: baseClaim.priorAuthStatus ?? null,
      paidAmount: 0,
      patientResponsibility: 0,
      phase: 1,
      hitlGate: baseClaim.hitlGate,
      tags: JSON.stringify(baseClaim.tags),
    },
  });

  const claim = serializeClaim(created);
  await writeAudit({
    action: 'CLAIM_CREATED',
    actor,
    actorRole: 'System',
    claimId: claim.id,
    claimNumber: claim.claimNumber,
    details: `Claim created via ${input.source ?? 'api'} for ${claim.patientName} — ${claim.totalAmount.toFixed(2)} EGP to ${claim.payerName}.`,
    newValue: claim.status,
    riskLevel: claim.denialRiskScore >= 50 ? 'HIGH' : 'LOW',
    tags: claim.tags,
    source: 'api',
  });
  await emitEvent('claim.created', { claim });
  return claim;
}

// ── Process (run the engine, persist, emit) ──────────────────────────────

export interface ProcessOutcome {
  claim: ClaimRecord;
  result: AgentResult;
  escalationCreated?: { id: string; level: number; reason: string };
}

export async function processOnce(idOrNumber: string, actor = 'engine'): Promise<ProcessOutcome | null> {
  const current = await getClaim(idOrNumber);
  if (!current) return null;
  if (isTerminal(current.status)) {
    const result = processClaim(toEngineClaim(current));
    return { claim: current, result };
  }

  const result = processClaim(toEngineClaim(current));
  const p = result.patch;

  const updated = await db.claim.update({
    where: { id: current.id },
    data: {
      status: p.status ?? current.status,
      readinessScore: p.readinessScore ?? current.readinessScore,
      denialRiskScore: p.denialRiskScore ?? current.denialRiskScore,
      priorAuthRequired: p.priorAuthRequired ?? current.priorAuthRequired,
      priorAuthStatus: p.priorAuthStatus ?? current.priorAuthStatus ?? null,
      priorAuthNumber: p.priorAuthNumber ?? current.priorAuthNumber ?? null,
      paidAmount: p.paidAmount ?? current.paidAmount,
      patientResponsibility: p.patientResponsibility ?? current.patientResponsibility,
      submittedAt: p.submittedAt ? new Date(p.submittedAt) : current.submittedAt ? new Date(current.submittedAt) : null,
      expectedResponseBy: p.expectedResponseBy ? new Date(p.expectedResponseBy) : current.expectedResponseBy ? new Date(current.expectedResponseBy) : null,
      filingDeadline: p.filingDeadline ? new Date(p.filingDeadline) : current.filingDeadline ? new Date(current.filingDeadline) : null,
      appealDeadline: p.appealDeadline ? new Date(p.appealDeadline) : current.appealDeadline ? new Date(current.appealDeadline) : null,
      currentAgent: result.agentName,
      hitlGate: result.hitlGate,
      tags: JSON.stringify(result.tags),
    },
  });
  const claim = serializeClaim(updated);

  // Record the agent processing event.
  await db.claimEvent.create({
    data: {
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      agentName: result.agentName,
      phase: claim.phase,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      confidence: result.confidence,
      rationale: result.rationale,
      recommendedAction: result.recommendedAction,
      hitlGate: result.hitlGate,
      escalationRequired: !!result.escalation,
      output: JSON.stringify(result.output),
      tags: JSON.stringify(result.tags),
    },
  }).catch(() => {});

  await writeAudit({
    action: 'AGENT_RUN',
    actor,
    actorRole: 'Agent',
    claimId: claim.id,
    claimNumber: claim.claimNumber,
    agentName: result.agentName,
    details: `${result.displayName}: ${result.rationale}`,
    previousValue: result.fromStatus,
    newValue: result.toStatus,
    riskLevel: result.hitlGate === 'APPROVE' ? 'HIGH' : result.hitlGate === 'REVIEW' ? 'MEDIUM' : 'LOW',
    tags: result.tags,
    source: 'engine',
  });

  // Persist escalation if the agent raised one.
  let escalationCreated: ProcessOutcome['escalationCreated'];
  if (result.escalation) {
    const esc = await db.escalation.create({
      data: {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        level: result.escalation.level,
        reason: result.escalation.reason,
        agentName: result.escalation.agentName,
        status: 'PENDING',
        tags: JSON.stringify(result.escalation.tags),
      },
    }).catch(() => null);
    if (esc) {
      escalationCreated = { id: esc.id, level: esc.level, reason: esc.reason };
      await emitEvent('escalation.created', { escalation: { id: esc.id, claimNumber: claim.claimNumber, level: esc.level, reason: esc.reason } });
    }
  }

  // Emit lifecycle events.
  if (result.fromStatus !== result.toStatus) {
    await emitEvent('claim.status_changed', { claim, from: result.fromStatus, to: result.toStatus });
    const map: Partial<Record<ClaimStatus, RcmEvent>> = {
      SUBMITTED: 'claim.submitted',
      DENIED: 'claim.denied',
      PAID: 'claim.paid',
      WRITTEN_OFF: 'claim.written_off',
    };
    const ev = map[result.toStatus];
    if (ev) await emitEvent(ev, { claim });
  }
  await emitEvent('agent.run', { claimNumber: claim.claimNumber, agent: result.agentName, from: result.fromStatus, to: result.toStatus });

  return { claim, result, escalationCreated };
}

/**
 * Auto-run a claim through the pipeline until it hits a human gate
 * (REVIEW/APPROVE), a terminal status, or a safety cap. Honors the Phase-1
 * governance model: stops at any gate that requires a human, so nothing is
 * auto-approved that policy prohibits.
 */
export async function processToGate(idOrNumber: string, actor = 'engine', maxSteps = 12): Promise<{ steps: ProcessOutcome[]; claim: ClaimRecord | null }> {
  const steps: ProcessOutcome[] = [];
  let id = idOrNumber;
  for (let i = 0; i < maxSteps; i++) {
    const outcome = await processOnce(id, actor);
    if (!outcome) break;
    steps.push(outcome);
    id = outcome.claim.id;
    if (isTerminal(outcome.claim.status)) break;
    // Stop on a human gate so we never bypass required review/approval.
    if (outcome.result.hitlGate !== 'AUTO') break;
    if (outcome.result.fromStatus === outcome.result.toStatus) break; // held (e.g. dirty scrub)
  }
  const claim = steps.length ? steps[steps.length - 1].claim : await getClaim(idOrNumber);
  return { steps, claim };
}

// ── helpers ───────────────────────────────────────────────────────────

function defaultPayerName(t: PayerType): string {
  return t === 'NHIA' ? 'National Health Insurance Authority' : t === 'SELF_PAY' ? 'Self-Pay' : 'Private Insurer';
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
