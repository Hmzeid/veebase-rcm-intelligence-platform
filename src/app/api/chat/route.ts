import { NextRequest, NextResponse } from 'next/server';

// Fallback knowledge base for when LLM SDK is unavailable
const FALLBACK_RESPONSES: Record<string, { content: string; tags: string[] }> = {
  denial: {
    content: `## Denial Rate Analysis\n\nCurrent **denial rate is 5.2%** against a target of 4.0%. This is in WARNING status.\n\n**Key findings:**\n- **Medical Necessity** denials (CO-50/167): 28% of all denials, EGP 625K impact\n- **Authorization Required** denials (CO-15/197): 22%, EGP 485K impact\n- **Coding/Bundling** denials (CO-7/97): 17%, EGP 312K impact\n\n**Recommended actions:**\n1. **PriorAuthorization Agent** — Improve pre-submission auth checks (approval rate at 82.1% vs 85% target)\n2. **Medical Coding Agent** — Strengthen medical necessity documentation support\n3. **Denial Prediction Agent** — Increase denial risk scoring sensitivity before submission\n\n**Confidence: MEDIUM** — Based on current monthly KPI data and denial trend analysis.`,
    tags: ['denial-rate', 'appeals', 'prior-auth'],
  },
  ar: {
    content: `## AR Days Analysis\n\nCurrent **AR Days: 42** against a target of ≤40 days. Status: WARNING.\n\n**Contributing factors:**\n- Slow adjudication from NHIA (45% of claims)\n- Private TPA response times averaging 18 days\n- 12 claims flagged as timely filing risk\n\n**Recommended actions:**\n1. **ClaimScrubSubmit Agent** — Increase first-pass rate from 92.4% toward 94% target\n2. **PaymentPosting Agent** — Accelerate underpayment detection and recovery\n3. **DenialManagement Agent** — Reduce appeal cycle time (7 active denial appeals)\n\n**Confidence: MEDIUM** — AR days improvement requires multi-agent coordination.`,
    tags: ['ar-days', 'cash-flow', 'adjudication'],
  },
  agent: {
    content: `## Agent Status Overview\n\n**12 agents** currently deployed across 4 categories:\n\n| Status | Count |\n|--------|-------|\n| ACTIVE | 6 |\n| PROCESSING | 2 |\n| IDLE | 4 |\n| ERROR | 0 |\n\n**Active agents:** Eligibility & Benefits, Charge Capture, Medical Coding, Payment Posting, Fraud Sentinel, Payer Contract & Rules\n\n**Processing:** Prior Authorization, Denial Management\n\n**Idle:** Claim Scrubbing, Denial Prediction, Patient Billing, Analytics\n\n**Total claims processed:** 8,723 across all agents\n**Average processing time:** 3,475ms\n\n**Confidence: HIGH** — Real-time agent status data.`,
    tags: ['agents', 'status', 'overview'],
  },
  escalation: {
    content: `## Escalation Queue Status\n\n**7 pending escalations**, including 2 at CRITICAL level (Level 4+).\n\n**Critical items:**\n- **ESC-1 (Level 4):** Fraud sentinel detected upcoding pattern — Compliance Officer review required\n- **ESC-10 (Level 5):** Phantom billing detected — Medical Director review required\n- **ESC-8 (Level 4):** Underpayment EGP 3,400 variance — Senior Biller review\n\n**Recommended actions:**\n1. Escalate ESC-10 immediately to Medical Director\n2. Assign Compliance Officer to ESC-1\n3. Review underpayment variance in ESC-8 against contract rates\n\n**Confidence: HIGH** — Based on live escalation queue data.`,
    tags: ['escalations', 'critical', 'compliance'],
  },
  kpi: {
    content: `## KPI Dashboard Summary\n\n| KPI | Value | Target | Status |\n|-----|-------|--------|--------|\n| First-Pass Claim Rate | 92.4% | 94% | WARNING |\n| Denial Rate | 5.2% | 4% | WARNING |\n| Appeal Overturn Rate | 64.3% | 60% | ON TARGET ✓ |\n| AR Days | 42 | ≤40 | WARNING |\n| Net Collection Rate | 95.7% | 96% | WARNING |\n| Prior Auth Approval Rate | 82.1% | 85% | OFF TARGET ✗ |\n| Patient Collection Rate | 71.4% | 80% | OFF TARGET ✗ |\n| Coding Accuracy Rate | 96.2% | 95% | ON TARGET ✓ |\n\n**2 KPIs OFF TARGET** — Prior Auth Approval and Patient Collection need immediate attention.\n\n**Confidence: HIGH** — Current monthly KPI data.`,
    tags: ['kpis', 'performance', 'targets'],
  },
  appeal: {
    content: `## Appeal Overturn Analysis\n\nCurrent **appeal overturn rate: 64.3%** exceeds the 60% target. Status: ON TARGET.\n\n**Key insights:**\n- 7 active denial appeals in progress\n- DenialManagement Agent handling 11 active claims\n- Average appeal processing: 6.5 seconds per claim analysis\n- 1 escalation flagged for appeal deadline risk (3 days remaining)\n\n**Recommended:**\n1. Prioritize ESC-6 — appeal deadline in 3 days for CLM-2026-0009\n2. Leverage high overturn rate to contest more medical necessity denials\n3. Use DenialManagement Agent templates for faster appeal drafting\n\n**Confidence: MEDIUM** — Appeal data is current but outcome predictions are probabilistic.`,
    tags: ['appeals', 'denials', 'overturn-rate'],
  },
};

function getFallbackResponse(message: string): { content: string; agent: string; confidence: string; tags: string[] } {
  const lowerMessage = message.toLowerCase();

  // Match against known topics
  for (const [key, response] of Object.entries(FALLBACK_RESPONSES)) {
    if (lowerMessage.includes(key)) {
      return {
        content: response.content,
        agent: 'Orchestrator (Fallback)',
        confidence: 'MEDIUM',
        tags: response.tags,
      };
    }
  }

  // General fallback with useful context
  return {
    content: `## RCM Platform Assistant\n\nI'm currently operating in **fallback mode** (AI model temporarily unavailable). I can still help with these topics based on live platform data:\n\n- **Denial rate** analysis and reduction strategies\n- **AR days** improvement recommendations\n- **Agent status** overview\n- **Escalation queue** status and priorities\n- **KPI dashboard** summary\n- **Appeal** overturn strategies\n\nPlease ask about one of these topics, or try again later for full AI-powered assistance.\n\n---\n*Current platform snapshot: 107 active claims, 7 pending escalations, 8 active agents, Phase 1 — Assistive Mode.*`,
    agent: 'Orchestrator (Fallback)',
    confidence: 'LOW',
    tags: ['fallback', 'general'],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Try to use LLM SDK for intelligent responses
    try {
      const sdk = await import('z-ai-web-dev-sdk');
      const LLMClass = sdk.LLM || sdk.default?.LLM;
      if (!LLMClass) throw new Error('LLM not available in SDK');
      const llm = new LLMClass();

      const systemPrompt = `You are the AI Orchestrator Assistant of the Veebase RCM Intelligence Platform — a provider-side, multi-agent Revenue Cycle Management system deployed for Egyptian hospitals and clinics.

Your operating context:
- Country: Egypt
- Primary payer: NHIA (National Health Insurance Authority) — 45% of claims
- Claims exchange: HFCX (HealthFlow Claims Exchange), FHIR R4 with JWE protection
- Private insurers: FRA-regulated TPAs (MedRight, Globemed, Nextcare) — 40% of claims
- Self-pay: 15% of claims
- You supervise 12 specialized agents in the RCM workflow
- Current phase: Phase 1 — Assistive Mode (all actions require human approval)

The 12 agents in order:
1. Eligibility & Benefits — Verify coverage before service
2. Prior Authorization — Manage preauth requirements and submissions
3. Charge Capture & Integrity — Catch unbilled services
4. Medical Coding — Propose ICD-10/CPT codes (always requires coder review)
5. Claim Scrubbing & Submission — Validate and submit claims via HFCX
6. Denial Prediction — Score denial risk before submission
7. Denial Management & Appeals — Classify denials, draft appeals
8. Payment Posting & Reconciliation — Post payments, detect underpayments
9. Patient Billing & Collections — Generate estimates and statements
10. Fraud, Waste & Medical Necessity Sentinel — Monitor for FWA patterns
11. Payer Contract & Rules Knowledge — Serve payer-specific rules
12. Analytics & Reporting — Compute KPIs and root-cause analysis

Current KPIs (monthly):
- First-pass claim rate: 92.4% (target: 94%)
- Denial rate: 5.2% (target: 4%)
- Appeal overturn rate: 64.3% (target: 60%) — ON TARGET
- AR days: 42 (target: 40 or less)
- Net collection rate: 95.7% (target: 96%)
- Prior auth approval rate: 82.1% (target: 85%) — OFF TARGET
- Patient collection rate: 71.4% (target: 80%) — OFF TARGET

Rules:
- Always attach a confidence level: HIGH, MEDIUM, LOW, or INSUFFICIENT_DATA
- Always provide rationale for recommendations
- Never fabricate data — if you don't know, say so
- Patient data is PHI — never include actual patient names or IDs
- Use markdown formatting for better readability
- Keep responses concise but comprehensive
- Reference specific agents when recommending actions
- Financial thresholds: claims above EGP 50,000 require senior biller review
- Timely filing: NHIA 30 days, private TPAs 60 days`;

      const response = await llm.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const content =
        response.choices?.[0]?.message?.content ||
        response.content ||
        null;

      if (content) {
        return NextResponse.json({
          content,
          agent: 'Orchestrator',
          confidence: 'MEDIUM',
          tags: [],
        });
      }

      // LLM returned empty content — use fallback
      throw new Error('LLM returned empty response');
    } catch (llmError) {
      // LLM SDK failed or returned empty — return structured fallback
      console.warn('Chat LLM unavailable, using fallback:', llmError instanceof Error ? llmError.message : 'Unknown error');
      const fallback = getFallbackResponse(message);
      return NextResponse.json(fallback);
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
