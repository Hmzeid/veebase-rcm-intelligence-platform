// RCM Intelligence Platform - Type Definitions

export type PayerType = 'NHIA' | 'PRIVATE' | 'SELF_PAY';

export type ClaimStatus =
  | 'ELIGIBILITY'
  | 'PRIOR_AUTH'
  | 'CHARGE_CAPTURE'
  | 'CODING'
  | 'SCRUBBING'
  | 'SUBMITTED'
  | 'ADJUDICATION'
  | 'REMITTANCE'
  | 'DENIED'
  | 'PAID'
  | 'CLOSED'
  | 'WRITTEN_OFF';

export type AgentStatusType = 'ACTIVE' | 'IDLE' | 'ERROR' | 'PROCESSING';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export type EscalationStatus = 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED';

export type AgentCategory = 'LINEAR' | 'SENTINEL' | 'KNOWLEDGE' | 'ANALYTICS';

export type HitlGate = 'APPROVE' | 'REVIEW' | 'AUTO';

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type KPITrend = 'IMPROVING' | 'STABLE' | 'DEGRADING';
export type KPIStatus = 'ON_TARGET' | 'WARNING' | 'OFF_TARGET';
export type KPIUnit = 'pct' | 'days' | 'EGP' | 'count';

export interface ClaimRecord {
  id: string;
  claimNumber: string;
  patientId: string;
  patientName: string;
  nationalId: string;
  encounterId: string;
  payerId: string;
  payerName: string;
  payerType: PayerType;
  serviceDate: string;
  totalAmount: number;
  status: ClaimStatus;
  readinessScore: number;
  denialRiskScore: number;
  priorAuthRequired: boolean;
  priorAuthNumber?: string;
  priorAuthStatus?: string;
  submittedAt?: string;
  expectedResponseBy?: string;
  paidAmount: number;
  patientResponsibility: number;
  appealDeadline?: string;
  filingDeadline?: string;
  phase: number;
  hitlGate: HitlGate;
  currentAgent?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentRecord {
  id: string;
  agentName: string;
  displayName: string;
  description: string;
  icon: string;
  status: AgentStatusType;
  lastActivity?: string;
  claimsProcessed: number;
  activeClaims: number;
  errorCount: number;
  avgProcessingMs: number;
  category: AgentCategory;
  sequence: number;
}

export interface EscalationRecord {
  id: string;
  claimId: string;
  claimNumber: string;
  level: number;
  reason: string;
  agentName: string;
  status: EscalationStatus;
  tags: string[];
  assignedTo?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface KPIRecord {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: KPIUnit;
  category: 'OPERATIONAL' | 'FINANCIAL' | 'QUALITY';
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  trend: KPITrend;
  status: KPIStatus;
}

export interface AgentOutput {
  agent: string;
  claim_id: string;
  timestamp: string;
  phase: number;
  output: Record<string, unknown>;
  confidence: ConfidenceLevel;
  rationale: string;
  recommended_action: string;
  escalation_required: boolean;
  escalation_reason?: string;
  hitl_gate: HitlGate;
  tags: string[];
}

export interface WorkflowStage {
  id: string;
  name: string;
  agentName: string;
  status: 'completed' | 'active' | 'pending' | 'blocked';
  timestamp?: string;
}

export interface AppealStrategy {
  id: string;
  strategyKey: 'A' | 'B' | 'C' | 'D' | 'E';
  name: string;
  description: string;
  denialReasonMatch: string[];
  successProbability: number;
  estimatedRecoveryPct: number;
  estimatedDays: number;
  requiredDocuments: string[];
}

export interface ProhibitedAction {
  id: string;
  rule: string;
  description: string;
  enforced: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: 'HITL_APPROVE' | 'HITL_REJECT' | 'ESCALATE' | 'RESOLVE' | 'SUBMIT_CLAIM' | 'APPEAL_FILED' | 'PAYMENT_DISPUTE' | 'PHASE_CHANGE' | 'AGENT_OVERRIDE';
  actor: string;
  actorRole: string;
  claimNumber?: string;
  agentName?: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags: string[];
}

// Pipeline stages in order
export const PIPELINE_STAGES: ClaimStatus[] = [
  'ELIGIBILITY',
  'PRIOR_AUTH',
  'CHARGE_CAPTURE',
  'CODING',
  'SCRUBBING',
  'SUBMITTED',
  'ADJUDICATION',
  'REMITTANCE',
  'PAID',
];

export const STATUS_COLORS: Record<ClaimStatus, string> = {
  ELIGIBILITY: 'bg-sky-100 text-sky-800',
  PRIOR_AUTH: 'bg-amber-100 text-amber-800',
  CHARGE_CAPTURE: 'bg-emerald-100 text-emerald-800',
  CODING: 'bg-violet-100 text-violet-800',
  SCRUBBING: 'bg-orange-100 text-orange-800',
  SUBMITTED: 'bg-teal-100 text-teal-800',
  ADJUDICATION: 'bg-cyan-100 text-cyan-800',
  REMITTANCE: 'bg-lime-100 text-lime-800',
  DENIED: 'bg-red-100 text-red-800',
  PAID: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  WRITTEN_OFF: 'bg-rose-100 text-rose-800',
};

export const AGENT_STATUS_COLORS: Record<AgentStatusType, string> = {
  ACTIVE: 'bg-emerald-500',
  IDLE: 'bg-gray-400',
  ERROR: 'bg-red-500',
  PROCESSING: 'bg-amber-500',
};

export const ESCALATION_LEVEL_LABELS: Record<number, string> = {
  1: 'Front Desk / Registration',
  2: 'Billing Team',
  3: 'Senior Biller / RCM Manager',
  4: 'Compliance Officer',
  5: 'Medical Director',
};

export const ESCALATION_LEVEL_COLORS: Record<number, string> = {
  1: 'bg-sky-100 text-sky-800 border-sky-200',
  2: 'bg-amber-100 text-amber-800 border-amber-200',
  3: 'bg-orange-100 text-orange-800 border-orange-200',
  4: 'bg-red-100 text-red-800 border-red-200',
  5: 'bg-rose-100 text-rose-800 border-rose-200',
};
