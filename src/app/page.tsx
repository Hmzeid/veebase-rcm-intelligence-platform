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
import { SettingsView } from '@/components/rcm/settings/settings-view';
import { NotificationSystem } from '@/components/rcm/layout/notification-system';
import { motion, AnimatePresence } from 'framer-motion';

const viewMap: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  agents: AgentsView,
  claims: ClaimsView,
  escalations: EscalationsView,
  audit: AuditView,
  'payer-rules': PayerRulesPanel,
  analytics: AnalyticsView,
  chat: ChatView,
  settings: SettingsView,
};

export default function Home() {
  const { activeView } = useRCMStore();
  const ActiveView = viewMap[activeView] ?? DashboardView;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <SidebarNav />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <ActiveView />
            </motion.div>
          </AnimatePresence>
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
