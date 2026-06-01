'use client';

import { useState } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
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

const NOTIFICATION_KEYS: { key: keyof NotificationPreferences; label: string; icon: React.ElementType }[] = [
  { key: 'claimsSubmitted', label: 'Claims Submitted', icon: FileDown },
  { key: 'claimsPaid', label: 'Claims Paid', icon: CheckCircle2 },
  { key: 'claimsDenied', label: 'Claims Denied', icon: ShieldAlert },
  { key: 'escalationsRaised', label: 'Escalations Raised', icon: Bell },
  { key: 'agentErrors', label: 'Agent Errors', icon: Zap },
  { key: 'agentCompletions', label: 'Agent Completions', icon: RefreshCw },
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

  const [phaseMode, setPhaseMode] = useState(1);

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
          <h2 className="text-lg font-semibold">Platform Settings</h2>
          <p className="text-sm text-muted-foreground">Configure system behavior, rules, and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. System Configuration Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-amber-500" />
              System Configuration
            </CardTitle>
            <CardDescription>Control automation phase and system behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phase Mode */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Phase Mode</p>
                  <p className="text-xs text-muted-foreground">Controls automation level across all agents</p>
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
                  Phase {phaseMode}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { phase: 1, label: 'Assistive', desc: 'Human-in-the-loop' },
                  { phase: 2, label: 'Supervised', desc: 'Conditional auto' },
                  { phase: 3, label: 'Autonomous', desc: 'Full automation' },
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
                    <p className="text-sm font-semibold">Phase {p.phase}</p>
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
                    <p className="text-sm font-medium">Simulation Speed</p>
                    <p className="text-xs text-muted-foreground">Agent simulation interval</p>
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
                <span>1s (Fast)</span>
                <span>10s (Slow)</span>
              </div>
            </div>

            <Separator />

            {/* Auto-refresh Dashboard */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Auto-refresh Dashboard</p>
                  <p className="text-xs text-muted-foreground">Automatically refresh live data</p>
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
              HITL Gate Rules
            </CardTitle>
            <CardDescription>Prohibited actions that are always enforced</CardDescription>
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
                      ALWAYS
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              These rules cannot be disabled — they ensure compliance and safety at all automation phases.
            </p>
          </CardContent>
        </Card>

        {/* 3. Notification Preferences Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4 text-sky-500" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Choose which events trigger real-time notifications</CardDescription>
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
              Payer Configuration
            </CardTitle>
            <CardDescription>Current payer mix and timely filing defaults</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PAYER_CONFIG.map((payer) => (
              <div key={payer.name} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={payer.color}>
                    {payer.name}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{payer.mix} of claims</p>
                    <p className="text-xs text-muted-foreground">
                      Timely filing: <span className="font-medium">{payer.filingDays} days</span>
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
                Payer configuration is read-only in the current phase. Contact your administrator to request changes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Data Management Card — Full width */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-4 h-4 text-emerald-500" />
              Data Management
            </CardTitle>
            <CardDescription>Export data and manage demo environment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Export All Data */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-medium">Export Claims Data</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Download all {claims.length} claims as a CSV file with full details.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAllCSV}
                  className="w-full gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export All Data as CSV
                </Button>
              </div>

              {/* Export Audit Trail */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <p className="text-sm font-medium">Export Audit Trail</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Download all {auditEntries.length} audit entries as a CSV file for compliance.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAuditCSV}
                  className="w-full gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Export Audit Trail
                </Button>
              </div>

              {/* Reset Demo Data */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-medium">Reset Demo Data</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reset all data to initial demo state. This action cannot be undone.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Demo Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Demo Data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will reset all claims, agents, escalations, audit entries, and settings back to their initial demo state. Any changes you have made will be permanently lost. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetDemoData}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                      >
                        Reset Data
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
