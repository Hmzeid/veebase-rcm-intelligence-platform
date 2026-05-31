import {
  AgentRecord,
  ClaimRecord,
  EscalationRecord,
  KPIRecord,
} from './rcm-types';

// ========== 12 AGENTS ==========
export const AGENTS: AgentRecord[] = [
  {
    id: 'agent-1',
    agentName: 'EligibilityBenefits',
    displayName: 'Eligibility & Benefits',
    description: 'Verifies patient insurance coverage, benefits, copays, and demographic accuracy before service delivery.',
    icon: 'ShieldCheck',
    status: 'ACTIVE',
    lastActivity: new Date(Date.now() - 120000).toISOString(),
    claimsProcessed: 847,
    activeClaims: 12,
    errorCount: 3,
    avgProcessingMs: 2400,
    category: 'LINEAR',
    sequence: 1,
  },
  {
    id: 'agent-2',
    agentName: 'PriorAuthorization',
    displayName: 'Prior Authorization',
    description: 'Manages preauthorization requirements, submits HFCX auth requests, and tracks approval status.',
    icon: 'FileCheck',
    status: 'PROCESSING',
    lastActivity: new Date(Date.now() - 60000).toISOString(),
    claimsProcessed: 523,
    activeClaims: 8,
    errorCount: 7,
    avgProcessingMs: 5200,
    category: 'LINEAR',
    sequence: 2,
  },
  {
    id: 'agent-3',
    agentName: 'ChargeCapture',
    displayName: 'Charge Capture & Integrity',
    description: 'Identifies billable services rendered but not yet captured as charges. Prevents silent under-billing.',
    icon: 'Receipt',
    status: 'ACTIVE',
    lastActivity: new Date(Date.now() - 180000).toISOString(),
    claimsProcessed: 692,
    activeClaims: 5,
    errorCount: 1,
    avgProcessingMs: 3800,
    category: 'LINEAR',
    sequence: 3,
  },
  {
    id: 'agent-4',
    agentName: 'MedicalCoding',
    displayName: 'Medical Coding',
    description: 'Proposes ICD-10, CPT, HCPCS codes from clinical documentation. Always requires certified coder review.',
    icon: 'Code',
    status: 'ACTIVE',
    lastActivity: new Date(Date.now() - 90000).toISOString(),
    claimsProcessed: 634,
    activeClaims: 15,
    errorCount: 4,
    avgProcessingMs: 4100,
    category: 'LINEAR',
    sequence: 4,
  },
  {
    id: 'agent-5',
    agentName: 'ClaimScrubSubmit',
    displayName: 'Claim Scrubbing & Submission',
    description: 'Validates claims against payer rules, scores readiness, and submits via HFCX when ready.',
    icon: 'Send',
    status: 'IDLE',
    lastActivity: new Date(Date.now() - 300000).toISOString(),
    claimsProcessed: 589,
    activeClaims: 3,
    errorCount: 2,
    avgProcessingMs: 2800,
    category: 'LINEAR',
    sequence: 5,
  },
  {
    id: 'agent-6',
    agentName: 'DenialPrediction',
    displayName: 'Denial Prediction',
    description: 'Scores denial probability before submission. Catches patterns beyond rule-based scrubbing.',
    icon: 'AlertTriangle',
    status: 'IDLE',
    lastActivity: new Date(Date.now() - 240000).toISOString(),
    claimsProcessed: 589,
    activeClaims: 3,
    errorCount: 0,
    avgProcessingMs: 1600,
    category: 'LINEAR',
    sequence: 6,
  },
  {
    id: 'agent-7',
    agentName: 'DenialManagement',
    displayName: 'Denial Management & Appeals',
    description: 'Classifies denials, selects appeal strategies, drafts appeal letters, and tracks recovery.',
    icon: 'RotateCcw',
    status: 'PROCESSING',
    lastActivity: new Date(Date.now() - 45000).toISOString(),
    claimsProcessed: 198,
    activeClaims: 11,
    errorCount: 1,
    avgProcessingMs: 6500,
    category: 'LINEAR',
    sequence: 7,
  },
  {
    id: 'agent-8',
    agentName: 'PaymentPosting',
    displayName: 'Payment Posting & Reconciliation',
    description: 'Posts payments accurately, detects underpayments by comparing against contracted rates.',
    icon: 'Banknote',
    status: 'ACTIVE',
    lastActivity: new Date(Date.now() - 150000).toISOString(),
    claimsProcessed: 456,
    activeClaims: 7,
    errorCount: 2,
    avgProcessingMs: 3200,
    category: 'LINEAR',
    sequence: 8,
  },
  {
    id: 'agent-9',
    agentName: 'PatientBilling',
    displayName: 'Patient Billing & Collections',
    description: 'Generates upfront estimates, final statements, and manages collection follow-up in Arabic and English.',
    icon: 'UserCheck',
    status: 'IDLE',
    lastActivity: new Date(Date.now() - 420000).toISOString(),
    claimsProcessed: 378,
    activeClaims: 4,
    errorCount: 0,
    avgProcessingMs: 2100,
    category: 'LINEAR',
    sequence: 9,
  },
  {
    id: 'agent-10',
    agentName: 'FraudWasteAbuse',
    displayName: 'Fraud, Waste & Medical Necessity',
    description: 'Cross-cutting sentinel monitoring for upcoding, unbundling, phantom billing, and medical necessity issues.',
    icon: 'Eye',
    status: 'ACTIVE',
    lastActivity: new Date(Date.now() - 200000).toISOString(),
    claimsProcessed: 1247,
    activeClaims: 18,
    errorCount: 0,
    avgProcessingMs: 1800,
    category: 'SENTINEL',
    sequence: 10,
  },
  {
    id: 'agent-11',
    agentName: 'PayerContractRules',
    displayName: 'Payer Contract & Rules',
    description: 'Queryable knowledge service serving fee schedules, auth requirements, edit libraries, and appeal rules.',
    icon: 'BookOpen',
    status: 'ACTIVE',
    lastActivity: new Date(Date.now() - 30000).toISOString(),
    claimsProcessed: 2103,
    activeClaims: 0,
    errorCount: 0,
    avgProcessingMs: 800,
    category: 'KNOWLEDGE',
    sequence: 11,
  },
  {
    id: 'agent-12',
    agentName: 'AnalyticsReporting',
    displayName: 'Analytics & Reporting',
    description: 'Computes KPIs, produces trend narratives, and root-cause analysis for continuous improvement.',
    icon: 'BarChart3',
    status: 'IDLE',
    lastActivity: new Date(Date.now() - 600000).toISOString(),
    claimsProcessed: 156,
    activeClaims: 0,
    errorCount: 0,
    avgProcessingMs: 4500,
    category: 'ANALYTICS',
    sequence: 12,
  },
];

// ========== CLAIMS DATA ==========
const patientNames = [
  'Ahmed Mohamed Hassan',
  'Fatma Ali Ibrahim',
  'Mohamed Salah Mostafa',
  'Nour El-Din Abdel Rahman',
  'Yasmin Hassan Ahmed',
  'Omar Khattab Youssef',
  'Sara Mahmoud El-Sayed',
  'Karim Tarek Nassar',
  'Huda Amr Farouk',
  'Amira Waleed Saeed',
  'Hassan Ibrahim Shaker',
  'Mona Adel Zakaria',
  'Tarek Sami El-Banna',
  'Layla Nabil Fahmy',
  'Rami Ashraf Gouda',
];

const payerNames = [
  { id: 'NHIA', name: 'NHIA - Universal Health Insurance', type: 'NHIA' as const },
  { id: 'MEDRIGHT', name: 'MedRight TPA', type: 'PRIVATE' as const },
  { id: 'GLOBEMED', name: 'Globemed Egypt', type: 'PRIVATE' as const },
  { id: 'NEXTCARE', name: 'Nextcare Egypt', type: 'PRIVATE' as const },
  { id: 'SELFPAY', name: 'Self-Pay', type: 'SELF_PAY' as const },
];

const statuses: ClaimRecord['status'][] = [
  'ELIGIBILITY', 'PRIOR_AUTH', 'CHARGE_CAPTURE', 'CODING',
  'SCRUBBING', 'SUBMITTED', 'ADJUDICATION', 'REMITTANCE',
  'DENIED', 'PAID', 'CLOSED', 'WRITTEN_OFF',
];

function randomDate(start: Date, end: Date): string {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function generateClaims(): ClaimRecord[] {
  const claims: ClaimRecord[] = [];
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  for (let i = 1; i <= 25; i++) {
    const payer = payerNames[Math.floor(Math.random() * payerNames.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const serviceDate = randomDate(thirtyDaysAgo, today);
    const totalAmount = Math.round((Math.random() * 45000 + 500) * 100) / 100;
    const isHighValue = totalAmount > 50000;
    const tags: string[] = [];
    if (isHighValue) tags.push('HIGH_VALUE_REVIEW');
    if (Math.random() < 0.1) tags.push('TIMELY_FILING_RISK');
    if (Math.random() < 0.05) tags.push('COMPLIANCE_FLAG');
    if (Math.random() < 0.08) tags.push('DENIAL_RISK_HIGH');
    if (Math.random() < 0.04) tags.push('URGENT_AUTH');
    if (Math.random() < 0.03) tags.push('DUPLICATE_RISK');

    const filingDeadline = new Date(new Date(serviceDate).getTime() + (payer.type === 'NHIA' ? 30 : 60) * 24 * 60 * 60 * 1000);

    claims.push({
      id: `claim-${i}`,
      claimNumber: `CLM-2026-${String(i).padStart(4, '0')}`,
      patientId: `PAT-${String((i % 15) + 1).padStart(4, '0')}`,
      patientName: patientNames[(i - 1) % patientNames.length],
      nationalId: `2990${String(1000000000 + i).slice(0, 10)}`,
      encounterId: `ENC-${String(i).padStart(5, '0')}`,
      payerId: payer.id,
      payerName: payer.name,
      payerType: payer.type,
      serviceDate,
      totalAmount,
      status,
      readinessScore: Math.floor(Math.random() * 40 + 60),
      denialRiskScore: Math.floor(Math.random() * 100),
      priorAuthRequired: Math.random() < 0.4,
      priorAuthNumber: Math.random() < 0.4 ? `AUTH-${String(Math.floor(Math.random() * 90000 + 10000))}` : undefined,
      priorAuthStatus: Math.random() < 0.4 ? (Math.random() < 0.7 ? 'APPROVED' : Math.random() < 0.5 ? 'PENDING' : 'DENIED') : 'NOT_REQUIRED',
      submittedAt: ['SUBMITTED', 'ADJUDICATION', 'REMITTANCE', 'DENIED', 'PAID', 'CLOSED', 'WRITTEN_OFF'].includes(status) ? randomDate(new Date(serviceDate), today) : undefined,
      expectedResponseBy: ['SUBMITTED', 'ADJUDICATION'].includes(status) ? randomDate(today, sixtyDaysFromNow) : undefined,
      paidAmount: ['PAID', 'CLOSED'].includes(status) ? Math.round(totalAmount * (0.6 + Math.random() * 0.35) * 100) / 100 : 0,
      patientResponsibility: Math.round(totalAmount * (0.05 + Math.random() * 0.2) * 100) / 100,
      appealDeadline: status === 'DENIED' ? randomDate(today, new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) : undefined,
      filingDeadline: filingDeadline.toISOString(),
      phase: 1,
      hitlGate: Math.random() < 0.3 ? 'APPROVE' : Math.random() < 0.5 ? 'AUTO' : 'REVIEW',
      currentAgent: status !== 'PAID' && status !== 'CLOSED' && status !== 'WRITTEN_OFF' ? AGENTS[Math.floor(Math.random() * 9)].agentName : undefined,
      tags,
      createdAt: serviceDate,
      updatedAt: randomDate(new Date(serviceDate), today),
    });
  }

  return claims;
}

export const CLAIMS: ClaimRecord[] = generateClaims();

// ========== ESCALATIONS ==========
export const ESCALATIONS: EscalationRecord[] = [
  {
    id: 'esc-1',
    claimId: 'claim-3',
    claimNumber: 'CLM-2026-0003',
    level: 4,
    reason: 'Fraud sentinel detected upcoding pattern: physician billing E&M 99215 on 100% of visits over 30 days',
    agentName: 'FraudWasteAbuse',
    status: 'PENDING',
    tags: ['COMPLIANCE_FLAG'],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'esc-2',
    claimId: 'claim-7',
    claimNumber: 'CLM-2026-0007',
    level: 3,
    reason: 'Claim value EGP 67,500 exceeds high-value threshold. Mandatory senior biller review required.',
    agentName: 'ClaimScrubSubmit',
    status: 'PENDING',
    tags: ['HIGH_VALUE_REVIEW'],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'esc-3',
    claimId: 'claim-12',
    claimNumber: 'CLM-2026-0012',
    level: 1,
    reason: 'Demographic mismatch: national ID name does not match insurance policy holder name',
    agentName: 'EligibilityBenefits',
    status: 'ACKNOWLEDGED',
    tags: [],
    assignedTo: 'Registration Desk',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'esc-4',
    claimId: 'claim-5',
    claimNumber: 'CLM-2026-0005',
    level: 3,
    reason: 'Prior authorization denied by NHIA. Clinical documentation insufficient for medical necessity.',
    agentName: 'PriorAuthorization',
    status: 'PENDING',
    tags: ['URGENT_AUTH'],
    createdAt: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    id: 'esc-5',
    claimId: 'claim-18',
    claimNumber: 'CLM-2026-0018',
    level: 2,
    reason: 'NHIA CoverageEligibilityResponse returned error code HFCX-ERR-401. Unable to verify coverage.',
    agentName: 'EligibilityBenefits',
    status: 'PENDING',
    tags: [],
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'esc-6',
    claimId: 'claim-9',
    claimNumber: 'CLM-2026-0009',
    level: 3,
    reason: 'Appeal deadline in 3 days for denied claim. Immediate action required.',
    agentName: 'DenialManagement',
    status: 'PENDING',
    tags: ['APPEAL_DEADLINE_RISK'],
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'esc-7',
    claimId: 'claim-21',
    claimNumber: 'CLM-2026-0021',
    level: 2,
    reason: 'DNFB risk: encounter 6 days post-discharge with no final bill generated',
    agentName: 'ChargeCapture',
    status: 'ACKNOWLEDGED',
    tags: ['DNFB_RISK'],
    assignedTo: 'Billing Team A',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'esc-8',
    claimId: 'claim-15',
    claimNumber: 'CLM-2026-0015',
    level: 4,
    reason: 'Underpayment detected: paid amount EGP 12,400 vs contracted rate EGP 15,800. Variance exceeds EGP 3,000.',
    agentName: 'PaymentPosting',
    status: 'PENDING',
    tags: ['HIGH_VALUE_REVIEW'],
    createdAt: new Date(Date.now() - 2700000).toISOString(),
  },
  {
    id: 'esc-9',
    claimId: 'claim-22',
    claimNumber: 'CLM-2026-0022',
    level: 3,
    reason: 'Missing charges include high-cost cardiac implant device. Estimated value EGP 28,000.',
    agentName: 'ChargeCapture',
    status: 'PENDING',
    tags: ['HIGH_VALUE_REVIEW'],
    createdAt: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: 'esc-10',
    claimId: 'claim-8',
    claimNumber: 'CLM-2026-0008',
    level: 5,
    reason: 'Phantom billing detected: charges for procedure with no corresponding clinical order or note',
    agentName: 'FraudWasteAbuse',
    status: 'PENDING',
    tags: ['COMPLIANCE_FLAG'],
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
];

// ========== KPIs ==========
export const KPIS: KPIRecord[] = [
  { id: 'kpi-1', name: 'First-Pass Claim Rate', value: 92.4, target: 94, unit: 'pct', category: 'OPERATIONAL', period: 'MONTHLY', trend: 'IMPROVING', status: 'WARNING' },
  { id: 'kpi-2', name: 'Denial Rate', value: 5.2, target: 4, unit: 'pct', category: 'OPERATIONAL', period: 'MONTHLY', trend: 'STABLE', status: 'WARNING' },
  { id: 'kpi-3', name: 'Preventable Denial Rate', value: 1.8, target: 2, unit: 'pct', category: 'OPERATIONAL', period: 'MONTHLY', trend: 'IMPROVING', status: 'ON_TARGET' },
  { id: 'kpi-4', name: 'Appeal Overturn Rate', value: 64.3, target: 60, unit: 'pct', category: 'OPERATIONAL', period: 'MONTHLY', trend: 'IMPROVING', status: 'ON_TARGET' },
  { id: 'kpi-5', name: 'AR Days', value: 42, target: 40, unit: 'days', category: 'FINANCIAL', period: 'MONTHLY', trend: 'STABLE', status: 'WARNING' },
  { id: 'kpi-6', name: 'Clean Claim Rate', value: 91.8, target: 94, unit: 'pct', category: 'OPERATIONAL', period: 'MONTHLY', trend: 'IMPROVING', status: 'WARNING' },
  { id: 'kpi-7', name: 'Net Collection Rate', value: 95.7, target: 96, unit: 'pct', category: 'FINANCIAL', period: 'MONTHLY', trend: 'STABLE', status: 'WARNING' },
  { id: 'kpi-8', name: 'Prior Auth Approval Rate', value: 82.1, target: 85, unit: 'pct', category: 'OPERATIONAL', period: 'MONTHLY', trend: 'DEGRADING', status: 'OFF_TARGET' },
  { id: 'kpi-9', name: 'Charge Capture Score', value: 93.5, target: 95, unit: 'pct', category: 'QUALITY', period: 'MONTHLY', trend: 'IMPROVING', status: 'WARNING' },
  { id: 'kpi-10', name: 'Coding Accuracy Rate', value: 96.2, target: 95, unit: 'pct', category: 'QUALITY', period: 'MONTHLY', trend: 'IMPROVING', status: 'ON_TARGET' },
  { id: 'kpi-11', name: 'DNFB Days', value: 3.2, target: 3, unit: 'days', category: 'OPERATIONAL', period: 'DAILY', trend: 'STABLE', status: 'WARNING' },
  { id: 'kpi-12', name: 'Patient Collection Rate', value: 71.4, target: 80, unit: 'pct', category: 'FINANCIAL', period: 'MONTHLY', trend: 'DEGRADING', status: 'OFF_TARGET' },
];

// ========== CHART DATA ==========
export const DENIAL_TREND_DATA = [
  { month: 'Oct', nhia: 4.8, private: 5.1, overall: 4.9 },
  { month: 'Nov', nhia: 4.5, private: 5.4, overall: 4.9 },
  { month: 'Dec', nhia: 5.2, private: 5.8, overall: 5.4 },
  { month: 'Jan', nhia: 4.9, private: 5.6, overall: 5.2 },
  { month: 'Feb', nhia: 4.3, private: 5.2, overall: 4.7 },
  { month: 'Mar', nhia: 5.0, private: 5.5, overall: 5.2 },
  { month: 'Apr', nhia: 4.6, private: 5.3, overall: 4.9 },
  { month: 'May', nhia: 4.2, private: 5.0, overall: 4.5 },
];

export const REVENUE_BY_PAYER = [
  { payer: 'NHIA', billed: 2400000, paid: 2040000, variance: -360000 },
  { payer: 'MedRight', billed: 980000, paid: 862400, variance: -117600 },
  { payer: 'Globemed', billed: 750000, paid: 690000, variance: -60000 },
  { payer: 'Nextcare', billed: 420000, paid: 386400, variance: -33600 },
  { payer: 'Self-Pay', billed: 350000, paid: 175000, variance: -175000 },
];

export const DENIAL_BY_REASON = [
  { reason: 'Medical Necessity', code: 'CO-50/167', count: 42, amount: 625000, pct: 28 },
  { reason: 'Authorization Required', code: 'CO-15/197', count: 31, amount: 485000, pct: 22 },
  { reason: 'Coding/Bundling', code: 'CO-7/97', count: 25, amount: 312000, pct: 17 },
  { reason: 'Eligibility', code: 'CO-4/16', count: 22, amount: 198000, pct: 15 },
  { reason: 'Timely Filing', code: 'CO-29', count: 14, amount: 156000, pct: 10 },
  { reason: 'Duplicate', code: 'CO-18', count: 8, amount: 89000, pct: 5 },
  { reason: 'COB/Primary Payer', code: 'CO-22', count: 3, amount: 35000, pct: 3 },
];

export const CLAIMS_BY_STAGE = [
  { stage: 'Eligibility', count: 12, color: '#0ea5e9' },
  { stage: 'Prior Auth', count: 8, color: '#f59e0b' },
  { stage: 'Charge Capture', count: 5, color: '#10b981' },
  { stage: 'Coding', count: 15, color: '#8b5cf6' },
  { stage: 'Scrubbing', count: 3, color: '#f97316' },
  { stage: 'Submitted', count: 9, color: '#14b8a6' },
  { stage: 'Adjudication', count: 6, color: '#06b6d4' },
  { stage: 'Remittance', count: 4, color: '#84cc16' },
  { stage: 'Paid', count: 38, color: '#22c55e' },
  { stage: 'Denied', count: 7, color: '#ef4444' },
];

export const DAILY_CLAIMS_VOLUME = [
  { day: 'Mon', submitted: 24, paid: 18, denied: 2 },
  { day: 'Tue', submitted: 31, paid: 22, denied: 3 },
  { day: 'Wed', submitted: 28, paid: 25, denied: 1 },
  { day: 'Thu', submitted: 35, paid: 20, denied: 4 },
  { day: 'Fri', submitted: 12, paid: 8, denied: 1 },
  { day: 'Sat', submitted: 18, paid: 14, denied: 2 },
  { day: 'Sun', submitted: 22, paid: 19, denied: 1 },
];

export const AGENT_ACTIVITY_DATA = [
  { hour: '08:00', activity: 12 },
  { hour: '09:00', activity: 28 },
  { hour: '10:00', activity: 45 },
  { hour: '11:00', activity: 52 },
  { hour: '12:00', activity: 38 },
  { hour: '13:00', activity: 25 },
  { hour: '14:00', activity: 42 },
  { hour: '15:00', activity: 48 },
  { hour: '16:00', activity: 35 },
  { hour: '17:00', activity: 22 },
  { hour: '18:00', activity: 15 },
];

// ========== PAYER MIX ==========
export const PAYER_MIX = [
  { name: 'NHIA', value: 45, color: '#10b981' },
  { name: 'Private TPAs', value: 40, color: '#f59e0b' },
  { name: 'Self-Pay', value: 15, color: '#6b7280' },
];

// ========== INITIAL ACTIVITIES ==========
export const INITIAL_ACTIVITIES = [
  {
    id: '1',
    type: 'escalation' as const,
    claimNumber: 'CLM-2026-0008',
    message: 'Phantom billing detected — charges for procedure with no clinical order',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    agent: 'FraudWasteAbuse',
    severity: 'error' as const,
  },
  {
    id: '2',
    type: 'claim_denied' as const,
    claimNumber: 'CLM-2026-0005',
    message: 'Prior authorization denied by NHIA — insufficient clinical documentation',
    timestamp: new Date(Date.now() - 5400000).toISOString(),
    agent: 'PriorAuthorization',
    severity: 'error' as const,
  },
  {
    id: '3',
    type: 'claim_paid' as const,
    claimNumber: 'CLM-2026-0014',
    message: 'Payment received: EGP 18,450 from NHIA (contracted rate matched)',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    agent: 'PaymentPosting',
    severity: 'success' as const,
  },
  {
    id: '4',
    type: 'auth_approved' as const,
    claimNumber: 'CLM-2026-0020',
    message: 'Prior authorization approved by MedRight TPA — valid for 30 days',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    agent: 'PriorAuthorization',
    severity: 'success' as const,
  },
  {
    id: '5',
    type: 'claim_submitted' as const,
    claimNumber: 'CLM-2026-0023',
    message: 'Claim submitted to NHIA via HFCX — readiness score 96%',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    agent: 'ClaimScrubSubmit',
    severity: 'info' as const,
  },
  {
    id: '6',
    type: 'payment_posted' as const,
    claimNumber: 'CLM-2026-0011',
    message: 'Underpayment detected: paid EGP 8,200 vs contracted EGP 9,800',
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    agent: 'PaymentPosting',
    severity: 'warning' as const,
  },
  {
    id: '7',
    type: 'claim_submitted' as const,
    claimNumber: 'CLM-2026-0024',
    message: 'Claim submitted to Globemed Egypt — readiness score 92%',
    timestamp: new Date(Date.now() - 21600000).toISOString(),
    agent: 'ClaimScrubSubmit',
    severity: 'info' as const,
  },
  {
    id: '8',
    type: 'claim_paid' as const,
    claimNumber: 'CLM-2026-0016',
    message: 'Payment received: EGP 32,100 from Globemed Egypt',
    timestamp: new Date(Date.now() - 28800000).toISOString(),
    agent: 'PaymentPosting',
    severity: 'success' as const,
  },
];

// ========== SUMMARY STATS ==========
export const DASHBOARD_SUMMARY = {
  totalClaimsActive: 107,
  totalClaimsMonth: 847,
  totalRevenueMonth: 4900000,
  totalCollectedMonth: 4353800,
  pendingEscalations: 7,
  avgReadinessScore: 84,
  avgDenialRisk: 23,
  phase: 1 as number,
  claimsAtRisk: 12,
};
