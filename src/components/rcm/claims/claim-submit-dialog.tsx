'use client';

import { useState, useMemo } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
import { ClaimRecord, PayerType } from '@/lib/rcm-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAYER_OPTIONS = [
  { id: 'NHIA', name: 'NHIA - Universal Health Insurance', type: 'NHIA' as PayerType },
  { id: 'MEDRIGHT', name: 'MedRight TPA', type: 'PRIVATE' as PayerType },
  { id: 'GLOBEMED', name: 'Globemed Egypt', type: 'PRIVATE' as PayerType },
  { id: 'NEXTCARE', name: 'Nextcare Egypt', type: 'PRIVATE' as PayerType },
  { id: 'SELFPAY', name: 'Self-Pay', type: 'SELF_PAY' as PayerType },
];

const DEPARTMENT_OPTIONS = [
  'Cardiology',
  'Orthopedics',
  'General Surgery',
  'Internal Medicine',
  'Pediatrics',
  'OB/GYN',
];

interface FormErrors {
  patientName?: string;
  nationalId?: string;
  payer?: string;
  serviceDate?: string;
  totalAmount?: string;
  department?: string;
  procedureCode?: string;
  diagnosisCode?: string;
}

export function ClaimSubmitDialog() {
  const { claims, addClaim } = useRCMStore();
  const [open, setOpen] = useState(false);

  // Form state
  const [patientName, setPatientName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [payer, setPayer] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [department, setDepartment] = useState('');
  const [procedureCode, setProcedureCode] = useState('');
  const [diagnosisCode, setDiagnosisCode] = useState('');
  const [priorAuthRequired, setPriorAuthRequired] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Readiness score: increases with each filled field
  const readinessScore = useMemo(() => {
    let score = 0;
    const fields = [patientName, nationalId, payer, serviceDate, totalAmount, department, procedureCode, diagnosisCode];
    const filledCount = fields.filter((f) => f.trim() !== '').length;
    // Each field contributes ~10 points, up to 80. Notes and priorAuth add remaining 20.
    score = Math.round((filledCount / 8) * 80);
    if (notes.trim()) score += 10;
    if (priorAuthRequired && !payer) score += 0; // incomplete info
    else if (priorAuthRequired) score += 5; // flag set is good info
    else score += 10; // explicitly not required is also complete
    return Math.min(score, 100);
  }, [patientName, nationalId, payer, serviceDate, totalAmount, department, procedureCode, diagnosisCode, notes, priorAuthRequired]);

  // Denial risk: basic computation
  const denialRiskScore = useMemo(() => {
    let risk = 5; // base risk
    const amount = parseFloat(totalAmount);
    if (priorAuthRequired) risk += 25;
    if (!isNaN(amount) && amount > 30000) risk += 20;
    if (!isNaN(amount) && amount > 50000) risk += 15;
    if (payer === 'SELFPAY') risk += 10;
    if (!procedureCode.trim()) risk += 10;
    if (!diagnosisCode.trim()) risk += 10;
    return Math.min(risk, 100);
  }, [priorAuthRequired, totalAmount, payer, procedureCode, diagnosisCode]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!patientName.trim()) errs.patientName = 'Patient name is required';
    if (!nationalId.trim()) {
      errs.nationalId = 'National ID is required';
    } else if (!/^\d{14}$/.test(nationalId.trim())) {
      errs.nationalId = 'National ID must be exactly 14 digits';
    }
    if (!payer) errs.payer = 'Payer is required';
    if (!serviceDate) errs.serviceDate = 'Service date is required';
    if (!totalAmount || parseFloat(totalAmount) <= 0) errs.totalAmount = 'Total amount must be greater than 0';
    if (!department) errs.department = 'Department is required';
    if (!procedureCode.trim()) errs.procedureCode = 'CPT procedure code is required';
    if (!diagnosisCode.trim()) errs.diagnosisCode = 'ICD-10 diagnosis code is required';
    return errs;
  }

  function resetForm() {
    setPatientName('');
    setNationalId('');
    setPayer('');
    setServiceDate('');
    setTotalAmount('');
    setDepartment('');
    setProcedureCode('');
    setDiagnosisCode('');
    setPriorAuthRequired(false);
    setNotes('');
    setErrors({});
  }

  function handleSubmit() {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const claimNumber = `CLM-2026-${String(claims.length + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const payerInfo = PAYER_OPTIONS.find((p) => p.id === payer);
    const amount = parseFloat(totalAmount);
    const filingDays = payerInfo?.type === 'NHIA' ? 30 : 60;

    const newClaim: ClaimRecord = {
      id: `claim-${Date.now()}`,
      claimNumber,
      patientId: `PAT-${String(Date.now()).slice(-6)}`,
      patientName: patientName.trim(),
      nationalId: nationalId.trim(),
      encounterId: `ENC-${String(Date.now()).slice(-6)}`,
      payerId: payer,
      payerName: payerInfo?.name ?? payer,
      payerType: payerInfo?.type ?? 'SELF_PAY',
      serviceDate: new Date(serviceDate).toISOString(),
      totalAmount: amount,
      status: 'ELIGIBILITY',
      readinessScore,
      denialRiskScore,
      priorAuthRequired,
      priorAuthStatus: priorAuthRequired ? 'PENDING' : 'NOT_REQUIRED',
      paidAmount: 0,
      patientResponsibility: Math.round(amount * 0.1 * 100) / 100,
      filingDeadline: new Date(new Date(serviceDate).getTime() + filingDays * 24 * 60 * 60 * 1000).toISOString(),
      phase: 1,
      hitlGate: 'REVIEW',
      currentAgent: 'EligibilityBenefits',
      tags: [
        ...(amount > 50000 ? ['HIGH_VALUE_REVIEW'] : []),
        ...(priorAuthRequired ? ['URGENT_AUTH'] : []),
        ...(denialRiskScore >= 50 ? ['DENIAL_RISK_HIGH'] : []),
      ],
      createdAt: now,
      updatedAt: now,
    };

    addClaim(newClaim);
    toast.success('Claim submitted successfully', {
      description: `${claimNumber} — ${patientName.trim()} (EGP ${amount.toLocaleString()})`,
    });
    resetForm();
    setOpen(false);
  }

  return (
    <>
      <Button
        size="sm"
        className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-3.5 h-3.5" />
        New Claim
      </Button>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <SheetContent side="right" className="sm:max-w-xl overflow-y-auto p-0">
          <div className="p-6 space-y-4">
            <SheetHeader className="p-0">
              <SheetTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Submit New Claim
              </SheetTitle>
            </SheetHeader>

            {/* Readiness & Risk Indicators */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Claim Readiness</span>
                  <span className={cn(
                    'text-sm font-bold',
                    readinessScore >= 80 ? 'text-emerald-600' :
                    readinessScore >= 50 ? 'text-amber-600' :
                    'text-red-600'
                  )}>
                    {readinessScore}%
                  </span>
                </div>
                <Progress
                  value={readinessScore}
                  className={cn(
                    'h-2',
                    readinessScore >= 80 ? '[&>div]:bg-emerald-500' :
                    readinessScore >= 50 ? '[&>div]:bg-amber-500' :
                    '[&>div]:bg-red-500'
                  )}
                />
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Denial Risk</span>
                  <span className={cn(
                    'text-sm font-bold flex items-center gap-1',
                    denialRiskScore >= 50 ? 'text-red-600' :
                    denialRiskScore >= 25 ? 'text-amber-600' :
                    'text-emerald-600'
                  )}>
                    {denialRiskScore >= 50 && <AlertTriangle className="w-3.5 h-3.5" />}
                    {denialRiskScore}%
                  </span>
                </div>
                <Progress
                  value={denialRiskScore}
                  className={cn(
                    'h-2',
                    denialRiskScore >= 50 ? '[&>div]:bg-red-500' :
                    denialRiskScore >= 25 ? '[&>div]:bg-amber-500' :
                    '[&>div]:bg-emerald-500'
                  )}
                />
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Patient Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="patientName" className="text-xs">Patient Name *</Label>
                  <Input
                    id="patientName"
                    placeholder="Full name"
                    value={patientName}
                    onChange={(e) => { setPatientName(e.target.value); if (errors.patientName) setErrors((prev) => ({ ...prev, patientName: undefined })); }}
                    className={cn('h-9', errors.patientName && 'border-red-500')}
                  />
                  {errors.patientName && <p className="text-[11px] text-red-500">{errors.patientName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nationalId" className="text-xs">National ID (14 digits) *</Label>
                  <Input
                    id="nationalId"
                    placeholder="2990101XXXXXXXX"
                    value={nationalId}
                    onChange={(e) => { setNationalId(e.target.value.replace(/\D/g, '').slice(0, 14)); if (errors.nationalId) setErrors((prev) => ({ ...prev, nationalId: undefined })); }}
                    className={cn('h-9 font-mono', errors.nationalId && 'border-red-500')}
                  />
                  {errors.nationalId && <p className="text-[11px] text-red-500">{errors.nationalId}</p>}
                </div>
              </div>

              {/* Payer & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Payer *</Label>
                  <Select value={payer} onValueChange={(v) => { setPayer(v); if (errors.payer) setErrors((prev) => ({ ...prev, payer: undefined })); }}>
                    <SelectTrigger className={cn('h-9', errors.payer && 'border-red-500')}>
                      <SelectValue placeholder="Select payer" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYER_OPTIONS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] h-4',
                                p.type === 'NHIA' && 'border-emerald-300 text-emerald-700',
                                p.type === 'PRIVATE' && 'border-amber-300 text-amber-700',
                                p.type === 'SELF_PAY' && 'border-gray-300 text-gray-700'
                              )}
                            >
                              {p.type}
                            </Badge>
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.payer && <p className="text-[11px] text-red-500">{errors.payer}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="serviceDate" className="text-xs">Service Date *</Label>
                  <Input
                    id="serviceDate"
                    type="date"
                    value={serviceDate}
                    onChange={(e) => { setServiceDate(e.target.value); if (errors.serviceDate) setErrors((prev) => ({ ...prev, serviceDate: undefined })); }}
                    className={cn('h-9', errors.serviceDate && 'border-red-500')}
                  />
                  {errors.serviceDate && <p className="text-[11px] text-red-500">{errors.serviceDate}</p>}
                </div>
              </div>

              {/* Amount & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="totalAmount" className="text-xs">Total Amount (EGP) *</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={totalAmount}
                    onChange={(e) => { setTotalAmount(e.target.value); if (errors.totalAmount) setErrors((prev) => ({ ...prev, totalAmount: undefined })); }}
                    className={cn('h-9 font-mono', errors.totalAmount && 'border-red-500')}
                  />
                  {errors.totalAmount && <p className="text-[11px] text-red-500">{errors.totalAmount}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Department *</Label>
                  <Select value={department} onValueChange={(v) => { setDepartment(v); if (errors.department) setErrors((prev) => ({ ...prev, department: undefined })); }}>
                    <SelectTrigger className={cn('h-9', errors.department && 'border-red-500')}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.department && <p className="text-[11px] text-red-500">{errors.department}</p>}
                </div>
              </div>

              {/* Codes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="procedureCode" className="text-xs">Procedure Code (CPT) *</Label>
                  <Input
                    id="procedureCode"
                    placeholder="e.g. 99213"
                    value={procedureCode}
                    onChange={(e) => { setProcedureCode(e.target.value.toUpperCase()); if (errors.procedureCode) setErrors((prev) => ({ ...prev, procedureCode: undefined })); }}
                    className={cn('h-9 font-mono', errors.procedureCode && 'border-red-500')}
                  />
                  {errors.procedureCode && <p className="text-[11px] text-red-500">{errors.procedureCode}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="diagnosisCode" className="text-xs">Diagnosis Code (ICD-10) *</Label>
                  <Input
                    id="diagnosisCode"
                    placeholder="e.g. I21.0"
                    value={diagnosisCode}
                    onChange={(e) => { setDiagnosisCode(e.target.value.toUpperCase()); if (errors.diagnosisCode) setErrors((prev) => ({ ...prev, diagnosisCode: undefined })); }}
                    className={cn('h-9 font-mono', errors.diagnosisCode && 'border-red-500')}
                  />
                  {errors.diagnosisCode && <p className="text-[11px] text-red-500">{errors.diagnosisCode}</p>}
                </div>
              </div>

              {/* Prior Auth Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Prior Authorization Required</Label>
                  <p className="text-[10px] text-muted-foreground">Enable if this service requires pre-approval from the payer</p>
                </div>
                <Switch
                  checked={priorAuthRequired}
                  onCheckedChange={setPriorAuthRequired}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes or special instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[70px] text-sm resize-none"
                />
              </div>

              {/* HITL Gate notice */}
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  This claim will enter the pipeline with <strong>HITL Gate: REVIEW</strong> (Phase 1). A human reviewer must approve before submission.
                </p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 pt-2">
              <SheetClose asChild>
                <Button variant="outline" size="sm" className="h-9">Cancel</Button>
              </SheetClose>
              <Button
                size="sm"
                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSubmit}
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Submit Claim
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
