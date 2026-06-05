import { test, expect, describe } from 'bun:test';
import {
  processClaim,
  computeReadiness,
  computeDenialRisk,
  getPayerRule,
  nextStatus,
  isTerminal,
  type EngineClaim,
} from '../src/lib/rcm-engine';
import type { ClaimStatus, PayerType } from '../src/lib/rcm-types';

function makeClaim(overrides: Partial<EngineClaim> = {}): EngineClaim {
  return {
    id: 'c1',
    claimNumber: 'CLM-TEST-0001',
    patientName: 'Test Patient',
    payerId: 'PRIVATE',
    payerName: 'Private Insurer',
    payerType: 'PRIVATE' as PayerType,
    serviceDate: new Date('2026-05-01').toISOString(),
    totalAmount: 2000,
    status: 'ELIGIBILITY' as ClaimStatus,
    readinessScore: 0,
    denialRiskScore: 0,
    priorAuthRequired: false,
    priorAuthNumber: null,
    priorAuthStatus: 'NOT_REQUIRED',
    paidAmount: 0,
    patientResponsibility: 0,
    phase: 1,
    tags: [],
    ...overrides,
  };
}

describe('scoring', () => {
  test('scores are bounded 0..100', () => {
    const c = makeClaim();
    const r = computeReadiness(c);
    const d = computeDenialRisk(c);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(100);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(100);
  });

  test('missing prior auth raises denial risk', () => {
    const withAuth = makeClaim({ priorAuthRequired: true, priorAuthNumber: 'A1', priorAuthStatus: 'APPROVED' });
    const without = makeClaim({ priorAuthRequired: true, priorAuthNumber: null, priorAuthStatus: 'PENDING' });
    expect(computeDenialRisk(without)).toBeGreaterThan(computeDenialRisk(withAuth));
  });

  test('clean-claim tag improves readiness', () => {
    const dirty = makeClaim();
    const clean = makeClaim({ tags: ['CLEAN_CLAIM'] });
    expect(computeReadiness(clean)).toBeGreaterThan(computeReadiness(dirty));
  });
});

describe('payer rules', () => {
  test('NHIA and PRIVATE have prior-auth thresholds, SELF_PAY does not', () => {
    expect(getPayerRule('NHIA').priorAuthThreshold).toBe(5000);
    expect(getPayerRule('PRIVATE').priorAuthThreshold).toBe(3000);
    expect(getPayerRule('SELF_PAY').priorAuthThreshold).toBe(Infinity);
  });
});

describe('lifecycle transitions', () => {
  test('nextStatus follows the pipeline order', () => {
    expect(nextStatus('ELIGIBILITY')).toBe('PRIOR_AUTH');
    expect(nextStatus('SCRUBBING')).toBe('SUBMITTED');
    expect(nextStatus('REMITTANCE')).toBe('PAID');
    expect(nextStatus('PAID')).toBeNull();
  });

  test('isTerminal flags terminal states only', () => {
    expect(isTerminal('PAID')).toBe(true);
    expect(isTerminal('WRITTEN_OFF')).toBe(true);
    expect(isTerminal('ELIGIBILITY')).toBe(false);
  });

  test('eligibility advances to prior-auth', () => {
    const r = processClaim(makeClaim({ status: 'ELIGIBILITY' }));
    expect(r.fromStatus).toBe('ELIGIBILITY');
    expect(r.toStatus).toBe('PRIOR_AUTH');
    expect(r.patch.status).toBe('PRIOR_AUTH');
  });

  test('self-pay sets patient responsibility to full amount at eligibility', () => {
    const r = processClaim(makeClaim({ status: 'ELIGIBILITY', payerType: 'SELF_PAY', totalAmount: 1234 }));
    expect(r.patch.patientResponsibility).toBe(1234);
  });

  test('terminal claim returns terminal result without transition', () => {
    const r = processClaim(makeClaim({ status: 'PAID' }));
    expect(r.terminal).toBe(true);
    expect(r.toStatus).toBe('PAID');
  });
});

describe('HITL governance & prohibited actions', () => {
  test('prior-auth required but missing → REVIEW gate + escalation', () => {
    const r = processClaim(makeClaim({ status: 'PRIOR_AUTH', priorAuthRequired: true, priorAuthNumber: null }));
    expect(r.hitlGate).toBe('REVIEW');
    expect(r.escalation).toBeDefined();
    expect(r.escalation!.level).toBeGreaterThanOrEqual(1);
  });

  test('high-value claim trips the FWA sentinel at scrubbing', () => {
    const r = processClaim(makeClaim({ status: 'SCRUBBING', totalAmount: 60000, tags: ['CLEAN_CLAIM'] }));
    // FWA escalation raised for >50k
    expect(r.escalation?.agentName).toBe('FraudWasteAbuse');
    expect(r.tags).toContain('FWA_FLAG');
  });

  test('dirty claim is held at scrubbing (not auto-submitted)', () => {
    const r = processClaim(makeClaim({ status: 'SCRUBBING', priorAuthRequired: true, priorAuthStatus: 'PENDING' }));
    expect(r.toStatus).toBe('SCRUBBING'); // held, not advanced to SUBMITTED
    expect(r.hitlGate).toBe('REVIEW');
  });

  test('write-off is proposed under APPROVE gate, never auto-executed', () => {
    const r = processClaim(makeClaim({ status: 'DENIED', totalAmount: 500, appealDeadline: new Date('2020-01-01').toISOString() }));
    expect(r.toStatus).toBe('WRITTEN_OFF');
    expect(r.hitlGate).toBe('APPROVE');
  });
});

describe('adjudication & payment', () => {
  test('claim missing required auth is denied at adjudication', () => {
    const r = processClaim(makeClaim({ status: 'ADJUDICATION', priorAuthRequired: true, priorAuthStatus: 'PENDING' }));
    expect(r.toStatus).toBe('DENIED');
    expect(r.patch.appealDeadline).toBeDefined();
  });

  test('clean claim is approved and proceeds to remittance', () => {
    const r = processClaim(makeClaim({ status: 'ADJUDICATION', tags: ['CLEAN_CLAIM'], priorAuthRequired: false }));
    expect(r.toStatus).toBe('REMITTANCE');
  });

  test('payment posting pays the contractual rate and reaches PAID', () => {
    const r = processClaim(makeClaim({ status: 'REMITTANCE', payerType: 'NHIA', totalAmount: 10000 }));
    expect(r.toStatus).toBe('PAID');
    expect(r.patch.paidAmount).toBe(9000); // NHIA reimbursement rate 0.9
    expect(r.terminal).toBe(true);
  });
});
