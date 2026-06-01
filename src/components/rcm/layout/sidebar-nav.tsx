'use client';

import { useRCMStore } from '@/lib/rcm-store';
import type { ViewMode } from '@/lib/rcm-store';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const navItems: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'claims', label: 'Claims Pipeline', icon: FileText },
  { id: 'escalations', label: 'Escalations', icon: AlertOctagon },
  { id: 'audit', label: 'Audit Trail', icon: ClipboardList },
  { id: 'payer-rules', label: 'Payer Rules', icon: BookOpen },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function SidebarNav() {
  const { activeView, setActiveView, escalations, claims } = useRCMStore();
  const pendingEscalations = escalations.filter((e) => e.status === 'PENDING').length;
  const activeClaims = claims.filter(
    (c) => !['PAID', 'CLOSED', 'WRITTEN_OFF'].includes(c.status)
  ).length;

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-card h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">Veebase</h1>
          <p className="text-[11px] text-muted-foreground -mt-0.5">RCM Intelligence</p>
        </div>
      </div>

      <Separator />

      {/* System Status */}
      <div className="px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3 h-3 text-emerald-500" />
          <span>Phase 1 — Assistive Mode</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>HFCX Connected</span>
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
              <span className="flex-1 text-left">{item.label}</span>
              {badge > 0 && (
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
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Prohibited Actions Guard</span>
            <Badge className="text-[8px] h-3.5 px-1 bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700">
              ACTIVE
            </Badge>
          </div>
          <div className="space-y-1">
            {[
              'No Auto-Accept Coding',
              'No Auto-Write-Off',
              'No Auto-Escalate to L5',
              'No Suppress Fraud Flags',
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
          <p>Egypt · NHIA / HFCX</p>
          <p>FHIR R4 · JWE Protected</p>
          <p>v1.0 · May 2026</p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { activeView, setActiveView, escalations } = useRCMStore();
  const pendingEscalations = escalations.filter((e) => e.status === 'PENDING').length;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
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
                {item.id === 'escalations' && pendingEscalations > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {pendingEscalations}
                  </span>
                )}
              </div>
              <span>{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
