'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Separator } from '@/components/ui/separator';
import { BookOpen, Search, Clock, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface PayerRule {
  queryType: string;
  payerId: string;
  result: Record<string, unknown>;
  source: string;
  effectiveDate: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  staleDataWarning: boolean;
}

const PAYER_RULES_DB: PayerRule[] = [
  {
    queryType: 'FEE_SCHEDULE',
    payerId: 'NHIA',
    result: {
      cpt: '99214',
      description: 'Office Visit - Established Patient, Moderate Complexity',
      rate: 'EGP 450',
      setting: 'OUTPATIENT',
    },
    source: 'NHIA Fee Schedule 2026 v2.1',
    effectiveDate: '2026-01-01',
    confidence: 'HIGH',
    staleDataWarning: false,
  },
  {
    queryType: 'FEE_SCHEDULE',
    payerId: 'NHIA',
    result: {
      cpt: '27447',
      description: 'Total Knee Replacement',
      rate: 'EGP 28,500',
      setting: 'INPATIENT',
    },
    source: 'NHIA Fee Schedule 2026 v2.1',
    effectiveDate: '2026-01-01',
    confidence: 'HIGH',
    staleDataWarning: false,
  },
  {
    queryType: 'AUTH_REQUIRED',
    payerId: 'NHIA',
    result: {
      rule: 'Prior authorization required for all inpatient procedures and outpatient surgical procedures with CPT codes in the 10000-69999 range',
      exceptions: 'Emergency procedures exempt with retro-auth within 48 hours',
      sla: '72 hours for standard review, 24 hours for urgent',
    },
    source: 'NHIA Policy Manual 2026 Ch.4',
    effectiveDate: '2026-01-01',
    confidence: 'HIGH',
    staleDataWarning: false,
  },
  {
    queryType: 'TIMELY_FILING',
    payerId: 'NHIA',
    result: {
      limit: '30 calendar days from date of service',
      exceptions: 'Retro-auth claims: 30 days from auth approval date',
      penalty: 'Claims filed after deadline are denied without appeal rights',
    },
    source: 'NHIA Claims Submission Guide 2026',
    effectiveDate: '2026-01-01',
    confidence: 'HIGH',
    staleDataWarning: false,
  },
  {
    queryType: 'APPEAL_RULES',
    payerId: 'NHIA',
    result: {
      deadline: '30 calendar days from denial notification',
      method: 'HFCX Claim (use=appeal) with attached supporting documentation',
      levels: 'First-level reconsideration → Second-level formal appeal → External review',
      requiredDocs: 'Original claim, denial letter, clinical documentation, peer review letter',
    },
    source: 'NHIA Appeals Process Guide 2026',
    effectiveDate: '2026-01-01',
    confidence: 'HIGH',
    staleDataWarning: false,
  },
  {
    queryType: 'COVERAGE',
    payerId: 'NHIA',
    result: {
      coveredServices: 'All medically necessary services as defined by NHIA benefit categories',
      exclusions: 'Cosmetic procedures, experimental treatments, non-EDA approved drugs, services outside Egypt',
      copayStructure: 'Outpatient: EGP 25-50 per visit | Inpatient: 10% coinsurance (max EGP 5,000/year)',
    },
    source: 'NHIA Benefit Catalog 2026',
    effectiveDate: '2026-01-01',
    confidence: 'HIGH',
    staleDataWarning: false,
  },
  {
    queryType: 'FEE_SCHEDULE',
    payerId: 'MEDRIGHT',
    result: {
      cpt: '99214',
      description: 'Office Visit - Established Patient, Moderate Complexity',
      rate: 'EGP 520',
      setting: 'OUTPATIENT',
    },
    source: 'MedRight Provider Agreement 2026',
    effectiveDate: '2026-02-01',
    confidence: 'HIGH',
    staleDataWarning: false,
  },
  {
    queryType: 'AUTH_REQUIRED',
    payerId: 'MEDRIGHT',
    result: {
      rule: 'Prior authorization required for inpatient admissions, surgical procedures, advanced imaging (CT/MRI/PET), and specialty referrals',
      exceptions: 'Emergency care exempt — notification within 48 hours required',
      sla: '5 business days for standard, 48 hours for urgent',
    },
    source: 'MedRight TPA Policy Manual 2026',
    effectiveDate: '2026-01-01',
    confidence: 'MEDIUM',
    staleDataWarning: false,
  },
  {
    queryType: 'TIMELY_FILING',
    payerId: 'MEDRIGHT',
    result: {
      limit: '60 calendar days from date of service',
      exceptions: 'Workers compensation: 90 days',
      penalty: 'Claims filed late denied; good cause exception available once per year',
    },
    source: 'MedRight Provider Agreement 2026',
    effectiveDate: '2026-02-01',
    confidence: 'HIGH',
    staleDataWarning: false,
  },
  {
    queryType: 'FEE_SCHEDULE',
    payerId: 'GLOBEMED',
    result: {
      cpt: '99214',
      description: 'Office Visit - Established Patient, Moderate Complexity',
      rate: 'EGP 490',
      setting: 'OUTPATIENT',
    },
    source: 'Globemed Network Agreement 2025 v3.2',
    effectiveDate: '2025-07-01',
    confidence: 'MEDIUM',
    staleDataWarning: true,
  },
  {
    queryType: 'AUTH_REQUIRED',
    payerId: 'GLOBEMED',
    result: {
      rule: 'Prior auth for inpatient, surgical, and all procedures over EGP 5,000',
      exceptions: 'Emergency stabilization exempt — pre-notification within 24 hours',
      sla: '3 business days standard, 24 hours urgent',
    },
    source: 'Globemed Provider Manual 2025',
    effectiveDate: '2025-07-01',
    confidence: 'MEDIUM',
    staleDataWarning: true,
  },
  {
    queryType: 'COVERAGE',
    payerId: 'GLOBEMED',
    result: {
      coveredServices: 'Comprehensive inpatient/outpatient, pharmacy, maternity, mental health',
      exclusions: 'Dental (except trauma), vision correction, weight management, fertility treatments',
      copayStructure: 'Outpatient: 20% coinsurance | Inpatient: 10% coinsurance (max EGP 10,000/year)',
    },
    source: 'Globemed Policy Schedule 2025',
    effectiveDate: '2025-07-01',
    confidence: 'MEDIUM',
    staleDataWarning: true,
  },
];

const QUERY_TYPE_LABELS: Record<string, string> = {
  FEE_SCHEDULE: 'Fee Schedule',
  AUTH_REQUIRED: 'Authorization Requirements',
  TIMELY_FILING: 'Timely Filing Limits',
  APPEAL_RULES: 'Appeal Rules',
  COVERAGE: 'Coverage & Exclusions',
  COB: 'Coordination of Benefits',
  PAYER_EDIT: 'Payer Edit Library',
};

const PAYER_LABELS: Record<string, string> = {
  NHIA: 'NHIA — Universal Health Insurance',
  MEDRIGHT: 'MedRight TPA',
  GLOBEMED: 'Globemed Egypt',
  NEXTCARE: 'Nextcare Egypt',
};

export function PayerRulesPanel() {
  const [selectedPayer, setSelectedPayer] = useState<string>('ALL');
  const [selectedQueryType, setSelectedQueryType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useI18n();

  const filteredRules = PAYER_RULES_DB.filter((rule) => {
    const matchesPayer = selectedPayer === 'ALL' || rule.payerId === selectedPayer;
    const matchesQueryType = selectedQueryType === 'ALL' || rule.queryType === selectedQueryType;
    const matchesSearch =
      !searchQuery ||
      JSON.stringify(rule.result).toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPayer && matchesQueryType && matchesSearch;
  });

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          {t.payerRules.subtitle}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t.payerRules.description}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t.payerRules.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={selectedPayer} onValueChange={setSelectedPayer}>
          <SelectTrigger className="w-full sm:w-52 h-9">
            <SelectValue placeholder="Select payer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.payerRules.allPayers}</SelectItem>
            <SelectItem value="NHIA">NHIA</SelectItem>
            <SelectItem value="MEDRIGHT">MedRight TPA</SelectItem>
            <SelectItem value="GLOBEMED">Globemed Egypt</SelectItem>
            <SelectItem value="NEXTCARE">Nextcare Egypt</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedQueryType} onValueChange={setSelectedQueryType}>
          <SelectTrigger className="w-full sm:w-52 h-9">
            <SelectValue placeholder="Rule type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.payerRules.allRuleTypes}</SelectItem>
            <SelectItem value="FEE_SCHEDULE">Fee Schedule</SelectItem>
            <SelectItem value="AUTH_REQUIRED">Authorization</SelectItem>
            <SelectItem value="TIMELY_FILING">Timely Filing</SelectItem>
            <SelectItem value="APPEAL_RULES">Appeal Rules</SelectItem>
            <SelectItem value="COVERAGE">Coverage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {filteredRules.map((rule, idx) => (
          <RuleCard key={idx} rule={rule} />
        ))}

        {filteredRules.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Info className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {t.payerRules.noRulesFound}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stale data warning */}
      {filteredRules.some((r) => r.staleDataWarning) && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t.payerRules.staleDataWarning}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.payerRules.staleDataDesc}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RuleCard({ rule }: { rule: PayerRule }) {
  const payerColor = rule.payerId === 'NHIA'
    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
    : rule.payerId === 'MEDRIGHT'
    ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
    : 'border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20';

  const payerBadge = rule.payerId === 'NHIA'
    ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
    : rule.payerId === 'MEDRIGHT'
    ? 'border-amber-300 text-amber-700 bg-amber-50'
    : 'border-sky-300 text-sky-700 bg-sky-50';

  return (
    <Card className={cn('border', payerColor)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('text-[10px] h-5', payerBadge)}>
              {PAYER_LABELS[rule.payerId] || rule.payerId}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-5">
              {QUERY_TYPE_LABELS[rule.queryType] || rule.queryType}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] h-4',
                rule.confidence === 'HIGH' && 'border-emerald-300 text-emerald-700',
                rule.confidence === 'MEDIUM' && 'border-amber-300 text-amber-700',
                rule.confidence === 'LOW' && 'border-red-300 text-red-700'
              )}
            >
              {rule.confidence} confidence
            </Badge>
            {rule.staleDataWarning && (
              <Badge variant="outline" className="text-[9px] h-4 border-amber-300 text-amber-700 bg-amber-50">
                STALE DATA
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Rule result fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(rule.result).map(([key, value]) => (
            <div key={key} className="p-2.5 rounded-md bg-background/50 border">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
              <p className="text-xs font-medium leading-relaxed">{String(value)}</p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Source metadata */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" />
            <span>{rule.source}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Effective: {rule.effectiveDate}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
