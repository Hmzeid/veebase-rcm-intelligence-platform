'use client';

import { useState, useMemo } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
import type { AuditEntry } from '@/lib/rcm-types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ClipboardList,
  Download,
  Filter,
  Search,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  Send,
  FileText,
  Banknote,
  RefreshCcw,
  Cpu,
  ArrowRightLeft,
  AlertOctagon,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// Action type config
const ACTION_CONFIG: Record<AuditEntry['action'], { label: string; icon: React.ElementType; color: string }> = {
  HITL_APPROVE: { label: 'HITL Approve', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  HITL_REJECT: { label: 'HITL Reject', icon: ShieldX, color: 'bg-red-100 text-red-800 border-red-200' },
  ESCALATE: { label: 'Escalate', icon: AlertOctagon, color: 'bg-orange-100 text-orange-800 border-orange-200' },
  RESOLVE: { label: 'Resolve', icon: CheckCircle2, color: 'bg-green-100 text-green-800 border-green-200' },
  SUBMIT_CLAIM: { label: 'Submit Claim', icon: Send, color: 'bg-sky-100 text-sky-800 border-sky-200' },
  APPEAL_FILED: { label: 'Appeal Filed', icon: FileText, color: 'bg-violet-100 text-violet-800 border-violet-200' },
  PAYMENT_DISPUTE: { label: 'Payment Dispute', icon: Banknote, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  PHASE_CHANGE: { label: 'Phase Change', icon: RefreshCcw, color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  AGENT_OVERRIDE: { label: 'Agent Override', icon: Cpu, color: 'bg-rose-100 text-rose-800 border-rose-200' },
};

const RISK_COLORS: Record<AuditEntry['riskLevel'], { bg: string; border: string; dot: string; text: string }> = {
  LOW: { bg: 'bg-emerald-50', border: 'border-l-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  MEDIUM: { bg: 'bg-amber-50', border: 'border-l-amber-500', dot: 'bg-amber-500', text: 'text-amber-700' },
  HIGH: { bg: 'bg-orange-50', border: 'border-l-orange-500', dot: 'bg-orange-500', text: 'text-orange-700' },
  CRITICAL: { bg: 'bg-red-50', border: 'border-l-red-500', dot: 'bg-red-500', text: 'text-red-700' },
};

const RISK_BADGE_COLORS: Record<AuditEntry['riskLevel'], string> = {
  LOW: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export function AuditView() {
  const { auditEntries } = useRCMStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Get unique roles for filter
  const uniqueRoles = useMemo(() => {
    const roles = new Set(auditEntries.map((e) => e.actorRole));
    return Array.from(roles).sort();
  }, [auditEntries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return auditEntries
      .filter((entry) => {
        if (actionFilter !== 'ALL' && entry.action !== actionFilter) return false;
        if (riskFilter !== 'ALL' && entry.riskLevel !== riskFilter) return false;
        if (roleFilter !== 'ALL' && entry.actorRole !== roleFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            (entry.claimNumber && entry.claimNumber.toLowerCase().includes(q)) ||
            entry.details.toLowerCase().includes(q) ||
            entry.actor.toLowerCase().includes(q) ||
            entry.actorRole.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditEntries, actionFilter, riskFilter, roleFilter, searchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    const total = auditEntries.length;
    const critical = auditEntries.filter((e) => e.riskLevel === 'CRITICAL').length;
    const hitlDecisions = auditEntries.filter((e) => e.action === 'HITL_APPROVE' || e.action === 'HITL_REJECT').length;
    const pendingReviews = auditEntries.filter(
      (e) => e.action === 'ESCALATE' || e.action === 'AGENT_OVERRIDE'
    ).length;
    return { total, critical, hitlDecisions, pendingReviews };
  }, [auditEntries]);

  const handleExport = () => {
    toast.success('Audit trail exported', {
      description: `${filteredEntries.length} entries exported to CSV`,
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setActionFilter('ALL');
    setRiskFilter('ALL');
    setRoleFilter('ALL');
  };

  const hasActiveFilters = actionFilter !== 'ALL' || riskFilter !== 'ALL' || roleFilter !== 'ALL' || searchQuery !== '';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100">
                <ClipboardList className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.critical}</p>
                <p className="text-xs text-muted-foreground">Critical Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.hitlDecisions}</p>
                <p className="text-xs text-muted-foreground">HITL Decisions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingReviews}</p>
                <p className="text-xs text-muted-foreground">Pending Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claim number, details, actor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Action Filter */}
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-[180px] h-9">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actions</SelectItem>
                <SelectItem value="HITL_APPROVE">HITL Approve</SelectItem>
                <SelectItem value="HITL_REJECT">HITL Reject</SelectItem>
                <SelectItem value="ESCALATE">Escalate</SelectItem>
                <SelectItem value="RESOLVE">Resolve</SelectItem>
                <SelectItem value="SUBMIT_CLAIM">Submit Claim</SelectItem>
                <SelectItem value="APPEAL_FILED">Appeal Filed</SelectItem>
                <SelectItem value="PAYMENT_DISPUTE">Payment Dispute</SelectItem>
                <SelectItem value="PHASE_CHANGE">Phase Change</SelectItem>
                <SelectItem value="AGENT_OVERRIDE">Agent Override</SelectItem>
              </SelectContent>
            </Select>

            {/* Risk Filter */}
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full md:w-[150px] h-9">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Risk Levels</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[180px] h-9">
                <SelectValue placeholder="Actor Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                {uniqueRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export & Clear */}
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-9">
                  Clear
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport} className="h-9 gap-1.5">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Export</span>
              </Button>
            </div>
          </div>

          {/* Active filter indicators */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground">Showing {filteredEntries.length} of {auditEntries.length} entries</span>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex flex-wrap gap-1.5">
                {actionFilter !== 'ALL' && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    Action: {ACTION_CONFIG[actionFilter as AuditEntry['action']]?.label || actionFilter}
                  </Badge>
                )}
                {riskFilter !== 'ALL' && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    Risk: {riskFilter}
                  </Badge>
                )}
                {roleFilter !== 'ALL' && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    Role: {roleFilter}
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    Search: &quot;{searchQuery}&quot;
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Timeline */}
      <ScrollArea className="max-h-[calc(100vh-380px)]">
        <div className="relative space-y-0">
          {filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No audit entries found</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search query</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[23px] top-0 bottom-0 w-px bg-border hidden md:block" />

              <div className="space-y-3">
                {filteredEntries.map((entry, index) => {
                  const actionConfig = ACTION_CONFIG[entry.action];
                  const riskConfig = RISK_COLORS[entry.riskLevel];
                  const ActionIcon = actionConfig.icon;

                  return (
                    <div key={entry.id} className="relative">
                      {/* Timeline dot */}
                      <div className="hidden md:flex absolute left-[16px] top-4 z-10">
                        <div className={cn('w-[15px] h-[15px] rounded-full border-2 border-background', riskConfig.dot)} />
                      </div>

                      <Card className={cn(
                        'md:ml-12 border-l-4 transition-all hover:shadow-md',
                        riskConfig.border,
                        index === 0 && 'ring-1 ring-emerald-200'
                      )}>
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3">
                            {/* Header row */}
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                              {/* Action badge */}
                              <Badge
                                variant="outline"
                                className={cn('w-fit text-[10px] font-semibold gap-1 shrink-0', actionConfig.color)}
                              >
                                <ActionIcon className="w-3 h-3" />
                                {actionConfig.label}
                              </Badge>

                              {/* Risk level badge */}
                              <Badge
                                variant="secondary"
                                className={cn('w-fit text-[10px] font-bold h-5', RISK_BADGE_COLORS[entry.riskLevel])}
                              >
                                {entry.riskLevel}
                              </Badge>

                              {/* Timestamp */}
                              <span className="text-[11px] text-muted-foreground sm:ml-auto shrink-0">
                                {format(new Date(entry.timestamp), 'dd MMM yyyy, HH:mm')}
                              </span>
                            </div>

                            {/* Actor info */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-[10px] font-bold">
                                {entry.actor.charAt(0)}
                              </div>
                              <div>
                                <span className="text-sm font-medium">{entry.actor}</span>
                                <span className="text-xs text-muted-foreground ml-1.5">({entry.actorRole})</span>
                              </div>
                            </div>

                            {/* Claim number + Agent */}
                            <div className="flex flex-wrap items-center gap-2">
                              {entry.claimNumber && (
                                <Badge variant="outline" className="text-[10px] font-mono h-5">
                                  {entry.claimNumber}
                                </Badge>
                              )}
                              {entry.agentName && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Cpu className="w-3 h-3" />
                                  {entry.agentName}
                                </span>
                              )}
                            </div>

                            {/* Details */}
                            <p className="text-sm text-foreground/90 leading-relaxed">
                              {entry.details}
                            </p>

                            {/* Value change */}
                            {(entry.previousValue || entry.newValue) && (
                              <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-3 py-2">
                                {entry.previousValue && (
                                  <span className="text-muted-foreground line-through">{entry.previousValue}</span>
                                )}
                                {entry.previousValue && entry.newValue && (
                                  <ArrowRightLeft className="w-3 h-3 text-muted-foreground shrink-0" />
                                )}
                                {entry.newValue && (
                                  <span className="font-medium text-foreground">{entry.newValue}</span>
                                )}
                              </div>
                            )}

                            {/* Tags */}
                            {entry.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {entry.tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-[9px] h-4 px-1.5 font-mono"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
