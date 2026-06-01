'use client';

import { useState, useCallback, useRef } from 'react';
import { useRCMStore } from '@/lib/rcm-store';
import { HOSPITAL_TEMPLATES } from '@/lib/rcm-data';
import type { IngestedPDF, ExtractedClaimData, IngestionStatus } from '@/lib/rcm-types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Upload,
  FileText,
  Printer,
  FolderOpen,
  Plug,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  ChevronRight,
  Sparkles,
  Eye,
  Trash2,
  RefreshCw,
  Send,
  ArrowRight,
  Copy,
  Settings,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// ==================== Pipeline Stage Config ====================
const PIPELINE_STAGES = [
  { key: 'upload', label: 'Upload', icon: Upload, statuses: ['UPLOADING', 'PENDING'] as IngestionStatus[] },
  { key: 'extract', label: 'Extract', icon: Search, statuses: ['EXTRACTING'] as IngestionStatus[] },
  { key: 'review', label: 'Review', icon: Eye, statuses: ['EXTRACTED', 'REVIEWING'] as IngestionStatus[] },
  { key: 'submit', label: 'Submit', icon: Send, statuses: ['SUBMITTED'] as IngestionStatus[] },
];

const STATUS_CONFIG: Record<IngestionStatus, { label: string; color: string; icon: React.ElementType }> = {
  UPLOADING: { label: 'Uploading', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300', icon: Upload },
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: Clock },
  EXTRACTING: { label: 'Extracting', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300', icon: Loader2 },
  EXTRACTED: { label: 'Extracted', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300', icon: Sparkles },
  REVIEWING: { label: 'Reviewing', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300', icon: Eye },
  SUBMITTED: { label: 'Submitted', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: CheckCircle2 },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: XCircle },
};

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  upload: { label: 'Upload', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800' },
  virtual_printer: { label: 'Virtual Printer', color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' },
  watch_folder: { label: 'Watch Folder', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
  api: { label: 'API', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (confidence >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 90) return 'bg-emerald-500';
  if (confidence >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

function getConfidenceBorder(confidence: number): string {
  if (confidence >= 90) return '';
  if (confidence >= 70) return 'border-amber-300 dark:border-amber-700';
  return 'border-red-300 dark:border-red-700';
}

// ==================== Main Component ====================
export function IngestionView() {
  const { ingestedPDFs, addIngestedPDF, updateIngestedPDF, removeIngestedPDF, addClaim, setActiveView } = useRCMStore();
  const [selectedPDF, setSelectedPDF] = useState<IngestedPDF | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('auto');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [configureDialogOpen, setConfigureDialogOpen] = useState(false);
  const [editedData, setEditedData] = useState<ExtractedClaimData | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pipeline counts
  const pipelineCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: ingestedPDFs.filter((p) => stage.statuses.includes(p.status)).length,
  }));
  const failedCount = ingestedPDFs.filter((p) => p.status === 'FAILED').length;

  // Handle file upload
  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF files are accepted');
        continue;
      }

      const newPDF: IngestedPDF = {
        id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'UPLOADING',
        hospitalTemplate: selectedTemplate,
        extractionConfidence: 0,
        pageCount: 1,
        source: 'upload',
      };

      addIngestedPDF(newPDF);
      setIsUploading(true);

      // Simulate upload → extraction pipeline
      setTimeout(() => {
        updateIngestedPDF(newPDF.id, { status: 'PENDING' });

        setTimeout(() => {
          updateIngestedPDF(newPDF.id, { status: 'EXTRACTING' });

          // Call the API
          const formData = new FormData();
          formData.append('file', file);
          formData.append('template', selectedTemplate);

          fetch('/api/ingest', {
            method: 'POST',
            body: formData,
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success) {
                updateIngestedPDF(newPDF.id, {
                  status: 'EXTRACTED',
                  extractedData: data.extractedData,
                  extractionConfidence: data.confidence,
                });
                toast.success(`Extracted data from ${file.name}`, {
                  description: data.method === 'vlm'
                    ? `AI extraction — ${data.confidence}% confidence`
                    : 'Template-based fallback used. Manual review recommended.',
                });
              } else {
                updateIngestedPDF(newPDF.id, {
                  status: 'FAILED',
                  extractionError: data.error || 'Extraction failed',
                });
                toast.error(`Failed to process ${file.name}`);
              }
            })
            .catch(() => {
              // Fallback: generate simulated extraction
              const fallbackData: ExtractedClaimData = {
                patientName: '[Manual entry required]',
                nationalId: '[14-digit ID]',
                payerName: 'Unknown',
                payerType: 'SELF_PAY',
                payerId: 'SELF_PAY',
                totalAmount: 0,
                fieldConfidence: { patientName: 5, nationalId: 5, totalAmount: 5 },
              };
              updateIngestedPDF(newPDF.id, {
                status: 'EXTRACTED',
                extractedData: fallbackData,
                extractionConfidence: 15,
              });
              toast.warning(`Extraction API unavailable for ${file.name}`, {
                description: 'Template-based fallback used. Manual review recommended.',
              });
            })
            .finally(() => {
              setIsUploading(false);
            });
        }, 1500);
      }, 1000);
    }
  }, [selectedTemplate, addIngestedPDF, updateIngestedPDF]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  // Open review sheet
  const openReview = (pdf: IngestedPDF) => {
    setSelectedPDF(pdf);
    setEditedData(pdf.extractedData ? { ...pdf.extractedData } : undefined);
  };

  // Submit as claim
  const handleSubmitAsClaim = () => {
    if (!selectedPDF || !editedData) return;

    const claimNumber = `CLM-2026-${String(Date.now()).slice(-4)}`;
    const newClaim = {
      id: `claim-${Date.now()}`,
      claimNumber,
      patientId: `PAT-${String(Math.floor(Math.random() * 9000 + 1000))}`,
      patientName: editedData.patientName || 'Unknown',
      nationalId: editedData.nationalId || '',
      encounterId: `ENC-${String(Math.floor(Math.random() * 90000 + 10000))}`,
      payerId: editedData.payerId || editedData.payerName || 'SELF_PAY',
      payerName: editedData.payerName || 'Unknown',
      payerType: editedData.payerType || 'SELF_PAY' as const,
      serviceDate: editedData.serviceDate || new Date().toISOString(),
      totalAmount: editedData.totalAmount || 0,
      status: 'ELIGIBILITY' as const,
      readinessScore: Math.min(selectedPDF.extractionConfidence, 85),
      denialRiskScore: selectedPDF.extractionConfidence < 70 ? 60 : 25,
      priorAuthRequired: editedData.priorAuthRequired || false,
      priorAuthNumber: editedData.priorAuthNumber,
      priorAuthStatus: editedData.priorAuthRequired ? 'PENDING' : 'NOT_REQUIRED',
      paidAmount: 0,
      patientResponsibility: 0,
      phase: 1,
      hitlGate: 'REVIEW' as const,
      currentAgent: 'EligibilityBenefits',
      tags: ['PDF_INGESTED', ...(selectedPDF.extractionConfidence < 70 ? ['LOW_CONFIDENCE'] : [])],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addClaim(newClaim);
    updateIngestedPDF(selectedPDF.id, {
      status: 'SUBMITTED',
      claimId: newClaim.id,
    });

    toast.success('Claim created from PDF extraction', {
      description: `${claimNumber} — ${editedData.patientName || 'Unknown patient'}`,
    });

    setSelectedPDF(null);
    setActiveView('claims');
  };

  // Save & review later
  const handleSaveReview = () => {
    if (!selectedPDF || !editedData) return;
    updateIngestedPDF(selectedPDF.id, {
      extractedData: editedData,
      status: 'REVIEWING',
    });
    toast.success('Extraction data saved', {
      description: 'You can resume review later.',
    });
    setSelectedPDF(null);
  };

  // Reject
  const handleReject = () => {
    if (!selectedPDF) return;
    updateIngestedPDF(selectedPDF.id, {
      status: 'FAILED',
      extractionError: 'Rejected by reviewer',
    });
    toast.info('PDF extraction rejected');
    setSelectedPDF(null);
  };

  // Retry extraction
  const handleRetry = (pdf: IngestedPDF) => {
    updateIngestedPDF(pdf.id, {
      status: 'EXTRACTING',
      extractionError: undefined,
      extractionConfidence: 0,
    });
    toast.info('Retrying extraction...', { description: pdf.fileName });
    // Simulate retry
    setTimeout(() => {
      const fallbackData: ExtractedClaimData = {
        patientName: '[Manual entry required]',
        nationalId: '[14-digit ID]',
        payerName: 'Unknown',
        payerType: 'SELF_PAY',
        payerId: 'SELF_PAY',
        totalAmount: 0,
        fieldConfidence: { patientName: 10, nationalId: 10, totalAmount: 10 },
      };
      updateIngestedPDF(pdf.id, {
        status: 'EXTRACTED',
        extractedData: fallbackData,
        extractionConfidence: 20,
      });
      toast.warning(`Retry extraction for ${pdf.fileName}`, {
        description: 'Template-based fallback used. Manual review recommended.',
      });
    }, 3000);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Section 1: Pipeline Visualization */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              {pipelineCounts.map((stage, idx) => {
                const StageIcon = stage.icon;
                const isActive = stage.count > 0;
                return (
                  <div key={stage.key} className="flex items-center gap-1 md:gap-2 flex-1">
                    <div
                      className={cn(
                        'flex flex-col items-center gap-1 px-3 py-2 rounded-lg flex-1 transition-all',
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950 ring-1 ring-emerald-200 dark:ring-emerald-800'
                          : 'bg-muted/50'
                      )}
                    >
                      <StageIcon
                        className={cn(
                          'w-5 h-5',
                          isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                        )}
                      />
                      <span className="text-xs font-medium">{stage.label}</span>
                      <span
                        className={cn(
                          'text-lg font-bold',
                          isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
                        )}
                      >
                        {stage.count}
                      </span>
                      {isActive && stage.key === 'extract' && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                        </span>
                      )}
                    </div>
                    {idx < pipelineCounts.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 hidden md:block" />
                    )}
                  </div>
                );
              })}
              {failedCount > 0 && (
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 ring-1 ring-red-200 dark:ring-red-800">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium">Failed</span>
                  <span className="text-lg font-bold text-red-700 dark:text-red-300">{failedCount}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Integration Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Virtual Printer */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-950">
                  <Printer className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-sm">Virtual Printer</CardTitle>
                  <CardDescription className="text-xs">Print-to-ingest</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">
                Configure a virtual printer on hospital workstations. When staff &quot;prints&quot; a claim, it automatically appears here.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setConfigureDialogOpen(true)}
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Configure
              </Button>
            </CardContent>
          </Card>

          {/* Watch Folder */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                  <FolderOpen className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-sm">Watch Folder</CardTitle>
                  <CardDescription className="text-xs">Auto-detect new files</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">
                Set up a network folder that hospital systems export to. New PDFs are automatically detected.
              </p>
              <Input
                readOnly
                value="\\hospital-server\claims-export\"
                className="text-xs h-8 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </CardContent>
          </Card>

          {/* API Endpoint */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                  <Plug className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-sm">API Endpoint</CardTitle>
                  <CardDescription className="text-xs">HL7/FHIR integration</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">
                REST API for direct claim submission from systems supporting HL7/FHIR.
              </p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono truncate">
                  POST /api/ingest
                </code>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => copyToClipboard('POST /api/ingest')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy endpoint</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 3: PDF Upload Dropzone */}
        <Card className="shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
              {/* Dropzone */}
              <div
                className={cn(
                  'flex-1 w-full border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
                  isDragging
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-muted-foreground/25 hover:border-emerald-300 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <Upload
                  className={cn(
                    'w-10 h-10 mx-auto mb-3',
                    isDragging ? 'text-emerald-500' : 'text-muted-foreground'
                  )}
                />
                <p className="text-sm font-medium">
                  {isDragging ? 'Drop PDF files here' : 'Drag & drop PDF files here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse — PDF files only
                </p>
                {isUploading && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Processing...</span>
                  </div>
                )}
              </div>

              {/* Template selector + upload button */}
              <div className="flex flex-col gap-2 w-full md:w-64">
                <Label className="text-xs font-medium">Hospital Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOSPITAL_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span>{t.name}</span>
                        {t.nameAr && (
                          <span className="text-muted-foreground text-xs ml-1">({t.nameAr})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload & Extract
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Processing Queue Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Processing Queue</CardTitle>
            <CardDescription>{ingestedPDFs.length} PDF file{ingestedPDFs.length !== 1 ? 's' : ''} in pipeline</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">File</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground hidden md:table-cell">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground hidden lg:table-cell">Template</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground hidden md:table-cell">Confidence</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground hidden lg:table-cell">Uploaded</th>
                    <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ingestedPDFs.map((pdf) => {
                    const statusCfg = STATUS_CONFIG[pdf.status];
                    const StatusIcon = statusCfg.icon;
                    const sourceBadge = SOURCE_BADGES[pdf.source];
                    const template = HOSPITAL_TEMPLATES.find((t) => t.id === pdf.hospitalTemplate);

                    return (
                      <tr key={pdf.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-[200px] md:max-w-[300px]">{pdf.fileName}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(pdf.fileSize)} · {pdf.pageCount} page{pdf.pageCount !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Badge variant="outline" className={cn('text-[10px] h-5', sourceBadge.color)}>
                            {sourceBadge.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{template?.name || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={cn('text-[10px] h-5 gap-1', statusCfg.color)}>
                            <StatusIcon className={cn('w-3 h-3', pdf.status === 'EXTRACTING' && 'animate-spin')} />
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Progress value={pdf.extractionConfidence} className="w-16 h-1.5" />
                            <span className={cn('text-xs font-medium', getConfidenceColor(pdf.extractionConfidence))}>
                              {pdf.extractionConfidence}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{timeAgo(pdf.uploadedAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {(pdf.status === 'EXTRACTED' || pdf.status === 'REVIEWING') && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openReview(pdf)}>
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Review</TooltipContent>
                              </Tooltip>
                            )}
                            {pdf.status === 'FAILED' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRetry(pdf)}>
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Retry</TooltipContent>
                              </Tooltip>
                            )}
                            {pdf.status === 'SUBMITTED' && pdf.claimId && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveView('claims')}>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Claim</TooltipContent>
                              </Tooltip>
                            )}
                            {pdf.status !== 'SUBMITTED' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                                    onClick={() => {
                                      removeIngestedPDF(pdf.id);
                                      toast.info('PDF removed from queue');
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {ingestedPDFs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <Upload className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No PDFs in the pipeline</p>
                        <p className="text-xs text-muted-foreground">Upload a file or configure an integration method above</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Extraction Detail Sheet */}
        <Sheet open={!!selectedPDF} onOpenChange={(open) => !open && setSelectedPDF(null)}>
          <SheetContent side="right" className="sm:max-w-3xl w-full overflow-y-auto p-0">
            {selectedPDF && (
              <div className="flex flex-col h-full">
                <SheetHeader className="p-6 pb-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {selectedPDF.fileName}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn('text-[10px]', STATUS_CONFIG[selectedPDF.status].color)}>
                      {STATUS_CONFIG[selectedPDF.status].label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedPDF.extractionConfidence}% confidence
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px]', SOURCE_BADGES[selectedPDF.source].color)}>
                      {SOURCE_BADGES[selectedPDF.source].label}
                    </Badge>
                  </div>
                  {selectedPDF.extractionError && (
                    <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 dark:text-red-300">{selectedPDF.extractionError}</p>
                      </div>
                    </div>
                  )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Left: Simulated PDF Preview */}
                    <div className="p-6 border-b lg:border-b-0 lg:border-r">
                      <h3 className="text-sm font-semibold mb-3">Document Preview</h3>
                      <div className="bg-muted/50 rounded-lg p-6 border min-h-[400px]">
                        <div className="space-y-4">
                          {/* Simulated claim form header */}
                          <div className="text-center border-b pb-3">
                            <p className="text-xs font-bold text-muted-foreground">CLAIM FORM</p>
                            <p className="text-[10px] text-muted-foreground">
                              {HOSPITAL_TEMPLATES.find((t) => t.id === selectedPDF.hospitalTemplate)?.hospitalSystem || 'Hospital System'}
                            </p>
                          </div>
                          {/* Simulated form fields */}
                          <div className="space-y-2">
                            {[
                              { label: 'Patient Name', value: editedData?.patientName },
                              { label: 'National ID', value: editedData?.nationalId },
                              { label: 'Payer', value: editedData?.payerName },
                              { label: 'Service Date', value: editedData?.serviceDate },
                              { label: 'Total Amount', value: editedData?.totalAmount ? `EGP ${editedData.totalAmount.toLocaleString()}` : undefined },
                              { label: 'Department', value: editedData?.department },
                              { label: 'Procedure Codes', value: editedData?.procedureCodes?.join(', ') },
                              { label: 'Diagnosis Codes', value: editedData?.diagnosisCodes?.join(', ') },
                              { label: 'Physician', value: editedData?.attendingPhysician },
                              { label: 'Facility', value: editedData?.facilityName },
                            ].map((field) => (
                              <div key={field.label} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{field.label}:</span>
                                <span className="font-medium text-right max-w-[60%] truncate">
                                  {field.value || '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                          {/* Simulated stamp */}
                          <div className="mt-6 text-right">
                            <div className="inline-block border-2 border-dashed border-muted-foreground/30 rounded-md px-3 py-1.5 rotate-[-3deg]">
                              <p className="text-[10px] text-muted-foreground/50 font-bold">HOSPITAL STAMP</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Editable extracted fields */}
                    <div className="p-6">
                      <h3 className="text-sm font-semibold mb-3">Extracted Data</h3>
                      {editedData ? (
                        <div className="space-y-4">
                          {/* Patient Name */}
                          <ExtractionField
                            label="Patient Name"
                            confidence={editedData.fieldConfidence?.patientName}
                          >
                            <Input
                              value={editedData.patientName || ''}
                              onChange={(e) => setEditedData({ ...editedData, patientName: e.target.value })}
                              className={cn('h-8 text-sm', getConfidenceBorder(editedData.fieldConfidence?.patientName || 0) && `border ${getConfidenceBorder(editedData.fieldConfidence?.patientName || 0)}`)}
                            />
                          </ExtractionField>

                          {/* National ID */}
                          <ExtractionField
                            label="National ID"
                            confidence={editedData.fieldConfidence?.nationalId}
                          >
                            <Input
                              value={editedData.nationalId || ''}
                              onChange={(e) => setEditedData({ ...editedData, nationalId: e.target.value })}
                              className={cn('h-8 text-sm', getConfidenceBorder(editedData.fieldConfidence?.nationalId || 0) && `border ${getConfidenceBorder(editedData.fieldConfidence?.nationalId || 0)}`)}
                            />
                          </ExtractionField>

                          {/* Payer */}
                          <ExtractionField
                            label="Payer"
                            confidence={editedData.fieldConfidence?.payerName}
                          >
                            <Select
                              value={editedData.payerId || editedData.payerName || 'SELF_PAY'}
                              onValueChange={(val) => {
                                const payerMap: Record<string, { name: string; type: 'NHIA' | 'PRIVATE' | 'SELF_PAY' }> = {
                                  NHIA: { name: 'NHIA - Universal Health Insurance', type: 'NHIA' },
                                  MEDRIGHT: { name: 'MedRight TPA', type: 'PRIVATE' },
                                  GLOBEMED: { name: 'Globemed Egypt', type: 'PRIVATE' },
                                  NEXTCARE: { name: 'Nextcare Egypt', type: 'PRIVATE' },
                                  SELF_PAY: { name: 'Self-Pay', type: 'SELF_PAY' },
                                };
                                const p = payerMap[val] || payerMap.SELF_PAY;
                                setEditedData({ ...editedData, payerName: p.name, payerType: p.type, payerId: val });
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NHIA">NHIA</SelectItem>
                                <SelectItem value="MEDRIGHT">MedRight</SelectItem>
                                <SelectItem value="GLOBEMED">Globemed</SelectItem>
                                <SelectItem value="NEXTCARE">Nextcare</SelectItem>
                                <SelectItem value="SELF_PAY">Self-Pay</SelectItem>
                              </SelectContent>
                            </Select>
                          </ExtractionField>

                          {/* Service Date */}
                          <ExtractionField
                            label="Service Date"
                            confidence={editedData.fieldConfidence?.serviceDate}
                          >
                            <Input
                              type="date"
                              value={editedData.serviceDate || ''}
                              onChange={(e) => setEditedData({ ...editedData, serviceDate: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </ExtractionField>

                          {/* Total Amount */}
                          <ExtractionField
                            label="Total Amount (EGP)"
                            confidence={editedData.fieldConfidence?.totalAmount}
                          >
                            <Input
                              type="number"
                              value={editedData.totalAmount || ''}
                              onChange={(e) => setEditedData({ ...editedData, totalAmount: Number(e.target.value) || 0 })}
                              className={cn('h-8 text-sm', getConfidenceBorder(editedData.fieldConfidence?.totalAmount || 0) && `border ${getConfidenceBorder(editedData.fieldConfidence?.totalAmount || 0)}`)}
                            />
                          </ExtractionField>

                          {/* Department */}
                          <ExtractionField
                            label="Department"
                            confidence={editedData.fieldConfidence?.department}
                          >
                            <Input
                              value={editedData.department || ''}
                              onChange={(e) => setEditedData({ ...editedData, department: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </ExtractionField>

                          {/* Procedure Codes */}
                          <ExtractionField
                            label="Procedure Codes (CPT)"
                            confidence={editedData.fieldConfidence?.procedureCodes}
                          >
                            <Input
                              value={editedData.procedureCodes?.join(', ') || ''}
                              onChange={(e) => setEditedData({
                                ...editedData,
                                procedureCodes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                              })}
                              className="h-8 text-sm"
                              placeholder="Comma-separated CPT codes"
                            />
                          </ExtractionField>

                          {/* Diagnosis Codes */}
                          <ExtractionField
                            label="Diagnosis Codes (ICD-10)"
                            confidence={editedData.fieldConfidence?.diagnosisCodes}
                          >
                            <Input
                              value={editedData.diagnosisCodes?.join(', ') || ''}
                              onChange={(e) => setEditedData({
                                ...editedData,
                                diagnosisCodes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                              })}
                              className="h-8 text-sm"
                              placeholder="Comma-separated ICD-10 codes"
                            />
                          </ExtractionField>

                          {/* Prior Auth Required */}
                          <div className="flex items-center justify-between gap-4">
                            <Label className="text-xs font-medium">Prior Auth Required</Label>
                            <Switch
                              checked={editedData.priorAuthRequired || false}
                              onCheckedChange={(val) => setEditedData({ ...editedData, priorAuthRequired: val })}
                            />
                          </div>

                          {/* Prior Auth Number */}
                          {editedData.priorAuthRequired && (
                            <ExtractionField label="Prior Auth Number" confidence={editedData.fieldConfidence?.priorAuthNumber}>
                              <Input
                                value={editedData.priorAuthNumber || ''}
                                onChange={(e) => setEditedData({ ...editedData, priorAuthNumber: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </ExtractionField>
                          )}

                          {/* Attending Physician */}
                          <ExtractionField
                            label="Attending Physician"
                            confidence={editedData.fieldConfidence?.attendingPhysician}
                          >
                            <Input
                              value={editedData.attendingPhysician || ''}
                              onChange={(e) => setEditedData({ ...editedData, attendingPhysician: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </ExtractionField>

                          {/* Facility Name */}
                          <ExtractionField
                            label="Facility Name"
                            confidence={editedData.fieldConfidence?.facilityName}
                          >
                            <Input
                              value={editedData.facilityName || ''}
                              onChange={(e) => setEditedData({ ...editedData, facilityName: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </ExtractionField>

                          {/* Encounter Type */}
                          <ExtractionField label="Encounter Type" confidence={editedData.fieldConfidence?.encounterType}>
                            <Select
                              value={editedData.encounterType || ''}
                              onValueChange={(val) => setEditedData({ ...editedData, encounterType: val })}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Inpatient">Inpatient</SelectItem>
                                <SelectItem value="Outpatient">Outpatient</SelectItem>
                                <SelectItem value="Emergency">Emergency</SelectItem>
                              </SelectContent>
                            </Select>
                          </ExtractionField>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No extracted data available</p>
                          <p className="text-xs text-muted-foreground">Extraction may still be in progress or has failed.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="p-4 border-t bg-muted/30 flex items-center justify-between gap-2">
                  <Button variant="destructive" size="sm" onClick={handleReject}>
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Reject
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSaveReview}>
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                      Save & Review Later
                    </Button>
                    <Button size="sm" onClick={handleSubmitAsClaim} disabled={!editedData}>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit as Claim
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Configure Dialog */}
        <Dialog open={configureDialogOpen} onOpenChange={setConfigureDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Virtual Printer Setup</DialogTitle>
              <DialogDescription>
                Configure a virtual printer on hospital workstations to automatically send claim PDFs to the Ingestion Hub.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Installation Steps</h4>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
                  <li>Install the Veebase Virtual Printer driver on each workstation</li>
                  <li>Configure the printer to point to: <code className="bg-muted px-1 py-0.5 rounded">\\veebase-server\ingest-print\</code></li>
                  <li>Set default template in printer preferences</li>
                  <li>When staff &quot;prints&quot; a claim, select &quot;Veebase PDF Ingest&quot; as the printer</li>
                </ol>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Download</h4>
                <Button variant="outline" size="sm" className="w-full" onClick={() => toast.info('Driver download would start here in production')}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Download Virtual Printer Driver (Windows)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ==================== Extraction Field Component ====================
function ExtractionField({
  label,
  confidence,
  children,
}: {
  label: string;
  confidence?: number;
  children: React.ReactNode;
}) {
  const hasConfidence = confidence !== undefined && confidence > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {hasConfidence && (
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', getConfidenceBg(confidence))} />
            <span className={cn('text-[10px] font-medium', getConfidenceColor(confidence))}>
              {confidence}%
            </span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
