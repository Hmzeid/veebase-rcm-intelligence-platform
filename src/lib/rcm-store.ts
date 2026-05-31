import { create } from 'zustand';
import { ClaimRecord, ClaimStatus, AgentRecord, EscalationRecord, KPIRecord, AuditEntry } from './rcm-types';
import { AGENTS, CLAIMS, ESCALATIONS, KPIS, INITIAL_ACTIVITIES, AUDIT_ENTRIES } from './rcm-data';

export type ViewMode = 'dashboard' | 'agents' | 'claims' | 'escalations' | 'analytics' | 'chat' | 'payer-rules' | 'audit';

export interface ActivityItem {
  id: string;
  type: 'claim_submitted' | 'claim_paid' | 'claim_denied' | 'escalation' | 'auth_approved' | 'payment_posted';
  claimNumber: string;
  message: string;
  timestamp: string;
  agent?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

interface RCMStore {
  // Navigation
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;

  // Data
  agents: AgentRecord[];
  claims: ClaimRecord[];
  escalations: EscalationRecord[];
  kpis: KPIRecord[];
  recentActivities: ActivityItem[];
  auditEntries: AuditEntry[];

  // Filters
  claimStatusFilter: ClaimStatus | 'ALL';
  setClaimStatusFilter: (filter: ClaimStatus | 'ALL') => void;
  claimSearchQuery: string;
  setClaimSearchQuery: (query: string) => void;
  escalationLevelFilter: number | 'ALL';
  setEscalationLevelFilter: (level: number | 'ALL') => void;

  // Selected items
  selectedAgent: AgentRecord | null;
  setSelectedAgent: (agent: AgentRecord | null) => void;
  selectedClaim: ClaimRecord | null;
  setSelectedClaim: (claim: ClaimRecord | null) => void;
  selectedEscalation: EscalationRecord | null;
  setSelectedEscalation: (esc: EscalationRecord | null) => void;

  // Actions
  acknowledgeEscalation: (id: string) => void;
  resolveEscalation: (id: string) => void;
  addAuditEntry: (entry: AuditEntry) => void;
}

export const useRCMStore = create<RCMStore>((set) => ({
  // Navigation
  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),

  // Data
  agents: AGENTS,
  claims: CLAIMS,
  escalations: ESCALATIONS,
  kpis: KPIS,
  recentActivities: INITIAL_ACTIVITIES,
  auditEntries: AUDIT_ENTRIES,

  // Filters
  claimStatusFilter: 'ALL',
  setClaimStatusFilter: (filter) => set({ claimStatusFilter: filter }),
  claimSearchQuery: '',
  setClaimSearchQuery: (query) => set({ claimSearchQuery: query }),
  escalationLevelFilter: 'ALL',
  setEscalationLevelFilter: (level) => set({ escalationLevelFilter: level }),

  // Selected items
  selectedAgent: null,
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  selectedClaim: null,
  setSelectedClaim: (claim) => set({ selectedClaim: claim }),
  selectedEscalation: null,
  setSelectedEscalation: (esc) => set({ selectedEscalation: esc }),

  // Actions
  acknowledgeEscalation: (id) =>
    set((state) => {
      const escalation = state.escalations.find((e) => e.id === id);
      const newAuditEntry: AuditEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'ESCALATE',
        actor: escalation?.assignedTo || 'System User',
        actorRole: 'Staff',
        claimNumber: escalation?.claimNumber,
        agentName: escalation?.agentName,
        details: `Escalation acknowledged for claim ${escalation?.claimNumber || id}. Reason: ${escalation?.reason || 'N/A'}`,
        previousValue: 'PENDING',
        newValue: 'ACKNOWLEDGED',
        riskLevel: (escalation?.level || 1) >= 4 ? 'HIGH' : 'MEDIUM',
        tags: ['ESCALATION_ACK'],
      };
      return {
        escalations: state.escalations.map((e) =>
          e.id === id ? { ...e, status: 'ACKNOWLEDGED' as const } : e
        ),
        auditEntries: [newAuditEntry, ...state.auditEntries],
      };
    }),

  resolveEscalation: (id) =>
    set((state) => {
      const escalation = state.escalations.find((e) => e.id === id);
      const newAuditEntry: AuditEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'RESOLVE',
        actor: escalation?.assignedTo || 'System User',
        actorRole: 'Staff',
        claimNumber: escalation?.claimNumber,
        agentName: escalation?.agentName,
        details: `Escalation resolved for claim ${escalation?.claimNumber || id}. Reason: ${escalation?.reason || 'N/A'}`,
        previousValue: escalation?.status || 'PENDING',
        newValue: 'RESOLVED',
        riskLevel: 'LOW',
        tags: ['ESCALATION_RESOLVED'],
      };
      return {
        escalations: state.escalations.map((e) =>
          e.id === id ? { ...e, status: 'RESOLVED' as const, resolvedAt: new Date().toISOString() } : e
        ),
        auditEntries: [newAuditEntry, ...state.auditEntries],
      };
    }),

  addAuditEntry: (entry) =>
    set((state) => ({
      auditEntries: [entry, ...state.auditEntries],
    })),
}));
