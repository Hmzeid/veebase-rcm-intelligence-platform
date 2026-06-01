'use client';

import { useState } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
import { useI18n } from '@/lib/i18n';
import type { NotificationPreferences } from '@/lib/rcm-store';
import { PROHIBITED_ACTIONS } from '@/lib/rcm-data';
import {
  Settings,
  Zap,
  Clock,
  RefreshCw,
  ShieldAlert,
  Bell,
  Building2,
  Database,
  Download,
  RotateCcw,
  Edit3,
  CheckCircle2,
  FileDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const PAYER_CONFIG = [
  { name: 'NHIA', mix: '45%', filingDays: 30, color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  { name: 'Private TPAs', mix: '40%', filingDays: 60, color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  { name: 'Self-Pay', mix: '15%', filingDays: 90, color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
];

export function SettingsView() {
  const {
    simulationSpeed,
    setSimulationSpeed,
    autoRefresh,
    setAutoRefresh,
    notifications,
    setNotifications,
    claims,
    auditEntries,
    resetDemoData,
  } = useRCMStore();

  const { t } = useI18n();

  const [phaseMode, setPhaseMode] = useState(1);

  const NOTIFICATION_KEYS: { key: keyof NotificationPreferences; label: string; icon: React.ElementType }[] = [
    { key: 'claimsSubmitted', label: t.settings.claimsSubmitted, icon: FileDown },
    { key: 'claimsPaid', label: t.settings.claimsPaid, icon: CheckCircle2 },
    { key: 'claimsDenied', label: t.settings.claimsDenied, icon: ShieldAlert },
    { key: 'escalationsRaised', label: t.settings.escalationsRaised, icon: Bell },
    { key: 'agentErrors', label: t.settings.agentErrors, icon: Zap },
    { key: 'agentCompletions', label: t.settings.agentCompletions, icon: RefreshCw },
  ];

  const handleExportAllCSV = () => {
    const headers = [
      'Claim #', 'Patient', 'National ID', 'Payer', 'Payer Type', 'Service Date',
      'Total Amount', 'Status', 'Readiness Score', 'Denial Risk Score', 'HITL Gate',
      'Current Agent', 'Tags', 'Created At', 'Updated At',
    ];
    const rows = claims.map((c) => [
      c.claimNumber,
      c.patientName,
      c.nationalId,
      c.payerName,
      c.payerType,
      c.serviceDate.split('T')[0],
      c.totalAmount,
      c.status,
      c.readinessScore,
      c.denialRiskScore,
      c.hitlGate,
      c.currentAgent || '',
      `"${c.tags.join('; ')}"`,
      c.createdAt.split('T')[0],
      c.updatedAt.split('T')[0],
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claims-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Claims data exported successfully');
  };

  const handleExportAuditCSV = () => {
    const headers = ['Timestamp', 'Action', 'Actor', 'Role', 'Claim #', 'Agent', 'Details', 'Previous', 'New', 'Risk Level', 'Tags'];
    const rows = auditEntries.map((e) => [
      e.timestamp,
      e.action,
      e.actor,
      e.actorRole,
      e.claimNumber || '',
      e.agentName || '',
      `"${e.details.replace(/"/g, '""')}"`,
      e.previousValue || '',
      e.newValue || '',
      e.riskLevel,
      e.tags.join('; '),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit trail exported successfully');
  };

  const handleResetDemoData = () => {
    resetDemoData();
    toast.success('Demo data has been reset to initial state');
  };

  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications({ ...notifications, [key]: !notifications[key] });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t.settings.platformSettings}</h2>
          <p className="text-sm text-muted-foreground">{t.settings.platformSettingsDesc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. System Configuration Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-amber-500" />
              {t.settings.systemConfig}
            </CardTitle>
            <CardDescription>{t.settings.controlsAutomationLevel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phase Mode */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t.settings.phaseMode}</p>
                  <p className="text-xs text-muted-foreground">{t.settings.controlsAutomationLevel}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    phaseMode === 1
                      ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                      : phaseMode === 2
                      ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300'
                      : 'border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-300'
                  }
                >
                  {t.header.phase} {phaseMode}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { phase: 1, label: t.settings.phase1Assistive, desc: t.settings.phase1Desc },
                  { phase: 2, label: t.settings.phase2Supervised, desc: t.settings.phase2Desc },
                  { phase: 3, label: t.settings.phase3Autonomous, desc: t.settings.phase3Desc },
                ].map((p) => (
                  <button
                    key={p.phase}
                    onClick={() => setPhaseMode(p.phase)}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      phaseMode === p.phase
                        ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950 dark:ring-emerald-800'
                        : 'border-border hover:border-emerald-300 hover:bg-muted/50'
                    }`}
                  >
                    <p className="text-sm font-semibold">{t.header.phase} {p.phase}</p>
                    <p className="text-[10px] text-muted-foreground">{p.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Simulation Speed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t.settings.simulationSpeed}</p>
                    <p className="text-xs text-muted-foreground">{t.settings.simulationSpeedDesc}</p>
                  </div>
                </div>
                <span className="text-sm font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {simulationSpeed}s
                </span>
              </div>
              <Slider
                value={[simulationSpeed]}
                onValueChange={(v) => setSimulationSpeed(v[0])}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1s ({t.settings.fast})</span>
                <span>10s ({t.settings.slow})</span>
              </div>
            </div>

            <Separator />

            {/* Auto-refresh Dashboard */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t.settings.autoRefresh}</p>
                  <p className="text-xs text-muted-foreground">{t.settings.autoRefreshDesc}</p>
                </div>
              </div>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
          </CardContent>
        </Card>

        {/* 2. HITL Gate Rules Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              {t.settings.hitlGateRules}
            </CardTitle>
            <CardDescription>{t.settings.hitlDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PROHIBITED_ACTIONS.map((action) => (
              <div
                key={action.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
              >
                <Switch
                  checked={action.enforced}
                  disabled
                  className="mt-0.5 data-[state=checked]:bg-red-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{action.rule}</p>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                    >
                      {t.settings.alwaysEnforced}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              {t.settings.rulesCannotDisable}
            </p>
          </CardContent>
        </Card>

        {/* 3. Notification Preferences Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4 text-sky-500" />
              {t.settings.notifications}
            </CardTitle>
            <CardDescription>{t.settings.notificationsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {NOTIFICATION_KEYS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <Switch
                  checked={notifications[key]}
                  onCheckedChange={() => toggleNotification(key)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 4. Payer Configuration Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-violet-500" />
              {t.settings.payerConfig}
            </CardTitle>
            <CardDescription>{t.settings.payerDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PAYER_CONFIG.map((payer) => (
              <div key={payer.name} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={payer.color}>
                    {payer.name}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{payer.mix} {t.settings.ofClaims}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.timelyFiling}: <span className="font-medium">{payer.filingDays} {t.settings.days}</span>
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled>
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <Edit3 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                {t.settings.payerReadOnly}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Data Management Card — Full width */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-4 h-4 text-emerald-500" />
              {t.settings.dataManagement}
            </CardTitle>
            <CardDescription>{t.settings.dataDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Export All Data */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-medium">{t.settings.exportClaimsData}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.settings.exportClaimsDesc}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAllCSV}
                  className="w-full gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.settings.exportAllCsv}
                </Button>
              </div>

              {/* Export Audit Trail */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <p className="text-sm font-medium">{t.settings.exportAuditCsv}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.settings.exportAuditDesc}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAuditCSV}
                  className="w-full gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {t.settings.exportAuditCsv}
                </Button>
              </div>

              {/* Reset Demo Data */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-medium">{t.settings.resetDemo}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.settings.resetDemoDesc}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t.settings.resetDemo}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.settings.resetDialogTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t.settings.resetDialogDesc}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetDemoData}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                      >
                        {t.settings.resetData}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
