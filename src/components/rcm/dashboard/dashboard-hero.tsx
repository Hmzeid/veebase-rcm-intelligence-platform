'use client';

import { Badge } from '@/components/ui/badge';
import { Shield, Activity, Zap, Clock } from 'lucide-react';
import { useRCMStore } from '@/lib/rcm-store';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function DashboardHero() {
  const { agents, claims, escalations } = useRCMStore();
  const { t } = useI18n();
  const activeAgents = agents.filter((a) => a.status === 'ACTIVE' || a.status === 'PROCESSING').length;
  const activeClaims = claims.filter((c) => !['PAID', 'CLOSED', 'WRITTEN_OFF'].includes(c.status)).length;
  const pendingEsc = escalations.filter((e) => e.status === 'PENDING').length;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white">
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center"
        style={{ backgroundImage: 'url(/hero-bg.png)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 via-emerald-900/80 to-transparent" />

      {/* Content */}
      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 text-[10px]">
                <Activity className="w-3 h-3 mr-1" />
                {t.dashboard.live}
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30 text-[10px]">
                <Clock className="w-3 h-3 mr-1" />
                {t.dashboard.phase1}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {t.dashboard.heroTitle}
            </h1>
            <p className="text-emerald-200/80 text-sm mt-2 leading-relaxed">
              {t.dashboard.heroDesc}
            </p>
          </div>

          {/* Status indicators */}
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex items-center gap-6">
              <StatusPill icon={Zap} label={t.dashboard.activeAgents} value={`${activeAgents}/12`} color="emerald" />
              <StatusPill icon={Activity} label={t.dashboard.liveClaims} value={String(activeClaims)} color="sky" />
              <StatusPill icon={Shield} label={t.escalations.title} value={String(pendingEsc)} color={pendingEsc > 5 ? 'red' : 'amber'} />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-200/70">{t.dashboard.hfcxConnected}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'emerald' | 'sky' | 'amber' | 'red';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/20 border-emerald-500/30',
    sky: 'bg-sky-500/20 border-sky-500/30',
    amber: 'bg-amber-500/20 border-amber-500/30',
    red: 'bg-red-500/20 border-red-500/30',
  };

  return (
    <div className={cn('flex flex-col items-center px-4 py-2 rounded-lg border', colorClasses[color])}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-white/70" />
        <span className="text-lg font-bold">{value}</span>
      </div>
      <span className="text-[10px] text-white/60">{label}</span>
    </div>
  );
}
