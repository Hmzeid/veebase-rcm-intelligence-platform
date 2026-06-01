'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  Shield,
  FileText,
  AlertTriangle,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  agent?: string;
  confidence?: string;
  tags?: string[];
}

const suggestedQueries = [
  {
    icon: Shield,
    label: 'Check claim CLM-2026-0005 status',
    query: 'What is the current status of claim CLM-2026-0005? Why was it denied and what is the appeal strategy?',
  },
  {
    icon: AlertTriangle,
    label: 'Show top denial reasons',
    query: 'What are the top denial reasons this month and how can we prevent them?',
  },
  {
    icon: BarChart3,
    label: 'Revenue collection report',
    query: 'Give me a summary of this month\'s revenue collection performance by payer type.',
  },
  {
    icon: FileText,
    label: 'Prior auth requirements',
    query: 'What are the prior authorization requirements for NHIA cardiology procedures?',
  },
];

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: `Welcome to the **Veebase RCM AI Assistant**. I can help you with:

• **Claim status** — Look up any claim and its current pipeline stage
• **Denial analysis** — Identify root causes and appeal strategies
• **Payer rules** — Query NHIA and private TPA requirements
• **KPI summaries** — Get performance insights and recommendations
• **Agent operations** — Understand what each agent is doing

I operate in **Phase 1 — Assistive Mode**. I propose findings and recommendations; a human operator approves before any action is taken. How can I help?`,
    timestamp: new Date().toISOString(),
    agent: 'Orchestrator',
  },
];

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (query?: string) => {
    const message = query || input.trim();
    if (!message || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) throw new Error('Chat API error');

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-resp`,
        role: 'assistant',
        content: data.content || 'I apologize, but I was unable to process your request. Please try again.',
        timestamp: new Date().toISOString(),
        agent: data.agent || 'Orchestrator',
        confidence: data.confidence,
        tags: data.tags,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Fallback response when API is unavailable
      const fallbackMsg: ChatMessage = {
        id: `msg-${Date.now()}-fallback`,
        role: 'assistant',
        content: generateFallbackResponse(message),
        timestamp: new Date().toISOString(),
        agent: 'Orchestrator',
        confidence: 'MEDIUM',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)]">
      {/* Suggested queries */}
      {messages.length <= 1 && (
        <div className="p-4 md:p-6 max-w-3xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestedQueries.map((q, idx) => {
              const Icon = q.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(q.query)}
                  className="flex items-center gap-3 p-3 rounded-lg border text-left hover:bg-accent/50 transition-colors"
                >
                  <Icon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs">{q.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto space-y-4 py-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isLoading && (
            <div className="flex items-center gap-3 p-4">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <Bot className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Analyzing...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-card p-4 md:px-6">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about claims, denials, payer rules, KPIs..."
            className="h-10"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Phase 1 — Assistive Mode · All recommendations require human approval
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-emerald-100 dark:bg-emerald-900'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4 text-emerald-600" />
        )}
      </div>
      <div
        className={cn(
          'flex-1 max-w-[85%] space-y-2',
          isUser && 'flex flex-col items-end'
        )}
      >
        <div
          className={cn(
            'rounded-xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 border'
          )}
        >
          {message.content.split('\n').map((line, i) => (
            <p key={i} className={cn(i > 0 && 'mt-2')}>
              {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={j}>{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </p>
          ))}
        </div>

        {/* Agent metadata */}
        {!isUser && (message.agent || message.confidence || message.tags) && (
          <div className="flex items-center gap-2 flex-wrap">
            {message.agent && (
              <Badge variant="outline" className="text-[9px] h-4">
                {message.agent}
              </Badge>
            )}
            {message.confidence && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] h-4',
                  message.confidence === 'HIGH' && 'border-emerald-300 text-emerald-700',
                  message.confidence === 'MEDIUM' && 'border-amber-300 text-amber-700',
                  message.confidence === 'LOW' && 'border-red-300 text-red-700',
                  message.confidence === 'INSUFFICIENT_DATA' && 'border-gray-300 text-gray-600'
                )}
              >
                {message.confidence}
              </Badge>
            )}
            {message.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[9px] h-4 border-orange-300 text-orange-700">
                {tag.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function generateFallbackResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('clm-2026-0005') || q.includes('claim') && q.includes('status')) {
    return `**Claim CLM-2026-0005 — Status Analysis**

**Current Status:** DENIED

**Denial Details:**
• Denial Code: CO-15 (Authorization Required)
• Payer: NHIA
• Amount: EGP 12,800
• Service Date: Recent cardiology procedure

**Root Cause:** Prior authorization was denied by NHIA due to insufficient clinical documentation supporting medical necessity.

**Appeal Strategy (Strategy B — Clinical Appeal):**
1. Collect additional clinical notes from the attending cardiologist
2. Attach peer-reviewed guidelines supporting the procedure's necessity
3. Submit clinical appeal within the 30-day appeal window
4. The Prior Authorization Agent has flagged this for immediate follow-up

**Confidence:** MEDIUM — The appeal success rate for this denial category with NHIA is approximately 58%.

**Recommended Action:** Escalate to clinical team (L3) to obtain supporting documentation before the appeal deadline.`;
  }

  if (q.includes('denial') && (q.includes('reason') || q.includes('top'))) {
    return `**Top Denial Reasons — Current Month**

1. **Medical Necessity (CO-50/167)** — 42 claims, EGP 625K (28%)
   Mitigation: Improve clinical documentation quality before submission

2. **Authorization Required (CO-15/197)** — 31 claims, EGP 485K (22%)
   Mitigation: Strengthen pre-service auth verification in Eligibility Agent

3. **Coding/Bundling (CO-7/97)** — 25 claims, EGP 312K (17%)
   Mitigation: Enhance NCCI bundling checks in Claim Scrubbing Agent

4. **Eligibility (CO-4/16)** — 22 claims, EGP 198K (15%)
   Mitigation: Improve demographic verification at registration

**Estimated Recoverable Revenue:** EGP 890,000 through appeals and corrected resubmissions.

**Recommended Priority:** Focus on medical necessity denials first — they have the highest value and 64% appeal overturn rate.`;
  }

  if (q.includes('revenue') || q.includes('collection') || q.includes('financial')) {
    return `**Revenue Collection Summary — Current Month**

| Payer | Billed | Collected | Rate |
|-------|--------|-----------|------|
| NHIA | EGP 2.4M | EGP 2.04M | 85.0% |
| Private TPAs | EGP 2.15M | EGP 1.94M | 90.2% |
| Self-Pay | EGP 350K | EGP 175K | 50.0% |
| **Total** | **EGP 4.9M** | **EGP 4.15M** | **84.7%** |

**Key Insights:**
• Self-pay collection rate is significantly below target (50% vs 80%)
• NHIA collection rate impacted by claim denials and contractual adjustments
• Private TPA collection is closest to target

**Net Collection Rate:** 95.7% (Target: 96%) — WARNING

**AR Days:** 42 (Target: ≤40) — Needs attention

**Recommended Actions:**
1. Improve self-pay upfront estimates and collection follow-up
2. Address NHIA underpayments through PaymentPosting Agent disputes
3. Reduce AR days by expediting claim submission for held claims`;
  }

  if (q.includes('prior auth') || q.includes('authorization') || q.includes('auth')) {
    return `**Prior Authorization Requirements — NHIA Cardiology**

**Procedures Requiring Prior Auth:**
• CPT 27447 (Total knee replacement) — Required
• CPT 27130 (Total hip replacement) — Required
• CPT 33533 (Coronary bypass) — Required
• CPT 93306 (Echocardiography) — NOT required (outpatient)
• CPT 93458 (Cardiac catheterization) — Required

**NHIA Authorization Process:**
1. Submit FHIR Claim (use=preauthorization) via HFCX
2. Include: clinical notes, lab results, prior treatment records
3. NHIA SLA: 72 hours for response
4. PreAuthRef number must be stored and included on claim submission

**Common Denial Reasons for Cardiology Auth:**
• Missing clinical note attachments (38% of denials)
• Step therapy not documented (24%)
• Insufficient medical necessity evidence (22%)

**Current Auth Approval Rate:** 82.1% (Target: 85%) — OFF_TARGET

**Recommendation:** The Prior Authorization Agent's evidence checklist for cardiology orders needs updating to require clinical note attachments before submission.`;
  }

  return `I can help you analyze claims, denials, payer rules, and KPI performance across the RCM pipeline. Here are some areas I can assist with:

• **Claim lookup** — Ask about any specific claim number
• **Denial analysis** — Understand denial patterns and prevention strategies
• **Payer rules** — Query NHIA and TPA-specific requirements
• **Performance metrics** — Get KPI summaries and root-cause analysis
• **Agent operations** — Understand what each of the 12 agents is doing

What would you like to explore?`;
}
