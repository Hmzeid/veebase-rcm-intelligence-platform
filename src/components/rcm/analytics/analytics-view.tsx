'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { KPIRecord } from '@/lib/rcm-types';
import {
  DENIAL_TREND_DATA,
  REVENUE_BY_PAYER,
  DENIAL_BY_REASON,
  DAILY_CLAIMS_VOLUME,
  AGENT_ACTIVITY_DATA,
  PAYER_MIX,
  REVENUE_TREND_DATA,
  CLAIMS_AGING_DATA,
} from '@/lib/rcm-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DollarSign,
  Clock,
  BarChart3,
  Wallet,
  Calendar,
} from 'lucide-react';
import { useMemo, useState } from 'react';

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

type TimePeriod = 'week' | 'month' | 'quarter';

export function AnalyticsView() {
  const { kpis, claims, agents } = useRCMStore();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

  const onTarget = kpis.filter((k) => k.status === 'ON_TARGET').length;
  const warning = kpis.filter((k) => k.status === 'WARNING').length;
  const offTarget = kpis.filter((k) => k.status === 'OFF_TARGET').length;

  // Filter claims by selected time period
  const filteredClaimsByPeriod = useMemo(() => {
    const now = new Date();
    const periodDays: Record<TimePeriod, number> = { week: 7, month: 30, quarter: 90 };
    const cutoff = new Date(now.getTime() - periodDays[timePeriod] * 24 * 60 * 60 * 1000);
    return claims.filter(c => new Date(c.createdAt) >= cutoff);
  }, [claims, timePeriod]);

  // Financial summary computed from filtered claims
  const financialSummary = useMemo(() => {
    const totalBilled = filteredClaimsByPeriod.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalCollected = filteredClaimsByPeriod.reduce((sum, c) => sum + c.paidAmount, 0);
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    // AR Days: weighted average based on claim age
    const now = new Date();
    const totalWeightedDays = filteredClaimsByPeriod.reduce((sum, c) => {
      const created = new Date(c.createdAt);
      const days = Math.max(0, (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days * c.totalAmount;
    }, 0);
    const arDays = totalBilled > 0 ? totalWeightedDays / totalBilled : 0;

    return { totalBilled, totalCollected, collectionRate, arDays };
  }, [filteredClaimsByPeriod]);

  // Compute claims aging from filtered claims data
  const claimsAging = useMemo(() => {
    const now = new Date();
    const buckets = [
      { bucket: '0-30 Days', min: 0, max: 30, color: '#10b981' },
      { bucket: '31-60 Days', min: 31, max: 60, color: '#f59e0b' },
      { bucket: '61-90 Days', min: 61, max: 90, color: '#f97316' },
      { bucket: '90+ Days', min: 91, max: Infinity, color: '#ef4444' },
    ];

    return buckets.map((b) => {
      const matching = filteredClaimsByPeriod.filter((c) => {
        const age = (now.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return age >= b.min && age <= b.max;
      });
      return {
        ...b,
        count: matching.length,
        amount: matching.reduce((sum, c) => sum + c.totalAmount, 0),
      };
    });
  }, [filteredClaimsByPeriod]);

  // Agent performance data for heatmap
  const agentPerformance = useMemo(() => {
    return agents.map((agent) => {
      const errorRate = agent.claimsProcessed > 0
        ? (agent.errorCount / agent.claimsProcessed) * 100
        : 0;
      const avgTimeSec = agent.avgProcessingMs / 1000;
      return {
        name: agent.displayName,
        agentName: agent.agentName,
        claimsProcessed: agent.claimsProcessed,
        activeClaims: agent.activeClaims,
        avgTime: avgTimeSec,
        errorRate,
      };
    });
  }, [agents]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header with Time Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-[10px] h-6 gap-1">
            {filteredClaimsByPeriod.length} claims in period
          </Badge>
          <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <TabsList className="h-8">
              <TabsTrigger value="week" className="text-xs px-3 h-7">
                <Calendar className="w-3 h-3 mr-1" />
                This Week
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3 h-7">
                <Calendar className="w-3 h-3 mr-1" />
                This Month
              </TabsTrigger>
              <TabsTrigger value="quarter" className="text-xs px-3 h-7">
                <Calendar className="w-3 h-3 mr-1" />
                This Quarter
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinancialCard
          title="Total Billed"
          value={`EGP ${(financialSummary.totalBilled / 1000000).toFixed(2)}M`}
          subtitle={`${filteredClaimsByPeriod.length} claims`}
          icon={DollarSign}
          trend="up"
          trendValue="+12.3%"
          color="emerald"
        />
        <FinancialCard
          title="Total Collected"
          value={`EGP ${(financialSummary.totalCollected / 1000000).toFixed(2)}M`}
          subtitle={financialSummary.totalBilled > 0 ? `${Math.round((financialSummary.totalCollected / financialSummary.totalBilled) * 100)}% of billed` : '0% of billed'}
          icon={Wallet}
          trend="up"
          trendValue="+8.1%"
          color="sky"
        />
        <FinancialCard
          title="Collection Rate"
          value={`${financialSummary.collectionRate.toFixed(1)}%`}
          subtitle="Target: 96.0%"
          icon={BarChart3}
          trend={financialSummary.collectionRate >= 96 ? 'up' : 'down'}
          trendValue={financialSummary.collectionRate >= 96 ? 'On Track' : 'Below Target'}
          color={financialSummary.collectionRate >= 96 ? 'emerald' : 'amber'}
        />
        <FinancialCard
          title="AR Days"
          value={`${financialSummary.arDays.toFixed(1)}`}
          subtitle="Target: ≤40 days"
          icon={Clock}
          trend={financialSummary.arDays <= 40 ? 'up' : 'down'}
          trendValue={financialSummary.arDays <= 40 ? 'On Track' : 'Above Target'}
          color={financialSummary.arDays <= 40 ? 'emerald' : 'red'}
        />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <AnalyticsKPICard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      {/* Charts Row 1: Denial Trend + Payer Mix Donut */}
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

        {/* Payer Mix Donut Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Payer Mix Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PAYER_MIX}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {PAYER_MIX.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number) => [`${value}%`, 'Share']}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute pointer-events-none" style={{ transform: 'translate(-50%, -50%)', marginTop: '-10px' }}>
                <div className="text-center">
                  <p className="text-2xl font-bold">{filteredClaimsByPeriod.length}</p>
                  <p className="text-[10px] text-muted-foreground">Total Claims</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Revenue Trend Area Chart + Claims Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend (Stacked Area Chart) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Revenue Trend (6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={REVENUE_TREND_DATA} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => `EGP ${(v / 1000000).toFixed(2)}M`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <defs>
                    <linearGradient id="nhiaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="privateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="selfPayGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6b7280" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6b7280" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="nhia" name="NHIA" stackId="1" stroke="#10b981" fill="url(#nhiaGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="private" name="Private TPAs" stackId="1" stroke="#f59e0b" fill="url(#privateGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="selfPay" name="Self-Pay" stackId="1" stroke="#6b7280" fill="url(#selfPayGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Claims Aging Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Claims Aging Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={claimsAging}
                  layout="vertical"
                  margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `EGP ${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="bucket" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, _name: string, props: { payload?: { count: number } }) =>
                      [`EGP ${(v / 1000).toFixed(0)}K (${props?.payload?.count ?? 0} claims)`, 'Amount']
                    }
                  />
                  <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                    {claimsAging.map((entry, index) => (
                      <Cell key={`aging-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Revenue by Payer + Denial by Reason */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>

      {/* Charts Row 4: Daily Volume + Agent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* Agent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Agent Activity (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
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
      </div>

      {/* Agent Performance Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Agent Performance Heatmap</CardTitle>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Good</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Moderate</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Concerning</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Agent</th>
                  <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Claims Processed</th>
                  <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Active Claims</th>
                  <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Avg Time (s)</th>
                  <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Error Rate</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((agent) => (
                  <tr key={agent.agentName} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium">{agent.name}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-md text-xs font-semibold',
                        getClaimsProcessedColor(agent.claimsProcessed)
                      )}>
                        {agent.claimsProcessed.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-md text-xs font-semibold',
                        getActiveClaimsColor(agent.activeClaims)
                      )}>
                        {agent.activeClaims}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-md text-xs font-semibold',
                        getAvgTimeColor(agent.avgTime)
                      )}>
                        {agent.avgTime.toFixed(1)}s
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-md text-xs font-semibold',
                        getErrorRateColor(agent.errorRate)
                      )}>
                        {agent.errorRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

// ========== Helper functions for heatmap colors ==========

function getClaimsProcessedColor(value: number): string {
  if (value >= 800) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200';
  if (value >= 400) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200';
  return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200';
}

function getActiveClaimsColor(value: number): string {
  if (value <= 5) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200';
  if (value <= 12) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200';
  return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200';
}

function getAvgTimeColor(value: number): string {
  if (value <= 3) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200';
  if (value <= 5) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200';
  return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200';
}

function getErrorRateColor(value: number): string {
  if (value <= 0.3) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200';
  if (value <= 1.0) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200';
  return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200';
}

// ========== Financial Summary Card ==========

function FinancialCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: 'up' | 'down';
  trendValue: string;
  color: 'emerald' | 'sky' | 'amber' | 'red';
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  };

  const iconBgMap = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400',
    amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    red: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn('p-2 rounded-lg', iconBgMap[color])}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1">
          {trend === 'up' ? (
            <TrendingUp className="w-3 h-3 text-emerald-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          <span className={cn(
            'text-[10px] font-medium',
            trend === 'up' ? 'text-emerald-600' : 'text-red-600'
          )}>
            {trendValue}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== KPI Card ==========

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

// ========== Root Cause Narrative ==========

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
