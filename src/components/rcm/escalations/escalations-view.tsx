'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { apiUpdateEscalation } from '@/lib/rcm-sync';
import { useI18n } from '@/lib/i18n';
import { EscalationRecord, ESCALATION_LEVEL_LABELS, ESCALATION_LEVEL_COLORS } from '@/lib/rcm-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ChevronRight,
  Shield,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function EscalationsView() {
  const {
    escalations,
    escalationLevelFilter,
    setEscalationLevelFilter,
    acknowledgeEscalation,
    resolveEscalation,
  } = useRCMStore();

  const { t } = useI18n();

  const filtered = escalations.filter(
    (e) => escalationLevelFilter === 'ALL' || e.level === escalationLevelFilter
  );

  const pending = filtered.filter((e) => e.status === 'PENDING');
  const acknowledged = filtered.filter((e) => e.status === 'ACKNOWLEDGED');
  const resolved = filtered.filter((e) => e.status === 'RESOLVED');

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{pending.length}</p>
            <p className="text-xs text-muted-foreground">{t.escalations.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{acknowledged.length}</p>
            <p className="text-xs text-muted-foreground">{t.escalations.acknowledged}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resolved.length}</p>
            <p className="text-xs text-muted-foreground">{t.escalations.resolved}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select
          value={escalationLevelFilter === 'ALL' ? 'ALL' : String(escalationLevelFilter)}
          onValueChange={(v) => setEscalationLevelFilter(v === 'ALL' ? 'ALL' : Number(v))}
        >
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Filter by level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Levels</SelectItem>
            <SelectItem value="1">L1 — Front Desk</SelectItem>
            <SelectItem value="2">L2 — Billing Team</SelectItem>
            <SelectItem value="3">L3 — Senior Biller / RCM</SelectItem>
            <SelectItem value="4">L4 — Compliance Officer</SelectItem>
            <SelectItem value="5">L5 — Medical Director</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Escalation Ladder Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" />
            {t.escalations.escalationLadder}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[1, 2, 3, 4, 5].map((level) => {
              const count = escalations.filter((e) => e.level === level && e.status === 'PENDING').length;
              return (
                <div key={level} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex flex-col items-center px-3 py-2 rounded-lg border min-w-[80px]',
                      ESCALATION_LEVEL_COLORS[level],
                      count > 0 && 'ring-2 ring-offset-1 ring-red-400'
                    )}
                  >
                    <span className="text-[10px] font-bold">L{level}</span>
                    <span className="text-[8px] text-center leading-tight mt-0.5">
                      {ESCALATION_LEVEL_LABELS[level].split('/')[0]}
                    </span>
                    {count > 0 && (
                      <Badge variant="destructive" className="text-[8px] h-3.5 mt-1 px-1">
                        {count}
                      </Badge>
                    )}
                  </div>
                  {level < 5 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Escalations list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4" />
            <p className="text-sm font-semibold text-muted-foreground">{t.escalations.allResolved}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t.escalations.noMatch}</p>
          </div>
        ) : (
        filtered.map((escalation) => (
          <EscalationCard
            key={escalation.id}
            escalation={escalation}
            onAcknowledge={() => { acknowledgeEscalation(escalation.id); void apiUpdateEscalation(escalation.id, 'acknowledge'); }}
            onResolve={() => { resolveEscalation(escalation.id); void apiUpdateEscalation(escalation.id, 'resolve'); }}
          />
        ))
        )}
      </div>
    </div>
  );
}

function EscalationCard({
  escalation,
  onAcknowledge,
  onResolve,
}: {
  escalation: EscalationRecord;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const { t } = useI18n();
  const levelColor = ESCALATION_LEVEL_COLORS[escalation.level];
  const isPending = escalation.status === 'PENDING';
  const isAcknowledged = escalation.status === 'ACKNOWLEDGED';

  return (
    <Card
      className={cn(
        'transition-all',
        isPending && escalation.level >= 4 && 'border-red-300 dark:border-red-800',
        isPending && escalation.level === 3 && 'border-orange-300 dark:border-orange-800',
        isAcknowledged && 'opacity-70',
        escalation.status === 'RESOLVED' && 'opacity-50'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('text-[9px] h-5', levelColor)}>
                L{escalation.level} — {ESCALATION_LEVEL_LABELS[escalation.level].split('/')[0]}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-5 font-mono">
                {escalation.claimNumber}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] h-5',
                  escalation.status === 'PENDING' && 'border-red-300 text-red-700 bg-red-50',
                  escalation.status === 'ACKNOWLEDGED' && 'border-amber-300 text-amber-700 bg-amber-50',
                  escalation.status === 'RESOLVED' && 'border-emerald-300 text-emerald-700 bg-emerald-50',
                  escalation.status === 'ESCALATED' && 'border-rose-300 text-rose-700 bg-rose-50'
                )}
              >
                {escalation.status}
              </Badge>
              {escalation.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[9px] h-5 border-orange-300 text-orange-700 bg-orange-50"
                >
                  {tag.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>

            <p className="text-sm text-foreground mt-2 leading-relaxed">{escalation.reason}</p>

            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="w-3 h-3" />
                <span>{escalation.agentName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(escalation.createdAt), { addSuffix: true })}</span>
              </div>
              {escalation.assignedTo && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>{escalation.assignedTo}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isPending && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAcknowledge}>
                {t.escalations.acknowledge}
              </Button>
            )}
            {(isPending || isAcknowledged) && (
              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onResolve}>
                {t.escalations.resolve}
              </Button>
            )}
            {escalation.status === 'RESOLVED' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
