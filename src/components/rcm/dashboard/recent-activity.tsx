'use client';

import { ESCALATIONS, CLAIMS } from '@/lib/rcm-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Send,
  RotateCcw,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'claim_submitted' | 'claim_paid' | 'claim_denied' | 'escalation' | 'auth_approved' | 'payment_posted';
  claimNumber: string;
  message: string;
  timestamp: string;
  agent?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

const activities: ActivityItem[] = [
  {
    id: '1',
    type: 'escalation',
    claimNumber: 'CLM-2026-0008',
    message: 'Phantom billing detected — charges for procedure with no clinical order',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    agent: 'FraudWasteAbuse',
    severity: 'error',
  },
  {
    id: '2',
    type: 'claim_denied',
    claimNumber: 'CLM-2026-0005',
    message: 'Prior authorization denied by NHIA — insufficient clinical documentation',
    timestamp: new Date(Date.now() - 5400000).toISOString(),
    agent: 'PriorAuthorization',
    severity: 'error',
  },
  {
    id: '3',
    type: 'claim_paid',
    claimNumber: 'CLM-2026-0014',
    message: 'Payment received: EGP 18,450 from NHIA (contracted rate matched)',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    agent: 'PaymentPosting',
    severity: 'success',
  },
  {
    id: '4',
    type: 'auth_approved',
    claimNumber: 'CLM-2026-0020',
    message: 'Prior authorization approved by MedRight TPA — valid for 30 days',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    agent: 'PriorAuthorization',
    severity: 'success',
  },
  {
    id: '5',
    type: 'claim_submitted',
    claimNumber: 'CLM-2026-0023',
    message: 'Claim submitted to NHIA via HFCX — readiness score 96%',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    agent: 'ClaimScrubSubmit',
    severity: 'info',
  },
  {
    id: '6',
    type: 'payment_posted',
    claimNumber: 'CLM-2026-0011',
    message: 'Underpayment detected: paid EGP 8,200 vs contracted EGP 9,800',
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    agent: 'PaymentPosting',
    severity: 'warning',
  },
  {
    id: '7',
    type: 'claim_submitted',
    claimNumber: 'CLM-2026-0024',
    message: 'Claim submitted to Globemed Egypt — readiness score 92%',
    timestamp: new Date(Date.now() - 21600000).toISOString(),
    agent: 'ClaimScrubSubmit',
    severity: 'info',
  },
  {
    id: '8',
    type: 'claim_paid',
    claimNumber: 'CLM-2026-0016',
    message: 'Payment received: EGP 32,100 from Globemed Egypt',
    timestamp: new Date(Date.now() - 28800000).toISOString(),
    agent: 'PaymentPosting',
    severity: 'success',
  },
];

const severityConfig = {
  info: { icon: ArrowRight, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-950' },
  success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950' },
};

export function RecentActivity() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="px-4 pb-4 space-y-2">
            {activities.map((activity) => {
              const config = severityConfig[activity.severity];
              const Icon = config.icon;

              return (
                <div
                  key={activity.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-accent/50',
                    config.bg
                  )}
                >
                  <div className={cn('mt-0.5', config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{activity.claimNumber}</span>
                      {activity.agent && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {activity.agent}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {activity.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
