'use client';

import { useRCMStore } from '@/lib/rcm-store';
import { ClaimRecord, ClaimStatus, STATUS_COLORS, PIPELINE_STAGES } from '@/lib/rcm-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  ArrowRight,
  CheckCircle2,
  Clock,
  ChevronRight,
  FileText,
  Shield,
  Calendar,
  DollarSign,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const statusLabels: Record<ClaimStatus, string> = {
  ELIGIBILITY: 'Eligibility Check',
  PRIOR_AUTH: 'Prior Authorization',
  CHARGE_CAPTURE: 'Charge Capture',
  CODING: 'Medical Coding',
  SCRUBBING: 'Claim Scrubbing',
  SUBMITTED: 'Submitted',
  ADJUDICATION: 'Adjudication',
  REMITTANCE: 'Remittance',
  DENIED: 'Denied',
  PAID: 'Paid',
  CLOSED: 'Closed',
  WRITTEN_OFF: 'Written Off',
};

export function ClaimsView() {
  const { claims, claimStatusFilter, setClaimStatusFilter, claimSearchQuery, setClaimSearchQuery, selectedClaim, setSelectedClaim } = useRCMStore();

  const filteredClaims = claims.filter((claim) => {
    const matchesStatus = claimStatusFilter === 'ALL' || claim.status === claimStatusFilter;
    const matchesSearch =
      !claimSearchQuery ||
      claim.claimNumber.toLowerCase().includes(claimSearchQuery.toLowerCase()) ||
      claim.patientName.toLowerCase().includes(claimSearchQuery.toLowerCase()) ||
      claim.payerName.toLowerCase().includes(claimSearchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search claims, patients, payers..."
            value={claimSearchQuery}
            onChange={(e) => setClaimSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select
          value={claimStatusFilter}
          onValueChange={(v) => setClaimStatusFilter(v as ClaimStatus | 'ALL')}
        >
          <SelectTrigger className="w-full sm:w-48 h-9">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {PIPELINE_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {statusLabels[stage]}
              </SelectItem>
            ))}
            <SelectItem value="DENIED">Denied</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline progress bar */}
      <PipelineProgress claims={claims} />

      {/* Claims table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Claims ({filteredClaims.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Claim #</TableHead>
                  <TableHead className="text-xs">Patient</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Payer</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Readiness</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Risk</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Service Date</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <ClaimRow
                    key={claim.id}
                    claim={claim}
                    onClick={() => setSelectedClaim(claim)}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Claim detail dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={(open) => !open && setSelectedClaim(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedClaim && <ClaimDetail claim={selectedClaim} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PipelineProgress({ claims }: { claims: ClaimRecord[] }) {
  const stageCounts = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: claims.filter((c) => c.status === stage).length,
  }));
  const total = claims.length;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {stageCounts.map((item, idx) => {
        const pct = total > 0 ? (item.count / total) * 100 : 0;
        return (
          <div key={item.stage} className="flex items-center gap-1">
            <div className="flex flex-col items-center min-w-[60px]">
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    idx < 2 ? 'bg-sky-500' :
                    idx < 4 ? 'bg-amber-500' :
                    idx < 6 ? 'bg-teal-500' :
                    'bg-emerald-500'
                  )}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5 text-center leading-tight">
                {item.stage.replace('_', ' ')}
              </span>
              <span className="text-[10px] font-bold">{item.count}</span>
            </div>
            {idx < stageCounts.length - 1 && (
              <ArrowRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClaimRow({ claim, onClick }: { claim: ClaimRecord; onClick: () => void }) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-accent/50"
      onClick={onClick}
    >
      <TableCell className="text-xs font-mono font-medium">{claim.claimNumber}</TableCell>
      <TableCell>
        <div>
          <p className="text-xs font-medium">{claim.patientName}</p>
          <p className="text-[10px] text-muted-foreground">{claim.nationalId.slice(0, 6)}...</p>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge
          variant="outline"
          className={cn(
            'text-[9px] h-4',
            claim.payerType === 'NHIA' && 'border-emerald-300 text-emerald-700 bg-emerald-50',
            claim.payerType === 'PRIVATE' && 'border-amber-300 text-amber-700 bg-amber-50',
            claim.payerType === 'SELF_PAY' && 'border-gray-300 text-gray-700 bg-gray-50'
          )}
        >
          {claim.payerId}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={cn('text-[10px] h-5', STATUS_COLORS[claim.status])}
        >
          {claim.status.replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-right font-mono">
        EGP {claim.totalAmount.toLocaleString()}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <Progress
            value={claim.readinessScore}
            className={cn(
              'h-1.5 w-16',
              claim.readinessScore >= 90 ? '[&>div]:bg-emerald-500' :
              claim.readinessScore >= 70 ? '[&>div]:bg-amber-500' :
              '[&>div]:bg-red-500'
            )}
          />
          <span className="text-[10px] font-medium">{claim.readinessScore}%</span>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              claim.denialRiskScore >= 60 ? 'bg-red-500' :
              claim.denialRiskScore >= 30 ? 'bg-amber-500' :
              'bg-emerald-500'
            )}
          />
          <span className="text-[10px]">{claim.denialRiskScore}%</span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-[10px] text-muted-foreground">
        {format(new Date(claim.serviceDate), 'MMM d')}
      </TableCell>
      <TableCell>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

function ClaimDetail({ claim }: { claim: ClaimRecord }) {
  const statusIdx = PIPELINE_STAGES.indexOf(claim.status as ClaimStatus);

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {claim.claimNumber}
          <Badge variant="secondary" className={cn('text-xs', STATUS_COLORS[claim.status])}>
            {claim.status.replace('_', ' ')}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      {/* Patient & Payer Info */}
      <div className="grid grid-cols-2 gap-4">
        <InfoBox icon={Shield} label="Patient" value={claim.patientName} sub={`ID: ${claim.nationalId}`} />
        <InfoBox icon={DollarSign} label="Payer" value={claim.payerName} sub={claim.payerType} />
      </div>

      {/* Financial Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold">EGP {claim.totalAmount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Billed</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-600">EGP {claim.paidAmount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Paid</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-600">EGP {claim.patientResponsibility.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Patient Responsibility</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Progress */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Workflow Progress</p>
        <div className="flex items-center gap-0.5 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, idx) => (
            <div key={stage} className="flex items-center gap-0.5">
              <div
                className={cn(
                  'flex flex-col items-center min-w-[56px] p-1.5 rounded-md',
                  idx < statusIdx ? 'bg-emerald-100 dark:bg-emerald-950' :
                  idx === statusIdx ? 'bg-sky-100 dark:bg-sky-950 ring-1 ring-sky-300' :
                  'bg-muted/50'
                )}
              >
                {idx < statusIdx ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                ) : idx === statusIdx ? (
                  <Clock className="w-3 h-3 text-sky-600" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                )}
                <span className="text-[8px] mt-0.5 text-center leading-tight font-medium">
                  {stage.replace('_', ' ')}
                </span>
              </div>
              {idx < PIPELINE_STAGES.length - 1 && (
                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/30 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Claim Readiness</p>
          <div className="flex items-center gap-2">
            <Progress
              value={claim.readinessScore}
              className={cn(
                'h-2 flex-1',
                claim.readinessScore >= 90 ? '[&>div]:bg-emerald-500' :
                claim.readinessScore >= 70 ? '[&>div]:bg-amber-500' :
                '[&>div]:bg-red-500'
              )}
            />
            <span className="text-sm font-bold">{claim.readinessScore}%</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Denial Risk</p>
          <div className="flex items-center gap-2">
            <Progress
              value={claim.denialRiskScore}
              className={cn(
                'h-2 flex-1',
                claim.denialRiskScore >= 60 ? '[&>div]:bg-red-500' :
                claim.denialRiskScore >= 30 ? '[&>div]:bg-amber-500' :
                '[&>div]:bg-emerald-500'
              )}
            />
            <span className="text-sm font-bold">{claim.denialRiskScore}%</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      {claim.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3 h-3 text-muted-foreground" />
          {claim.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                'text-[10px]',
                tag === 'HIGH_VALUE_REVIEW' && 'border-orange-300 text-orange-700 bg-orange-50',
                tag === 'TIMELY_FILING_RISK' && 'border-red-300 text-red-700 bg-red-50',
                tag === 'COMPLIANCE_FLAG' && 'border-rose-300 text-rose-700 bg-rose-50',
                tag === 'DENIAL_RISK_HIGH' && 'border-red-300 text-red-700 bg-red-50',
                tag === 'URGENT_AUTH' && 'border-amber-300 text-amber-700 bg-amber-50',
                tag === 'DUPLICATE_RISK' && 'border-violet-300 text-violet-700 bg-violet-50'
              )}
            >
              {tag.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      )}

      {/* Prior Auth */}
      {claim.priorAuthRequired && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold">Prior Authorization</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  claim.priorAuthStatus === 'APPROVED' && 'border-emerald-300 text-emerald-700',
                  claim.priorAuthStatus === 'DENIED' && 'border-red-300 text-red-700',
                  claim.priorAuthStatus === 'PENDING' && 'border-amber-300 text-amber-700',
                )}
              >
                {claim.priorAuthStatus}
              </Badge>
            </div>
            {claim.priorAuthNumber && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Auth #: {claim.priorAuthNumber}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Service:</span>
          <span className="font-medium">{format(new Date(claim.serviceDate), 'MMM d, yyyy')}</span>
        </div>
        {claim.filingDeadline && (
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Filing Deadline:</span>
            <span className="font-medium">{format(new Date(claim.filingDeadline), 'MMM d, yyyy')}</span>
          </div>
        )}
      </div>

      {/* HITL Gate */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <span className="text-xs font-semibold">HITL Gate</span>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            claim.hitlGate === 'APPROVE' && 'border-emerald-300 text-emerald-700',
            claim.hitlGate === 'REVIEW' && 'border-amber-300 text-amber-700',
            claim.hitlGate === 'AUTO' && 'border-sky-300 text-sky-700',
          )}
        >
          {claim.hitlGate}
        </Badge>
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
