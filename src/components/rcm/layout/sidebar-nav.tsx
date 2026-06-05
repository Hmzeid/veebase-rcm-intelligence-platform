'use client';

import { useState, useEffect } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
import type { ViewMode } from '@/lib/rcm-store';
import { useI18n } from '@/lib/i18n';
import {
  LayoutDashboard,
  Bot,
  FileText,
  AlertOctagon,
  BarChart3,
  MessageSquare,
  Activity,
  Shield,
  BookOpen,
  ClipboardList,
  ShieldAlert,
  CheckCircle2,
  Settings,
  Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const navItems: { id: ViewMode; labelKey: string; icon: React.ElementType }[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { id: 'agents', labelKey: 'agents', icon: Bot },
  { id: 'claims', labelKey: 'claims', icon: FileText },
  { id: 'ingestion', labelKey: 'ingestion', icon: Printer },
  { id: 'escalations', labelKey: 'escalations', icon: AlertOctagon },
  { id: 'audit', labelKey: 'audit', icon: ClipboardList },
  { id: 'payer-rules', labelKey: 'payerRules', icon: BookOpen },
  { id: 'analytics', labelKey: 'analytics', icon: BarChart3 },
  { id: 'chat', labelKey: 'chat', icon: MessageSquare },
  { id: 'settings', labelKey: 'settings', icon: Settings },
];

export function SidebarNav() {
  const { activeView, setActiveView, escalations, claims } = useRCMStore();
  const { t, isRTL, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  // One-time mount flag to avoid SSR/CSR hydration mismatch on locale/theme.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const pendingEscalations = escalations.filter((e) => e.status === 'PENDING').length;
  const activeClaims = claims.filter(
    (c) => !['PAID', 'CLOSED', 'WRITTEN_OFF'].includes(c.status)
  ).length;

  return (
    <aside className={cn(
      'hidden md:flex w-64 flex-col h-screen sticky top-0 bg-card',
      isRTL ? 'border-l' : 'border-r'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">Veebase</h1>
          <p className="text-[11px] text-muted-foreground -mt-0.5">{t.appSubtitle}</p>
        </div>
      </div>

      <Separator />

      {/* System Status */}
      <div className="px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3 h-3 text-emerald-500" />
          <span>{t.common.phase1Assistive}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{t.common.hfcxConnected}</span>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const badge =
            item.id === 'escalations' && pendingEscalations > 0
              ? pendingEscalations
              : item.id === 'claims' && activeClaims > 0
              ? activeClaims
              : 0;

          const label = t.nav[item.labelKey as keyof typeof t.nav];

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive && 'text-emerald-600 dark:text-emerald-400')} />
              <span className={cn('flex-1', isRTL ? 'text-right' : 'text-left')}>{label}</span>
              {mounted && badge > 0 && (
                <Badge
                  variant={item.id === 'escalations' ? 'destructive' : 'secondary'}
                  className="h-5 min-w-[20px] text-[10px] px-1.5"
                >
                  {badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Prohibited Actions Guard */}
      <div className="mx-3 mb-2">
        <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">{t.common.prohibitedActionsGuard}</span>
            <Badge className="text-[8px] h-3.5 px-1 bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700">
              {t.common.active}
            </Badge>
          </div>
          <div className="space-y-1">
            {[
              t.common.noAutoAcceptCoding,
              t.common.noAutoWriteOff,
              t.common.noAutoEscalateL5,
              t.common.noSuppressFraudFlags,
            ].map((rule) => (
              <div key={rule} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="text-[9px] text-emerald-700 dark:text-emerald-400 leading-tight">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t">
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <p>{t.common.egypt} · {t.common.nhia}</p>
          <p>{t.common.fhir}</p>
          <p>v1.0 · {mounted ? new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' }) : ''}</p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { activeView, setActiveView, escalations } = useRCMStore();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  // One-time mount flag to avoid SSR/CSR hydration mismatch on locale/theme.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const pendingEscalations = escalations.filter((e) => e.status === 'PENDING').length;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const label = t.nav[item.labelKey as keyof typeof t.nav];
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all',
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {mounted && item.id === 'escalations' && pendingEscalations > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {pendingEscalations}
                  </span>
                )}
              </div>
              <span>{label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
