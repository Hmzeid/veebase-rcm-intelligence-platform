'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Bot,
  FileText,
  AlertTriangle,
  BookOpen,
  BarChart3,
  MessageSquare,
  Hash,
  ArrowUpRight,
  Clock,
} from 'lucide-react';

type ViewMode = 'dashboard' | 'agents' | 'claims' | 'escalations' | 'analytics' | 'chat' | 'payer-rules';

interface RecentAction {
  id: string;
  label: string;
  type: 'nav' | 'claim' | 'agent' | 'escalation';
  view: ViewMode;
  entityId?: string;
  timestamp: number;
}

const MAX_RECENT = 5;
const STORAGE_KEY = 'veebase-rcm-recent-actions';

const viewConfig: { view: ViewMode; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { view: 'agents', label: 'Agent Fleet', icon: <Bot /> },
  { view: 'claims', label: 'Claims Pipeline', icon: <FileText /> },
  { view: 'escalations', label: 'Escalation Queue', icon: <AlertTriangle /> },
  { view: 'payer-rules', label: 'Payer Rules', icon: <BookOpen /> },
  { view: 'analytics', label: 'Analytics & Reporting', icon: <BarChart3 /> },
  { view: 'chat', label: 'AI Assistant', icon: <MessageSquare /> },
];

function loadRecentActions(): RecentAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentActions(actions: RecentAction[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch {
    // Ignore storage errors
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recentActions, setRecentActions] = useState<RecentAction[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const {
    claims,
    agents,
    escalations,
    setActiveView,
    setSelectedClaim,
    setSelectedAgent,
    setSelectedEscalation,
  } = useRCMStore();

  // Listen for ⌘K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addRecentAction = useCallback((action: RecentAction) => {
    setRecentActions((prev) => {
      // Remove duplicate by id, then add to front
      const filtered = prev.filter((a) => a.id !== action.id);
      const updated = [action, ...filtered].slice(0, MAX_RECENT);
      saveRecentActions(updated);
      return updated;
    });
  }, []);

  const handleNavSelect = useCallback(
    (view: ViewMode) => {
      const config = viewConfig.find((v) => v.view === view);
      setActiveView(view);
      addRecentAction({
        id: `nav-${view}`,
        label: config?.label ?? view,
        type: 'nav',
        view,
        timestamp: Date.now(),
      });
      setOpen(false);
    },
    [setActiveView, addRecentAction]
  );

  const handleClaimSelect = useCallback(
    (claimId: string) => {
      const claim = claims.find((c) => c.id === claimId);
      if (claim) {
        setSelectedClaim(claim);
        setActiveView('claims');
        addRecentAction({
          id: `claim-${claim.id}`,
          label: `${claim.claimNumber} — ${claim.patientName}`,
          type: 'claim',
          view: 'claims',
          entityId: claim.id,
          timestamp: Date.now(),
        });
      }
      setOpen(false);
    },
    [claims, setSelectedClaim, setActiveView, addRecentAction]
  );

  const handleAgentSelect = useCallback(
    (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (agent) {
        setSelectedAgent(agent);
        setActiveView('agents');
        addRecentAction({
          id: `agent-${agent.id}`,
          label: agent.displayName,
          type: 'agent',
          view: 'agents',
          entityId: agent.id,
          timestamp: Date.now(),
        });
      }
      setOpen(false);
    },
    [agents, setSelectedAgent, setActiveView, addRecentAction]
  );

  const handleEscalationSelect = useCallback(
    (escId: string) => {
      const esc = escalations.find((e) => e.id === escId);
      if (esc) {
        setSelectedEscalation(esc);
        setActiveView('escalations');
        addRecentAction({
          id: `esc-${esc.id}`,
          label: `${esc.claimNumber} — L${esc.level}`,
          type: 'escalation',
          view: 'escalations',
          entityId: esc.id,
          timestamp: Date.now(),
        });
      }
      setOpen(false);
    },
    [escalations, setSelectedEscalation, setActiveView, addRecentAction]
  );

  const handleRecentSelect = useCallback(
    (action: RecentAction) => {
      if (action.type === 'nav') {
        setActiveView(action.view);
      } else if (action.type === 'claim' && action.entityId) {
        const claim = claims.find((c) => c.id === action.entityId);
        if (claim) setSelectedClaim(claim);
        setActiveView('claims');
      } else if (action.type === 'agent' && action.entityId) {
        const agent = agents.find((a) => a.id === action.entityId);
        if (agent) setSelectedAgent(agent);
        setActiveView('agents');
      } else if (action.type === 'escalation' && action.entityId) {
        const esc = escalations.find((e) => e.id === action.entityId);
        if (esc) setSelectedEscalation(esc);
        setActiveView('escalations');
      }
      setOpen(false);
    },
    [claims, agents, escalations, setActiveView, setSelectedClaim, setSelectedAgent, setSelectedEscalation]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search for views, claims, agents, and escalations"
    >
      <CommandInput placeholder="Search views, claims, agents, escalations..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent Actions */}
        {recentActions.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`recent-${action.label}`}
                  onSelect={() => handleRecentSelect(action)}
                >
                  <Clock className="text-muted-foreground" />
                  <span>{action.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{action.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {viewConfig.map(({ view, label, icon }) => (
            <CommandItem
              key={view}
              value={`nav-${label}`}
              onSelect={() => handleNavSelect(view)}
            >
              {icon}
              <span>{label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Claims */}
        {claims.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Claims">
              {claims.map((claim) => (
                <CommandItem
                  key={claim.id}
                  value={`claim-${claim.claimNumber}-${claim.patientName}-${claim.payerName}`}
                  onSelect={() => handleClaimSelect(claim.id)}
                >
                  <Hash className="text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{claim.claimNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {claim.patientName} · {claim.payerName}
                    </span>
                  </div>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {claim.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Agents */}
        {agents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agents">
              {agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={`agent-${agent.displayName}-${agent.agentName}`}
                  onSelect={() => handleAgentSelect(agent.id)}
                >
                  <Bot className="text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{agent.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {agent.status} · {agent.activeClaims} active claims
                    </span>
                  </div>
                  <span className="ml-auto flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        agent.status === 'ACTIVE'
                          ? 'bg-emerald-500'
                          : agent.status === 'PROCESSING'
                          ? 'bg-amber-500'
                          : agent.status === 'ERROR'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                      }`}
                    />
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Escalations */}
        {escalations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Escalations">
              {escalations.map((esc) => (
                <CommandItem
                  key={esc.id}
                  value={`esc-${esc.claimNumber}-${esc.reason}`}
                  onSelect={() => handleEscalationSelect(esc.id)}
                >
                  <AlertTriangle className="text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm flex items-center gap-1.5">
                      {esc.claimNumber}
                      <span
                        className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                          esc.level >= 4
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            : esc.level >= 3
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        L{esc.level}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {esc.reason}
                    </span>
                  </div>
                  <ArrowUpRight className="ml-auto text-muted-foreground h-3.5 w-3.5" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
