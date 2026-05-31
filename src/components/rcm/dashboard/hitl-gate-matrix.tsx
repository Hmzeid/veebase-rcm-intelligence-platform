'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldAlert, ShieldCheck, ShieldQuestion, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── HITL Gate Matrix Data ──────────────────────────────────────────

interface HitlCell {
  label: string;
  type: 'human' | 'conditional' | 'auto' | 'always';
  detail?: string;
}

interface HitlRow {
  action: string;
  icon: string;
  phase1: HitlCell;
  phase2: HitlCell;
  phase3: HitlCell;
}

const HITL_ROWS: HitlRow[] = [
  {
    action: 'Claim submission',
    icon: 'Send',
    phase1: { label: 'Require approval', type: 'human' },
    phase2: { label: 'Auto if score ≥ 90 + 15min', type: 'conditional', detail: 'Claim auto-submits when readiness score ≥ 90 and held for 15-min cooling period' },
    phase3: { label: 'Auto if score ≥ 90', type: 'auto', detail: 'Immediate auto-submission when readiness score ≥ 90' },
  },
  {
    action: 'Final coding decision',
    icon: 'Code',
    phase1: { label: 'Require coder', type: 'always' },
    phase2: { label: 'Require coder', type: 'always' },
    phase3: { label: 'Require coder (always)', type: 'always', detail: 'Certified coder review is mandatory across all phases' },
  },
  {
    action: 'Appeal letter send',
    icon: 'Mail',
    phase1: { label: 'Require approval', type: 'human' },
    phase2: { label: 'Require approval', type: 'human' },
    phase3: { label: 'Auto if overturn prob > 70%', type: 'conditional', detail: 'AI-drafted appeal auto-sent when overturn probability exceeds 70%' },
  },
  {
    action: 'Payment posting',
    icon: 'Banknote',
    phase1: { label: 'Require approval', type: 'human' },
    phase2: { label: 'Auto for matched, correct', type: 'conditional', detail: 'Auto-post when payment matches contracted rate exactly' },
    phase3: { label: 'Auto for matched, correct', type: 'auto', detail: 'Auto-post for matched, correct payments' },
  },
  {
    action: 'Write-off',
    icon: 'FileX',
    phase1: { label: 'Require L3', type: 'always' },
    phase2: { label: 'Require L3', type: 'always' },
    phase3: { label: 'Require L3 (always)', type: 'always', detail: 'Senior biller / RCM manager approval always required for write-offs' },
  },
  {
    action: 'Collections referral',
    icon: 'UserCheck',
    phase1: { label: 'Require L3', type: 'always' },
    phase2: { label: 'Require L3', type: 'always' },
    phase3: { label: 'Require L3 (always)', type: 'always', detail: 'Senior biller / RCM manager approval always required for collections referral' },
  },
  {
    action: 'High-value (> EGP 50k)',
    icon: 'AlertTriangle',
    phase1: { label: 'Require L3', type: 'always' },
    phase2: { label: 'Require L3', type: 'always' },
    phase3: { label: 'Require L3 (always)', type: 'always', detail: 'Senior biller / RCM manager review always required for high-value claims' },
  },
  {
    action: 'Compliance flag',
    icon: 'ShieldAlert',
    phase1: { label: 'Require L4', type: 'always' },
    phase2: { label: 'Require L4', type: 'always' },
    phase3: { label: 'Require L4 (always)', type: 'always', detail: 'Compliance officer review always required when compliance flags are raised' },
  },
];

const CURRENT_PHASE = 1;

// ── Cell style mapping ─────────────────────────────────────────────

const cellStyles: Record<HitlCell['type'], { bg: string; text: string; border: string; icon: React.ElementType }> = {
  human: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: ShieldAlert,
  },
  conditional: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    icon: ShieldQuestion,
  },
  auto: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: ShieldCheck,
  },
  always: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: ShieldAlert,
  },
};

function HitlCellContent({ cell, phase, isCurrentPhase }: { cell: HitlCell; phase: number; isCurrentPhase: boolean }) {
  const style = cellStyles[cell.type];
  const Icon = style.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-start gap-1.5 p-2 rounded-md border text-xs leading-snug transition-all',
              style.bg,
              style.border,
              style.text,
              isCurrentPhase && 'ring-2 ring-offset-1 ring-primary/30'
            )}
          >
            <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="font-medium">{cell.label}</span>
            {cell.type === 'always' && (
              <Badge variant="outline" className="text-[8px] h-3.5 px-1 ml-auto shrink-0 border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
                ALWAYS
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px] text-xs">
          <p className="font-semibold mb-1">Phase {phase}: {cell.label}</p>
          {cell.detail && <p className="text-muted-foreground">{cell.detail}</p>}
          {!cell.detail && (
            <p className="text-muted-foreground">
              {cell.type === 'human' && 'Manual human approval required before proceeding.'}
              {cell.type === 'conditional' && 'Automated with conditions — human review triggered when conditions not met.'}
              {cell.type === 'auto' && 'Fully automated — no human intervention needed under normal conditions.'}
              {cell.type === 'always' && 'Mandatory human review — this gate can never be fully automated for compliance/safety.'}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Phase indicator ─────────────────────────────────────────────────

function PhaseIndicator() {
  const phases = [
    { num: 1, label: 'Phase 1', desc: 'Full HITL oversight', color: 'bg-red-500' },
    { num: 2, label: 'Phase 2', desc: 'Conditional automation', color: 'bg-amber-500' },
    { num: 3, label: 'Phase 3', desc: 'Max automation', color: 'bg-emerald-500' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {phases.map((p, idx) => (
        <div key={p.num} className="flex items-center gap-2">
          {idx > 0 && (
            <div className="hidden sm:block w-6 h-px bg-border -ml-1 mr-1" />
          )}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all',
                p.color,
                p.num === CURRENT_PHASE ? 'ring-2 ring-offset-2 ring-primary/50 scale-125' : 'opacity-40'
              )}
            />
            <div className="flex flex-col">
              <span className={cn(
                'text-xs font-semibold leading-none',
                p.num === CURRENT_PHASE ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {p.label}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</span>
            </div>
            {p.num === CURRENT_PHASE && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary">
                Current
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function HitlGateMatrix() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              HITL Gate Matrix
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Human-in-the-loop approval requirements by automation phase
            </CardDescription>
          </div>
          <PhaseIndicator />
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-4 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800" />
            <span className="text-[10px] text-muted-foreground">Requires Human</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800" />
            <span className="text-[10px] text-muted-foreground">Conditional Auto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800" />
            <span className="text-[10px] text-muted-foreground">Automated</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
              ALWAYS
            </Badge>
            <span className="text-[10px] text-muted-foreground">Never auto-eligible</span>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] sm:w-[220px] text-xs">Action</TableHead>
                <TableHead className="text-xs text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-semibold">Phase 1</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Full HITL</span>
                  </div>
                </TableHead>
                <TableHead className="text-xs text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-semibold">Phase 2</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Conditional</span>
                  </div>
                </TableHead>
                <TableHead className="text-xs text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-semibold">Phase 3</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Max Auto</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {HITL_ROWS.map((row) => (
                <TableRow key={row.action}>
                  <TableCell className="text-xs font-medium py-2">
                    {row.action}
                  </TableCell>
                  <TableCell className="py-2 px-1.5">
                    <HitlCellContent cell={row.phase1} phase={1} isCurrentPhase={CURRENT_PHASE === 1} />
                  </TableCell>
                  <TableCell className="py-2 px-1.5">
                    <HitlCellContent cell={row.phase2} phase={2} isCurrentPhase={CURRENT_PHASE === 2} />
                  </TableCell>
                  <TableCell className="py-2 px-1.5">
                    <HitlCellContent cell={row.phase3} phase={3} isCurrentPhase={CURRENT_PHASE === 3} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Note */}
        <div className="flex items-start gap-2 mt-4 px-1">
          <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Currently operating in <span className="font-semibold text-foreground">Phase 1</span> — all actions require
            explicit human approval. The matrix evolves as the platform matures: Phase 2 introduces conditional
            automation based on confidence scores, and Phase 3 maximizes automation while preserving mandatory
            human gates for coding decisions, write-offs, high-value claims, collections, and compliance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
