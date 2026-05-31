'use client';

import { KPIGrid } from './kpi-cards';
import { AgentStatusGrid } from './agent-status-grid';
import { ClaimPipeline } from './claim-pipeline';
import { RecentActivity } from './recent-activity';

export function DashboardView() {
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* KPIs */}
      <KPIGrid />

      {/* Agent Status + Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AgentStatusGrid />
        <ClaimPipeline />
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}
