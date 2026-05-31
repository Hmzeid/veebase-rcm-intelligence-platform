'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { KPIRecord } from '@/lib/rcm-types';
import {
  DENIAL_TREND_DATA,
  REVENUE_BY_PAYER,
  DENIAL_BY_REASON,
  DAILY_CLAIMS_VOLUME,
  AGENT_ACTIVITY_DATA,
} from '@/lib/rcm-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';

const KPI_STATUS_COLORS = {
  ON_TARGET: 'text-emerald-600 dark:text-emerald-400',
  WARNING: 'text-amber-600 dark:text-amber-400',
  OFF_TARGET: 'text-red-600 dark:text-red-400',
};

const TREND_COLORS = {
  IMPROVING: 'text-emerald-600',
  STABLE: 'text-gray-500',
  DEGRADING: 'text-red-500',
};

export function AnalyticsView() {
  const { kpis } = useRCMStore();

  const onTarget = kpis.filter((k) => k.status === 'ON_TARGET').length;
  const warning = kpis.filter((k) => k.status === 'WARNING').length;
  const offTarget = kpis.filter((k) => k.status === 'OFF_TARGET').length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Summary bar */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium">{onTarget} On Target</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">{warning} Warning</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium">{offTarget} Off Target</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <AnalyticsKPICard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Denial Trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Denial Rate Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DENIAL_TREND_DATA} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 8]} unit="%" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="nhia" name="NHIA" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="private" name="Private TPAs" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="overall" name="Overall" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Payer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Revenue by Payer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={REVENUE_BY_PAYER} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="payer" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => `EGP ${(v / 1000).toFixed(0)}K`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="billed" name="Billed" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" name="Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Denial by Reason */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Denial by Reason Code</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DENIAL_BY_REASON.map((item) => (
                <div key={item.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{item.code}</span>
                      <span className="font-medium">{item.reason}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{item.count} claims</span>
                      <span className="font-bold">EGP {(item.amount / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500/70 transition-all"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Claims Volume */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Daily Claims Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DAILY_CLAIMS_VOLUME} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="submitted" name="Submitted" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="paid" name="Paid" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="denied" name="Denied" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Agent Activity (Today)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={AGENT_ACTIVITY_DATA} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <defs>
                  <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="activity" name="Actions" stroke="#10b981" fill="url(#activityGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Root Cause Narratives */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Root-Cause Narratives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RootCauseNarrative
            kpi="Prior Auth Approval Rate"
            status="OFF_TARGET"
            value="82.1%"
            target="85%"
            rootCauses={[
              'Authorization requests missing clinical note attachments (38% of denials)',
              'Cardiology orders have 18% auth denial rate — highest among departments',
              'Step therapy documentation gaps for orthopedic procedures',
            ]}
            recommendations={[
              'Update Prior Auth Agent evidence checklist for cardiology orders — require attached clinical notes before submission',
              'Add mandatory step therapy verification for orthopedic CPT codes 27447, 27130',
              'Implement pre-submission documentation quality scoring',
            ]}
          />
          <RootCauseNarrative
            kpi="Patient Collection Rate"
            status="OFF_TARGET"
            value="71.4%"
            target="80%"
            rootCauses={[
              'Self-pay patients receiving no upfront estimates before service (32% of cases)',
              'Collection follow-up not triggered for balances under EGP 500',
              'Arabic statement language unclear — patients confused about payment options',
            ]}
            recommendations={[
              'Enable PatientBilling Agent upfront estimates for all self-pay encounters',
              'Lower collection follow-up threshold to EGP 200',
              'Redesign Arabic statement template with simpler language and QR payment code',
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsKPICard({ kpi }: { kpi: KPIRecord }) {
  const trendIcon =
    kpi.trend === 'IMPROVING' ? TrendingUp :
    kpi.trend === 'DEGRADING' ? TrendingDown :
    Minus;

  const formatValue = kpi.unit === 'pct' ? `${kpi.value.toFixed(1)}%` :
    kpi.unit === 'days' ? `${kpi.value.toFixed(1)}d` :
    kpi.unit === 'EGP' ? `EGP ${(kpi.value / 1000).toFixed(0)}K` :
    kpi.value.toFixed(0);

  const formatTarget = kpi.unit === 'pct' ? `${kpi.target.toFixed(1)}%` :
    kpi.unit === 'days' ? `≤${kpi.target}d` :
    kpi.unit === 'EGP' ? `EGP ${(kpi.target / 1000).toFixed(0)}K` :
    kpi.target.toFixed(0);

  return (
    <Card className={cn(
      'transition-shadow hover:shadow-md',
      kpi.status === 'OFF_TARGET' && 'border-red-200 dark:border-red-900',
      kpi.status === 'WARNING' && 'border-amber-200 dark:border-amber-900'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-muted-foreground leading-tight">{kpi.name}</p>
          {(() => {
            const Icon = trendIcon;
            return <Icon className={cn('w-3.5 h-3.5', TREND_COLORS[kpi.trend])} />;
          })()}
        </div>
        <p className={cn('text-2xl font-bold', KPI_STATUS_COLORS[kpi.status])}>
          {formatValue}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">Target: {formatTarget}</span>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] h-4',
              kpi.status === 'ON_TARGET' && 'border-emerald-300 text-emerald-700',
              kpi.status === 'WARNING' && 'border-amber-300 text-amber-700',
              kpi.status === 'OFF_TARGET' && 'border-red-300 text-red-700'
            )}
          >
            {kpi.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RootCauseNarrative({
  kpi,
  status,
  value,
  target,
  rootCauses,
  recommendations,
}: {
  kpi: string;
  status: string;
  value: string;
  target: string;
  rootCauses: string[];
  recommendations: string[];
}) {
  return (
    <div className={cn(
      'p-4 rounded-lg border',
      status === 'OFF_TARGET' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20' :
      'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className={cn(
          'text-[10px]',
          status === 'OFF_TARGET' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'
        )}>
          {status.replace('_', ' ')}
        </Badge>
        <span className="text-sm font-semibold">{kpi}</span>
        <span className="text-xs text-muted-foreground">
          {value} (target: {target})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Root Causes</p>
          <ul className="space-y-1.5">
            {rootCauses.map((cause, i) => (
              <li key={i} className="text-xs text-foreground leading-relaxed flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                {cause}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Recommendations</p>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-foreground leading-relaxed flex items-start gap-2">
                <ArrowUpRight className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
