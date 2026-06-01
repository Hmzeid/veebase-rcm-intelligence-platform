'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPIRecord } from '@/lib/rcm-types';
import { useRCMStore } from '@/lib/rcm-store';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface KPICardProps {
  kpi: KPIRecord;
  compact?: boolean;
}

const unitFormatters: Record<string, (v: number) => string> = {
  pct: (v) => `${v.toFixed(1)}%`,
  days: (v) => `${v.toFixed(1)}d`,
  EGP: (v) => `EGP ${(v / 1000).toFixed(0)}K`,
  count: (v) => v.toFixed(0),
};

const trendIcons = {
  IMPROVING: TrendingUp,
  STABLE: Minus,
  DEGRADING: TrendingDown,
};

const statusColors = {
  ON_TARGET: 'text-emerald-600 dark:text-emerald-400',
  WARNING: 'text-amber-600 dark:text-amber-400',
  OFF_TARGET: 'text-red-600 dark:text-red-400',
};

const statusIcons = {
  ON_TARGET: CheckCircle2,
  WARNING: AlertTriangle,
  OFF_TARGET: AlertTriangle,
};

export function KPICard({ kpi, compact }: KPICardProps) {
  const formatValue = unitFormatters[kpi.unit] || ((v: number) => v.toString());
  const TrendIcon = trendIcons[kpi.trend];
  const StatusIcon = statusIcons[kpi.status];
  const progressPct = kpi.unit === 'pct' ? kpi.value : (kpi.value / kpi.target) * 100;

  return (
    <Card className={cn('transition-shadow hover:shadow-md', compact && 'py-0')}>
      <CardHeader className={cn('pb-2', compact && 'px-4 pt-4 pb-1')}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn('text-sm font-medium text-muted-foreground', compact && 'text-xs')}>
            {kpi.name}
          </CardTitle>
          <StatusIcon className={cn('w-4 h-4', statusColors[kpi.status])} />
        </div>
      </CardHeader>
      <CardContent className={cn(compact && 'px-4 pb-4 pt-0')}>
        <div className="flex items-end justify-between">
          <div>
            <p className={cn('text-2xl font-bold tracking-tight', compact && 'text-xl')}>
              {formatValue(kpi.value)}
            </p>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {kpi.trend === 'IMPROVING' ? '↑' : kpi.trend === 'DEGRADING' ? '↓' : '→'} {formatValue(kpi.target)}
              </p>
            )}
          </div>
          <div className={cn('flex items-center gap-1 text-xs font-medium', statusColors[kpi.status])}>
            <TrendIcon className="w-3 h-3" />
            <span>{kpi.trend}</span>
          </div>
        </div>
        {!compact && (
          <div className="mt-3">
            <Progress
              value={Math.min(100, Math.max(0, progressPct))}
              className={cn(
                'h-1.5',
                kpi.status === 'ON_TARGET' && '[&>div]:bg-emerald-500',
                kpi.status === 'WARNING' && '[&>div]:bg-amber-500',
                kpi.status === 'OFF_TARGET' && '[&>div]:bg-red-500'
              )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KPIGrid() {
  const { kpis } = useKPIData();
  const { t } = useI18n();
  const operational = kpis.filter((k) => k.category === 'OPERATIONAL');
  const financial = kpis.filter((k) => k.category === 'FINANCIAL');
  const quality = kpis.filter((k) => k.category === 'QUALITY');

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title={t.dashboard.activeClaims}
          value="107"
          subtitle={`12 ${t.dashboard.atRisk}`}
          trend="IMPROVING"
          color="emerald"
        />
        <SummaryCard
          title={t.dashboard.monthlyRevenue}
          value="EGP 4.9M"
          subtitle={`88.8% ${t.dashboard.collected}`}
          trend="STABLE"
          color="emerald"
        />
        <SummaryCard
          title={t.dashboard.pendingEscalations}
          value="7"
          subtitle={`2 ${t.dashboard.highPriority}`}
          trend="DEGRADING"
          color="amber"
        />
        <SummaryCard
          title={t.dashboard.avgReadiness}
          value="84%"
          subtitle={`${t.dashboard.target}: 90%+`}
          trend="IMPROVING"
          color="emerald"
        />
      </div>

      {/* Operational KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          {t.dashboard.kpiCategories.operational}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {operational.map((kpi) => (
            <KPICard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      </div>

      {/* Financial KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {t.dashboard.kpiCategories.financial}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {financial.map((kpi) => (
            <KPICard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      </div>

      {/* Quality KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          {t.dashboard.kpiCategories.quality}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quality.map((kpi) => (
            <KPICard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      </div>
    </div>
  );
}

function useKPIData() {
  const kpis = useRCMStore((state) => state.kpis);
  return { kpis };
}

function SummaryCard({
  title,
  value,
  subtitle,
  trend,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend: string;
  color: 'emerald' | 'amber' | 'red';
}) {
  const colorClasses = {
    emerald: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30',
    amber: 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30',
    red: 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30',
  };

  return (
    <Card className={cn('border', colorClasses[color])}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {trend === 'IMPROVING' && <ArrowUpRight className="w-3 h-3 text-emerald-600" />}
          {trend === 'DEGRADING' && <ArrowDownRight className="w-3 h-3 text-red-500" />}
          {trend === 'STABLE' && <Minus className="w-3 h-3 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
}
