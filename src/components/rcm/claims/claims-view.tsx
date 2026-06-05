'use client';

import { useState } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
import { apiProcessClaim } from '@/lib/rcm-sync';
import { useI18n } from '@/lib/i18n';
import { AgentOutput, AppealStrategy, ClaimRecord, ClaimStatus, ConfidenceLevel, STATUS_COLORS, PIPELINE_STAGES } from '@/lib/rcm-types';
import { CLAIM_AGENT_OUTPUTS, APPEAL_STRATEGIES } from '@/lib/rcm-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  Bot,
  AlertTriangle,
  GitBranch,
  RotateCcw,
  Target,
  FileCheck,
  Sparkles,
  Zap,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ClaimSubmitDialog } from './claim-submit-dialog';

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

const agentDisplayNames: Record<string, string> = {
  EligibilityBenefits: 'Eligibility & Benefits',
  PriorAuthorization: 'Prior Authorization',
  ChargeCapture: 'Charge Capture',
  MedicalCoding: 'Medical Coding',
  ClaimScrubSubmit: 'Claim Scrubbing & Submit',
  DenialPrediction: 'Denial Prediction',
  DenialManagement: 'Denial Management',
  PaymentPosting: 'Payment Posting',
  PatientBilling: 'Patient Billing',
  FraudWasteAbuse: 'Fraud, Waste & Abuse',
  PayerContractRules: 'Payer Contract & Rules',
  AnalyticsReporting: 'Analytics & Reporting',
};

const confidenceColors: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  LOW: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  INSUFFICIENT_DATA: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

const hitlGateColors: Record<string, string> = {
  APPROVE: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  REVIEW: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
  AUTO: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300',
};

const strategyColors: Record<string, string> = {
  A: 'border-sky-300 bg-sky-50 dark:bg-sky-950/30',
  B: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30',
  C: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
  D: 'border-violet-300 bg-violet-50 dark:bg-violet-950/30',
  E: 'border-rose-300 bg-rose-50 dark:bg-rose-950/30',
};

const strategyIcons: Record<string, React.ElementType> = {
  A: FileCheck,
  B: MessageSquare,
  C: Shield,
  D: GitBranch,
  E: AlertTriangle,
};

export function ClaimsView() {
  const { claims, claimStatusFilter, setClaimStatusFilter, claimSearchQuery, setClaimSearchQuery, selectedClaim, setSelectedClaim } = useRCMStore();
  const { t } = useI18n();

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
            placeholder={t.claims.search}
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
            <SelectValue placeholder={t.claims.filterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.claims.allStatuses}</SelectItem>
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
        <ClaimSubmitDialog />
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
          {filteredClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm font-semibold text-muted-foreground">{t.claims.noClaimsFound}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{t.claims.tryAdjusting}</p>
            </div>
          ) : (
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t.claims.claimNumber}</TableHead>
                  <TableHead className="text-xs">{t.claims.patient}</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">{t.claims.payer}</TableHead>
                  <TableHead className="text-xs">{t.claims.status}</TableHead>
                  <TableHead className="text-xs text-right">{t.claims.amount}</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">{t.claims.readiness}</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">{t.claims.risk}</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">{t.claims.serviceDate}</TableHead>
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
          )}
        </CardContent>
      </Card>

      {/* Claim detail sheet */}
      <Sheet open={!!selectedClaim} onOpenChange={(open) => !open && setSelectedClaim(null)}>
        <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto p-0">
          <div className="p-6">
            {selectedClaim && <ClaimDetail claim={selectedClaim} />}
          </div>
        </SheetContent>
      </Sheet>
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
  const { t } = useI18n();
  const { upsertClaim, setSelectedClaim } = useRCMStore();
  const [processing, setProcessing] = useState(false);
  const statusIdx = PIPELINE_STAGES.indexOf(claim.status as ClaimStatus);

  const isTerminalClaim = ['PAID', 'CLOSED', 'WRITTEN_OFF'].includes(claim.status);

  async function runAgents() {
    setProcessing(true);
    const res = await apiProcessClaim(claim.id, 'auto');
    setProcessing(false);
    if (res?.claim) {
      upsertClaim(res.claim);
      setSelectedClaim(res.claim);
      const steps = res.stepsRun ?? res.steps?.length ?? 0;
      toast.success(`Agents advanced ${claim.claimNumber}`, {
        description: `${steps} stage(s) processed → now ${String(res.claim.status).replace('_', ' ')}.`,
      });
    } else {
      toast.error('Processing failed', { description: 'Could not run the agent pipeline for this claim.' });
    }
  }

  // Get agent outputs for this claim
  const agentOutputs = CLAIM_AGENT_OUTPUTS.filter(
    (output) => output.claim_id === claim.id
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Determine recommended appeal strategies for denied claims
  const isDenied = claim.status === 'DENIED';
  const recommendedStrategy = isDenied
    ? agentOutputs.find((o) => o.agent === 'DenialManagement')?.output as Record<string, unknown> | undefined
    : undefined;

  return (
    <div className="space-y-4">
      <SheetHeader className="p-0">
        <SheetTitle className="flex items-center gap-2 flex-wrap">
          <FileText className="w-5 h-5" />
          {claim.claimNumber}
          <Badge variant="secondary" className={cn('text-xs', STATUS_COLORS[claim.status])}>
            {claim.status.replace('_', ' ')}
          </Badge>
          {!isTerminalClaim && (
            <Button
              size="sm"
              className="h-7 text-xs ml-auto bg-violet-600 hover:bg-violet-700 text-white"
              onClick={runAgents}
              disabled={processing}
            >
              <Zap className={cn('w-3.5 h-3.5 mr-1.5', processing && 'animate-pulse')} />
              {processing ? 'Running…' : t.claims.runAgents}
            </Button>
          )}
        </SheetTitle>
      </SheetHeader>

      {/* Patient & Payer Info */}
      <div className="grid grid-cols-2 gap-4">
        <InfoBox icon={Shield} label={t.claims.patient} value={claim.patientName} sub={`ID: ${claim.nationalId}`} />
        <InfoBox icon={DollarSign} label={t.claims.payer} value={claim.payerName} sub={claim.payerType} />
      </div>

      {/* Financial Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold">EGP {claim.totalAmount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{t.claims.billed}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-600">EGP {claim.paidAmount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{t.claims.paid}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-600">EGP {claim.patientResponsibility.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{t.claims.patientResponsibility}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Progress */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">{t.claims.workflowProgress}</p>
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
          <p className="text-xs font-semibold text-muted-foreground mb-1">{t.claims.claimReadiness}</p>
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
          <p className="text-xs font-semibold text-muted-foreground mb-1">{t.claims.denialRisk}</p>
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
                <span className="text-xs font-semibold">{t.claims.priorAuth}</span>
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
        <span className="text-xs font-semibold">{t.claims.hitlGate}</span>
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

      {/* Processing Timeline */}
      {agentOutputs.length > 0 && (
        <ProcessingTimeline outputs={agentOutputs} claimAmount={claim.totalAmount} />
      )}

      {/* Appeal Strategy Panel (only for denied claims) */}
      {isDenied && (
        <AppealStrategyPanel
          claim={claim}
          recommendedStrategyKey={recommendedStrategy?.appealStrategy as string | undefined}
        />
      )}
    </div>
  );
}

// ========== Processing Timeline Component ==========
function ProcessingTimeline({ outputs, claimAmount }: { outputs: AgentOutput[]; claimAmount: number }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">{t.claims.processingTimeline}</p>
        <Badge variant="outline" className="text-[9px] h-4 border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
          {outputs.length} {t.claims.agentOutputs}
        </Badge>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-0">
          {outputs.map((output, idx) => (
            <TimelineEntry
              key={`${output.agent}-${output.timestamp}`}
              output={output}
              isLast={idx === outputs.length - 1}
              claimAmount={claimAmount}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineEntry({ output, isLast, claimAmount }: { output: AgentOutput; isLast: boolean; claimAmount: number }) {
  const displayName = agentDisplayNames[output.agent] || output.agent;
  const hasEscalation = output.escalation_required;
  const isFraudFlag = output.tags.includes('FRAUD_SENTINEL') || output.tags.includes('PHANTOM_BILLING');

  return (
    <div className={cn('relative flex gap-3', !isLast && 'pb-3')}>
      {/* Timeline dot */}
      <div className="relative z-10 flex-shrink-0 mt-1">
        <div
          className={cn(
            'w-[22px] h-[22px] rounded-full flex items-center justify-center border-2',
            hasEscalation
              ? 'bg-red-100 border-red-400 dark:bg-red-950 dark:border-red-600'
              : isFraudFlag
              ? 'bg-rose-100 border-rose-400 dark:bg-rose-950 dark:border-rose-600'
              : 'bg-emerald-100 border-emerald-400 dark:bg-emerald-950 dark:border-emerald-600'
          )}
        >
          {hasEscalation ? (
            <AlertTriangle className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />
          ) : isFraudFlag ? (
            <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
          ) : (
            <Bot className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        'flex-1 p-3 rounded-lg border text-xs',
        hasEscalation
          ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30'
          : isFraudFlag
          ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30'
          : 'border-border bg-card'
      )}>
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs">{displayName}</span>
            <Badge
              variant="outline"
              className={cn('text-[9px] h-4 px-1.5', confidenceColors[output.confidence])}
            >
              {output.confidence}
            </Badge>
            <Badge
              variant="outline"
              className={cn('text-[9px] h-4 px-1.5', hitlGateColors[output.hitl_gate])}
            >
              {output.hitl_gate === 'APPROVE' ? 'HITL: Approve' :
               output.hitl_gate === 'REVIEW' ? 'HITL: Review' : 'HITL: Auto'}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {format(new Date(output.timestamp), 'MMM d, HH:mm')}
          </span>
        </div>

        {/* Output summary */}
        <OutputSummary output={output} claimAmount={claimAmount} />

        {/* Rationale */}
        <div className="mt-2 p-2 rounded bg-muted/50 dark:bg-muted/20">
          <div className="flex items-start gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Rationale</p>
              <p className="text-[11px] leading-relaxed">{output.rationale}</p>
            </div>
          </div>
        </div>

        {/* Recommended action */}
        <div className="mt-1.5 flex items-start gap-1.5">
          <Target className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-[10px] font-medium text-muted-foreground">Recommended: </span>
            <span className="text-[11px]">{output.recommended_action}</span>
          </div>
        </div>

        {/* Escalation notice */}
        {hasEscalation && output.escalation_reason && (
          <div className="mt-2 flex items-start gap-1.5 p-2 rounded bg-red-100/60 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
            <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-red-800 dark:text-red-300 font-medium">{output.escalation_reason}</p>
          </div>
        )}

        {/* Tags */}
        {output.tags.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {output.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn(
                  'text-[8px] h-3.5 px-1',
                  tag === 'COMPLIANCE_FLAG' && 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300',
                  tag === 'FRAUD_SENTINEL' && 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300',
                  tag === 'PHANTOM_BILLING' && 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300',
                  tag === 'UPCODING_REVIEW' && 'border-orange-300 text-orange-700 bg-orange-50 dark:bg-orange-950 dark:text-orange-300',
                  tag === 'HIGH_VALUE_REVIEW' && 'border-orange-300 text-orange-700 bg-orange-50 dark:bg-orange-950 dark:text-orange-300',
                  tag === 'URGENT_AUTH' && 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300',
                  tag === 'TIMELY_FILING_RISK' && 'border-red-300 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300',
                  tag === 'APPEAL_DEADLINE_RISK' && 'border-red-300 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300',
                  tag === 'UNDERPAYMENT' && 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300',
                  tag === 'HFCX_SUBMIT' && 'border-teal-300 text-teal-700 bg-teal-50 dark:bg-teal-950 dark:text-teal-300',
                  tag === 'CLEAN_CLAIM' && 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300',
                  tag === 'LOW_RISK' && 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300',
                )}
              >
                {tag.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OutputSummary({ output, claimAmount }: { output: AgentOutput; claimAmount: number }) {
  const out = output.output;

  // Render key output fields based on agent type
  if (output.agent === 'EligibilityBenefits') {
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">Coverage</p>
          <p className="text-xs font-semibold text-emerald-600">{out.coverageVerified ? 'Verified' : 'Failed'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Copay</p>
          <p className="text-xs font-semibold">EGP {(out.copayAmount as number)?.toLocaleString?.() ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Benefits Left</p>
          <p className="text-xs font-semibold">EGP {(out.benefitsRemaining as number)?.toLocaleString?.() ?? '—'}</p>
        </div>
      </div>
    );
  }

  if (output.agent === 'PriorAuthorization') {
    const authStatus = out.authStatus as string;
    return (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Auth Status</p>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] h-4',
              authStatus === 'APPROVED' && 'border-emerald-300 text-emerald-700',
              authStatus === 'DENIED' && 'border-red-300 text-red-700',
              authStatus === 'PENDING' && 'border-amber-300 text-amber-700',
              authStatus === 'NOT_REQUIRED' && 'border-sky-300 text-sky-700',
            )}
          >
            {authStatus?.replace('_', ' ') ?? 'N/A'}
          </Badge>
        </div>
        {out.authNumber && (
          <div>
            <p className="text-[10px] text-muted-foreground">Auth #</p>
            <p className="text-xs font-mono font-semibold">{out.authNumber as string}</p>
          </div>
        )}
        {out.denialCode && (
          <div>
            <p className="text-[10px] text-muted-foreground">Denial Code</p>
            <p className="text-xs font-semibold text-red-600">{out.denialCode as string}</p>
          </div>
        )}
      </div>
    );
  }

  if (output.agent === 'ChargeCapture') {
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">Charges</p>
          <p className="text-xs font-semibold">{out.chargesCaptured as number}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Captured</p>
          <p className="text-xs font-semibold">EGP {(out.totalCaptured as number)?.toLocaleString?.()}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Missing</p>
          <p className={cn('text-xs font-semibold', (out.missingCharges as number) > 0 ? 'text-red-600' : 'text-emerald-600')}>
            {out.missingCharges as number}
          </p>
        </div>
      </div>
    );
  }

  if (output.agent === 'MedicalCoding') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">ICD-10</p>
          <p className="text-xs font-mono font-semibold">{(out.icd10Codes as string[])?.join(', ') ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">CPT</p>
          <p className="text-xs font-mono font-semibold">{(out.cptCodes as string[])?.join(', ') ?? '—'}</p>
        </div>
      </div>
    );
  }

  if (output.agent === 'ClaimScrubSubmit') {
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">Readiness</p>
          <p className="text-xs font-semibold text-emerald-600">{out.readinessScore as number}%</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Scrub</p>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] h-4',
              (out.scrubResult as string) === 'PASS'
                ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                : 'border-red-300 text-red-700 bg-red-50'
            )}
          >
            {out.scrubResult as string}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Method</p>
          <p className="text-xs font-semibold">{out.submissionMethod as string}</p>
        </div>
      </div>
    );
  }

  if (output.agent === 'DenialPrediction') {
    const prob = out.denialProbability as number;
    return (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Denial Probability</p>
          <div className="flex items-center gap-2">
            <Progress
              value={prob}
              className={cn(
                'h-1.5 flex-1',
                prob >= 60 ? '[&>div]:bg-red-500' :
                prob >= 30 ? '[&>div]:bg-amber-500' :
                '[&>div]:bg-emerald-500'
              )}
            />
            <span className="text-xs font-bold">{prob}%</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Risk Factors</p>
          <p className="text-xs font-semibold">{(out.riskFactors as string[])?.length ?? 0} factors</p>
        </div>
      </div>
    );
  }

  if (output.agent === 'DenialManagement') {
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">Classification</p>
          <p className="text-xs font-semibold">{(out.denialClassification as string)?.replace(/_/g, ' ') ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Strategy</p>
          <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300">
            Strategy {out.appealStrategy as string}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Recovery Est.</p>
          <p className="text-xs font-semibold text-emerald-600">{Math.round((out.estimatedRecovery as number) * 100)}%</p>
        </div>
      </div>
    );
  }

  if (output.agent === 'PaymentPosting') {
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">Posted</p>
          <p className="text-xs font-semibold">EGP {(out.postedAmount as number)?.toLocaleString?.()}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Contracted</p>
          <p className="text-xs font-semibold">EGP {(out.contractedAmount as number)?.toLocaleString?.()}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Variance</p>
          <p className={cn(
            'text-xs font-semibold',
            (out.variance as number) < 0 ? 'text-red-600' : 'text-emerald-600'
          )}>
            EGP {(out.variance as number)?.toLocaleString?.()}
          </p>
        </div>
      </div>
    );
  }

  if (output.agent === 'FraudWasteAbuse') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Pattern</p>
          <p className="text-xs font-semibold text-red-600">{(out.pattern as string)?.replace(/_/g, ' ') ?? 'N/A'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Severity</p>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] h-4',
              (out.severity as string) === 'CRITICAL' && 'border-rose-300 text-rose-700 bg-rose-50',
              (out.severity as string) === 'HIGH' && 'border-red-300 text-red-700 bg-red-50',
              (out.severity as string) === 'MEDIUM' && 'border-amber-300 text-amber-700 bg-amber-50',
            )}
          >
            {out.severity as string}
          </Badge>
        </div>
      </div>
    );
  }

  // Default: show output keys
  return (
    <div className="text-[10px] text-muted-foreground">
      {Object.keys(out).slice(0, 4).map((key) => (
        <span key={key} className="mr-3">
          <span className="font-medium">{key}:</span> {String(out[key])}
        </span>
      ))}
    </div>
  );
}

// ========== Appeal Strategy Panel ==========
function AppealStrategyPanel({ claim, recommendedStrategyKey }: { claim: ClaimRecord; recommendedStrategyKey?: string }) {
  const { t } = useI18n();
  // Determine which strategies are most relevant based on denial info
  const getRecommendedStrategies = () => {
    if (recommendedStrategyKey) {
      return APPEAL_STRATEGIES.map((s) => ({
        ...s,
        isRecommended: s.strategyKey === recommendedStrategyKey,
      }));
    }
    // Default: recommend based on tags
    const hasAuthIssue = claim.tags.includes('URGENT_AUTH');
    const defaultKey = hasAuthIssue ? 'B' : 'A';
    return APPEAL_STRATEGIES.map((s) => ({
      ...s,
      isRecommended: s.strategyKey === defaultKey,
    }));
  };

  const strategies = getRecommendedStrategies();

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-3.5 h-3.5 text-red-500" />
        <p className="text-xs font-semibold text-muted-foreground">{t.claims.appealStrategies}</p>
        <Badge variant="outline" className="text-[9px] h-4 border-red-300 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
          {t.claims.deniedClaim}
        </Badge>
      </div>

      <div className="space-y-2">
        {strategies.map((strategy) => (
          <AppealStrategyCard
            key={strategy.id}
            strategy={strategy}
            claim={claim}
            isRecommended={strategy.isRecommended}
          />
        ))}
      </div>

      {/* Appeal deadline warning */}
      {claim.appealDeadline && (
        <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              {t.claims.appealDeadline}: {format(new Date(claim.appealDeadline), 'MMM d, yyyy')}
            </p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              {t.claims.fileBefore}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function handleDraftAppeal(strategy: AppealStrategy & { isRecommended: boolean }, claim: ClaimRecord) {
  const doc = `# APPEAL LETTER — ${claim.claimNumber}

## Strategy: ${strategy.name} (${strategy.strategyKey})

**Date:** ${new Date().toLocaleDateString('en-EG')}
**Claim Number:** ${claim.claimNumber}
**Patient:** ${claim.patientName}
**Payer:** ${claim.payerName}
**Billed Amount:** EGP ${claim.totalAmount.toLocaleString()}
**Estimated Recovery:** EGP ${Math.round(claim.totalAmount * strategy.estimatedRecoveryPct / 100).toLocaleString()} (${strategy.estimatedRecoveryPct}%)
**Success Probability:** ${strategy.successProbability}%
**Estimated Timeline:** ${strategy.estimatedDays} days

---

## Denial Background

${strategy.description}

## Required Documents

${strategy.requiredDocuments.map(d => `- [ ] ${d}`).join('\n')}

---

## Appeal Body

Dear [Payer Name] Review Committee,

We are writing to appeal the denial of claim **${claim.claimNumber}** for patient **[REDACTED]**, rendered on **${new Date(claim.serviceDate).toLocaleDateString('en-EG')}**.

[Provide clinical rationale and supporting evidence here]

We believe this claim was denied in error based on the following grounds:

1. [Ground 1 — insert specific contractual or clinical basis]
2. [Ground 2 — cite relevant NHIA/payer policy]
3. [Ground 3 — reference clinical guidelines]

We respectfully request reinstatement of benefits for the services rendered, totaling **EGP ${claim.totalAmount.toLocaleString()}**.

Sincerely,

[Provider Name]
[Title]
[Facility Name]
[Date]

---
*Generated by Veebase RCM Intelligence Platform — ${strategy.name}*
*Confidence: ${strategy.successProbability}% | Recovery Estimate: EGP ${Math.round(claim.totalAmount * strategy.estimatedRecoveryPct / 100).toLocaleString()}*
`;

  const blob = new Blob([doc], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `appeal-${claim.claimNumber}-strategy-${strategy.strategyKey}.md`;
  a.click();
  URL.revokeObjectURL(url);

  toast.success(`Appeal drafted: ${strategy.name} — EGP ${Math.round(claim.totalAmount * strategy.estimatedRecoveryPct / 100).toLocaleString()} estimated recovery`);
}

function AppealStrategyCard({
  strategy,
  claim,
  isRecommended,
}: {
  strategy: AppealStrategy & { isRecommended: boolean };
  claim: ClaimRecord;
  isRecommended: boolean;
}) {
  const Icon = strategyIcons[strategy.strategyKey] || FileCheck;
  const claimAmount = claim.totalAmount;
  const estimatedRecovery = Math.round(claimAmount * strategy.estimatedRecoveryPct / 100);

  return (
    <Card
      className={cn(
        'border transition-all',
        strategyColors[strategy.strategyKey],
        isRecommended && 'ring-2 ring-emerald-400 dark:ring-emerald-600'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <div className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5',
              strategy.strategyKey === 'A' && 'bg-sky-100 dark:bg-sky-950',
              strategy.strategyKey === 'B' && 'bg-emerald-100 dark:bg-emerald-950',
              strategy.strategyKey === 'C' && 'bg-amber-100 dark:bg-amber-950',
              strategy.strategyKey === 'D' && 'bg-violet-100 dark:bg-violet-950',
              strategy.strategyKey === 'E' && 'bg-rose-100 dark:bg-rose-950',
            )}>
              <Icon className={cn(
                'w-3.5 h-3.5',
                strategy.strategyKey === 'A' && 'text-sky-600 dark:text-sky-400',
                strategy.strategyKey === 'B' && 'text-emerald-600 dark:text-emerald-400',
                strategy.strategyKey === 'C' && 'text-amber-600 dark:text-amber-400',
                strategy.strategyKey === 'D' && 'text-violet-600 dark:text-violet-400',
                strategy.strategyKey === 'E' && 'text-rose-600 dark:text-rose-400',
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">
                  Strategy {strategy.strategyKey}: {strategy.name}
                </span>
                {isRecommended && (
                  <Badge className="text-[8px] h-3.5 px-1 bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700">
                    RECOMMENDED
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                {strategy.description}
              </p>

              {/* Metrics row */}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Success:</span>
                  <span className={cn(
                    'text-[10px] font-bold',
                    strategy.successProbability >= 60 ? 'text-emerald-600' :
                    strategy.successProbability >= 40 ? 'text-amber-600' :
                    'text-red-600'
                  )}>
                    {strategy.successProbability}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-muted-foreground">Recovery:</span>
                  <span className="text-[10px] font-bold">EGP {estimatedRecovery.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-sky-500" />
                  <span className="text-[10px] text-muted-foreground">~{strategy.estimatedDays}d</span>
                </div>
              </div>

              {/* Required documents */}
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                <FileCheck className="w-2.5 h-2.5 text-muted-foreground" />
                {strategy.requiredDocuments.slice(0, 2).map((doc) => (
                  <Badge key={doc} variant="outline" className="text-[8px] h-3 px-1">
                    {doc.length > 25 ? doc.slice(0, 25) + '...' : doc}
                  </Badge>
                ))}
                {strategy.requiredDocuments.length > 2 && (
                  <span className="text-[8px] text-muted-foreground">+{strategy.requiredDocuments.length - 2} more</span>
                )}
              </div>
            </div>
          </div>

          {/* Draft Appeal button */}
          <Button
            size="sm"
            variant={isRecommended ? 'default' : 'outline'}
            className={cn(
              'text-[10px] h-7 px-2.5 flex-shrink-0',
              isRecommended && 'bg-emerald-600 hover:bg-emerald-700 text-white'
            )}
            onClick={() => handleDraftAppeal(strategy, claim)}
          >
            <Zap className="w-3 h-3 mr-1" />
            Draft Appeal
          </Button>
        </div>
      </CardContent>
    </Card>
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
