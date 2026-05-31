'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { SidebarNav, MobileNav } from '@/components/rcm/layout/sidebar-nav';
import { Header } from '@/components/rcm/layout/header';
import { CommandPalette } from '@/components/rcm/layout/command-palette';
import { DashboardView } from '@/components/rcm/dashboard/dashboard-view';
import { AgentsView } from '@/components/rcm/agents/agents-view';
import { ClaimsView } from '@/components/rcm/claims/claims-view';
import { EscalationsView } from '@/components/rcm/escalations/escalations-view';
import { AuditView } from '@/components/rcm/audit/audit-view';
import { AnalyticsView } from '@/components/rcm/analytics/analytics-view';
import { PayerRulesPanel } from '@/components/rcm/agents/payer-rules-panel';
import { ChatView } from '@/components/rcm/chat/chat-view';
import { NotificationSystem } from '@/components/rcm/layout/notification-system';

export default function Home() {
  const { activeView } = useRCMStore();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <SidebarNav />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'agents' && <AgentsView />}
          {activeView === 'claims' && <ClaimsView />}
          {activeView === 'escalations' && <EscalationsView />}
          {activeView === 'audit' && <AuditView />}
          {activeView === 'payer-rules' && <PayerRulesPanel />}
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'chat' && <ChatView />}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Command Palette */}
      <CommandPalette />

      {/* Real-time notification toasts */}
      <NotificationSystem />
    </div>
  );
}
