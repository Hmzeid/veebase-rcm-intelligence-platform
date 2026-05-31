import { create } from 'zustand';
import { ClaimRecord, ClaimStatus, AgentRecord, EscalationRecord, KPIRecord } from './rcm-types';
import { AGENTS, CLAIMS, ESCALATIONS, KPIS, INITIAL_ACTIVITIES } from './rcm-data';

type ViewMode = 'dashboard' | 'agents' | 'claims' | 'escalations' | 'analytics' | 'chat' | 'payer-rules';

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
    set((state) => ({
      escalations: state.escalations.map((e) =>
        e.id === id ? { ...e, status: 'ACKNOWLEDGED' as const } : e
      ),
    })),
  resolveEscalation: (id) =>
    set((state) => ({
      escalations: state.escalations.map((e) =>
        e.id === id ? { ...e, status: 'RESOLVED' as const, resolvedAt: new Date().toISOString() } : e
      ),
    })),
}));
