'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { useI18n } from '@/lib/i18n';
import { AgentRecord, AgentStatusType, AgentCategory } from '@/lib/rcm-types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { motion } from 'framer-motion';

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

const statusLabels: Record<AgentStatusType, Record<string, string>> = {
  ACTIVE: { en: 'Active', ar: 'نشط' },
  IDLE: { en: 'Idle', ar: 'خامل' },
  ERROR: { en: 'Error', ar: 'خطأ' },
  PROCESSING: { en: 'Processing', ar: 'يعالج' },
};

const statusDotColors: Record<AgentStatusType, string> = {
  ACTIVE: 'bg-emerald-500',
  IDLE: 'bg-gray-400',
  ERROR: 'bg-red-500',
  PROCESSING: 'bg-amber-500 animate-pulse',
};

const categoryColors: Record<AgentCategory, string> = {
  LINEAR: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  SENTINEL: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  KNOWLEDGE: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  ANALYTICS: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

export function AgentStatusGrid() {
  const { agents, setActiveView, setSelectedAgent } = useRCMStore();
  const { t, locale } = useI18n();

  const linearAgents = agents.filter((a) => a.category === 'LINEAR');
  const sentinelAgents = agents.filter((a) => a.category === 'SENTINEL');
  const knowledgeAgents = agents.filter((a) => a.category === 'KNOWLEDGE');
  const analyticsAgents = agents.filter((a) => a.category === 'ANALYTICS');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{t.dashboard.agentFleetStatus}</h3>
        <button
          onClick={() => setActiveView('agents')}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
        >
          {t.dashboard.viewAll} →
        </button>
      </div>

      {/* Workflow Pipeline */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
          {t.dashboard.linearWorkflow}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {linearAgents.map((agent, idx) => (
            <AgentMiniCard
              key={agent.id}
              agent={agent}
              showArrow={idx < linearAgents.length - 1}
              onClick={() => {
                setSelectedAgent(agent);
                setActiveView('agents');
              }}
            />
          ))}
        </div>
      </div>

      {/* Cross-cutting agents */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
          {t.dashboard.crossCutting}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sentinelAgents.map((agent) => (
            <AgentMiniCard
              key={agent.id}
              agent={agent}
              onClick={() => {
                setSelectedAgent(agent);
                setActiveView('agents');
              }}
            />
          ))}
          {knowledgeAgents.map((agent) => (
            <AgentMiniCard
              key={agent.id}
              agent={agent}
              onClick={() => {
                setSelectedAgent(agent);
                setActiveView('agents');
              }}
            />
          ))}
          {analyticsAgents.map((agent) => (
            <AgentMiniCard
              key={agent.id}
              agent={agent}
              onClick={() => {
                setSelectedAgent(agent);
                setActiveView('agents');
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentMiniCard({
  agent,
  onClick,
}: {
  agent: AgentRecord;
  showArrow?: boolean;
  onClick: () => void;
}) {
  const { locale } = useI18n();
  const Icon = iconMap[agent.icon] || ShieldCheck;
  const statusLabel = statusLabels[agent.status]?.[locale] || statusLabels[agent.status]?.en || agent.status;

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border"
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center',
              agent.status === 'ACTIVE' || agent.status === 'PROCESSING'
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400'
                : agent.status === 'ERROR'
                ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            )}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1">
              <span className={cn('w-1.5 h-1.5 rounded-full', statusDotColors[agent.status])} />
              <span className="text-[9px] text-muted-foreground font-medium">
                {statusLabel}
              </span>
            </div>
          </div>
          <p className="text-xs font-semibold mt-2 leading-tight">{agent.displayName}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground">
              {agent.claimsProcessed} {locale === 'ar' ? 'معالجة' : 'processed'}
            </span>
            {agent.activeClaims > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1">
                {agent.activeClaims} {locale === 'ar' ? 'نشطة' : 'active'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
