'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { AgentRecord, AgentStatusType, AgentCategory } from '@/lib/rcm-types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck,
  FileCheck,
  Receipt,
  Code,
  Send,
  AlertTriangle,
  RotateCcw,
  Banknote,
  UserCheck,
  Eye,
  BookOpen,
  BarChart3,
  Activity,
  Clock,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const iconMap: Record<string, React.ElementType> = {
  ShieldCheck,
  FileCheck,
  Receipt,
  Code,
  Send,
  AlertTriangle,
  RotateCcw,
  Banknote,
  UserCheck,
  Eye,
  BookOpen,
  BarChart3,
};

const statusColors: Record<AgentStatusType, { dot: string; bg: string; text: string }> = {
  ACTIVE: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300' },
  IDLE: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/30', text: 'text-gray-600 dark:text-gray-400' },
  ERROR: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300' },
  PROCESSING: { dot: 'bg-amber-500 animate-pulse', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300' },
};

const categoryInfo: Record<AgentCategory, { label: string; color: string; desc: string }> = {
  LINEAR: { label: 'Linear Workflow', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300', desc: 'Sequential claim processing pipeline' },
  SENTINEL: { label: 'Sentinel', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300', desc: 'Cross-cutting fraud & compliance monitoring' },
  KNOWLEDGE: { label: 'Knowledge Service', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300', desc: 'Queryable payer rules and contract data' },
  ANALYTICS: { label: 'Analytics', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', desc: 'KPI computation and root-cause analysis' },
};

export function AgentsView() {
  const { agents, selectedAgent, setSelectedAgent } = useRCMStore();

  const linearAgents = agents.filter((a) => a.category === 'LINEAR');
  const sentinelAgents = agents.filter((a) => a.category === 'SENTINEL');
  const knowledgeAgents = agents.filter((a) => a.category === 'KNOWLEDGE');
  const analyticsAgents = agents.filter((a) => a.category === 'ANALYTICS');

  const activeCount = agents.filter((a) => a.status === 'ACTIVE' || a.status === 'PROCESSING').length;
  const idleCount = agents.filter((a) => a.status === 'IDLE').length;
  const errorCount = agents.filter((a) => a.status === 'ERROR').length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Status summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium">{activeCount} Active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          <span className="text-sm font-medium">{idleCount} Idle</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-sm font-medium">{errorCount} Errors</span>
          </div>
        )}
      </div>

      {/* Workflow visualization */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Linear Workflow Pipeline
        </h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {linearAgents.map((agent, idx) => (
            <div key={agent.id} className="flex items-center gap-1">
              <AgentCard agent={agent} />
              {idx < linearAgents.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cross-cutting agents */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" />
          Cross-cutting Agents
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sentinelAgents.map((agent) => (
            <AgentDetailCard key={agent.id} agent={agent} />
          ))}
          {knowledgeAgents.map((agent) => (
            <AgentDetailCard key={agent.id} agent={agent} />
          ))}
          {analyticsAgents.map((agent) => (
            <AgentDetailCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Agent detail sheet */}
      <Sheet open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto p-0">
          <div className="p-6">
            {selectedAgent && <AgentDetailContent agent={selectedAgent} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentRecord }) {
  const Icon = iconMap[agent.icon] || ShieldCheck;
  const colors = statusColors[agent.status];
  const { setSelectedAgent } = useRCMStore();

  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      <Card
        className={cn('cursor-pointer min-w-[130px] transition-shadow hover:shadow-md border', colors.bg)}
        onClick={() => setSelectedAgent(agent)}
      >
        <CardContent className="p-3 text-center">
          <div className={cn('mx-auto w-8 h-8 rounded-lg flex items-center justify-center mb-2', colors.bg)}>
            <Icon className={cn('w-4 h-4', colors.text)} />
          </div>
          <p className="text-[11px] font-semibold leading-tight">{agent.displayName}</p>
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
            <span className={cn('text-[9px] font-medium', colors.text)}>
              {agent.status}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AgentDetailCard({ agent }: { agent: AgentRecord }) {
  const Icon = iconMap[agent.icon] || ShieldCheck;
  const colors = statusColors[agent.status];
  const catInfo = categoryInfo[agent.category];
  const { setSelectedAgent } = useRCMStore();

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setSelectedAgent(agent)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colors.bg)}>
              <Icon className={cn('w-5 h-5', colors.text)} />
            </div>
            <div>
              <p className="text-sm font-semibold">{agent.displayName}</p>
              <Badge variant="outline" className={cn('text-[9px] h-4 mt-1', catInfo.color)}>
                {catInfo.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
            <span className={cn('text-xs font-medium', colors.text)}>
              {agent.status}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed line-clamp-2">
          {agent.description}
        </p>
        <div className="flex items-center gap-4 mt-3">
          <div className="text-center">
            <p className="text-sm font-bold">{agent.claimsProcessed}</p>
            <p className="text-[10px] text-muted-foreground">Processed</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold">{agent.activeClaims}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold">{agent.avgProcessingMs}ms</p>
            <p className="text-[10px] text-muted-foreground">Avg Time</p>
          </div>
          {agent.errorCount > 0 && (
            <div className="text-center">
              <p className="text-sm font-bold text-red-600">{agent.errorCount}</p>
              <p className="text-[10px] text-muted-foreground">Errors</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AgentDetailContent({ agent }: { agent: AgentRecord }) {
  const Icon = iconMap[agent.icon] || ShieldCheck;
  const colors = statusColors[agent.status];
  const catInfo = categoryInfo[agent.category];

  return (
    <div className="space-y-4">
      <SheetHeader className="p-0">
        <SheetTitle className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colors.bg)}>
            <Icon className={cn('w-5 h-5', colors.text)} />
          </div>
          <div>
            <span>{agent.displayName}</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={cn('text-[9px] h-4', catInfo.color)}>
                {catInfo.label}
              </Badge>
              <Badge variant="outline" className={cn('text-[9px] h-4', colors.bg, colors.text)}>
                {agent.status}
              </Badge>
            </div>
          </div>
        </SheetTitle>
      </SheetHeader>

      <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <StatBox label="Claims Processed" value={agent.claimsProcessed.toString()} />
        <StatBox label="Active Claims" value={agent.activeClaims.toString()} />
        <StatBox label="Avg Processing" value={`${agent.avgProcessingMs}ms`} />
        <StatBox label="Errors" value={agent.errorCount.toString()} alert={agent.errorCount > 0} />
      </div>

      <Separator />

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Agent Category</p>
        <div className={cn('p-3 rounded-lg', catInfo.color)}>
          <p className="text-xs font-semibold">{catInfo.label}</p>
          <p className="text-[11px] opacity-80 mt-0.5">{catInfo.desc}</p>
        </div>
      </div>

      {agent.lastActivity && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          Last activity: {formatDistanceToNow(new Date(agent.lastActivity), { addSuffix: true })}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">HITL Gate Status</p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Phase {agent.category === 'LINEAR' ? '1 — Review Required' : '1 — Query Only'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <p className={cn('text-lg font-bold', alert && 'text-red-600')}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
