'use client';

import { useState, useEffect } from 'react';
import { KPIGrid } from './kpi-cards';
import { AgentStatusGrid } from './agent-status-grid';
import { ClaimPipeline } from './claim-pipeline';
import { RecentActivity } from './recent-activity';
import { HitlGateMatrix } from './hitl-gate-matrix';
import { DashboardHero } from './dashboard-hero';
import { useAgentSimulation } from './use-agent-simulation';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Hero skeleton */}
      <Skeleton className="h-32 w-full rounded-xl" />

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-2 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardView() {
  // Enable live agent simulation
  useAgentSimulation(true);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Hero banner */}
      <DashboardHero />

      {/* KPIs */}
      <KPIGrid />

      {/* Agent Status + Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AgentStatusGrid />
        <ClaimPipeline />
      </div>

      {/* HITL Gate Matrix */}
      <HitlGateMatrix />

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}
