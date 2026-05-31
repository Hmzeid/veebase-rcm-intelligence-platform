'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
import { AgentStatusType } from '@/lib/rcm-types';

// ── Simulation Config ───────────────────────────────────────────────

const MIN_INTERVAL_MS = 3000;
const MAX_INTERVAL_MS = 5000;

const STATUS_TRANSITIONS: Record<AgentStatusType, AgentStatusType[]> = {
  IDLE: ['ACTIVE', 'PROCESSING'],
  ACTIVE: ['PROCESSING', 'IDLE'],
  PROCESSING: ['ACTIVE', 'IDLE'],
  ERROR: ['IDLE'],
};

// Error transition templates — used when agents encounter errors
const ERROR_ACTIVITY_TEMPLATES = [
  'Agent encountered processing error — claim requires manual intervention',
  'Timeout error — payer system unresponsive after retry',
  'Data validation error — missing required field in claim',
  'Connection error — HFCX gateway returned HTTP 503',
];

// Completion activity templates — used when agents finish processing
const COMPLETION_ACTIVITY_TEMPLATES = [
  'Batch processing complete — {count} claims processed successfully',
  'Claim scrubbed and cleared — submitted to payer',
  'Coding validation passed — claim ready for submission',
  'Payment reconciliation complete — all remittances matched',
];

const SIMULATION_ACTIVITY_MESSAGES: {
  type: 'claim_submitted' | 'claim_paid' | 'claim_denied' | 'escalation' | 'auth_approved' | 'payment_posted';
  severities: ('info' | 'success' | 'warning' | 'error')[];
  templates: string[];
}[] = [
  {
    type: 'claim_submitted',
    severities: ['info'],
    templates: [
      'Claim submitted to NHIA via HFCX — readiness score {score}%',
      'Claim submitted to MedRight TPA — readiness score {score}%',
      'Claim submitted to Globemed Egypt — readiness score {score}%',
      'Claim scrubbed and submitted — {score}% readiness',
    ],
  },
  {
    type: 'claim_paid',
    severities: ['success'],
    templates: [
      'Payment received: EGP {amount} from NHIA (contracted rate matched)',
      'Payment received: EGP {amount} from MedRight TPA',
      'Remittance posted — EGP {amount} collected',
      'Payment reconciled — EGP {amount} matched to contract',
    ],
  },
  {
    type: 'claim_denied',
    severities: ['warning', 'error'],
    templates: [
      'Claim denied — medical necessity not established',
      'Denial received — prior authorization was expired',
      'Partial denial — bundled procedure code CO-97',
      'Claim denied — timely filing limit exceeded',
    ],
  },
  {
    type: 'escalation',
    severities: ['warning', 'error'],
    templates: [
      'Escalation raised — high-value claim requires L3 review',
      'Compliance flag triggered — upcoding pattern detected',
      'Escalation — underpayment variance exceeds threshold',
      'Escalation — appeal deadline approaching in 48 hours',
    ],
  },
  {
    type: 'auth_approved',
    severities: ['success'],
    templates: [
      'Prior authorization approved by NHIA — valid for 30 days',
      'Auth request approved — procedure code verified',
      'Retro-authorization granted for emergency encounter',
    ],
  },
  {
    type: 'payment_posted',
    severities: ['info', 'warning'],
    templates: [
      'Payment posted — EGP {amount} applied to patient account',
      'Underpayment detected: paid EGP {amount} vs contracted rate',
      'Payment posted with patient responsibility — EGP {amount} remaining',
    ],
  },
];

const AGENT_NAMES = [
  'EligibilityBenefits',
  'PriorAuthorization',
  'ChargeCapture',
  'MedicalCoding',
  'ClaimScrubSubmit',
  'DenialPrediction',
  'DenialManagement',
  'PaymentPosting',
  'PatientBilling',
  'FraudWasteAbuse',
  'PayerContractRules',
  'AnalyticsReporting',
];

// ── Helpers ─────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string): string {
  return template
    .replace('{score}', String(randomBetween(78, 99)))
    .replace('{amount}', String(randomBetween(1200, 65000)));
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * useAgentSimulation
 *
 * Simulates live agent activity by periodically updating the Zustand store:
 * - Transitions agent statuses (IDLE ↔ ACTIVE ↔ PROCESSING)
 * - Increments claimsProcessed counters
 * - Updates lastActivity timestamps
 * - Generates new activity feed items
 *
 * Call this hook once in a top-level dashboard component.
 */
export function useAgentSimulation(enabled = true) {
  const store = useRCMStore;
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);

  enabledRef.current = enabled;

  const tick = useCallback(() => {
    if (!enabledRef.current) return;

    const state = store.getState();
    const agents = state.agents;

    // Pick 1–2 random agents to update
    const updateCount = Math.random() < 0.4 ? 2 : 1;
    const updatedAgents = [...agents];

    const pendingNewActivities: Array<{
      id: string;
      type: 'claim_submitted' | 'claim_paid' | 'claim_denied' | 'escalation' | 'auth_approved' | 'payment_posted';
      claimNumber: string;
      message: string;
      timestamp: string;
      agent: string;
      severity: 'info' | 'success' | 'warning' | 'error';
    }> = [];

    for (let i = 0; i < updateCount; i++) {
      const idx = randomBetween(0, updatedAgents.length - 1);
      const agent = updatedAgents[idx];

      // Transition status — with a 10% chance of ERROR from PROCESSING
      let newStatus: AgentStatusType;
      if (agent.status === 'PROCESSING' && Math.random() < 0.1) {
        newStatus = 'ERROR';
      } else {
        const possibleNext = STATUS_TRANSITIONS[agent.status];
        newStatus = randomPick(possibleNext);
      }

      // Increment processed claims if transitioning away from PROCESSING
      const claimsProcessed = agent.status === 'PROCESSING' && newStatus !== 'PROCESSING'
        ? agent.claimsProcessed + randomBetween(1, 5)
        : agent.claimsProcessed;

      updatedAgents[idx] = {
        ...agent,
        status: newStatus,
        lastActivity: new Date().toISOString(),
        claimsProcessed,
        // Slightly vary active claims
        activeClaims: newStatus === 'PROCESSING'
          ? Math.max(0, agent.activeClaims + randomBetween(0, 3))
          : newStatus === 'IDLE'
          ? Math.max(0, agent.activeClaims - randomBetween(0, 2))
          : agent.activeClaims,
      };

      // Generate activity for ERROR transitions (always)
      if (newStatus === 'ERROR') {
        pendingNewActivities.push({
          id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'escalation',
          claimNumber: `CLM-2026-${String(randomBetween(1, 25)).padStart(4, '0')}`,
          message: randomPick(ERROR_ACTIVITY_TEMPLATES),
          timestamp: new Date().toISOString(),
          agent: agent.name,
          severity: 'error',
        });
      }

      // Generate activity for completion transitions (PROCESSING → IDLE/ACTIVE, 70% chance)
      if (agent.status === 'PROCESSING' && (newStatus === 'IDLE' || newStatus === 'ACTIVE') && Math.random() < 0.7) {
        const completionMessage = randomPick(COMPLETION_ACTIVITY_TEMPLATES)
          .replace('{count}', String(randomBetween(2, 15)));
        pendingNewActivities.push({
          id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'claim_paid',
          claimNumber: `CLM-2026-${String(randomBetween(1, 25)).padStart(4, '0')}`,
          message: completionMessage,
          timestamp: new Date().toISOString(),
          agent: agent.name,
          severity: 'success',
        });
      }
    }

    // Also generate a random activity item (40% chance, for variety)
    if (Math.random() < 0.4) {
      const activityGroup = randomPick(SIMULATION_ACTIVITY_MESSAGES);
      const message = fillTemplate(randomPick(activityGroup.templates));
      const severity = randomPick(activityGroup.severities);
      const claimNum = `CLM-2026-${String(randomBetween(1, 25)).padStart(4, '0')}`;
      const agentName = randomPick(AGENT_NAMES);

      pendingNewActivities.push({
        id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: activityGroup.type,
        claimNumber: claimNum,
        message,
        timestamp: new Date().toISOString(),
        agent: agentName,
        severity,
      });
    }

    // Prepend new activities and cap at 30
    let newActivities = state.recentActivities || [];
    if (pendingNewActivities.length > 0) {
      newActivities = [...pendingNewActivities, ...newActivities].slice(0, 30);
    }

    // Apply batch update to store
    store.setState({
      agents: updatedAgents,
      recentActivities: newActivities,
    } as Partial<typeof state>);

    // Schedule next tick with jitter
    const nextDelay = randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
    intervalRef.current = setTimeout(tick, nextDelay);
  }, [store]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start first tick after a short delay
    intervalRef.current = setTimeout(tick, randomBetween(1000, 2000));

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, tick]);
}
