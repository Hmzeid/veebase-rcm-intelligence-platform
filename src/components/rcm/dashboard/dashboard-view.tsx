'use client';

import { KPIGrid } from './kpi-cards';
import { AgentStatusGrid } from './agent-status-grid';
import { ClaimPipeline } from './claim-pipeline';
import { RecentActivity } from './recent-activity';
import { HitlGateMatrix } from './hitl-gate-matrix';
import { DashboardHero } from './dashboard-hero';
import { useAgentSimulation } from './use-agent-simulation';

export function DashboardView() {
  // Enable live agent simulation
  useAgentSimulation(true);

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
