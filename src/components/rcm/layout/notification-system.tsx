'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRCMStore, ActivityItem } from '@/lib/rcm-store';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';

// ── Severity config ─────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  ActivityItem['severity'],
  {
    icon: typeof AlertTriangle;
    duration: number;
    bgClass: string;
    iconColor: string;
    borderColor: string;
  }
> = {
  error: {
    icon: AlertTriangle,
    duration: Infinity, // persistent until manual dismiss
    bgClass: 'bg-red-50 dark:bg-red-950/60',
    iconColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-l-4 border-l-red-500',
  },
  warning: {
    icon: AlertCircle,
    duration: 8000,
    bgClass: 'bg-amber-50 dark:bg-amber-950/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-l-4 border-l-amber-500',
  },
  success: {
    icon: CheckCircle,
    duration: 5000,
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-l-4 border-l-emerald-500',
  },
  info: {
    icon: Info,
    duration: 5000,
    bgClass: 'bg-sky-50 dark:bg-sky-950/60',
    iconColor: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-l-4 border-l-sky-500',
  },
};

// ── View mapping ────────────────────────────────────────────────────

function getViewForActivityType(type: ActivityItem['type']): string {
  switch (type) {
    case 'claim_submitted':
    case 'claim_paid':
    case 'claim_denied':
    case 'payment_posted':
      return 'claims';
    case 'escalation':
      return 'escalations';
    case 'auth_approved':
      return 'agents';
    default:
      return 'dashboard';
  }
}

// ── Component ───────────────────────────────────────────────────────

/**
 * NotificationSystem
 *
 * Watches the Zustand store's `recentActivities` for NEW items and shows
 * Sonner toast notifications accordingly. Each toast is styled by severity
 * and includes a clickable claim number, message, and agent name.
 */
export function NotificationSystem() {
  const recentActivities = useRCMStore((s) => s.recentActivities);
  const setActiveView = useRCMStore((s) => s.setActiveView);
  const seenIdsRef = useRef<Set<string>>(new Set(recentActivities.map((a) => a.id)));

  useEffect(() => {
    const currentIds = new Set(recentActivities.map((a) => a.id));
    const seenIds = seenIdsRef.current;

    // Find new items that haven't been seen yet
    const newItems = recentActivities.filter((a) => !seenIds.has(a.id));

    // Update the seen set
    seenIdsRef.current = currentIds;

    // Show a toast for each new item
    for (const item of newItems) {
      const config = SEVERITY_CONFIG[item.severity];
      const IconComponent = config.icon;
      const targetView = getViewForActivityType(item.type);

      toast.custom(
        (t) => (
          <div
            className={`${config.bgClass} ${config.borderColor} rounded-lg shadow-lg p-4 w-full max-w-sm cursor-pointer transition-all hover:scale-[1.01]`}
            onClick={() => {
              setActiveView(targetView as 'dashboard' | 'agents' | 'claims' | 'escalations' | 'analytics' | 'chat' | 'payer-rules');
              toast.dismiss(t);
            }}
            role="alert"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
                <IconComponent className="h-5 w-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Claim number badge */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center rounded-md bg-white/80 dark:bg-white/10 px-2 py-0.5 text-xs font-mono font-semibold text-foreground/80">
                    {item.claimNumber}
                  </span>
                  {item.agent && (
                    <span className="text-[10px] text-muted-foreground font-medium truncate">
                      {item.agent}
                    </span>
                  )}
                </div>

                {/* Message */}
                <p className="text-sm text-foreground/90 leading-snug">
                  {item.message}
                </p>

                {/* Timestamp */}
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast.dismiss(t);
                }}
                className="flex-shrink-0 rounded-md p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
                aria-label="Dismiss notification"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        ),
        {
          duration: config.duration,
          position: 'bottom-right',
          unstyled: true,
        }
      );
    }
  }, [recentActivities, setActiveView]);

  return null; // This component renders nothing — only toast side effects
}
