'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { CLAIMS_BY_STAGE, PAYER_MIX } from '@/lib/rcm-data';
import { cn } from '@/lib/utils';
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { ArrowRight, Clock, AlertTriangle, DollarSign, Users } from 'lucide-react';

export function ClaimPipeline() {
  const { claims, setActiveView } = useRCMStore();

  // Count claims by status
  const statusCounts = CLAIMS_BY_STAGE;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Pipeline Funnel */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Claims Pipeline</CardTitle>
            <button
              onClick={() => setActiveView('claims')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View Details →
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 10 }}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Payer Mix + Quick Stats */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Payer Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PAYER_MIX}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {PAYER_MIX.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <QuickStat
              icon={Clock}
              label="AR Days"
              value="42"
              target="≤40"
              status="warning"
            />
            <QuickStat
              icon={AlertTriangle}
              label="Claims at Risk"
              value="12"
              target="minimize"
              status="warning"
            />
            <QuickStat
              icon={DollarSign}
              label="Revenue Month"
              value="EGP 4.9M"
              target="88.8% collected"
              status="good"
            />
            <QuickStat
              icon={Users}
              label="Active Agents"
              value="8/12"
              target="operational"
              status="good"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  target,
  status,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  target: string;
  status: 'good' | 'warning' | 'bad';
}) {
  const statusColor =
    status === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : status === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-3.5 h-3.5', statusColor)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">{value}</span>
        <span className="text-[10px] text-muted-foreground">{target}</span>
      </div>
    </div>
  );
}


