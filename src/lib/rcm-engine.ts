/**
 * RCM Processing Engine
 * ─────────────────────
 * Deterministic, explainable rules engine that drives a claim through the
 * revenue-cycle pipeline. Each pipeline stage is owned by one of the 12
 * agents; `processClaim()` runs the agent responsible for the claim's current
 * stage, produces a structured AgentOutput, recomputes risk/readiness scores,
 * decides the next status, and flags Human-in-the-Loop (HITL) gates and
 * escalations according to the Phase-1 governance model.
 *
 * The engine is pure: it takes a claim snapshot and returns the proposed
 * changes. Persistence, audit logging and webhook dispatch are handled by the
 * service layer (rcm-service.ts), keeping this module side-effect free and
 * unit-testable.
 */

import type {
  ClaimStatus,
  ConfidenceLevel,
  HitlGate,
  PayerType,
} from './rcm-types';

// ── Domain inputs ───────────────────────────────────────────────────────

export interface EngineClaim {
  id: string;
  claimNumber: string;
  patientName: string;
  payerId: string;
  payerName: string;
  payerType: PayerType;
  serviceDate: string;
  totalAmount: number;
  status: ClaimStatus;
  readinessScore: number;
  denialRiskScore: number;
  priorAuthRequired: boolean;
  priorAuthNumber?: string | null;
  priorAuthStatus?: string | null;
  paidAmount: number;
  patientResponsibility: number;
  phase: number;
  tags: string[];
  submittedAt?: string | null;
  filingDeadline?: string | null;
  appealDeadline?: string | null;
  expectedResponseBy?: string | null;
}

export interface ProposedEscalation {
  level: number;
  reason: string;
  agentName: string;
  tags: string[];
}

export interface AgentResult {
  agentName: string;
  displayName: string;
  fromStatus: ClaimStatus;
  toStatus: ClaimStatus;
  confidence: ConfidenceLevel;
  hitlGate: HitlGate;
  rationale: string;
  recommendedAction: string;
  output: Record<string, unknown>;
  tags: string[];
  escalation?: ProposedEscalation;
  /** Field-level patch to apply to the claim record. */
  patch: Partial<EngineClaim>;
  /** True when the claim has reached a terminal state (PAID/CLOSED/WRITTEN_OFF). */
  terminal: boolean;
}

// ── Payer rule book ─────────────────────────────────────────────────────
// Compact, deterministic contract rules. In a real deployment these would be
// sourced from the PayerContractRules knowledge agent / contract DB.

interface PayerRule {
  /** Amount above which prior authorisation is mandatory (EGP). */
  priorAuthThreshold: number;
  /** Timely-filing window in days from service date. */
  filingDays: number;
  /** Appeal window in days from denial. */
  appealDays: number;
  /** Contractual reimbursement rate applied at payment posting. */
  reimbursementRate: number;
  /** Baseline denial propensity for this payer (0-100). */
  denialBaseline: number;
}

const PAYER_RULES: Record<PayerType, PayerRule> = {
  NHIA: { priorAuthThreshold: 5000, filingDays: 90, appealDays: 30, reimbursementRate: 0.9, denialBaseline: 8 },
  PRIVATE: { priorAuthThreshold: 3000, filingDays: 60, appealDays: 45, reimbursementRate: 0.85, denialBaseline: 12 },
  SELF_PAY: { priorAuthThreshold: Infinity, filingDays: 365, appealDays: 0, reimbursementRate: 0, denialBaseline: 0 },
};

export function getPayerRule(payerType: PayerType): PayerRule {
  return PAYER_RULES[payerType] ?? PAYER_RULES.PRIVATE;
}

// ── Scoring ─────────────────────────────────────────────────────────────

/** Recompute readiness (0-100, higher = cleaner) from the current claim state. */
export function computeReadiness(claim: EngineClaim): number {
  let score = 70;
  const rule = getPayerRule(claim.payerType);

  if (claim.priorAuthRequired) {
    if (claim.priorAuthNumber && claim.priorAuthStatus === 'APPROVED') score += 15;
    else if (claim.priorAuthStatus === 'PENDING') score -= 10;
    else score -= 20;
  } else {
    score += 10;
  }

  if (claim.totalAmount > rule.priorAuthThreshold && !claim.priorAuthRequired) score -= 8;
  if (claim.tags.includes('MISSING_CHARGES')) score -= 15;
  if (claim.tags.includes('CODING_REVIEW')) score -= 8;
  if (claim.tags.includes('CLEAN_CLAIM')) score += 12;

  // Filing-deadline pressure
  if (claim.filingDeadline) {
    const days = daysUntil(claim.filingDeadline);
    if (days < 7) score -= 12;
    else if (days < 15) score -= 5;
  }

  return clamp(Math.round(score), 0, 100);
}

/** Recompute denial-risk (0-100, higher = riskier). */
export function computeDenialRisk(claim: EngineClaim): number {
  const rule = getPayerRule(claim.payerType);
  let risk = rule.denialBaseline;

  if (claim.priorAuthRequired && claim.priorAuthStatus !== 'APPROVED') risk += 25;
  if (claim.totalAmount > rule.priorAuthThreshold * 2) risk += 15;
  if (claim.tags.includes('DENIAL_RISK_HIGH')) risk += 20;
  if (claim.tags.includes('FWA_FLAG')) risk += 25;
  if (claim.tags.includes('MISSING_CHARGES')) risk += 12;
  if (claim.tags.includes('CODING_REVIEW')) risk += 10;
  if (claim.tags.includes('CLEAN_CLAIM')) risk -= 10;
  if (claim.readinessScore >= 85) risk -= 8;

  return clamp(Math.round(risk), 0, 100);
}

// ── Pipeline definition ─────────────────────────────────────────────────

const NEXT_STATUS: Partial<Record<ClaimStatus, ClaimStatus>> = {
  ELIGIBILITY: 'PRIOR_AUTH',
  PRIOR_AUTH: 'CHARGE_CAPTURE',
  CHARGE_CAPTURE: 'CODING',
  CODING: 'SCRUBBING',
  SCRUBBING: 'SUBMITTED',
  SUBMITTED: 'ADJUDICATION',
  ADJUDICATION: 'REMITTANCE', // may divert to DENIED
  REMITTANCE: 'PAID',
};

const STAGE_AGENT: Record<ClaimStatus, { name: string; display: string }> = {
  ELIGIBILITY: { name: 'EligibilityBenefits', display: 'Eligibility & Benefits' },
  PRIOR_AUTH: { name: 'PriorAuthorization', display: 'Prior Authorization' },
  CHARGE_CAPTURE: { name: 'ChargeCapture', display: 'Charge Capture & Integrity' },
  CODING: { name: 'MedicalCoding', display: 'Medical Coding' },
  SCRUBBING: { name: 'ClaimScrubSubmit', display: 'Claim Scrubbing & Submission' },
  SUBMITTED: { name: 'ClaimScrubSubmit', display: 'Claim Scrubbing & Submission' },
  ADJUDICATION: { name: 'PaymentPosting', display: 'Payment Posting & Reconciliation' },
  REMITTANCE: { name: 'PaymentPosting', display: 'Payment Posting & Reconciliation' },
  DENIED: { name: 'DenialManagement', display: 'Denial Management & Appeals' },
  PAID: { name: 'PaymentPosting', display: 'Payment Posting & Reconciliation' },
  CLOSED: { name: 'AnalyticsReporting', display: 'Analytics & Reporting' },
  WRITTEN_OFF: { name: 'DenialManagement', display: 'Denial Management & Appeals' },
};

const TERMINAL: ClaimStatus[] = ['PAID', 'CLOSED', 'WRITTEN_OFF'];

export function isTerminal(status: ClaimStatus): boolean {
  return TERMINAL.includes(status);
}

export function nextStatus(status: ClaimStatus): ClaimStatus | null {
  return NEXT_STATUS[status] ?? null;
}

// ── The engine ──────────────────────────────────────────────────────────

/**
 * Run the agent responsible for the claim's current stage and return the
 * proposed result. Pure function — no persistence.
 */
export function processClaim(input: EngineClaim): AgentResult {
  const claim: EngineClaim = { ...input, tags: [...(input.tags ?? [])] };
  const rule = getPayerRule(claim.payerType);
  const agent = STAGE_AGENT[claim.status] ?? STAGE_AGENT.ELIGIBILITY;
  const from = claim.status;

  switch (claim.status) {
    case 'ELIGIBILITY':
      return runEligibility(claim, agent, from, rule);
    case 'PRIOR_AUTH':
      return runPriorAuth(claim, agent, from, rule);
    case 'CHARGE_CAPTURE':
      return runChargeCapture(claim, agent, from);
    case 'CODING':
      return runCoding(claim, agent, from);
    case 'SCRUBBING':
      return runScrub(claim, agent, from, rule);
    case 'SUBMITTED':
      return runAdjudicationStart(claim, agent, from);
    case 'ADJUDICATION':
      return runAdjudicate(claim, agent, from, rule);
    case 'REMITTANCE':
      return runPaymentPosting(claim, agent, from, rule);
    case 'DENIED':
      return runDenialManagement(claim, agent, from, rule);
    default:
      return terminalResult(claim, agent, from);
  }
}

// ── Stage implementations ───────────────────────────────────────────────

function runEligibility(c: EngineClaim, agent: Agent, from: ClaimStatus, rule: PayerRule): AgentResult {
  const verified = c.payerType !== 'SELF_PAY';
  const patch: Partial<EngineClaim> = {};
  const tags = [...c.tags];

  if (c.payerType === 'SELF_PAY') {
    patch.patientResponsibility = c.totalAmount;
  }
  // Determine whether prior auth will be required downstream.
  const requiresAuth = c.totalAmount >= rule.priorAuthThreshold && c.payerType !== 'SELF_PAY';
  patch.priorAuthRequired = requiresAuth || c.priorAuthRequired;
  if (patch.priorAuthRequired && !c.priorAuthNumber) patch.priorAuthStatus = 'PENDING';
  if (!patch.priorAuthRequired) patch.priorAuthStatus = 'NOT_REQUIRED';

  const to = NEXT_STATUS.ELIGIBILITY!;
  return finalize(c, agent, from, to, {
    confidence: verified ? 'HIGH' : 'MEDIUM',
    hitlGate: 'AUTO',
    rationale: verified
      ? `Coverage verified with ${c.payerName}. ${patch.priorAuthRequired ? 'Prior authorization required for this amount.' : 'No prior authorization required.'}`
      : `Self-pay encounter — patient responsibility set to ${c.totalAmount.toFixed(2)} EGP.`,
    recommendedAction: 'Proceed to prior-authorization check',
    output: {
      eligibilityStatus: verified ? 'ACTIVE' : 'SELF_PAY',
      coverageType: c.payerType,
      priorAuthRequired: patch.priorAuthRequired,
      copayEstimate: c.payerType === 'NHIA' ? 0 : Math.round(c.totalAmount * 0.1),
    },
    tags,
    patch,
  });
}

function runPriorAuth(c: EngineClaim, agent: Agent, from: ClaimStatus, _rule: PayerRule): AgentResult {
  const patch: Partial<EngineClaim> = {};
  const tags = [...c.tags];
  let escalation: ProposedEscalation | undefined;
  let confidence: ConfidenceLevel = 'HIGH';
  let hitlGate: HitlGate = 'AUTO';
  let rationale: string;

  if (!c.priorAuthRequired) {
    patch.priorAuthStatus = 'NOT_REQUIRED';
    rationale = 'Prior authorization not required for this claim.';
  } else if (c.priorAuthNumber) {
    patch.priorAuthStatus = 'APPROVED';
    rationale = `Prior authorization ${c.priorAuthNumber} on file and approved.`;
  } else {
    // Missing auth on a claim that needs it → human review (prohibited to auto-proceed).
    patch.priorAuthStatus = 'PENDING';
    confidence = 'LOW';
    hitlGate = 'REVIEW';
    if (!tags.includes('URGENT_AUTH')) tags.push('URGENT_AUTH');
    rationale = 'Authorization required but no auth number on file. Flagged for human review before submission.';
    escalation = {
      level: 2,
      reason: `Missing prior authorization on ${c.claimNumber} (${c.totalAmount.toFixed(0)} EGP)`,
      agentName: agent.name,
      tags: ['PRIOR_AUTH', 'MISSING_AUTH'],
    };
  }

  const to = NEXT_STATUS.PRIOR_AUTH!;
  return finalize(c, agent, from, to, {
    confidence,
    hitlGate,
    rationale,
    recommendedAction: hitlGate === 'REVIEW' ? 'Obtain authorization before submission' : 'Proceed to charge capture',
    output: { priorAuthStatus: patch.priorAuthStatus, priorAuthNumber: c.priorAuthNumber ?? null },
    tags,
    patch,
    escalation,
  });
}

function runChargeCapture(c: EngineClaim, agent: Agent, from: ClaimStatus): AgentResult {
  const tags = [...c.tags];
  // Deterministic "missing charge" heuristic: high-value inpatient-style claims
  // with no clean-claim marker get a charge-integrity review.
  const missing = c.totalAmount > 20000 && !c.tags.includes('CLEAN_CLAIM');
  let confidence: ConfidenceLevel = 'HIGH';
  let hitlGate: HitlGate = 'AUTO';
  if (missing && !tags.includes('MISSING_CHARGES')) tags.push('MISSING_CHARGES');
  if (missing) { confidence = 'MEDIUM'; hitlGate = 'REVIEW'; }

  const to = NEXT_STATUS.CHARGE_CAPTURE!;
  return finalize(c, agent, from, to, {
    confidence,
    hitlGate,
    rationale: missing
      ? 'Potential under-documentation detected for a high-value encounter. Charge reconciliation recommended.'
      : 'Charges reconciled against the encounter; no integrity gaps detected.',
    recommendedAction: missing ? 'Reconcile charges with clinical documentation' : 'Proceed to coding',
    output: { chargeIntegrity: missing ? 'REVIEW' : 'PASS', lineItems: estimateLineItems(c.totalAmount) },
    tags,
    patch: {},
  });
}

function runCoding(c: EngineClaim, agent: Agent, from: ClaimStatus): AgentResult {
  const tags = [...c.tags];
  // Prohibited action: never auto-accept low-confidence coding → REVIEW gate.
  const lowConfidence = c.tags.includes('MISSING_CHARGES') || c.totalAmount > 30000;
  if (lowConfidence && !tags.includes('CODING_REVIEW')) tags.push('CODING_REVIEW');
  const confidence: ConfidenceLevel = lowConfidence ? 'MEDIUM' : 'HIGH';
  const hitlGate: HitlGate = lowConfidence ? 'REVIEW' : 'AUTO';

  const to = NEXT_STATUS.CODING!;
  return finalize(c, agent, from, to, {
    confidence,
    hitlGate,
    rationale: lowConfidence
      ? 'Coding generated with medium confidence; coder sign-off required (auto-accept prohibited by governance policy).'
      : 'ICD-10 / CPT codes assigned and validated against documentation.',
    recommendedAction: lowConfidence ? 'Route to certified coder for sign-off' : 'Proceed to scrubbing',
    output: { codingAccuracy: lowConfidence ? 88 : 97, codesAssigned: 3 + (c.totalAmount > 10000 ? 2 : 0) },
    tags,
    patch: {},
  });
}

function runScrub(c: EngineClaim, agent: Agent, from: ClaimStatus, rule: PayerRule): AgentResult {
  const tags = [...c.tags];
  const edits: string[] = [];
  if (c.priorAuthRequired && c.priorAuthStatus !== 'APPROVED') edits.push('AUTH_MISMATCH');
  if (c.tags.includes('MISSING_CHARGES')) edits.push('CHARGE_GAP');
  if (c.tags.includes('CODING_REVIEW')) edits.push('CODE_REVIEW_PENDING');

  const clean = edits.length === 0;
  if (clean && !tags.includes('CLEAN_CLAIM')) tags.push('CLEAN_CLAIM');

  // Fraud/Waste/Abuse sentinel check at submission time.
  let escalation: ProposedEscalation | undefined;
  if (c.totalAmount > 50000) {
    if (!tags.includes('FWA_FLAG')) tags.push('FWA_FLAG');
    escalation = {
      level: 4,
      reason: `High-value claim ${c.claimNumber} (${c.totalAmount.toFixed(0)} EGP) flagged for medical-necessity review`,
      agentName: 'FraudWasteAbuse',
      tags: ['FWA', 'HIGH_VALUE_REVIEW'],
    };
  }

  const patch: Partial<EngineClaim> = {};
  let to: ClaimStatus;
  let hitlGate: HitlGate;
  let confidence: ConfidenceLevel;
  let rationale: string;

  if (!clean) {
    // Hold at scrubbing for human review; do not submit a dirty claim.
    to = 'SCRUBBING';
    hitlGate = 'REVIEW';
    confidence = 'LOW';
    rationale = `Scrubber found ${edits.length} edit(s): ${edits.join(', ')}. Claim held for correction before submission.`;
  } else {
    to = NEXT_STATUS.SCRUBBING!; // SUBMITTED
    hitlGate = c.totalAmount > 50000 ? 'APPROVE' : 'AUTO';
    confidence = 'HIGH';
    const now = new Date();
    patch.submittedAt = now.toISOString();
    patch.filingDeadline = addDays(c.serviceDate, rule.filingDays);
    patch.expectedResponseBy = addDays(now.toISOString(), 14);
    rationale = 'Claim passed all scrubber edits and was submitted to the payer.';
  }

  return finalize(c, agent, from, to, {
    confidence,
    hitlGate,
    rationale,
    recommendedAction: clean ? 'Await payer adjudication' : 'Correct flagged edits and re-scrub',
    output: { edits, cleanClaim: clean, scrubberPassRate: clean ? 100 : Math.round((1 - edits.length / 5) * 100) },
    tags,
    patch,
    escalation,
  });
}

function runAdjudicationStart(c: EngineClaim, agent: Agent, from: ClaimStatus): AgentResult {
  const to = NEXT_STATUS.SUBMITTED!; // ADJUDICATION
  return finalize(c, agent, from, to, {
    confidence: 'HIGH',
    hitlGate: 'AUTO',
    rationale: 'Claim accepted by the payer clearinghouse and entered adjudication.',
    recommendedAction: 'Monitor for remittance advice',
    output: { clearinghouseStatus: 'ACCEPTED', payerAck: true },
    tags: [...c.tags],
    patch: {},
  });
}

function runAdjudicate(c: EngineClaim, agent: Agent, from: ClaimStatus, rule: PayerRule): AgentResult {
  const risk = computeDenialRisk({ ...c });
  const denied = risk >= 55 || c.tags.includes('FWA_FLAG') || (c.priorAuthRequired && c.priorAuthStatus !== 'APPROVED');
  const tags = [...c.tags];

  if (denied) {
    const patch: Partial<EngineClaim> = {
      appealDeadline: addDays(new Date().toISOString(), rule.appealDays),
    };
    return finalize(c, { name: 'DenialPrediction', display: 'Denial Prediction' }, from, 'DENIED', {
      confidence: 'HIGH',
      hitlGate: 'REVIEW',
      rationale: `Payer denied the claim (risk score ${risk}). ${c.priorAuthRequired && c.priorAuthStatus !== 'APPROVED' ? 'Reason: missing prior authorization.' : 'Reason: medical-necessity / coding edit.'}`,
      recommendedAction: 'Evaluate appeal strategy',
      output: { adjudication: 'DENIED', denialRisk: risk, denialCode: c.priorAuthRequired ? 'CO-197' : 'CO-50' },
      tags,
      patch,
      escalation: {
        level: 3,
        reason: `Claim ${c.claimNumber} denied — appeal window ${rule.appealDays} days`,
        agentName: 'DenialManagement',
        tags: ['DENIAL', 'APPEAL_CANDIDATE'],
      },
    });
  }

  const to = NEXT_STATUS.ADJUDICATION!; // REMITTANCE
  return finalize(c, agent, from, to, {
    confidence: 'HIGH',
    hitlGate: 'AUTO',
    rationale: `Payer approved the claim (risk score ${risk}). Remittance advice received.`,
    recommendedAction: 'Post payment and reconcile',
    output: { adjudication: 'APPROVED', allowedAmount: Math.round(c.totalAmount * rule.reimbursementRate) },
    tags,
    patch: {},
  });
}

function runPaymentPosting(c: EngineClaim, agent: Agent, from: ClaimStatus, rule: PayerRule): AgentResult {
  const allowed = Math.round(c.totalAmount * rule.reimbursementRate);
  const patientResp = c.payerType === 'NHIA' ? 0 : Math.round(c.totalAmount * 0.1);
  const patch: Partial<EngineClaim> = {
    paidAmount: allowed,
    patientResponsibility: patientResp,
  };
  return finalize(c, agent, from, 'PAID', {
    confidence: 'HIGH',
    hitlGate: 'AUTO',
    rationale: `Payment of ${allowed.toFixed(0)} EGP posted and reconciled. Contractual adjustment ${(c.totalAmount - allowed).toFixed(0)} EGP.`,
    recommendedAction: c.payerType === 'NHIA' ? 'Close claim' : 'Generate patient statement for balance',
    output: { paidAmount: allowed, contractualAdjustment: c.totalAmount - allowed, patientResponsibility: patientResp },
    tags: [...c.tags],
    patch,
  });
}

function runDenialManagement(c: EngineClaim, agent: Agent, from: ClaimStatus, rule: PayerRule): AgentResult {
  // Decide appeal vs write-off. Appeal when within window and recoverable value is meaningful.
  const withinWindow = c.appealDeadline ? daysUntil(c.appealDeadline) > 0 : true;
  const worthAppealing = c.totalAmount >= 1000 && withinWindow;
  const tags = [...c.tags];

  if (worthAppealing) {
    const patch: Partial<EngineClaim> = { submittedAt: new Date().toISOString() };
    return finalize(c, agent, from, 'SUBMITTED', {
      confidence: 'MEDIUM',
      hitlGate: 'APPROVE',
      rationale: `Appeal filed with supporting documentation. Estimated overturn probability ${overturnProbability(c)}%.`,
      recommendedAction: 'Track appeal outcome',
      output: { appealFiled: true, strategy: c.priorAuthRequired ? 'A' : 'C', overturnProbability: overturnProbability(c) },
      tags,
      patch,
    });
  }

  // Write off — but this is a prohibited auto-action, so require human approval.
  return finalize(c, agent, from, 'WRITTEN_OFF', {
    confidence: 'LOW',
    hitlGate: 'APPROVE',
    rationale: withinWindow
      ? 'Recoverable value below appeal threshold. Write-off proposed (requires human approval — auto write-off is prohibited).'
      : 'Appeal window expired. Write-off proposed (requires human approval).',
    recommendedAction: 'Obtain manager approval for write-off',
    output: { writeOffProposed: true, reason: withinWindow ? 'LOW_VALUE' : 'WINDOW_EXPIRED' },
    tags,
    patch: {},
    escalation: {
      level: 3,
      reason: `Write-off proposed for ${c.claimNumber} (${c.totalAmount.toFixed(0)} EGP)`,
      agentName: agent.name,
      tags: ['WRITE_OFF', 'APPROVAL_REQUIRED'],
    },
  });
}

function terminalResult(c: EngineClaim, agent: Agent, from: ClaimStatus): AgentResult {
  return finalize(c, agent, from, from, {
    confidence: 'HIGH',
    hitlGate: 'AUTO',
    rationale: `Claim is in a terminal state (${from}); no further automated processing.`,
    recommendedAction: 'No action required',
    output: { terminal: true },
    tags: [...c.tags],
    patch: {},
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

interface Agent { name: string; display: string }

interface FinalizeArgs {
  confidence: ConfidenceLevel;
  hitlGate: HitlGate;
  rationale: string;
  recommendedAction: string;
  output: Record<string, unknown>;
  tags: string[];
  patch: Partial<EngineClaim>;
  escalation?: ProposedEscalation;
}

function finalize(
  c: EngineClaim,
  agent: Agent,
  from: ClaimStatus,
  to: ClaimStatus,
  a: FinalizeArgs,
): AgentResult {
  // Build the next claim snapshot to recompute scores consistently.
  const next: EngineClaim = { ...c, ...a.patch, status: to, tags: a.tags };
  const readinessScore = computeReadiness(next);
  const denialRiskScore = computeDenialRisk(next);

  const patch: Partial<EngineClaim> = {
    ...a.patch,
    status: to,
    tags: a.tags,
    readinessScore,
    denialRiskScore,
    currentAgent: agent.name,
  } as Partial<EngineClaim>;

  return {
    agentName: agent.name,
    displayName: agent.display,
    fromStatus: from,
    toStatus: to,
    confidence: a.confidence,
    hitlGate: a.hitlGate,
    rationale: a.rationale,
    recommendedAction: a.recommendedAction,
    output: a.output,
    tags: a.tags,
    escalation: a.escalation,
    patch,
    terminal: isTerminal(to),
  };
}

function overturnProbability(c: EngineClaim): number {
  let p = 55;
  if (c.priorAuthRequired) p += 15; // auth-related denials overturn well once auth obtained
  if (c.tags.includes('CLEAN_CLAIM')) p += 10;
  if (c.tags.includes('FWA_FLAG')) p -= 25;
  return clamp(p, 5, 95);
}

function estimateLineItems(amount: number): number {
  return clamp(Math.round(amount / 2500), 1, 40);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.round(diff / 86_400_000);
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}
