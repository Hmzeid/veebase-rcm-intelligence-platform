import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { computeReadiness, computeDenialRisk, getPayerRule, type EngineClaim } from '@/lib/rcm-engine';
import { parseBody, EligibilitySchema } from '@/lib/validation';
import type { PayerType } from '@/lib/rcm-types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/eligibility — real-time eligibility & risk pre-check without
 * persisting a claim. Useful at the point of registration/scheduling.
 * Body: { payerType, totalAmount, priorAuthNumber?, serviceDate? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'read');
  if ('error' in auth) return auth.error;

  const parsed = await parseBody(request, EligibilitySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const payerType = body.payerType as PayerType;
  const totalAmount = body.totalAmount;
  const rule = getPayerRule(payerType);
  const priorAuthRequired = totalAmount >= rule.priorAuthThreshold && payerType !== 'SELF_PAY';

  const probe: EngineClaim = {
    id: 'probe', claimNumber: 'PROBE', patientName: body.patientName ?? 'Probe',
    payerId: payerType, payerName: payerType, payerType,
    serviceDate: body.serviceDate ?? new Date().toISOString(),
    totalAmount, status: 'ELIGIBILITY', readinessScore: 0, denialRiskScore: 0,
    priorAuthRequired, priorAuthNumber: body.priorAuthNumber ?? null,
    priorAuthStatus: priorAuthRequired ? (body.priorAuthNumber ? 'APPROVED' : 'PENDING') : 'NOT_REQUIRED',
    paidAmount: 0, patientResponsibility: 0, phase: 1, tags: [],
  };

  return NextResponse.json({
    eligible: payerType !== 'SELF_PAY',
    coverageType: payerType,
    priorAuthRequired,
    priorAuthThreshold: rule.priorAuthThreshold === Infinity ? null : rule.priorAuthThreshold,
    filingDays: rule.filingDays,
    estimatedReimbursement: Math.round(totalAmount * rule.reimbursementRate),
    estimatedPatientResponsibility: payerType === 'NHIA' ? 0 : Math.round(totalAmount * 0.1),
    readinessScore: computeReadiness(probe),
    denialRiskScore: computeDenialRisk(probe),
    recommendation: priorAuthRequired && !body.priorAuthNumber
      ? 'Obtain prior authorization before service to avoid denial.'
      : 'Cleared to proceed.',
  });
}
